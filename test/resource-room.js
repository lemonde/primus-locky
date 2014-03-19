var expect = require('chai').expect;
var roomKey = require('../lib/resource-room');

describe('Resource room', function () {
  describe('#format', function () {
    it('should format key', function () {
      expect(roomKey.format('article')).to.equal('locky:article');
    });
  });

  describe('#parse', function () {
    it('should parse key', function () {
      expect(roomKey.parse('locky:article')).to.equal('article');
      expect(roomKey.parse('article')).to.be.null;
    });
  });

  it('should be symetric', function () {
    expect(roomKey.parse(roomKey.format('article'))).to.equal('article');
  });
});