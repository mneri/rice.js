/*
 * parser.js
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

module.exports.parseLine = function(line) {
    var end = 0,
        key,
        message = {
            tags: {},
            nick: null,
            user: null,
            host: null,
            type: 'UNKNOWN',
            params: []
        },
        start = 0,
        trailing = false,
        value;

    // If we encounter '@' there is a tag section
    if (line[start] == '@') {
        start = ++end; // Ignore '@'

        while (line[end] != ' ') {
            if (line[end] == '=') {
                key = line.substring(start, end);
                start = ++end;
            } else if (line[end] == ';') {
                if (key) {
                    value = line.substring(start, end);
                } else {
                    key = line.substring(start, end);
                    value = true;
                }

                message.tags[key] = value;
                key = null;
                start = ++end;
            } else {
                end++;
            }
        }

        if (start != end) {
            if (key) {
                value = line.substring(start, end);
            } else {
                key = line.stubstring(start, end);
                value = true;
            }

            message.tags[key] = value;
        }

        start = ++end;
    }

    // If we encounter ':' there is the prefix
    if (line[start] == ':') {
        start = ++end; // Ignore ':'
        // Nick ends with '!' or ' '
        while (line[end] != '!' && line[end] != ' ') end++;
        message.nick = line.substring(start, end);

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