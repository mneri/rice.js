/*
 * index.js
 *
 * This file is part of libirc-client
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

module.exports.Connection = Connection;

function Connection() {
    var self = this,
        connection = null,
        host = null,
        mode = {},
        nick = null,
        user = null,
        real = null,
        state = 'closed',
        supported = [];

    // Add all the convenience methods to send messages:
    //  1) cap        2) info       3) invite     4) help       5) ison
    //  6) join       7) kick       8) kill       9) list      10) mode
    // 11) motd      12) names     13) notice    14) nick      15) oper
    // 16) part      17) pass      18) ping      19) pong      20) privmsg
    // 21) quit      22) time      23) topic     24) trace     25) user
    // 26) userhost  27) users     28) version   29) wallops   30) who
    // 31) whois     32) whowas
    //
    // Every method accepts as many arguments as specified by the corresponding
    // command in the RFC. For example:
    //     privmsg('#channel', 'Hello, world!'); // Send a message to a channel
    //     join('#channel');                     // Join a channel
    //     join('#channel', 'password');         // Join a channel with password
    //     part('#channel');                     // Exit a channel
    //     part('#channel', 'Goodbye, world!');  // Exit a channel with message
    //
    // Parameters are merged together and a colon to the last parameter is
    // automatically added if necessary.

    commands.forEach(function(command) {
        // The commands variable (from require('./commands');) contains the list of
        // all IRC commands. For every command we add a function.
        self[command.toLowerCase()] = function() {
            var body = '',
                i,
                trailing = arguments[arguments.length - 1];

            // Join parameters from first to second-last.
            for (i = 0; i < arguments.length - 1; i++)
                body += ' ' + arguments[i];

            // Check if the last parameter needs to be preceded by a colon
            if (trailing === '' || trailing[0] === ':' || trailing.indexOf(' ') !== -1)
                trailing = ':' + trailing;

            body += ' ' + trailing;
            self.send(command + body);
        }
    });

    // The following methods are overridden:
    //  1) cap        2) mode       3) nick       4) user
    //
    // If invoked with no parameters they return:
    // 1) The list of the server's capabilities
    // 2) The list of user's modes
    // 3) The actual nickname
    // 4) The actual username
    //
    // If you pass at least one parameter to these methods, the corresponding command is sent
    // to the IRC server.

    self.cap = (function() {
        var func = self.cap;
        return function() { return !arguments.length ? supported : func.apply(self, arguments); };
    })();

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

    // Get the name of the host this connection is connected to.
    self.host = function() {
        return host;
    };

    // Get the user's real name
    self.real = function() {
        return real;
    };

    // Get the connection's state, one of:
    //  1) closed     2) connected  3) registered
    self.state = function() {
        return state;
    };

    // End the connection
    self.end = function() {
        connection.end();
    };

    // Send a line to the IRC server. The characters '\r\n' are automatically added
    // if necessary.
    self.send = function(string) {
        // Force the parameter to be a string
        if (typeof string !== 'string')
            string = "" + string;

        // Add a trailing '\r\n' if necessary.
        if (string.indexOf('\r\n') == -1)
            string += '\r\n';

        connection.write(string);
    };

    // Start a connection with an IRC server
    self.start = function(options, callback) {
        var buffer = '',
            defaults = {
                host: null,
                port: null,       // Not mandatory, guessed from the secure field.
                secure: false,    // Notice that SSL is not enabled by default
                encoding: 'utf8',
                caps: {},
                nick: null,
                user: null,
                real: null,
                auth: {
                    type: 'simple',
                    password: null
                },
                timeout: 90000
            };

        // Executed on 'connect' or 'secureConnect' (in case of SSL) socket event.
        function onconnection() {
            var reader;

            // If on SSL and authorization process fails close the connection.
            if (options.secure && !connection.authorized) {
                self.emit('error', connection.authorizationError);
                connection.end();
                return;
            }

            reader = readline.createInterface({
                input: connection,
                output: connection
            });

            // Parse the message and emit the event.
            reader.on('line', function(line) {
                var args,
                    message;

                self.emit('line', line);
                message = parser.parseLine(line);

                // Translate the reply code (e.g. '005') in the reply string (e.g. 'RPL_WELCOME')
                // as in replies.js
                if (replies[message.type])
                    message.type = replies[message.type];

                args = [message.type.toLowerCase()].concat({
                    nick: message.nick,
                    user: message.user,
                    host: message.host
                }, message.params, message.tags);
                self.emit('message', args);
                self.emit.apply(self, args);
            });

            user = options.user;
            real = options.real;
            state = 'connected';
            self.emit('connect');
            self.cap('LS');

            // Switch authentication method. There are three supported authentication methods:
            // 1) 'simple': classic authentication process. A PASS command is sent to the server
            //     before the NICK and USER commands.
            // 2) 'nickserv': authentication via nickserv. After registration send an identify
            //    command to nickserv.
            // 3) 'sasl': authentication via SASL.
            if (options.auth.type === 'simple' && options.auth.password) {
                self.pass(auth.password);
            } else if (options.auth.type === 'nickserv' && options.auth.password) {
                self.once('register', function() {
                    self.privmsg('NickServ', 'identify ' + options.auth.password);
                });
            } else if (options.auth.type === 'sasl' && !options.caps.sasl) {
                options.caps.sasl = function(next) {
                    self.send('AUTHENTICATE PLAIN');
                    self.once('authenticate', function() {
                        var body = new Buffer(options.auth.nick + '\0' + options.auth.user + '\0' + options.auth.password);
                        self.send('AUTHENTICATE ' + body.toString('base64'));
                    });
                    self.once('rpl_saslsuccess', function() {
                        next();
                    });
                };
            }

            self.nick(options.nick);
            self.user(options.user, 8, '*', options.real);
        };

        // Check for mandatory options
        if (!options.host || !options.nick || !options.user || !options.real)
            throw new Error('You must supply at least a host, a nick, a user and a real name!');

        // Merge default options and user provided options.
        Object.keys(defaults).forEach(function(key) {
            if (options[key] == undefined) options[key] = defaults[key];
        });

        if (options.caps instanceof Array) {
            (function() {
                var caps = {};

                options.caps.forEach(function(name) {
                    caps[name] = null;
                });
                options.caps = caps;
            })();
        }

        if (typeof callback === 'function')
            self.on('connect', callback);

        if (options.secure) {
            connection = tls.connect({
                host: options.host,
                port: options.port ? options.port : 6697
            }, onconnection);
        } else {
            connection = net.createConnection({
                host: options.host,
                port: options.port ? options.port : 6667
            }, onconnection);
        }

        connection.setTimeout(options.timeout);
        connection.setEncoding(options.encoding);
        connection.on('close', function() {
            connection = host = nick = user = real = null;
            mode = {};
            state = 'closed';
            self.emit('close');
        });

        // TODO: This conflicts with the event generated by the 'ERROR' message.
        // but probably it's not important.
        connection.on('error', function() {
            self.emit('error');
        });

        connection.on('timeout', function() {
            self.ping((new Date()).toString());
        });

        self.on('cap', function(from, x, sub, caps) {
            var callbacks,
                i,
                request;

            // Handle the message if and only if it is received before registration.
            if (state === 'connected') {
                switch (sub) {
                case 'ACK':
                    callbacks = [];
                    i = 0;

                    caps.split(' ').forEach(function(name) {
                        var callback = options.caps[name];

                        if (typeof callback === 'function')
                           callbacks.push(callback);
                    });
                    callbacks.push(function() {
                        self.cap('END');
                    });

                    (function next() {
                        if (i < callbacks.length)
                            callbacks[i++](next);
                    })();

                    break;
                case 'LS':
                    supported = caps.split(' ');
                    request = Object.keys(options.caps).filter(function(cap) {
                        if (caps.indexOf(cap) == -1) return false;
                        else return true;
                    });

                    if (request.length) self.cap('REQ', request.join(' '));
                    else self.cap('END');
                }
            }
        });

        self.on('mode', function(from, to, specs) {
            var i,
                m,
                value;

            // We handle our user mode only
            if (to == nick) {
                for (i = 0; i < specs.length; i++) {
                    m = specs[i];

                    if (m === ' ')
                        ; // Ignore spaces
                    else if (m === '+')
                        value = true;
                    else if (m === '-')
                        value = false;
                    else
                        mode[m] = value;
                }
            }
        });

        self.on('nick', function(from, newNick) {
            if (from.nick === nick) nick = newNick;
        });

        self.on('ping', function(from, string) {
            self.pong(string);
        });

        self.on('rpl_myinfo', function(from, to, server, version, umodes, cmodes) {
            var i;

            host = server;

            for (i = 0; i < umodes.length; i++)
                mode[umodes[i]] = false;
        });

        self.on('rpl_welcome', function() {
            nick = arguments[1];
            state = 'registered';
            self.emit('register');
        });
    };
};

util.inherits(Connection, EventEmitter);