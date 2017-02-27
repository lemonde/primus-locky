const expect = require('chai').expect;
const roomKey = require('../lib/resource-room');

describe('Resource room', () => {
  describe('#format', () => {
    it('should format key', () => {
      expect(roomKey.format('article')).to.equal('locky:article');
    });
  });

  describe('#parse', () => {
    it('should parse key', () => {
      expect(roomKey.parse('locky:article')).to.equal('article');
      expect(roomKey.parse('article')).to.be.null;
    });
  });

  it('should be symetric', () => {
    expect(roomKey.parse(roomKey.format('article'))).to.equal('article');
  });
});