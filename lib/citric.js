/*
 * citric.js
 *
 * This file is part of citric - Minimalistic IRC library for Node.js
 * © Copyright Massimo Neri 2014
 *
 * This library is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this library. If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

var EventEmitter = require('events').EventEmitter,
    net = require('net'),
    readline = require('readline'),
    replies = require('./replies'),
    tls = require('tls'),
    util = require('util');

module.exports.Client = Client;

function Client() {
    var self = this,
        connection = null,
        mode = {
            'away': false,
            'invisible': false,
            'wallops': false,
            'restricted': false,
            'operator': false,
            'localOperator': false,
            'serverNotices': false
        },
        nick = null,
        state = 'closed';

    Object.defineProperty(self, 'mode', {
        get: function() { return mode },
        set: undefined
    });

    Object.defineProperty(self, 'nick', {
        get: function() { return nick },
        set: undefined
    });

    Object.defineProperty(self, 'state', {
        get: function() { return state },
        set: undefined
    });

    // Override this method and provide your auth mechanisms. This function is automatically
    // called just before NICK and USER commands. Don't call this function directly.
    self._auth = function (auth) {
        if (auth.type == 'simple' && auth.password) {
            self.send('PASS', auth.password);
        } else if (auth.type == 'nickserv' && auth.password) {
            self.once('register', function () {
                self.send('PRIVMSG', 'NickServ', 'identify ' + auth.password);
            });
        } else if (auth.type == 'sasl') {
            // TODO
        }
    };

    // Start a connection with an IRC server
    self.connect = function (options, callback) {
        var buffer = '',
            defaults = {
                host: null,       // Mandatory
                port: null,       // Not mandatory, guessed from the secure field.
                secure: false,    // TODO: Probably should be true by default
                encoding: 'utf8',
                nick: null,       // Mandatory
                user: null,       // Mandatory
                real: null,
                auth: {
                    type: 'simple',
                    password: null
                }
            };

        // Check for mandatory options
        if (!options.host || !options.nick || !options.user || !options.real)
            throw new Error('You must supply at least a host, a nick, a user and a real name!');

        // Merge default options and user provided options.
        Object.keys(defaults).forEach(function (key) {
            if (options[key] == undefined) options[key] = defaults[key];
        });

        if (typeof callback == 'function')
            self.on('connect', callback);

        if (options.secure) {
            connection = tls.connect({
                host: options.host,
                port: options.port ? options.port : 6697
            }, function() {
                // This sucks. tls module emits the event 'secureConnect' instead of 'connect'.
                // Here we force a 'connect' event to be fired.
                connection.emit('connect');
            });
        } else {
            connection = net.createConnection({
                host: options.host,
                port: options.port ? options.port : 6667
            });
        }

        connection.setTimeout(0);
        connection.setEncoding(options.encoding);
        connection.on('close', function () {
            state = 'closed';
            self.emit('close');
        });
        // This will capture both 'connect' and 'secureConnect' events.
        connection.on('connect', function () {
            var reader = readline.createInterface({
                input: connection,
                output: connection
            });

            // Parse the message and emit the event.
            reader.on('line', function (line) {
                var message = self._parseLine(line),
                    args = [];

                // Translate the reply code (e.g. '005') in the reply sting (e.g. 'RPL_WELCOME')
                // as in replies.js
                if (replies[message.type])
                    message.type = replies[message.type];

                args.push(message.type);
                // The first argument to the event handler is always an object describing the sender.
                // The subsequent arguments depend on the type of the message.
                args.push({
                    nick: message.nick,
                    user: message.user,
                    host: message.host
                });
                args = args.concat(message.params);
                self.emit.apply(self, args);
            });

            state = 'connected';
            self.emit('connect');
            self._auth(options.auth);
            self.send('NICK', options.nick);
            self.send('USER', options.user, 8, '*', options.real);
        });
    };

    self._parseLine = function (line) {
        var message = {},
            start = 0,
            end = 0,
            trailing = false; // Is this the last argument (begins with ':')?

        // **I tried to do things without regular expressions**

        // Initialize all the fields. This is a little optimization for V8, I think
        message.nick = null;
        message.user = null;
        message.host = null;
        message.type = 'UNKNOWN';
        message.params = [];

        // If the line starts with ':' there is a prefix
        if (line[0] == ':') {
            start = end = 1; // Ignore ':'
            // Nick ends with '!' or ' '
            while (line[end] != '!' && line[end] != ' ') end++;
            message.nick = line.substring(1, end);

            // If there's a '!' we have the username
            if (line[end] == '!') {
                start = ++end; // Ignore '!'
                // Username ends with '@' or ' '
                while (line[end] != '@' && line[end] != ' ') end++;
                message.user = line.substring(start, end);
            }

            // If there's a '@' we have the host name
            if (line[end] == '@') {
                start = ++end;
                // Host name ends with ' '
                while (line[end] != ' ') end++;
                message.host = line.substring(start, end);
            }

            while (line[end] != ' ') end++;
            start = ++end;
        }

        // There is always a command. The command ends with ' ' or '\r\n'
        while (line[end] != ' ' && end < line.length) end++;
        message.type = line.substring(start, end);

        // Check if we have parameters
        if (end < line.length) {
            start = ++end; // Ignore ' '

            while (end < line.length && !trailing) {
                if (line[end] == ' ') {
                    message.params.push(line.substring(start, end));
                    start = end + 1;
                } else if (line[end] == ':') {
                    trailing = true;
                }

                end++;
            }

            if (trailing) start++;
            message.params.push(line.substring(start));
        }

        return message;
    };

    self.send = function (command) {
        var args = Array.prototype.slice.call(arguments),
            trailing = args[args.length - 1].toString(); // Because we treat it as a string

        // We want to add a semicolon to the last argument, if necessary.
        if (trailing == '' || trailing[0] == ':' || trailing.indexOf(' ') != -1)
            args[args.length - 1] = ':' + trailing;

        connection.write(args.join(' ') + '\r\n');
    };

    self.on('MODE', function(from, to, specs) {
        var i,
            translations = {
                'a': 'away',
                'i': 'invisible',
                'w': 'wallops',
                'r': 'restricted',
                'o': 'operator',
                'O': 'localOperator',
                's': 'serverNotices'
            },
            value;

        // We handle our user mode only
        if (to == nick) {
            for (i = 0; i < specs.length; i++) {
                if (specs[i] == ' ') {
                    // Ignore spaces
                } if (specs[i] == '+') {
                    value = true;
                } else if (specs[i] == '-') {
                    value = false;
                } else {
                    // We provide long names for standard modes (defined in
                    // https://tools.ietf.org/html/rfc2812#section-3.1.5). If mode is non standard,
                    // we use the character as it is.
                    if (translations[specs[i]])
                        mode[translations[specs[i]]] = value;
                    else
                        mode[specs[i]] = value;
                }
            }
        }
    });

    self.on('NICK', function(from, newNick) {
        if (from.nick == nick) nick = newNick;
    });

    self.on('PING', function (from, string) {
        self.send('PONG', string);
    });

    // Unfortunately, the command AWAY does not result in a MODE reply. We must set
    // the away flag here.
    self.on('RPL_NOWAWAY', function() {
        mode.away = true;
    });

    self.on('RPL_UNAWAY', function() {
        mode.away = false;
    });

    self.on('RPL_WELCOME', function () {
        nick = arguments[1];
        state = 'registered';
        self.emit('register');
    });
};

util.inherits(Client, EventEmitter);