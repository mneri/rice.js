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

    // Add all the convenience methods to send commands (like privmsg(), join() and part()).
    commands.forEach(function(command) {
        self[command.toLowerCase()] = function() {
            var body = '',
                i,
                trailing = arguments[arguments.length - 1];

            // Join parameters from first to second-last. Then check if we need a colon
            // and join the last parameter.
            for (i = 0; i < arguments.length - 1; i++)
                body += ' ' + arguments[i];

            if (trailing === '' || trailing[0] === ':' || trailing.indexOf(' ') !== -1)
                trailing = ':' + trailing;

            body += ' ' + trailing;
            self.send(command + body);
        }
    });

    self.host = function() {
        return host;
    };

    // We want the methods mode(), nick() and user() to return the actual user mode flags, the
    // actual user's nick and the username respectively. Unfortunately, the names mode(), nick()
    // and user() confict with the names of the methods for the commands MODE, NICK and USER).
    // So, let's create a wrapper around them. If we invoke one of those methods with no
    // parameters, we return the value of interest, else we invoke the proper function.

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

    self.real = function() {
        return real;
    };

    self.state = function() {
        return state;
    };

    self.end = function() {
        connection.end();
    };

    self.send = function(string) {
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

                // Translate the reply code (e.g. '005') in the reply sting (e.g. 'RPL_WELCOME')
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

            // Switch authentication method
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
