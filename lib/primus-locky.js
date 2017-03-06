const _ = require('lodash');

/**
 * Module dependencies.
 */

const resourceRoom = require('./resource-room');

/**
 * Create a new PrimusLocky instance.
 *
 * @param {Primus} primus
 * @param {Object} options
 */

class PrimusLocky {
  constructor(primus, options = {}) {
    options.locky = options.locky || {};

    if (! _.get(options, 'locky.client')) {
      throw new Error('You must define a locky client.');
    }

    if (! _.get(options, 'locky.client.ttl')) {
      throw new Error('You must specify a TTL for the lock.');
    }

    if (! _.get(options, 'locky.unserializeSpark')) {
      throw new Error('You must implement an unserializeSpark function.');
    }

    // set the autoLock
    this.autoLock = _.get(options, 'locky.autoLock', true);

    this.unserializeSpark = options.locky.unserializeSpark;

    this.locky = options.locky.client;

    this.primus = primus;
    this.primus.on('joinroom', this.onJoinRoom.bind(this));

    // Attach lockyRoom method to Primus.
    this.primus.lockyRoom = this.lockyRoom.bind(this);

    // Define a heartbeat to refresh locks.
    // By default TTL - 1s.
    const heartbeatIntervalTime =
      _.get(options.locky, 'heartbeatInterval') ||
      _.get(options, 'locky.client.ttl') - 1000;

    const heartbeatInterval = setInterval(() => this.refreshLocks(), heartbeatIntervalTime);

    this.primus.on('close', () => clearInterval(heartbeatInterval));
  }

  /**
   * Return the room associate to a resource.
   *
   * @param {String} resource
   * @returns {Room}
   */

  lockyRoom(resource) {
    return this.primus.room(resourceRoom.format(resource));
  }

  /**
   * Called when a spark join a room.
   * Try to lock the article.
   *
   * @param {String} room
   * @param {Spark} spark
   */

  onJoinRoom(room, spark) {
    // Parse resource id from room.
    const resource = resourceRoom.parse(room);

    // If the room is not a resource room, ignore it.
    if (! resource) return ;

    // Unserialize user id from spark.
    this.unserializeSpark(spark, (err, user) => {
      if (err) return this.primus.emit('error', err);

      // If the user can't be parse, do nothing.
      if (! user) return ;

      // Get the current resource locker.
      this.locky.getLocker(resource, (err, locker) => {
        if (err) return this.primus.emit('error', err);

        // If autoLock is active and if there is no locker, lock the article.
        if (this.autoLock && ! locker) {
          return this.locky.lock({
            resource,
            locker: user,
            force: true
          });
        }

        // If the locker is the current user, refresh the lock.
        if (user === locker) this.locky.refresh(resource);
      });
    });
  }


  /**
   * Refresh all active locks.
   */

  refreshLocks() {
    // For each spark.
    this.primus.forEach((spark) => {

      // For each room.
      spark.rooms((err, rooms) => {
        if (err) return this.primus.emit('error', err);

        // Simulate that the user is joining the room.
        rooms.forEach((room) => {
          const resource = resourceRoom.parse(room);
          this.primus.emit('refreshLock', resource, room, spark);
          this.onJoinRoom(room, spark);
        });
      });
    });
  }
}

/**
 * Expose module.
 */

module.exports = function (primus, options) {
  return new PrimusLocky(primus, options);
};
