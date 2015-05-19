var logger = require('pomelo-logger').getLogger('MqttConnector', 'MqttSocket');
var EventEmitter = require('events').EventEmitter;
var Constant = require('../util/constant');
var Util = require('util');

var DEFAULT_HANDSHAKE_MAX_TIMES = 10;

var ST_INITED = 1;
var ST_WORKING = 2;
var ST_KICKING = 3;
var ST_KICKED = 4;
var ST_CLOSED = 5;

/**
 * MqttSocket class that wraps socket and websocket to provide unified interface for up level.
 *
 * @param   {Number} id socket id
 * @param   {Object} socket mqtt-connection wrapped socket
 * @param   {Object} adaptor mqttAdaptor
 * @param   {Object} opts mqtt connector configuration opts
 * @api public
 */
var MqttSocket = function(id, socket, adaptor, opts, kickMsg) {
  EventEmitter.call(this);
  this.id = id;
  this.socket = socket;
  this.remoteAddress = {
    ip: socket.stream.remoteAddress,
    port: socket.stream.remotePort
  };

  this.timer = null;
  this.handshakeTimer = null;
  this.timeout = opts.timeout * 1000;
  this.disconnectOnTimeout = opts.disconnectOnTimeout;
  this.handshakeTimeout = opts.handshakeTimeout * 1000;

  this.adaptor = adaptor;
  this.kickMsg = kickMsg;
  this.handshakeMaxTimes = opts.handshakeMaxTimes || DEFAULT_HANDSHAKE_MAX_TIMES;
  this.handshakeTimes = 0;
  // this.kickTest = 0;

  var self = this;

  socket.on('close', this.emit.bind(this, 'disconnect'));
  socket.on('error', this.emit.bind(this, 'error'));
  socket.on('disconnect', this.emit.bind(this, 'disconnect'));
  socket.on('connect', this.emit.bind(this, 'connect'));

  socket.on('pingreq', function(packet) {
    socket.pingresp();
  });

  socket.on('publish', this.adaptor.onPublish.bind(this.adaptor, this));

  // reset heartbeat timer
  socket.on('connect', this.resetTimer.bind(this));
  socket.on('pingreq', this.resetTimer.bind(this));
  socket.on('subscribe', this.resetTimer.bind(this));
  socket.on('publish', this.resetTimer.bind(this));

  this.state = ST_INITED;
};

Util.inherits(MqttSocket, EventEmitter);

/**
 * MqttSocket interface for send message to client used for pomelo connector componnent.
 *
 * @param   {Object}  msg message object typeof JSON or buffer
 * @param   {Boolean} kick message flag, true for kick message
 * @api public
 */
MqttSocket.prototype.send = function(msg, kickFlag) {
  if (!kickFlag && this.state == ST_CLOSED) {
    logger.error('send message error socket closed state %d', this.state);
    return;
  }

  if (this.state == ST_INITED) {
    logger.warn('client %d not handshaked, send msg is not allowed', this.id);
    return;
  }

  if (this.state == ST_KICKED) {
    return this.kick();
  }

  if (msg instanceof Buffer) {
    // if encoded, send directly
    this.socket.stream.write(msg);
  } else {
    this.adaptor.publish(this, msg);
  }
};

/**
 * MqttSocket interface for send messages to client used for pomelo connector componnent.
 *
 * @param   {Array} msgs message objects
 * @api public
 */
MqttSocket.prototype.sendBatch = function(msgs) {
  for (var i = 0, l = msgs.length; i < l; i++) {
    this.send(msgs[i]);
  }
};

/**
 * MqttSocket send connack package when mqtt client connect.
 *
 * @param   {Object} msg {returnCode: 0}
 * @api public
 */
MqttSocket.prototype.connack = function(msg) {
  this.socket.connack(msg);
}

/**
 * MqttSocket send kick package to kick client, client will disconnect the connection.
 *
 * @api public
 */
MqttSocket.prototype.kick = function() {
  // logger.debug('do kick %d %d .', this.id, this.kickTest);
  // if (this.kickTest++) {
  if (this.state == ST_CLOSED) {
    return;
  }

  this.state = ST_KICKING;
  this.send(this.kickMsg, true);
  // }
  this.state = ST_KICKED;
}

MqttSocket.prototype.handshakeResp = function(msg) {
  this.emit('handshake');
  this.state = ST_WORKING;
  this.send(msg);
}

MqttSocket.prototype.checkReady = function() {
  // check package state not handshake do not allow msg package
  return this.state == ST_WORKING;
}

MqttSocket.prototype.checkHandshake = function() {
  return this.state == ST_WORKING;
}

MqttSocket.prototype.checkAttack = function() {
  if (this.handshakeTimes++ >= this.handshakeMaxTimes) {
    logger.error("handshake attack detected for %d times, close the client %d", this.handshakeTimes, this.id);
    this.disconnect();
    return true;
  }

  return false;
}

/**
 * MqttSocket disconnect error、close、timeout clients.
 *
 * @api public
 */
MqttSocket.prototype.disconnect = function() {
  if (this.state === ST_CLOSED) {
    return;
  }

  // if (this.kickTest == 1) {
  //   return;
  // }
  // logger.debug('disconnect client %d %d %s ~~~', this.id, this.state, new Error('').stack);
  this.state = ST_CLOSED;
  this.socket.stream.destroy();
  this.clearTimer();
  this.clearHandshakeTimer();
};

/**
 * MqttSocket setup heartbeat timer.
 *
 * @api public
 */
MqttSocket.prototype.setUpTimer = function() {
  if (this.state == ST_KICKED) {
    // client not kicked, retry with kick message
    this.kick();
  }

  if (this.state == ST_CLOSED) {
    // logger.error('closed state do not set timer %s', new Error('').stack);
    return;
  }

  if (this.timer) {
    return;
  }

  var self = this;
  this.timer = setTimeout(function() {
    if (self.disconnectOnTimeout) {
      logger.info('client %j heartbeat timeout %d ms.', self.id, self.timeout);
      self.emit('close');
    }
  }, this.timeout);
}

/**
 * MqttSocket clear heartbeat timer.
 *
 * @api public
 */
MqttSocket.prototype.clearTimer = function() {
  clearTimeout(this.timer);
  delete this.timer;
  this.timer = null;
}

/**
 * MqttSocket reset heartbeat timer.
 *
 * @api public
 */
MqttSocket.prototype.resetTimer = function() {
  this.clearTimer();
  this.setUpTimer();
}

MqttSocket.prototype.setHandshakeTimer = function() {
  if (this.state == ST_CLOSED) {
    return;
  }

  if (this.handshakeTimer) {
    return;
  }

  var self = this;
  this.handshakeTimer = setTimeout(function() {
    if (self.disconnectOnTimeout) {
      logger.info('client %j handshake timeout %d ms.', self.id, self.handshakeTimeout);
      self.emit('close');
    }
  }, this.handshakeTimeout);
}

MqttSocket.prototype.clearHandshakeTimer = function() {
  clearTimeout(this.handshakeTimer);
  delete this.handshakeTimer;
  this.handshakeTimer = null;
}

module.exports = MqttSocket;