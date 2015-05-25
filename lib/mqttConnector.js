var logger = require('pomelo-logger').getLogger('MqttConnector');
var EventEmitter = require('events').EventEmitter;
var MqttAdaptor = require('./mqtt/mqttAdaptor');
var MqttConnection = require('mqtt-connection');
var MqttGenerate = require('./util/generate');
var MqttSocket = require('./mqtt/mqttSocket');
var MqttSwitcher = require('./mqttSwitcher');
var Constant = require('./util/constant');
var Coder2 = require('./util/coder2');
var Coder = require('./util/coder');
var Util = require('util');
var net = require('net');

var curId = 1;

var DEFAULT_NO_DELAY = true;
var DEFAULT_DISTINCT_HOST = false;
var DEFAULT_DISCONNECT_ON_TIMEOUT = true;
var DEFAULT_MQTT_HEARTBEAT_TIMEOUT = 90;
var DEFAULT_MQTT_HANDSHAKE_TIMEOUT = 10;
var DEFAULT_GZIP_COMPRESS_SIZE = 300;

/**
 * MqttConnector wrap server and clients communications through mqtt over tcp and over ws
 * @param   {Number}  port connector           port
 * @param   {String}  host connector           host
 * @param   {Object}  opts connector           configuration opts
 * @param   {Boolean} opts.distinctHost        setup to listen to distinctHost
 * @param   {Number}  opts.timeout             setup connect, message timeout time default 90s
 * @param   {Boolean} opts.setNoDelay          setup tcpNoDelay default true
 * @param   {Boolean} opts.disconnectOnTimeout setup true to disconnect client when timeout default true
 * @param   {Number}  opts.handshakeTimeout    setup for client handshake timeout
 * @param   {Number}  opts.gzipCompressSize    setup for gzip compress packet size
 * @param   {Boolean} opts.useGzipCompress     setup true to enable gzip compress
 * @param   {Boolean} opts.useRouteCompress    setup true to enable route compress
 * @param   {Boolean} opts.useProtobufCompress setup true to enable protobuf compress
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
  opts['handshakeTimeout'] = opts['handshakeTimeout'] || DEFAULT_MQTT_HANDSHAKE_TIMEOUT;
  opts['gzipCompressSize'] = opts['gzipCompressSize'] || DEFAULT_GZIP_COMPRESS_SIZE;

  this.opts = opts || {};
  this.app = opts.app;
  this.port = port;
  this.host = host;
  this.distinctHost = opts['distinctHost'];
  this.useGzipCompress = opts['useGzipCompress'];
  this.useRouteCompress = opts['useRouteCompress'];
  this.useProtobufCompress = opts['useProtobufCompress'];
  this.gzipCompressSize = opts['gzipCompressSize'];

  this.switcher = null;
  this.adaptor = new MqttAdaptor(this.opts, this);
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
    var mqttSocket = new MqttSocket(curId++, socket, self.adaptor, self.opts, self.composeKick());
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
      // reconnect will be in another socket fd handle
      mqttSocket.setHandshakeTimer();
      mqttSocket.connack({
        returnCode: 0
      });
    });

    mqttSocket.on('handshake', function() {
      mqttSocket.clearHandshakeTimer();
    });

    // kick client when closing
    mqttSocket.on('closing', function() {
      mqttSocket.kick();
    });

    self.emit('connection', mqttSocket);
  };

  var app = this.app;

  this.dictionary = app.components.__bearcat__dictionary__;
  this.decodeIO_protobuf = app.components.__decodeIO__protobuf__;

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

MqttConnector.prototype.decode = Coder.decode;

MqttConnector.prototype.encode = Coder.encode;

MqttConnector.prototype.composeKick = Coder.composeKick;

MqttConnector.prototype.decode2 = Coder2.decode;

MqttConnector.prototype.encode2 = Coder2.encode;

MqttConnector.prototype.composeKick2 = Coder2.composeKick;

module.exports = MqttConnector;