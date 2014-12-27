libirc-client - A complete IRC library for building IRC clients
======
libirc-client is a complete libray for building IRC clients, bots and bouncers in Node.js.
It provides basic IRC functionalities: connect, disconnect, send and receive messages.

Basic Usage
======
In the simplest case you can connect to an IRC server like so:

    var irc = require('/path/to/lib/index.js'),
        connection;

    connection = new irc.Connection({
        host: 'irc.freenode.net',
        nick: 'jdoe',
        user: 'jdoe',
        real: 'John Doe'
    });
    connection.start();

Sending Messages
======
There are many convenience methods, one for every IRC command. For example:

    connection.join('#bots');
    connection.privmsg('#bots', 'Hello, world!');
    connection.part('#bots', 'Goodbye, all!');

A list of supported commands can be found in `lib/commands.js`. A semicolon to the last
parameter is automatically added if necessary.

You can also send raw lines with the `send()` method. The string `'\r\n'` is
automatically appended if not present.

Receiving Messages
======
Every message received emits an event. You must register to the event in order to
handle the message. The name of the event is the name of the command as specified in
the [RFC](https://tools.ietf.org/html/rfc2812) but lowercase. For example:

    connection.on('privmsg', function(from, to, message) {
        console.log(from + ': ' + message);
    });
    connection.on('rpl_nowaway', function() {
        console.log('You are now away');
    });

The first parameter to the callback is an object describing the sender (`nick`, `user`,
`host`). The subsequent parameters depend on the type of the message.

Everytime a message is received a `'line'` event is emitted. Callbacks to this event
receive as the only argument the line sent by the server.

Events
======
There are five main state events:

* `bounce`: when the connection is bounced to another server;
* `connect`: when the connection is established;
* `close`: emitted when the connection is closed;
* `error`: when an error occours;
* `register`: when the registration process has been completed.

Options
======
When starting a connection you can provide an option parameter that should specify:

* `autoBounce`: reconnects automatically to another host on bounce;
* `autoNickChange`: automatically send NICK commands on conflicts;
* `capabilities`: array of IRCv3 capabilities to request;
* `encoding`: defaults to the string 'utf8';
* `host`: _mandatory_, specify the address of the server;
* `ignores`: array of nicknames to ignore;
* `mode`: mode to set on login;
* `pass`: user's password;
* `port`: if not specified the port is guessed on the basis of `secure` field;
* `nick`: _mandatory_, the nickname;
* `user`: _mandatory_, the username;
* `real`: _mandatory_, the real name of the user;
* `secure`: boolean, true if you want secure connection;
* `timeout`: specify the socket timeout.

Other Features
======
The `client` maintains the state of the connection. There are many methods you can access:

* `cap()`: current active capabilities;
* `encoding()`: socket's encoding;
* `host()`: host's name;
* `ircd()`: irc daemon name of the host;
* `mode()`: user's current mode flags;
* `nick()`: user's current nickname;
* `real()`: user's real name;
* `state()`: the state of the connection (`closed`, `connected`, `registered`);
* `user()`: username.

Note that the name of the methods `cap()`, `nick()`, `user()` and `mode()` are in conflict
with the name of the methods for the IRC commands `NICK`, `USER` and `MODE`. If you call
these methods with no parameters you get the actual value of the nickname, username and
the user mode flags set. If you call these methods with at least one parameter you send
commands to the server.

Further Documentation
======
Read [RFC1459](http://tools.ietf.org/html/rfc1459.html) and [RFC2812](https://tools.ietf.org/html/rfc2812).