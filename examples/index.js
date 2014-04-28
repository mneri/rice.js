/*
 * index.js
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

var citric = require('../lib/citric.js'),
    client,
    options = {
        host: 'irc.freenode.net',
        nick: 'bot' + parseInt(Math.random() * 1000),
        user: 'jdoe',
        real: 'John Doe',
        auth: {
            type: 'simple',
            password: null
        }
    };

// Create a client and connect to the network
client = new citric.Client();
client.startConnection(options);

// There are 3 main events: connect (when the connection starts), register (when
// the registration process ends) and close (when the connection is being
// closed)

// Autojoin a channel.
client.on('register', function () {
    client.join('#bots515');
});

// Every message generates an event. The first parameter is always an object
// that describes the sender of the message (nick, user, host), the subsequent
// parameters are the ones specified by the RFC. For example, PRIVMSG (as in
// https://tools.ietf.org/html/rfc2812#section-3.3.1) receives two extra
// parameters: the receiver of the message and the text; JOIN (as in
// https://tools.ietf.org/html/rfc2812#section-3.2.1) receives one extra
// parameter: the channel the user joined.

// If the nickname is already in use we pick another random one
client.on('ERR_NICKNAMEINUSE', function () {
    client.nick('bot' + parseInt(Math.random() * 1000));
});

client.on('ERROR', function (from, error) {
    console.log(error);
});

// Every time a user join a channel we say hello.
client.on('JOIN', function (from, channel) {
    var message;

    if (from.nick == client.nick()) {
        console.log('I joined #bots515');
    } else {
        console.log(from.nick + ' joined #bots');
        message = 'Hello, ' + from.nick + '!';
        client.privmsg('#bots515', message);
        console.log(message);
    }
});

// Log the messages from the server
client.on('NOTICE', function (from, to, message) {
    console.log(from.nick + ': ' + message);
});

// Log the messages from the users
client.on('PRIVMSG', function (from, to, message) {
    console.log(from.nick + ': ' + message);
});