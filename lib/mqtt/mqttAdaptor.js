var Constant = require('../util/constant');
var DEFAULT_SELF_DEFINED_ROUTE = false;

/**
 * MqttAdaptor adaptor for publish、subscribe message.
 *
 * @param    {Object}   opts configuration
 * @api public
 */
var MqttAdaptor = function(opts) {
  opts = opts || {};
  this.publishRoute = opts.publishRoute;
  this.subscribeRoute = opts.subscribeRoute;
  this.selfDefinedRoute = opts.selfDefinedRoute || DEFAULT_SELF_DEFINED_ROUTE;
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
  var id = packet.messageId;

  var payload = packet.payload;
  if (payload instanceof Buffer) {
    payload = payload.toString('utf8');
    payload = JSON.parse(payload);
    packet.payload = payload;
  }

  if (this.selfDefinedRoute) {
    route = payload.route;
    id = payload.id;
  }

  if (!route) {
    throw new Error('unspecified publish route.');
  }

  var req = {
    id: id,
    route: route,
    body: payload.body
  };

  client.emit('message', req);

  if (packet.qos === 1) {
    client.socket.puback({
      messageId: packet.messageId
    });
  }
};

/**
 * Publish message.
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
  var payload = packet;

  // just send qos 0 message
  // qos 1 message handled by application level
  client.socket.publish(packet);
  // client.socket.publish({
  //   topic: Constant.DEFAULT_TOPIC,
  //   payload: payload
  // });
};

module.exports = MqttAdaptor;