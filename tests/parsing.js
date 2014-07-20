/*
 * parsing.js
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

var parser = require('../lib/parser'),
    should = require('should'),
    vows = require('vows');

vows.describe("Message parsing").addBatch({
    "A parsed message like": {

        "'FOO'": {
            topic: parser.parseLine("FOO"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: null,
                    user: null,
                    host: null,
                    type: 'FOO',
                    params: []
                });
            }
        },

        "'FOO ' (trailing space)": {
            topic: parser.parseLine("FOO "),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: null,
                    user: null,
                    host: null,
                    type: 'FOO',
                    params: []
                });
            }
        },

        "'FOO bar'": {
            topic: parser.parseLine("FOO bar"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: null,
                    user: null,
                    host: null,
                    type: 'FOO',
                    params: [ 'bar' ]
                });
            }
        },

        "'FOO  bar' (double space)": {
            topic: parser.parseLine("FOO  bar"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: null,
                    user: null,
                    host: null,
                    type: 'FOO',
                    params: [ 'bar' ]
                });
            }
        },

        "'FOO bar ' (trailing space)": {
            topic: parser.parseLine("FOO bar "),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: null,
                    user: null,
                    host: null,
                    type: 'FOO',
                    params: [ 'bar' ]
                });
            }
        },

        "'FOO bar baz'": {
            topic: parser.parseLine("FOO bar baz"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: null,
                    user: null,
                    host: null,
                    type: 'FOO',
                    params: [ 'bar', 'baz' ]
                });
            }
        },

        "'FOO bar  baz' (double space)": {
            topic: parser.parseLine("FOO bar baz"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: null,
                    user: null,
                    host: null,
                    type: 'FOO',
                    params: [ 'bar', 'baz' ]
                });
            }
        },

        "'FOO bar baz qux'": {
            topic: parser.parseLine("FOO bar baz qux"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: null,
                    user: null,
                    host: null,
                    type: 'FOO',
                    params: [ 'bar', 'baz', 'qux' ]
                });
            }
        },

        "'FOO bar :baz qux'": {
            topic: parser.parseLine("FOO bar :baz qux"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: null,
                    user: null,
                    host: null,
                    type: 'FOO',
                    params: [ 'bar', 'baz qux' ]
                });
            }
        },

        "'FOO bar  :baz qux' (double space)": {
            topic: parser.parseLine("FOO bar :baz qux"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: null,
                    user: null,
                    host: null,
                    type: 'FOO',
                    params: [ 'bar', 'baz qux' ]
                });
            }
        },

        "':lorem FOO'": {
            topic: parser.parseLine(":lorem FOO"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: 'lorem',
                    user: null,
                    host: null,
                    type: 'FOO',
                    params: []
                });
            }
        },

        "':lorem!ipsum FOO'": {
            topic: parser.parseLine(":lorem!ipsum FOO"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: 'lorem',
                    user: 'ipsum',
                    host: null,
                    type: 'FOO',
                    params: []
                });
            }
        },

        "':lorem!ipsum@dolor FOO'": {
            topic: parser.parseLine(":lorem!ipsum@dolor FOO"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: 'lorem',
                    user: 'ipsum',
                    host: 'dolor',
                    type: 'FOO',
                    params: []
                });
            }
        },

        "':lorem!ipsum@dolor  FOO' (double space)": {
            topic: parser.parseLine(":lorem!ipsum@dolor FOO"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: {},
                    nick: 'lorem',
                    user: 'ipsum',
                    host: 'dolor',
                    type: 'FOO',
                    params: []
                });
            }
        },

        "'@foo :lorem!ipsum@dolor FOO'": {
            topic: parser.parseLine("@foo :lorem!ipsum@dolor FOO"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: { foo: true },
                    nick: 'lorem',
                    user: 'ipsum',
                    host: 'dolor',
                    type: 'FOO',
                    params: []
                });
            }
        },

        "'@foo; :lorem!ipsum@dolor FOO'": {
            topic: parser.parseLine("@foo; :lorem!ipsum@dolor FOO"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: { foo: true },
                    nick: 'lorem',
                    user: 'ipsum',
                    host: 'dolor',
                    type: 'FOO',
                    params: []
                });
            }
        },

        "'@foo=bar :lorem!ipsum@dolor FOO'": {
            topic: parser.parseLine("@foo=bar :lorem!ipsum@dolor FOO"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: { foo: 'bar' },
                    nick: 'lorem',
                    user: 'ipsum',
                    host: 'dolor',
                    type: 'FOO',
                    params: []
                });
            }
        },

        "'@foo=bar; :lorem!ipsum@dolor FOO'": {
            topic: parser.parseLine("@foo=bar; :lorem!ipsum@dolor FOO"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: { foo: 'bar' },
                    nick: 'lorem',
                    user: 'ipsum',
                    host: 'dolor',
                    type: 'FOO',
                    params: []
                });
            }
        },

        "'@foo;bar :lorem!ipsum@dolor FOO'": {
            topic: parser.parseLine("@foo;bar :lorem!ipsum@dolor FOO"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: { foo: true, bar: true },
                    nick: 'lorem',
                    user: 'ipsum',
                    host: 'dolor',
                    type: 'FOO',
                    params: []
                });
            }
        },

        "'@foo;bar=baz :lorem!ipsum@dolor FOO'": {
            topic: parser.parseLine("@foo;bar=baz :lorem!ipsum@dolor FOO"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: { foo: true, bar: 'baz' },
                    nick: 'lorem',
                    user: 'ipsum',
                    host: 'dolor',
                    type: 'FOO',
                    params: []
                });
            }
        },

        "'@foo;bar=baz; :lorem!ipsum@dolor FOO'": {
            topic: parser.parseLine("@foo;bar=baz; :lorem!ipsum@dolor FOO"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: { foo: true, bar: 'baz' },
                    nick: 'lorem',
                    user: 'ipsum',
                    host: 'dolor',
                    type: 'FOO',
                    params: []
                });
            }
        },

        "'@foo;bar=baz;  :lorem!ipsum@dolor FOO' (double space)": {
            topic: parser.parseLine("@foo;bar=baz; :lorem!ipsum@dolor FOO"),
            "shold be": function(topic) {
                return should(topic).eql({
                    tags: { foo: true, bar: 'baz' },
                    nick: 'lorem',
                    user: 'ipsum',
                    host: 'dolor',
                    type: 'FOO',
                    params: []
                });
            }
        }

    }
}).run();
