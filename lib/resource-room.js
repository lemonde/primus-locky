/**
 * Expose module.
 */

exports.format = format;
exports.parse = parse;

/**
 * Format room name from resource id.
 *
 * @param {String} id
 * @returns {String}
 */

function format(id) {
  return 'locky:' + id;
}

/**
 * Parse the room name and extract resource id.
 *
 * @param {String} name
 * @returns {String}
 */

function parse(name) {
  const regexp = /^locky:/;
  if (! name.match(regexp, '')) return null;
  return name.replace(regexp, '');
}