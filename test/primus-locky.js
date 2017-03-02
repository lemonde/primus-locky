const sinon = require('sinon');
const redis = require('then-redis');
const http = require('http').Server;
const Locky = require('locky');
const Primus = require('primus');
const PrimusRooms = require('primus-rooms');
const PrimusEmitter = require('primus-emitter');
const PrimusLocky = require('../index');
const expect = require('chai').use(require('sinon-chai')).expect;

let PORT = 1111;


/**
 * Port getter.
 */

Object.defineProperty(client, 'port', {
  get: () => {
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
  const addr = srv.address();
  const url = `http://0.0.0.0:${port || addr.port}`;
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

describe('Primus locky', () => {

  beforeEach((done) => {
    const client = redis.createClient();

    client.flushdb()
    .then(() => client.quit(done))
    .catch(done);
  });

  it('should return an error if there is no locky client', () => {
    function createServer() {
      const srv = http();
      server(srv, {});
    }

    expect(createServer).to.throw('You must define a locky client.');
  });

  it('should return an error if there is no TTL', () => {
    function createServer() {
      const locky = new Locky();
      const srv = http();
      server(srv, {
        locky: {
          client: locky
        }
      });
    }

    expect(createServer).to.throw('You must specify a TTL for the lock.');
  });

  it('should return an error if `unserializeSpark` is not implemented', () => {
    function createServer() {
      const locky = new Locky({ ttl: 2000 });
      const srv = http();
      server(srv, {
        locky: {
          client: locky
        }
      });
    }

    expect(createServer).to.throw('You must implement an unserializeSpark function.');
  });

  describe('with required options', () => {
    let srv, primus, locky, currentUser;

    beforeEach(() => {
      currentUser = { name: 'john' };
      locky = new Locky({ ttl: 2000 });
      srv = http();
      primus = server(srv, {
        locky: {
          client: locky,
          unserializeSpark: (spark, cb) => cb(null, currentUser.name)
        }
      });

      sinon.spy(locky, 'lock');
      sinon.spy(locky, 'refresh');
    });

    afterEach(() => {
      if (primus.ignore)
        srv.close();
      else
        primus.end();

      locky.close();
    });

    it('should refresh if the same user re-join the room', (done) => {
      let clientId = 1;

      srv.listen(client.port, () => {
        primus.on('connection', (spark) => {
          spark.join('locky:article');

          if (clientId === 1) {
            client(srv, primus);
          }

          if (clientId === 2) {
            setTimeout(() => {
              expect(locky.refresh).to.be.calledWith('article');
              done();
            }, 20);
          }

          clientId++;
        });

        client(srv, primus);
      });
    });

    it('should do nothing if a differend user join the room', (done) => {
      let clientId = 1;

      srv.listen(client.port, () => {
        primus.on('connection', (spark) => {
          spark.join('locky:article');

          if (clientId === 1) {
            setTimeout(() => {
              currentUser.name = 'kingkong';
              client(srv, primus);
            }, 20);
          }

          if (clientId === 2) {
            setTimeout(() => {
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

    describe('with autolock', () => {
      it('should lock the resource when we join the room', (done) => {
        srv.listen(client.port, () => {
          primus.on('connection', (spark) => {
            spark.join('locky:article');

            setTimeout(() => {
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

      it('should give the lock to the next user when a user quit the room', function (done) {
        this.timeout(4000);

        let clientId = 1;
        let spark1, spark2;

        srv.listen(client.port, () => {
          primus.on('connection', (spark) => {
            spark.join('locky:article');

            if (clientId === 1) {
              spark1 = spark;
              setTimeout(() => {
                currentUser.name = 'kingkong';
                client(srv, primus);
              }, 20);
            }

            if (clientId === 2) {
              spark2 = spark;

              setTimeout(() => {
                spark1.leave('locky:article');

                setTimeout(() => {
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
    });

    describe('without autolock', () => {
      beforeEach(() => {
        primus = server(srv, {
          locky: {
            client: locky,
            unserializeSpark: (spark, cb) => {
              cb(null, currentUser.name);
            },
            autoLock: false
          }
        });
      });

      it('should not lock the resource when we join the room', (done) => {
        srv.listen(client.port, () => {
          primus.on('connection', (spark) => {
            spark.join('locky:article');

            setTimeout(() => {
              expect(locky.lock).to.not.be.called;
              done();
            }, 20);
          });

          client(srv, primus);
        });
      });

      it('should not give the lock to the next user when a user quit the room', function (done) {
        this.timeout(4000);

        let clientId = 1;
        let spark1, spark2;

        srv.listen(client.port, () => {
          primus.on('connection', (spark) => {
            spark.join('locky:article');

            if (clientId === 1) {
              spark1 = spark;
              setTimeout(() => {
                currentUser.name = 'kingkong';
                client(srv, primus);
              }, 20);
            }

            if (clientId === 2) {
              spark2 = spark;

              setTimeout(() => {
                spark1.leave('locky:article');

                setTimeout(() => {
                  expect(locky.lock).to.not.be.called;
                  done();
                }, 3000);

              }, 20);
            }

            clientId++;
          });

          client(srv, primus);
        });
      });
    });

    describe('#lockyRoom', () => {
      beforeEach(() => {
        sinon.stub(primus, 'room');
      });

      afterEach(() => {
        primus.room.restore();
      });

      it('should return a room based on resource', () => {
        srv.listen(client.port, () => {
          primus.lockyRoom('resource');
          expect(primus.room).to.be.calledWith('locky:resource');
        });
      });
    });
  });
});