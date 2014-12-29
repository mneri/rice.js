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

var capabilities = require('./capabilities'),
    commands = require('./commands'),
    EventEmitter = require('events').EventEmitter,
    net = require('net'),
    parser = require('./parser'),
    linereader = require('./linereader'),
    replies = require('./replies'),
    tls = require('tls'),
    util = require('util');

function Connection(opts) {
    var self = this,
        autoBounce,
        autoNickChange,
        availableChannelModes = [],
        currentCapabilities = [],
        currentHost,
        encoding,
        host,
        hostCapabilities,
        ignores,
        ircd,
        loginMode,
        mode = {},
        nick,
        pass,
        port,
        user,
        real,
        secure,
        socket,
        state = 'closed',
        timeout,
        wantedCapabilities,
        wantedNick;

    var options = {
            autoBounce: true,
            autoNickChange: true,
            capabilities: capabilities,
            encoding: 'utf8',
            extras: {},
            host: null,
            ignores: [],
            mode: '8',
            nick: null,
            pass: null,
            port: null,
            user: null,
            real: null,
            secure: true,
            timeout: 5 * 60 * 1000
        };

    (function _construct(opts) {
        // Check for mandatory options
        if (!opts.host || !opts.nick || !opts.user || !opts.real)
            throw new Error('You must supply at least a host, a nick, a user and a real name!');

        // Merge default options and user provided options.
        Object.keys(opts).forEach(function(key) {
            options[key] = opts[key];
        });

        autoBounce = options.autoBounce;
        encoding = options.encoding;
        self.extra = options.extras;
        host = options.host;
        ignores = (options.ignores instanceof Array ? options.ignores : [options.ignores]);
        loginMode = options.mode;
        pass = options.pass;
        port = (options.port ? options.port : (options.secure ? 6697 : 6667));
        real = options.real;
        secure = options.secure;
        timeout = options.timeout;
        user = options.user;
        wantedCapabilities = (options.capabilities instanceof Array ? options.capabilities : [options.capabilities]);
        wantedNick = options.nick;
    })(opts);

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
        // The commands variable (from require('./commands');) contains the list
        // of all IRC commands. For every command we add a function.
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
    // 1) The list of the active capabilities
    // 2) The list of user's modes
    // 3) The actual nickname
    // 4) The actual username
    //
    // If you pass at least one parameter to these methods, the corresponding
    // command is sent to the IRC server.

    self.cap = (function() {
        var func = self.cap;
        return function() { return !arguments.length ? currentCapabilities : func.apply(self, arguments); };
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

    // Get the encoding for the current connection
    self.encoding = function() {
        return encoding;
    };

    // End the connection
    self.end = function() {
        socket.end();
    };

    // Get the name of the host this connection is connected to
    self.host = function() {
        return host;
    };

    // Ignore further messages from this nickname
    self.ignore = function(nick) {
        ignores.push(nick);
    };

    // Get the name of the host's ircd
    self.ircd = function() {
        return ircd;
    }

    // Undo an ignore
    self.mind = function(nick) {
        ignores.splice(ignores.indexOf(nick), 1);
    };

    // Get the user's real name
    self.real = function() {
        return real;
    };

    // Send a line to the IRC server. The characters '\r\n' are automatically
    // added if necessary.
    self.send = function(string) {
        // Force the parameter to be a string
        if (typeof string !== 'string')
            string = "" + string;

        // Add a trailing '\r\n' if necessary.
        if (string.indexOf('\r\n') == -1)
            string += '\r\n';

        socket.write(string);
    };

    // Start a connection with an IRC server
    self.start = function(callback) {
        // Executed on 'connect' or 'secureConnect' (in case of SSL) socket
        // event.
        function onconnection() {
            var reader = new linereader(socket);

            // If on SSL and authorization process fails close the connection.
            if (secure && !socket.authorized) {
                self.emit('error', socket.authorizationError);
                socket.end();
                return;
            }

            // Parse the message and emit the event.
            reader.on('line', function(line) {
                var args,
                    message;

                message = parser.parseLine(line);

                if (ignores.indexOf(message.nick) != -1)
                    return;

                self.emit('line', line);

                // Translate the reply code (e.g. '005') in the reply string
                // (e.g. 'RPL_WELCOME') as in replies.js
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

            state = 'connected';
            self.emit('connect');
            self.cap('LS');

            if (pass)
                self.pass(auth.password);

            self.nick(wantedNick);
            self.user(user, loginMode, '*', real);
        }

        if (typeof callback === 'function')
            self.on('connect', callback);

        if (secure) {
            socket = tls.connect({
                host: host,
                port: port ? port : 6697
            }, onconnection);
        } else {
            socket = net.createConnection({
                host: host,
                port: port ? port : 6667
            }, onconnection);
        }

        socket.setTimeout(timeout);
        socket.setEncoding(encoding);
        socket.on('close', function() {
            socket = null;
            mode = {};
            state = 'closed';
            self.emit('close');
        });
        socket.on('error', function(err) {
            self.emit('error', err);
        });
        socket.on('timeout', function() {
            self.ping((new Date()).toString());
        });
    };

    // Get the connection's state, one of:
    //  1) closed     2) connected  3) registered
    self.state = function() {
        return state;
    };

    self.on('authenticate', function() {
        var body = new Buffer(wantedNick + '\0' + user + '\0' + pass);
        self.send('AUTHENTICATE ' + body.toString('base64'));
    });

    self.on('cap', function(from, to, sub, caps) {
        if (sub == 'ACK') {
            caps.split(/\s+/).forEach(function(cap) {
                if (cap.indexOf('-') == 0) {
                    cap = cap.substring(1);
                    currentCapabilities.splice(currentCapabilities.indexOf(cap), 1);
                } else {
                    cap = cap.replace(/[-~=]/, '');
                    currentCapabilities.push(cap);
                }
                
            });
        }
    });

    self.on('cap', function(from, to, sub, caps) {
        var capsToRequire,
            i;

        if (state == 'connected') {
            switch (sub) {
                case 'ACK':
                    if (currentCapabilities.indexOf('sasl') >= 0)
                        self.send('AUTHENTICATE PLAIN');
                    else
                        self.cap('END');

                    break;
                case 'LS':
                    hostCapabilities = caps.split(/\s+/);
                    capsToRequire = wantedCapabilities.slice();

                    for (i = 0; i < capsToRequire.length; i++) {
                        if (hostCapabilities.indexOf(capsToRequire[i]) == -1) {
                            capsToRequire.splice(i, 1);
                            i--;
                        }
                    }

                    if (!pass && capsToRequire.indexOf('sasl') != -1)
                        capsToRequire.splice(capsToRequire.indexOf('sasl'), 1);

                    if (capsToRequire.length == 0)
                        self.cap('END');
                    else
                        self.cap('REQ', capsToRequire.join(' '));

                    break;
            }
        }
    });

    // When a MODE message is received, update the user's modes
    self.on('mode', function(from, to, specs) {
        var i,
            m,
            value;

        // We handle our user mode only
        if (to == nick) {
            for (i = 0; i < specs.length; i++) {
                m = specs[i];

                if (m === ' ') ; // Ignore spaces
                else if (m === '+') value = true;
                else if (m === '-') value = false;
                else mode[m] = value;
            }
        }
    });

    // Update the user's nickname
    self.on('nick', function(from, newNick) {
        if (from.nick === nick) nick = newNick;
    });

    self.on('ping', function(from, string) {
        self.pong(string);
    });

    self.on('rpl_bounce', function(from, to, text) {
        var matches,
            regexp;

        if (options.autoBounce) {
            regexp = /Try server (.+), port (\d+)/i
            matches = regexp.exec(text);

            if (matches) {
                host = matches[1];
                port = matches[2];
                self.emit('bounce');
                self.stop();
                self.start(options);
            }
        }
    });

    // Automatically change the user's nickname
    (function() {
        var tries = 0;

        self.on('err_nicknameinuse', function() {
            if (state === 'connected' && autoNickChange)
                nick(wantedNick + ++tries);
        });
    })();

    self.on('rpl_myinfo', function(from, to, host, version, umodes, cmodes) {
        var i;

        currentHost = host;
        ircd = version;

        for (i = 0; i < umodes.length; i++)
            mode[umodes[i]] = false;

        for (i = 0; i < cmodes.length; i++)
            availableChannelModes.push(cmodes[i]);

        state = 'registered';
        self.emit('register');
    });

    self.on('rpl_saslsuccess', function() {
        if (state === 'connected')
            cap('END');
    });

    self.on('rpl_welcome', function() {
        nick = arguments[1];
    });
};

util.inherits(Connection, EventEmitter);
module.exports.Connection = Connection;
