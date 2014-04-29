citric - A minimalistic IRC library
======
citric is a minimalistic libray for building IRC clients, bots and bouncers in Node.js.
It provides only basic IRC functionalities: connect, disconnect, send and receive
messages.

Basic Usage
======
In the simplest case you can connect to an IRC server like so:

    var citric = require('/path/to/citric.js'),
        client;

    connection = new citric.Connection();
    connection.start({
        host: 'irc.freenode.net',
        nick: 'jdoe',
        user: 'jdoe',
        real: 'John Doe'
    });

Sending Messages
======
There are many convenience methods, one for every IRC command. For example:

    connection.join('#bots');
    connection.privmsg('#bots', 'Hello, world!');
    connection.part('#bots', 'Goodbye, all!');

A list of supported commands can be found in `lib/commands.js`. A semicolon to the last
parameter is automatically added if necessary.

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

Everytime a message is received a `'line'` event is also emitted. Callbacks to this event
receive as the only argument the line sent by the server.

Events
======
There are four main state events:

* `connect`: when the connection is established;
* `close`: emitted when the connection is closed.
* `error`: when an error occours;
* `register`: when the registration process has been completed;

Options
======
When starting a connection you can provide an option parameter that should specify:

* `host`: _mandatory_, specify the address of the server;
* `port`: if not specified the port is guessed on the basis of `secure` field;
* `secure`: boolean, true if you want secure connection;
* `encoding`: defaults to the string 'utf8';
* `nick`: _mandatory_, the nickname;
* `user`: _mandatory_, the username;
* `real`: _mandatory_, the real name of the user;
* `auth`: the authentication method to use;
* `timeout`: specify the socket timeout.

The `auth` parameter is an object that specify the authentication method. In the simplest
case it is:

    auth: {
        type: 'simple',
        password: null
    }

Actually only `simple` and `nickserv`, and `sasl` methods are supported. For `sasl` you
should supply additional parameters:

    auth: {
        type: 'sasl',
        nick: 'jdoe',
        user: 'jdoe',
        password: 'supersecretpassword'
    }

Other Features
======
The `client` maintains the state of the connection. There are three methods you can access:

* `state()`: the state of the connection (`closed`, `connected`, `registered`);
* `nick()`: user's current nickname;
* `user()`: username
* `real()`: user's real name;
* `mode()`: user's current mode flags.

Note that the name of the methods `nick()`, `user()` and `mode()` conflict with the name of
the convenience methods for the IRC commands `NICK`, `USER` and `MODE`. If you call these
methods with no parameters you get the actual value of the nickname, username and the user
mode flags set. If you call these methods with parameters you send commands to the server.

Further Documentation
======
Read [RFC1459](http://tools.ietf.org/html/rfc1459.html) and [RFC2812](https://tools.ietf.org/html/rfc2812).