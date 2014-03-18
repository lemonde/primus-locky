# primus-locky

Primus locky is a primus extension for [locky](https://github.com/neoziro/locky), it provides a room based locking.

This plugin requires [primus-emitter](https://github.com/cayasso/primus-emitter/), [primus-rooms](https://github.com/cayasso/primus-rooms/).


## Install

```
npm install primus-locky
```

## Usage

```js
var http = require('http');
var Locky = require('locky');
var Primus = require('primus');
var PrimusLocky = require('primus-locky');

var server = http.createServer();
var primus = new Primus(server, {
  locky: new Locky()
});

primus.use('locky', PrimusLocky);
```

### Options

Since primus-locky doesn't depends directly from [locky](https://github.com/neoziro/locky), you must inject a locky client in the options.


```js
new Primus(server, {
  locky: new Locky()
})
```

### Join room

You can find how to join a room in [primus-room](https://github.com/cayasso/primus-rooms#sparkjoinname-fn) plugin. To join a locky room, the only thing to do is to prefix it with `locky:`.

```js
// Join the room of the resource "article:13".
spark.join('locky:article:13');
```

## Room based locking

The room based locking principle is very simple, it can be resume in four rules:

- When a user joins a room:
  - if the room is empty, he takes the lock.
  - if the room is not empty, nothing.
- When a user leaves a room:
  - if he was alone in the room, nothing.
  - if there is other persons in the room, a random user takes the lock.

## Events

The events are emitted only in the resource room.

### primus.on('locky:locked', userId)

Emitted when a user takes the lock on the resource.

## License

MIT