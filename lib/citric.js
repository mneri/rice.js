/*
 * citric.js
 *
 * This file is part of citric - Minimalistic IRC library for Node.js
 * © Copyright Massimo Neri 2014 <hello@mneri.me>
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

var commands = require('./commands'),
    EventEmitter = require('events').EventEmitter,
    net = require('net'),
    parser = require('./parser'),
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
        user = null,
        real = null,
        state = 'closed';

    // Add all the convenience methods to send commands (like privmsg(), join() and
    // part()). These methods are automatically generated from the specifications in
    // commands.js.
    Object.keys(commands).forEach(function(command) {
        self[command.toLowerCase()] = function() {
            var body = '',
                i,
                trailing = arguments[arguments.length - 1];

            // TODO: Check the parameters, if in debug mode
            // Join parameters from first to second-last. Then check if we need a colon
            // and join the last parameter.
            for (i = 0; i < arguments.length - 1; i++)
                body += ' ' + arguments[i];

            if (trailing == '' || trailing[0] == ':' || trailing.indexOf(' ') != -1)
                trailing = ':' + trailing;

            body += ' ' + trailing;
            self.sendRaw(command + body + '\r\n');
        }
    });

    // We want the methods mode(), nick() and user() to return respectively the actual user mode
    // flags, the actual user's nick and the username. Unfortunately, the names mode(), nick()
    // and user() confict with the methods to send commands to the server (namely MODE, NICK and
    // USER). So, let's create a wrapper around them. If we invoke one of those methods with no
    // parameters, we return the value of interest, else we invoke the proper function.

    self.mode = (function() {
        var func = self.mode;
        return function() { return !arguments.length ? mode : func.apply(self, arguments); };
    })();

    self.nick = (function() {
        var func = self.nick;
        return function() { return !arguments.length ? nick : func.apply(self, arguments); };
    })();

    self.user = (function() {
        var func = self.user;
        return function() { return !arguments.length ? user : func.apply(self, arguments); };
    })();

    self.real = function() {
        return real;
    };

    self.state = function() {
        return state;
    };

    // Override this method and provide your auth mechanisms. This function is automatically
    // called just before NICK and USER commands. Don't call this function directly.
    self._auth = function (auth) {
        if (auth.type == 'simple' && auth.password) {
            self.pass(auth.password);
        } else if (auth.type == 'nickserv' && auth.password) {
            self.once('register', function () {
                self.privmsg('NickServ', 'identify ' + auth.password);
            });
        } else if (auth.type == 'sasl') {
            self.cap('REQ', 'sasl');
            // Since we only asked for sasl, we don't need to check the list of capabilities
            self.once('cap', function(from, x, ack) {
                if (ack == 'ACK') {
                    self.sendRaw('AUTHENTICATE PLAIN\r\n');
                    self.once('authenticate', function() {
                        var body = new Buffer(auth.nick + '\0' + auth.user + '\0' + auth.password);
                        self.sendRaw('AUTHENTICATE ' + body.toString('base64') + '\r\n');
                    });
                    self.once('rpl_saslsuccess', function() {
                        self.cap('END');
                    });
                }
            });
        }
    };

    // Start a connection with an IRC server
    self.startConnection = function (options, callback) {
        var buffer = '',
            defaults = {
                host: null,
                port: null,       // Not mandatory, guessed from the secure field.
                secure: false,    // TODO: Probably should be true by default
                encoding: 'utf8',
                nick: null,
                user: null,
                real: null,
                auth: {
                    type: 'simple',
                    password: null
                },
                timeout: 90000
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

        connection.setTimeout(options.timeout);
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
                var message;

                self.emit('line', line);
                message = parser.parseLine(line);

                // Translate the reply code (e.g. '005') in the reply sting (e.g. 'RPL_WELCOME')
                // as in replies.js
                if (replies[message.type])
                    message.type = replies[message.type];

                // The first argument to the event handler is always an object describing the sender.
                // The subsequent arguments are the parameters of the message.
                self.emit.apply(self,
                    [message.type.toLowerCase()].concat({
                        nick: message.nick,
                        user: message.user,
                        host: message.host
                    }, message.params)
                );
            });

            user = options.user;
            real = options.real;
            state = 'connected';
            self.emit('connect');
            self._auth(options.auth);
            self.nick(options.nick);
            self.user(options.user, 8, '*', options.real);
        });
        connection.on('error', function() {
            self.emit('error'); // TODO: This conflicts with the event generated by the 'ERROR' message.
                                // but probably it's not important.
        });
        connection.on('timeout', function() {
            self.ping((new Date()).toString());
        });
    };

    self.sendRaw = function(string) {
        connection.write(string);
    };

    self.on('mode', function(from, to, specs) {
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

    self.on('nick', function(from, newNick) {
        if (from.nick == nick) nick = newNick;
    });

    self.on('ping', function (from, string) {
        self.pong(string);
    });

    // Unfortunately, the command AWAY does not result in a MODE reply. We must set
    // the away flag here.
    self.on('rpl_nowaway', function() {
        mode.away = true;
    });

    self.on('rpl_unaway', function() {
        mode.away = false;
    });

    self.on('rpl_welcome', function () {
        nick = arguments[1];
        state = 'registered';
        self.emit('register');
    });
};

util.inherits(Client, EventEmitter);