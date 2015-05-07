var logger = require('pomelo-logger').getLogger('MqttConnector', 'MqttSocket');
var EventEmitter = require('events').EventEmitter;
var Util = require('util');

var ST_INITED = 1;
var ST_CLOSED = 2;

/**
 * MqttSocket class that wraps socket and websocket to provide unified interface for up level.
 *
 * @param   {Number} id socket id
 * @param   {Object} socket mqtt-connection wrapped socket
 * @param   {Object} adaptor mqttAdaptor
 * @param   {Object} opts mqtt connector configuration opts
 * @api public
 */
var MqttSocket = function(id, socket, adaptor, opts) {
  EventEmitter.call(this);
  this.id = id;
  this.socket = socket;
  this.remoteAddress = {
    ip: socket.stream.remoteAddress,
    port: socket.stream.remotePort
  };

  this.timer = null;
  this.timeout = opts.timeout * 1000;
  this.disconnectOnTimeout = opts.disconnectOnTimeout;

  this.adaptor = adaptor;

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
 * @param   {Object} msg message object typeof JSON or buffer
 * @api public
 */
MqttSocket.prototype.send = function(msg) {
  if (this.state !== ST_INITED) {
    return;
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
 * MqttSocket disconnect error、close、timeout clients.
 *
 * @api public
 */
MqttSocket.prototype.disconnect = function() {
  if (this.state === ST_CLOSED) {
    return;
  }

  this.state = ST_CLOSED;
  this.socket.stream.destroy();
};

/**
 * MqttSocket setup heartbeat timer.
 *
 * @api public
 */
MqttSocket.prototype.setUpTimer = function() {
  if (this.timer) {
    return;
  }

  var self = this;
  this.timer = setTimeout(function() {
    if (self.disconnectOnTimeout) {
      logger.info('client %j heartbeat timeout %d s.', self.id, self.timeout);
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
  if (!this.timer) {
    return;
  }

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

module.exports = MqttSocket;