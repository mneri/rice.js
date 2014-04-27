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

var EventEmitter = require('events').EventEmitter,
    net = require('net'),
    readline = require('readline'),
    replies = require('./replies'),
    tls = require('tls'),
    util = require('util');

module.exports.Client = Client;

function Client(options) {
    var self = this;

    self.connection = null;
    self.nick = null;
    self.state = 'closed';
    self.options = {
        host: null,       // Mandatory
        port: null,       // Not mandatory, guessed from the secure field.
        encoding: 'utf8',
        nick: null,       // Mandatory
        user: null,       // Mandatory
        real: null,
        auth: {
            type: 'simple',
            password: null
        }
    };

    // Merge default options and user provided options.
    Object.keys(self.options).forEach(function (key) {
        if (options[key] != undefined)
            self.options[key] = options[key];
    });

    // Check for mandatory options
    if (!self.options.host || !self.options.nick || !self.options.user || !self.options.real)
        throw new Error('You must supply at least a host, a nick, a user and a real name!');

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
    self.connect = function (callback) {
        var buffer = '';

        if (typeof callback == 'function')
            self.on('connect', callback);

        self.connection = net.createConnection({
            host: self.options.host,
            port: self.options.port ? self.options.port : 6667
        });
        self.connection.setTimeout(0);
        self.connection.setEncoding(self.options.encoding);
        self.connection.on('close', function () {
            self.state = 'closed';
            self.emit('close');
        });
        self.connection.on('connect', function () {
            var reader = readline.createInterface({
                input: self.connection,
                output: self.connection
            });

            // Parse the message and emit the event.
            reader.on('line', function (line) {
                var message = self._parseLine(line),
                    args = [];

                if (replies[message.type])
                    message.type = replies[message.type];

                args.push(message.type);
                args.push({
                    nick: message.nick,
                    user: message.user,
                    host: message.host
                });
                args = args.concat(message.params);
                self.emit.apply(self, args);
            });

            self.state = 'connected';
            self.emit('connect');
            self._auth(self.options.auth);
            self.send('NICK', self.options.nick);
            self.send('USER', self.options.user, 8, '*', self.options.real);
        });
    };

    self._parseLine = function (line) {
        var message = {},
            start = 0,
            end = 0,
            trailing = false; // Is this the last argument (begins with ':')?

        // Initialize all the fields. This is a little optimization for V8, I think.
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
                while (line[end] != '@' && line[end] != ' ') {
                    end++;
                }
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

        self.connection.write(args.join(' ') + '\r\n');
    };

    self.on('NICK', function(from, nick) {
        if (self.nick == from.nick) self.nick = nick;
    });

    self.on('PING', function (from, string) {
        self.send('PONG', string);
    });

    self.on('RPL_WELCOME', function () {
        self.nick = arguments[1];
        self.state = 'registered';
        self.emit('register');
    });
};

util.inherits(Client, EventEmitter);