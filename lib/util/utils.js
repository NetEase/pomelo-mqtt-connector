var browser_zlib = require('browserify-zlib');
var node_zlib = require('zlib');

var Utils = {};

Utils.getZlib = function() {
	if (node_zlib['gzipSync'] && node_zlib['gunzipSync']) {
		return node_zlib;
	} else {
		return browser_zlib;
	}
}

module.exports = Utils;