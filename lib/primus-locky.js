/**
 * Module dependencies.
 */

var _ = require('lodash');
var resourceRoom = require('./resource-room');

/**
 * Expose module.
 */

module.exports = function (primus, options) {
  return new PrimusLocky(primus, options);
};

/**
 * Create a new PrimusLocky instance.
 *
 * @param {Primus} primus
 * @param {Object} options
 */

function PrimusLocky(primus, options) {
  options = options || {};
  options.locky = options.locky || {};

  if (! options.locky.client)
    throw new Error('You must define a locky client.');

  if (! options.locky.client.ttl)
    throw new Error('You must specify a TTL for the lock.');

  if (! options.locky.unserializeSpark)
    throw new Error('You must implement an unserializeSpark function.');


  this.unserializeSpark = options.locky.unserializeSpark;

  this.locky = options.locky.client;

  this.primus = primus;
  this.primus.on('joinroom', this.onJoinRoom.bind(this));

  // Attach lockyRoom method to Primus.
  this.primus.lockyRoom = this.lockyRoom.bind(this);

  // Define a heartbeat to refresh locks.
  // By default TTL - 1s.
  var heartbeatIntervalTime = options.heartbeatInterval || options.locky.client.ttl - 1000;
  var heartbeatInterval = setInterval(this.refreshLocks.bind(this), heartbeatIntervalTime);
  this.primus.on('close', function onClose() {
    clearInterval(heartbeatInterval);
  });
}

/**
 * Return the room associate to a resource.
 *
 * @param {String} resource
 * @returns {Room}
 */

PrimusLocky.prototype.lockyRoom = function lockyRoom(resource) {
  return this.primus.room(resourceRoom.format(resource));
};

/**
 * Called when a spark join a room.
 * Try to lock the article.
 *
 * @param {String} room
 * @param {Spark} spark
 */

PrimusLocky.prototype.onJoinRoom = function onJoinRoom(room, spark) {
  // Parse resource id from room.
  var resource = resourceRoom.parse(room);

  // If the room is not a resource room, ignore it.
  if (! resource) return ;

  // Unserialize user id from spark.
  this.unserializeSpark(spark, function (err, user) {
    if (err) return this.primus.emit('error', err);

    // If the user can't be parse, do nothing.
    if (! user) return ;

    // Get the current resource locker.
    this.locky.getLocker(resource, function (err, locker) {
      if (err) return this.primus.emit('error', err);

      // If there is no locker, lock the article.
      if (! locker)
        return this.locky.lock({
          resource: resource,
          locker: user,
          force: true
        });

      // If the locker is the current user, refresh the lock.
      if (user === locker) this.locky.refresh(resource);

    }.bind(this));

  }.bind(this));
};


/**
 * Refresh all active locks.
 */

PrimusLocky.prototype.refreshLocks = function refreshLocks() {
  // For each spark.
  this.primus.forEach(function (spark) {

    // For each room.
    spark.rooms(function (err, rooms) {
      if (err) return this.primus.emit('error', err);

      // Simulate that the user is joining the room.
      rooms.forEach(function (room) {
        this.onJoinRoom(room, spark);
      }, this);

    }.bind(this));

  }.bind(this));
};