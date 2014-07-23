/*
 * linereader.js
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

var EventEmitter = require('events').EventEmitter,
    util = require('util');

function LineReader(input) {
    var self = this,
        buffer = '';

    input.on('data', function(chunk) {
        var i,
            lines;

        buffer += chunk;
        lines = buffer.split('\r\n');
        buffer = lines.pop();

        for (i = 0; i < lines.length; i++)
            self.emit('line', lines[i]);
    });
};

util.inherits(LineReader, EventEmitter);
module.exports = LineReader;