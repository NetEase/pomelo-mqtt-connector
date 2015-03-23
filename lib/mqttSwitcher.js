var logger = require('pomelo-logger').getLogger('MqttConnector', 'MqttSwitcher');
var TcpProcessor = require('./processor/tcpProcessor');
var WsProcessor = require('./processor/wsProcessor');
var EventEmitter = require('events').EventEmitter;
var Util = require('util');

var HTTP_METHODS = [
  'GET', 'POST', 'DELETE', 'PUT', 'HEAD'
];

var ST_STARTED = 1;
var ST_CLOSED = 2;

/**
 * MqttSwitcher for tcp and websocket protocol
 *
 * @param {Object} server tcp server instance from node.js net module
 */
var MqttSwitcher = function(server, opts) {
  EventEmitter.call(this);
  this.server = server;
  this.wsprocessor = new WsProcessor();
  this.tcpprocessor = new TcpProcessor();
  this.id = 1;
  this.timers = {};
  this.timeout = opts.timeout;
  this.setNoDelay = opts.setNoDelay;

  this.server.on('connection', this.newSocket.bind(this));
  this.wsprocessor.on('connection', this.emit.bind(this, 'connection'));
  this.tcpprocessor.on('connection', this.emit.bind(this, 'connection'));

  this.state = ST_STARTED;
};

Util.inherits(MqttSwitcher, EventEmitter);

/**
 * MqttSwitcher on new tcp socket
 *
 * @param    {Object}  tcp socket
 * @param    {Object}  packet mqtt pubAck packet
 * @api public
 */
MqttSwitcher.prototype.newSocket = function(socket) {
  if (this.state !== ST_STARTED) {
    return;
  }

  // if set connection timeout
  if (this.timeout) {
    var timer = setTimeout(function() {
      logger.warn('connection is timeout without communication, the remote ip is %s && port is %s', socket.remoteAddress, socket.remotePort);
      socket.destroy();
    }, this.timeout * 1000);

    this.timers[this.id] = timer;
    socket.id = this.id++;
  }

  var self = this;
  socket.once('close', function() {
    if (socket.id) {
      clearTimeout(self.timers[socket.id]);
      delete self.timers[socket.id];
    }
  });

  socket.once('data', function(data) {
    if (socket.id) {
      clearTimeout(self.timers[socket.id]);
      delete self.timers[socket.id];
    }
    if (isHttp(data)) {
      processHttp(self, self.wsprocessor, socket, data);
    } else {
      if (self.setNoDelay) {
        socket.setNoDelay(true);
      }
      processTcp(self, self.tcpprocessor, socket, data);
    }
  });
};

/**
 * MqttSwitcher close interface
 *
 * @api public
 */
MqttSwitcher.prototype.close = function() {
  if (this.state !== ST_STARTED) {
    return;
  }

  this.state = ST_CLOSED;
  this.wsprocessor.close();
  this.tcpprocessor.close();
};

var isHttp = function(data) {
  var head = data.toString('utf8', 0, 4);

  for (var i = 0, l = HTTP_METHODS.length; i < l; i++) {
    if (head.indexOf(HTTP_METHODS[i]) === 0) {
      return true;
    }
  }

  return false;
};

var processHttp = function(switcher, processor, socket, data) {
  processor.add(socket, data);
};

var processTcp = function(switcher, processor, socket, data) {
  processor.add(socket, data);
};

module.exports = MqttSwitcher;