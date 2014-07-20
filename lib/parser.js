/*
 * parser.js
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

module.exports.parseLine = function(line) {
    var c,
        end = 0,
        key,
        length = line.length,
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
    if (line.charCodeAt(start) === 64) {
        start = ++end; // Ignore '@'

        while ((c = line.charCodeAt(end)) !== 32 && end < length) { // space
            if (c === 61) { // '='
                key = line.substring(start, end);
                start = ++end;
            } else if (c === 59) { // ';'
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
                key = line.substring(start, end);
                value = true;
            }

            message.tags[key] = value;
        }

        start = ++end;
    }

    // If we encounter ':' there is the prefix
    if (line.charCodeAt(start) === 58) {
        start = ++end; // Ignore ':'
        // Nick ends with '!' or space
        while ((c = line.charCodeAt(end)) !== 33 && c !== 32 && end < length) end++;
        message.nick = line.substring(start, end);

        // If there's a '!' we have the username
        if (line.charCodeAt(end) === 33) {
            start = ++end; // Ignore '!'
            // Username ends with '@' or space
            while ((c = line.charCodeAt(end)) !== 64 && c !== 32 && end < length) end++;
            message.user = line.substring(start, end);
        }

        // If there's a '@' we have the host name
        if (line.charCodeAt(end) === 64) {
            start = ++end;
            // Host name ends with space
            while (line.charCodeAt(end) !== 32 && end < length) end++;
            message.host = line.substring(start, end);
        }

        // Skip white spaces
        do { end++; } while (line.charCodeAt(end) === 32 && end < length);
        start = end;
    }

    // There is always a command. The command ends with ' ' or '\r\n'
    while (line.charCodeAt(end) !== 32 && end < length) end++;
    message.type = line.substring(start, end);

    // Skip white spaces
    do { end++; } while (line.charCodeAt(end) === 32 && end < length);
    start = end;

    // Check if we have parameters
    if (end < length) {
        do {
            if ((c = line.charCodeAt(end)) === 32) { // space
                // If start == end, then we have more than one space. We want to skip extra spaces.
                if (start < end)
                    message.params.push(line.substring(start, end));

                start = end + 1;
            } else if (c === 58) { // ':'
                trailing = true;
            }

            end++;
        } while (end < length && !trailing);

        if (trailing) start++; // Skip ':'
        message.params.push(line.substring(start));
    }

    return message;
};
