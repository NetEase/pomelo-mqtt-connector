/**
 * MqttAdaptor adaptor for publish、subscribe message.
 *
 * @param    {Object}   opts configuration
 * @api public
 */
var MqttAdaptor = function(opts) {
  opts = opts || {};
  this.subReqs = {};
  this.publishRoute = opts.publishRoute;
  this.subscribeRoute = opts.subscribeRoute;
};

/**
 * MqttAdaptor onPublish message
 *
 * @param    {Object}  client mqtt-connection wrap socket
 * @param    {Object}  packet mqtt publish packet
 * @api public
 */
MqttAdaptor.prototype.onPublish = function(client, packet) {
  var route = this.publishRoute;

  if (!route) {
    throw new Error('unspecified publish route.');
  }

  var payload = packet.payload;
  if (payload instanceof Buffer) {
    payload = payload.toString('utf8');
    packet.payload = payload;
  }

  var req = {
    id: packet.messageId,
    route: route,
    body: packet
  };

  client.emit('message', req);

  if (packet.qos === 1) {
    client.socket.puback({
      messageId: packet.messageId
    });
  }
};

/**
 * MqttAdaptor onSubscribe message
 *
 * @param    {Object}  client mqtt-connection wrap socket
 * @param    {Object}  packet mqtt subscribe packet
 * @api public
 */
MqttAdaptor.prototype.onSubscribe = function(client, packet) {
  var route = this.subscribeRoute;

  if (!route) {
    throw new Error('unspecified subscribe route.');
  }

  var req = {
    id: packet.messageId,
    route: route,
    body: {
      subscriptions: packet.subscriptions
    }
  };

  this.subReqs[packet.messageId] = packet;

  client.emit('message', req);
};

/**
 * MqttAdaptor onPubAck message
 *
 * @param    {Object}  client mqtt-connection wrap socket
 * @param    {Object}  packet mqtt pubAck packet
 * @api public
 */
MqttAdaptor.prototype.onPubAck = function(client, packet) {
  var req = {
    id: packet.messageId,
    route: 'connector.mqttHandler.pubAck',
    body: {
      mid: packet.messageId
    }
  };

  this.subReqs[packet.messageId] = packet;

  client.emit('message', req);
};

/**
 * Publish message or subscription ack.
 *
 * if packet.id exist and this.subReqs[packet.id] exist then packet is a suback.
 * Subscription is request/response mode.
 * packet.id is pass from client in packet.messageId and record in Pomelo context and attached to the subscribe response packet.
 * packet.body is the context that returned by subscribe next callback.
 *
 * if packet.id not exist then packet is a publish message.
 * otherwise packet is a illegal packet.
 *
 * @param    {Object}  client mqtt-connection wrap socket
 * @param    {Object}  packet mqtt publish packet
 */
MqttAdaptor.prototype.publish = function(client, packet) {
  var mid = packet.id;
  var subreq = this.subReqs[mid];
  if (subreq) {
    // is suback
    client.socket.suback({
      messageId: mid,
      granted: packet.body
    });
    delete this.subReqs[mid];
    return;
  }

  client.socket.publish(packet.body);
};

module.exports = MqttAdaptor;