## pomelo-mqtt-connector

pomelo mqtt connector based on mqtt over tcp and over ws protocol  

## Usage

```
var MqttConnector = require('pomelo-mqtt-connector');

// in pomelo app.configure setup mqtt connector configuration
app.configure('all', 'connector', function() {
	app.set('connectorConfig', {
		connector: MqttConnector,
		useProtobufCompress: true,
		useRouteCompress: true,
		useGzipCompress: true,
		app: app
	});
});
```

## Options

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