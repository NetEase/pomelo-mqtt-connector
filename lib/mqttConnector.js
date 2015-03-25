var logger = require('pomelo-logger').getLogger('MqttConnector');
var EventEmitter = require('events').EventEmitter;
var MqttAdaptor = require('./mqtt/mqttAdaptor');
var MqttConnection = require('mqtt-connection');
var MqttGenerate = require('./util/generate');
var MqttSocket = require('./mqtt/mqttSocket');
var MqttSwitcher = require('./mqttSwitcher');
var Constant = require('./util/constant');
var Util = require('util');
var net = require('net');

var curId = 1;

var DEFAULT_NO_DELAY = true;
var DEFAULT_DISTINCT_HOST = false;
var DEFAULT_DISCONNECT_ON_TIMEOUT = true;
var DEFAULT_MQTT_HEARTBEAT_TIMEOUT = 90;

/**
 * MqttConnector wrap server and clients communications through mqtt over tcp and over ws
 * @param   {Number}  port connector           port
 * @param   {String}  host connector           host
 * @param   {Object}  opts connector           configuration opts
 * @param   {Boolean} opts.distinctHost        setup to listen to distinctHost
 * @param   {Boolean} opts.timeout             setup connect, message timeout time default 90s
 * @param   {Boolean} opts.setNoDelay          setup tcpNoDelay default true
 * @param   {Boolean} opts.disconnectOnTimeout setup true to disconnect client when timeout default true
 * @param   {String}  opts.publishRoute        mqttConnector publish message route for pomelo message routing like connector.mqttHandler.publish
 * @param   {String}  opts.subscribeRoute      mqttConnector subscribe message route for pomelo message routing like connector.mqttHandler.subscribe
 * @param   {String}  opts.selfDefinedRoute    setup true to enable self-defined pomelo route message
 */
var MqttConnector = function(port, host, opts) {
  if (!(this instanceof MqttConnector)) {
    return new MqttConnector(port, host, opts);
  }

  EventEmitter.call(this);

  opts['setNoDelay'] = opts['setNoDelay'] || DEFAULT_NO_DELAY;
  opts['distinctHost'] = opts['distinctHost'] || DEFAULT_DISTINCT_HOST;
  opts['disconnectOnTimeout'] = opts['disconnectOnTimeout'] || DEFAULT_DISCONNECT_ON_TIMEOUT;
  opts['timeout'] = opts['timeout'] || DEFAULT_MQTT_HEARTBEAT_TIMEOUT;

  this.opts = opts || {};
  this.port = port;
  this.host = host;
  this.distinctHost = opts['distinctHost'];

  this.switcher = null;
  this.adaptor = new MqttAdaptor(this.opts);
};

Util.inherits(MqttConnector, EventEmitter);

/**
 * MqttConnector pomelo connector start interface.
 *
 * @param    {Function} callback function
 * @api public
 */
MqttConnector.prototype.start = function(cb) {
  var self = this;

  var gensocket = function(socket) {
    var mqttSocket = new MqttSocket(curId++, socket, self.adaptor, self.opts);
    mqttSocket.on('close', function() {
      mqttSocket.disconnect();
    });

    mqttSocket.on('error', function() {
      mqttSocket.disconnect();
    });

    mqttSocket.on('disconnect', function() {
      mqttSocket.disconnect();
    });

    mqttSocket.on('connect', function() {
      mqttSocket.connack({
        returnCode: 0
      });
    });

    self.emit('connection', mqttSocket);
  };

  this.tcpServer = net.createServer();
  this.switcher = new MqttSwitcher(this.tcpServer, this.opts);

  this.switcher.on('connection', function(socket) {
    var mqttClient = MqttConnection(socket);

    gensocket(mqttClient);
  });

  if (this.distinctHost) {
    this.tcpServer.listen(this.port, this.host);
  } else {
    this.tcpServer.listen(this.port);
  }

  logger.info('started on %d', this.port);

  process.nextTick(cb);
};

/**
 * MqttConnector pomelo connector stop interface.
 *
 * @param    {Boolean}  force setup true to enable force stop
 * @param    {Function} cb callback function
 * @api public
 */
MqttConnector.prototype.stop = function(force, cb) {
  this.switcher.close();
  this.tcpServer.close();

  process.nextTick(cb);
};

/**
 * MqttConnector pomelo connector close interface.
 *
 * @param    {Function} cb callback function
 * @api public
 */
MqttConnector.prototype.close = function() {
  this.switcher.close();
  this.tcpServer.close();
};

var composeResponse = function(msgId, route, msgBody) {
  var payload = JSON.stringify({
    id: msgId,
    body: msgBody
  });

  var msg = {
    topic: Constant.DEFAULT_TOPIC,
    payload: payload
  };

  return msg;
};

var composePush = function(route, msgBody) {
  var payload = JSON.stringify({
    route: route,
    body: msgBody
  });

  var msg = {
    topic: Constant.DEFAULT_TOPIC,
    payload: payload
  }

  msg = MqttGenerate.publish(msg);

  if (!msg) {
    logger.error('invalid mqtt publish message: %j', msgBody);
  }

  return msg;
};

/**
 * MqttConnector pomelo connector encode interface for encode message.
 *
 * @param    {String}   request id for request message
 * @param    {String}   route
 * @param    {Object}   msgBody
 * @api public
 */
MqttConnector.prototype.encode = function(reqId, route, msgBody) {
  if (reqId) {
    return composeResponse(reqId, route, msgBody);
  }

  return composePush(route, msgBody);
};

module.exports = MqttConnector;