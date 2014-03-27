var sinon = require('sinon');
var redis = require('redis');
var http = require('http').Server;
var Locky = require('locky');
var Primus = require('primus');
var PrimusRooms = require('primus-rooms');
var PrimusEmitter = require('primus-emitter');
var PrimusLocky = require('../index');
var expect = require('chai').use(require('sinon-chai')).expect;
var PORT = 1111;


/**
 * Port getter.
 */

Object.defineProperty(client, 'port', {
  get: function () {
    return PORT++;
  }
});

/**
 * Create the client.
 *
 * @param {Server} srv
 * @param {Primus} primus
 * @param {Number} port
 * @returns {Primus.Socket}
 */

function client(srv, primus, port){
  var addr = srv.address();
  var url = 'http://' + addr.address + ':' + (port || addr.port);
  return new primus.Socket(url);
}

/**
 * Create the server.
 *
 * @param {Server} srv
 * @param {Object} opts
 * @returns {Primus}
 */

function server(srv, opts) {
  return new Primus(srv, opts)
    .use('rooms', PrimusRooms)
    .use('emitter', PrimusEmitter)
    .use('locky', PrimusLocky);
}

describe('Primus locky', function () {

  beforeEach(function (done) {
    var client = redis.createClient();
    client.flushdb(function (err) {
      if (err) return done(err);
      client.quit(done);
    });
  });

  it('should return an error if there is no locky client', function () {
    function createServer() {
      var srv = http();
      server(srv, {});
    }

    expect(createServer).to.throw('You must define a locky client.');
  });

  it('should return an error if there is no TTL', function () {
    function createServer() {
      var locky = new Locky();
      var srv = http();
      server(srv, {
        locky: {
          client: locky
        }
      });
    }

    expect(createServer).to.throw('You must specify a TTL for the lock.');
  });

  it('should return an error if `unserializeSpark` is not implemented', function () {
    function createServer() {
      var locky = new Locky({ ttl: 2000 });
      var srv = http();
      server(srv, {
        locky: {
          client: locky
        }
      });
    }

    expect(createServer).to.throw('You must implement an unserializeSpark function.');
  });

  describe('with required options', function () {
    var srv, primus, locky, currentUser;

    beforeEach(function () {
      currentUser = { name: 'john' };
      locky = new Locky({ ttl: 2000 });
      srv = http();
      primus = server(srv, {
        locky: {
          client: locky,
          unserializeSpark: function (spark, cb) {
            cb(null, currentUser.name);
          }
        }
      });

      sinon.spy(locky, 'lock');
      sinon.spy(locky, 'refresh');
    });

    afterEach(function () {
      if (primus.ignore)
        srv.close();
      else
        primus.end();

      locky.close();
    });

    it('should lock the resource when we join the room', function (done) {
      srv.listen(client.port, function () {
        primus.on('connection', function (spark) {
          spark.join('locky:article');

          setTimeout(function () {
            expect(locky.lock).to.be.calledWith({
              resource: 'article',
              locker: 'john',
              force: true
            });
            done();
          }, 20);
        });

        client(srv, primus);
      });
    });

    it('should refresh if the same user re-join the room', function (done) {
      var clientId = 1;

      srv.listen(client.port, function () {
        primus.on('connection', function (spark) {
          spark.join('locky:article');

          if (clientId === 1) {
            client(srv, primus);
          }

          if (clientId === 2) {
            setTimeout(function () {
              expect(locky.refresh).to.be.calledWith('article');
              done();
            }, 20);
          }

          clientId++;
        });

        client(srv, primus);
      });
    });

    it('should do nothing if a differend user join the room', function (done) {
      var clientId = 1;

      srv.listen(client.port, function () {
        primus.on('connection', function (spark) {
          spark.join('locky:article');

          if (clientId === 1) {
            setTimeout(function () {
              currentUser.name = 'kingkong';
              client(srv, primus);
            }, 20);
          }

          if (clientId === 2) {
            setTimeout(function () {
              expect(locky.refresh).to.not.be.called;
              expect(locky.lock).to.be.calledOnce;
              done();
            }, 20);
          }

          clientId++;
        });

        client(srv, primus);
      });
    });

    it('should give the lock to the next user when a user quit the room', function (done) {
      this.timeout(4000);

      var clientId = 1;
      var spark1, spark2;

      srv.listen(client.port, function () {
        primus.on('connection', function (spark) {
          spark.join('locky:article');

          if (clientId === 1) {
            spark1 = spark;
            setTimeout(function () {
              currentUser.name = 'kingkong';
              client(srv, primus);
            }, 20);
          }

          if (clientId === 2) {
            spark2 = spark;

            setTimeout(function () {
              spark1.leave('locky:article');

              setTimeout(function () {
                expect(locky.lock).to.be.calledWith({
                  resource: 'article',
                  locker: 'kingkong',
                  force: true
                });
                done();
              }, 3000);

            }, 20);
          }

          clientId++;
        });

        client(srv, primus);
      });
    });

    it('should broadcast events', function (done) {
      var spy = sinon.spy();

      srv.listen(client.port, function () {
        primus.on('connection', function (spark) {
          spark.join('locky:article');

          setTimeout(function () {
            expect(spy).to.be.calledWith('article', 'john');
            done();
          }, 20);
        });

        var client1 = client(srv, primus);
        client1.on('locky:lock', spy);
      });
    });
  });
});