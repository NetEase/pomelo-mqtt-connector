var WebSocketStream = require('websocket-stream');
var EventEmitter = require('events').EventEmitter;
var WebSocketServer = require('ws').Server;
var http = require('http');
var Util = require('util');

var ST_STARTED = 1;
var ST_CLOSED = 2;

/**
 * WsProcessor websocket protocol processor
 */
var WsProcessor = function() {
  EventEmitter.call(this);
  this.httpServer = http.createServer();

  var self = this;
  this.wsServer = new WebSocketServer({
    server: this.httpServer
  });

  this.wsServer.on('connection', function(socket) {
    var wsSocketStream = WebSocketStream(socket);

    // emit socket to outside
    self.emit('connection', wsSocketStream);
  });

  this.state = ST_STARTED;
};

Util.inherits(WsProcessor, EventEmitter);

/**
 * WsProcessor add socket data.
 *
 * @param   {Object} socket
 * @param   {Object} message data
 * @api public
 */
WsProcessor.prototype.add = function(socket, data) {
  if (this.state !== ST_STARTED) {
    return;
  }

  this.httpServer.emit('connection', socket);
  if (typeof socket.ondata === 'function') {
    // compatible with stream2
    socket.ondata(data, 0, data.length);
  } else {
    // compatible with old stream
    socket.emit('data', data);
  }
};

/**
 * WsProcessor close.
 *
 * @api public
 */
WsProcessor.prototype.close = function() {
  if (this.state !== ST_STARTED) {
    return;
  }

  this.state = ST_CLOSED;
  this.wsServer.close();
  this.wsServer = null;
  this.httpServer = null;
};

module.exports = WsProcessor;