/*
 * umodes.js
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

module.exports = {
	'austhex': {
		'a': 'ERRORS',
		'h': 'HELPER',
		'l': 'LISTALL',
		't': 'Z_LINED',
		'T': 'W_LINED',
		'v': 'HOST_HIDING'
	},
	'bahamut': {
		'a': 'SERVICES_ADMIN',
		'A': 'SERVER_ADMIN',
		'b': 'CHATOPS',
		'd': 'DEBUG',
		'f': 'FLOODS',
		'g': 'GLOBOPS',
		'h': 'HELPER',
		'k': 'KILLS',
		'm': 'SPAMBOTS',
		'n': 'ROUTING',
		'r': 'REGISTERED',
		'R': 'NO_NON_REGISTERED',
		'y': 'STATS_LINKS'
	},
	'hybrid-ircd': {
		'a': 'ADMIN',
		'b': 'BOTS',
		'c': 'CLIENT_CONNS',
		'd': 'DEBUG',
		'f': 'FULL',
		'g': 'CALLERID',
		'k': 'KILLS',
		'l': 'LOCOPS',
		'n': 'NCHANGE',
		'r': 'REJ',
		'u': 'UNAUTH',
		'x': 'EXTERNAL',
		'y': 'SPY',
		'z': 'OPERWALL'
	},
	'ircu': {
		'd': 'DEAF',
		'g': 'DEBUG',
		'k': 'SERVICE',
		'r': 'REGISTERED',
		's': 'SERVER_NOTICES',
		'x': 'HOST_HIDING'
	},
	'kine-ircd': {
		'd': 'DEAF',
		'g': 'CALLERID',
		'h': 'HELPER',
		'R': 'NO_NON_REGISTERED',
		's': 'SERVER_NOTICES'
	},
	'rfc2812': {
		'a': 'AWAY',
		'i': 'INVISIBLE',
		'o': 'OPERATOR',
		'O': 'LOCAL_OPERATOR',
		'r': 'RESTRICTED_CONNECTION',
		's': 'SERVER_NOTICES',
		'w': 'WALLOPS'
	},
	'unreal': {
		'a': 'SERVICES_ADMIN',
		'A': 'SERVER_ADMIN',
		'b': 'CHATOPS',
		'B': 'BOT',
		'C': 'CO_ADMIN',
		'G': 'STRIP_BAD_WORDS',
		'H': 'HIDE_OPER',
		'I': 'INVISIBLE_JOINPART',
		'N': 'NETWORK_ADMIN',
		'p': 'HIDE_CHANNELS',
		'q': 'KIX',
		'R': 'NO_NON_REGISTERED',
		'S': 'SERVICE',
		't': 'MODIFIED_HOST',
		'T': 'BLOCK_CTCP',
		'v': 'VICTIM',
		'V': 'WEBTV',
		'W': 'WHOIS_PARANOIA',
		'x': 'HOST_HIDING',
		'z': 'SECURE_CONN'
	}
};
