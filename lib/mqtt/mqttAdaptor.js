var logger = require('pomelo-logger').getLogger('MqttConnector', 'MqttAdaptor');
var Constant = require('../util/constant');

/**
 * MqttAdaptor adaptor for publish、subscribe message.
 *
 * @param    {Object}   opts configuration
 * @api public
 */
var MqttAdaptor = function(opts, connector) {
  opts = opts || {};
  this.connector = connector;
};

/**
 * MqttAdaptor onPublish message
 *
 * @param    {Object}  client mqtt-connection wrap socket, MqttSocket
 * @param    {Object}  packet mqtt publish packet
 * @api public
 */
MqttAdaptor.prototype.onPublish = function(client, packet) {
  var messageId = packet.messageId;

  var topic = packet.topic;
  var payload = packet.payload;

  var req = {
    topic: topic,
    body: payload
  };

  if (topic == Constant.HANDSHAKE_TOPIC) {
    if (this.connector.compress) {
      this.onHandshake(client, req);
    } else {
      client['kickMsg'] = this.connector.composeKick2();
      this.onHandshake2(client, req);
    }
  } else {
    if (client.checkReady()) {
      client.emit('message', req);
    } else {
      // client not ready, publish message is not allowed
      logger.warn("client not ready, publish message is not allowed");
      client.disconnect();
    }
  }

  if (packet.qos === 1) {
    client.socket.puback({
      messageId: messageId
    });
  }
};

MqttAdaptor.prototype.onHandshake = function(client, msg) {
  if (this.beforeHandshake(client)) {
    return;
  }

  var handshakeMsg = this.connector.decode(msg);

  var dictionary = this.connector.dictionary;
  var protobuf = this.connector.decodeIO_protobuf;

  var dict = this.connector.useRouteCompress ? dictionary.getDict() : {};
  var protos = this.connector.useProtobufCompress ? protobuf.getProtos() : {};

  var body = handshakeMsg.body;
  var resp = null;
  if (body && body.reconnect) {
    resp = {
      code: Constant.CODE_OK
    }
  } else {
    resp = {
      sys: {
        dict: dict,
        protos: protos
      }
    }
  }

  var data = this.connector.encode(handshakeMsg.id, handshakeMsg.route, resp);
  client.handshakeResp(data);
}

MqttAdaptor.prototype.onHandshake2 = function(client, msg) {
  if (this.beforeHandshake(client)) {
    return;
  }

  var handshakeMsg = JSON.parse(msg.body.toString());

  var data = this.connector.encode2(handshakeMsg.id, handshakeMsg.route);
  client.handshakeResp(data);
}

MqttAdaptor.prototype.beforeHandshake = function(client) {
  if (client.checkAttack()) {
    return true;
  }

  if (client.checkHandshake()) {
    // logger.warn("already in working state, do not handshake again and again");
    return true;
  }

  return false;
}

/**
 * Publish message.
 */
MqttAdaptor.prototype.publish = function(client, packet) {
  // just send qos 0 message
  // qos 1 message handled by application level
  client.socket.publish(packet);
};

module.exports = MqttAdaptor;