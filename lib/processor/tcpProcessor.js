var EventEmitter = require('events').EventEmitter;
var Util = require('util');

var ST_STARTED = 1;
var ST_CLOSED = 2;

/**
 * TcpProcessor mqtt tcp protocol processor
 */
var TcpProcessor = function() {
  EventEmitter.call(this);
  this.state = ST_STARTED;
};

Util.inherits(TcpProcessor, EventEmitter);

/**
 * TcpProcessor add socket data.
 *
 * @param   {Object} socket
 * @param   {Object} message data
 * @api public
 */
TcpProcessor.prototype.add = function(socket, data) {
  if (this.state !== ST_STARTED) {
    return;
  }

  this.emit('connection', socket);
  socket.emit('data', data);
};

/**
 * TcpProcessor close.
 *
 * @api public
 */
TcpProcessor.prototype.close = function() {
  if (this.state !== ST_STARTED) {
    return;
  }
  this.state = ST_CLOSED;
};

module.exports = TcpProcessor;