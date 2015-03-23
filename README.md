## pomelo-mqtt-connector

pomelo mqtt connector based on mqtt over tcp and over ws protocol  

## Usage

```
var MqttConnector = require('pomelo-mqtt-connector');

// in pomelo app.configure setup mqtt connector configuration
app.configure('all', 'connector', function() {
	app.set('connectorConfig', {
		connector: MqttConnector,
		publishRoute: 'connector.mqttHandler.publish',
		subscribeRoute: 'connector.mqttHandler.subscribe',
		encode: MqttConnector.encode
	});
});
```

## Options

* @param   {Boolean} opts.distinctHost        setup to listen to distinctHost
* @param   {Boolean} opts.timeout             setup connect, message timeout time default 90s
* @param   {Boolean} opts.setNoDelay          setup tcpNoDelay default true
* @param   {Boolean} opts.disconnectOnTimeout setup true to disconnect client when timeout default true
* @param   {String}  opts.publishRoute        mqttConnector publish message route for pomelo message routing like connector.mqttHandler.publish
* @param   {String}  opts.subscribeRoute      mqttConnector subscribe message route for pomelo message routing like connector.mqttHandler.subscribe

## License

(The MIT License)

Copyright (c) 2012-2015 NetEase, Inc. and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.