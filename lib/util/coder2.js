var logger = require('pomelo-logger').getLogger("MqttConnector", "message-coder2");
var MqttGenerate = require('./generate');
var Constant = require('./constant');
var Utils = require('./utils');

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

var encode = function(reqId, route, msgBody) {
  if (reqId) {
    return composeResponse(reqId, route, msgBody);
  }

  return composePush(route, msgBody);
};

var decode = function(msg) {
  return JSON.parse(msg.body);
}

var composeKick = function() {
  // encode use dictionary
  var route = Constant.DEFAULT_KICK_ROUTE;

  var payload = JSON.stringify({
    route: route
  });

  var msg = {
    topic: Constant.DEFAULT_TOPIC,
    payload: payload
  }

  msg = MqttGenerate.publish(msg);

  return msg;
}

module.exports = {
  encode: encode,
  decode: decode,
  composeKick: composeKick
};