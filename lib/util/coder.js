var logger = require('pomelo-logger').getLogger("MqttConnector", "message-coder");
var Message = require('pomelo-protocol').Message;
var Protocol = require('pomelo-protocol');
var MqttGenerate = require('./generate');
var Constant = require('./constant');
var Coder2 = require('./coder2');
var Utils = require('./utils');
var zlib = Utils.getZlib();

var encode = function(reqId, route, msg) {
  if (!this.compress) {
    return Coder2.encode(reqId, route, msg);
  }

  if (reqId) {
    return composeResponse(this, reqId, route, msg);
  } else {
    return composePush(this, route, msg);
  }
};

var decode = function(msg) {
  if (!this.compress) {
    return Coder2.decode(msg);
  }

  var dmsg = Message.decode(msg.body);

  if (dmsg.compressGzip) {
    if (this.useGzipCompress) {
      logger.debug('[decode] gzip decompress');
      dmsg.body = zlib.gunzipSync(dmsg.body);
    } else {
      return logger.error('gunzip error! useGzipCompress flag not enabled .');
    }
  }

  var route = dmsg.route;

  // decode use dictionary
  if (dmsg.compressRoute) {
    if (this.useRouteCompress) {
      var abbrs = this.dictionary.getAbbrs();
      if (!abbrs[route]) {
        return logger.error('dictionary error! no abbrs for route : %s', route);
      }
      logger.debug('[decode] route using route decompress %d %s', route, abbrs[route]);
      route = dmsg.route = abbrs[route];
    } else {
      return logger.error('dictionary error! useRouteCompress flag not enabled .');
    }
  }

  // decode use protobuf
  if (this.useProtobufCompress && this.decodeIO_protobuf && this.decodeIO_protobuf.check(Constant.TYPE_CLIENT, route)) {
    dmsg.body = this.decodeIO_protobuf.decode(route, dmsg.body);
    logger.debug('[decode] body using protobuf msg %j', dmsg.body);
  } else {
    dmsg.body = JSON.parse(Protocol.strdecode(dmsg.body));
    // dmsg.body = JSON.parse(dmsg.body.toString('utf8'));
    logger.debug('[decode] body using json msg %j', dmsg.body);
  }

  return dmsg;
};

var composeResponse = function(server, msgId, route, msgBody) {
  if (!msgId || !route || !msgBody) {
    return;
  }

  var encodeMsgBody = encodeBody(server, route, msgBody);

  var gzipResult = composeGzip(server, encodeMsgBody);
  var compressGzip = gzipResult['compressGzip'];
  encodeMsgBody = gzipResult['result'];

  var payload = Message.encode(msgId, Message.TYPE_RESPONSE, 0, null, encodeMsgBody, compressGzip);

  var msg = {
    topic: Constant.DEFAULT_TOPIC,
    payload: payload
  };

  msg = MqttGenerate.publish(msg);

  if (!msg) {
    logger.error('composeResponse invalid mqtt publish message: %j', msgBody);
  }

  return msg;
};

var composePush = function(server, route, msgBody) {
  if (!route || !msgBody) {
    return;
  }

  var encodeMsgBody = encodeBody(server, route, msgBody);

  var gzipResult = composeGzip(server, encodeMsgBody);
  var compressGzip = gzipResult['compressGzip'];
  encodeMsgBody = gzipResult['result'];

  var routeResult = composeRoute(server, route);
  var compressRoute = routeResult['compressRoute'];
  var route = routeResult['route'];

  var payload = Message.encode(0, Message.TYPE_PUSH, compressRoute, route, encodeMsgBody, compressGzip);

  var msg = {
    topic: Constant.DEFAULT_TOPIC,
    payload: payload
  }

  msg = MqttGenerate.publish(msg);

  if (!msg) {
    logger.error('composePush invalid mqtt publish message: %j', msgBody);
  }

  return msg;
};

var composeKick = function() {
  var server = this;

  // encode use dictionary
  var route = Constant.DEFAULT_KICK_ROUTE;
  var routeResult = composeRoute(server, route);
  var compressRoute = routeResult['compressRoute'];
  var route = routeResult['route'];

  var payload = Message.encode(0, Message.TYPE_PUSH, compressRoute, route, null);

  var msg = {
    topic: Constant.DEFAULT_TOPIC,
    payload: payload
  }

  msg = MqttGenerate.publish(msg);

  return msg;
}

var encodeBody = function(server, route, msgBody) {
  // encode use protobuf
  var connector = server;
  var decodeIO_protobuf = connector.decodeIO_protobuf;
  if (connector.useProtobufCompress && decodeIO_protobuf && decodeIO_protobuf.check(Constant.TYPE_SERVER, route)) {
    logger.debug('[encodeBody] using protobuf %s %j', route, msgBody);
    msgBody = decodeIO_protobuf.encode(route, msgBody);
  } else {
    logger.debug('[encodeBody] using json %s %j', route, msgBody);
    msgBody = new Buffer(JSON.stringify(msgBody), 'utf8');
  }

  return msgBody;
};

var composeRoute = function(server, route) {
  // encode use dictionary
  var compressRoute = 0;
  if (server.dictionary && server.useRouteCompress) {
    var dict = server.dictionary.getDict();
    if (dict[route]) {
      logger.debug('[route compress] %s %s', route, dict[route]);
      route = dict[route];
      compressRoute = 1;
    }
  }

  return {
    route: route,
    compressRoute: compressRoute
  }
}

var composeGzip = function(server, payload) {
  var compressGzip = 0;

  var len = payload.length;
  if (server.useGzipCompress && server.gzipCompressSize < len) {
    compressGzip = 1;
    payload = zlib.gzipSync(payload);
    logger.debug('[gzip compress] message old size %d, gziped size %d', len, payload.length);
  }

  return {
    result: payload,
    compressGzip: compressGzip
  }
}

module.exports = {
  encode: encode,
  decode: decode,
  composeKick: composeKick
};