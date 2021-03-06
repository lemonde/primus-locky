# primus-locky
[![Build Status](https://travis-ci.org/neoziro/primus-locky.svg?branch=master)](https://travis-ci.org/neoziro/primus-locky)
[![Dependency Status](https://david-dm.org/neoziro/primus-locky.svg?theme=shields.io)](https://david-dm.org/neoziro/primus-locky)
[![devDependency Status](https://david-dm.org/neoziro/primus-locky/dev-status.svg?theme=shields.io)](https://david-dm.org/neoziro/primus-locky#info=devDependencies)

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
  locky: {
    client: new Locky(),
    unserializeSpark: getUserIdFromSpark
  }
});

primus.use('locky', PrimusLocky);
```

### Options

#### client

Since primus-locky doesn't depends directly from [locky](https://github.com/neoziro/locky), you must inject a [locky](https://github.com/neoziro/locky) client in the options.


```js
new Primus(server, {
  locky: {
    client: new Locky()
  }
})
```

#### unserializeSpark

With the room based locking, the user must be determined from the spark, if your client are logged you can retrieve it from them.

```js
new Primus(server, {
  locky: {
    unserializeSpark: function unserializeSpark(spark, cb) {
      // Decode user id from headers.
      // This function should be implemented by you.
      var user = getUserFromHeaders(spark.headers);
      cb(null, user);
    }
  }
});
```

#### heartbeatInterval

Define the time between each heartbeat, by default `locky.ttl - 1000`. This time should be less than the locky TTL, else the lock will be losed between each tick.

```js
new Primus(server, {
  locky: {
    heartbeatInterval: 2000
  }
});
```

#### autoLock

Define if the lock will be take automatically by the first user or the last user in the room. Default to `true`.

```js
new Primus(server, {
  locky: {
    autoLock: false
  }
});
```

### Join room

You can find how to join a room in [primus-room](https://github.com/cayasso/primus-rooms#sparkjoinname-fn) plugin. To join a locky room, the only thing to do is to prefix it with `locky:`.

```js
// Join the room of the resource "article:13".
spark.join('locky:article:13');
```

### primus.lockyRoom(resource)

This method can be used to target a locky room. It's the same API as `primus.room()`.

```js
primus.lockyRoom('myresource').send('hello');
```

## Room based locking

The room based locking principle is very simple, it can be resume in four rules:

- When a user joins a room:
  - if the room is empty, he takes the lock.
  - if the room is not empty, nothing.
- When a user leaves a room:
  - if he was alone in the room, nothing.
  - if there is other persons in the room, a random user takes the lock.

## License

MIT