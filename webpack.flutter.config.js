const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  entry: './src/services/qr/index.flutter.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'qr-engine.bundle.js',
    library: {
      name: ['__flutterJsTemp__'],  // Temporary variable name
      type: 'var',  // Simple var declaration
    },
    globalObject: 'globalThis',
  },
  plugins: [
    // Manually assign to globalThis and this after the var declaration
    new webpack.BannerPlugin({
      banner: `
(function(root) {
  'use strict';
  
  // Polyfills for modern JS features potentially missing in QuickJS/flutter_js
  
  // Object.hasOwn (ES2022)
  if (typeof Object.hasOwn === 'undefined') {
    Object.hasOwn = function(obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    };
  }
  
  // Math.cbrt (ES6)
  if (typeof Math.cbrt === 'undefined') {
    Math.cbrt = function(x) {
      var y = Math.pow(Math.abs(x), 1/3);
      return x < 0 ? -y : y;
    };
  }
  
  // Math.trunc (ES6)
  if (typeof Math.trunc === 'undefined') {
    Math.trunc = function(v) {
      v = +v;
      if (!isFinite(v)) return v;
      return (v - v % 1) || (v < 0 ? -0 : v === 0 ? v : 0);
    };
  }
  
  // String.prototype.replaceAll (ES2021)
  if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function(str, newStr) {
      if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') {
        return this.replace(str, newStr);
      }
      return this.split(str).join(newStr);
    };
  }
  
  // Array.prototype.at (ES2022)
  if (!Array.prototype.at) {
    Array.prototype.at = function(index) {
      index = Math.trunc(index) || 0;
      if (index < 0) index += this.length;
      if (index < 0 || index >= this.length) return undefined;
      return this[index];
    };
  }

  // Original bundle starts here
`,
      raw: true,
      entryOnly: true,
    }),
    new webpack.BannerPlugin({
      banner: `
  // Original bundle ends here
  // Now expose on global object
  var g = (typeof globalThis !== 'undefined') ? globalThis : 
          (typeof window !== 'undefined') ? window : 
          (typeof global !== 'undefined') ? global : 
          (typeof self !== 'undefined') ? self : root;
          
  if (typeof __flutterJsTemp__ !== 'undefined') {
    g.QREngine = __flutterJsTemp__;
    g.FlutterQREngine = __flutterJsTemp__;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this)));
`,
      raw: true,
      entryOnly: true,
      footer: true,
    }),
  ],
  target: 'web',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules\/(?!(color|color-string|color-convert)\/).*/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  browsers: ['ie 11']
                },
                modules: 'commonjs'
              }]
            ]
          }
        }
      }
    ]
  },
  resolve: {
    alias: {
      // Replace winston logger with browser-compatible version
      '../../utils/logger': path.resolve(__dirname, 'src/utils/logger.browser.js'),
    },
    fallback: {
      "buffer": require.resolve("buffer/"),
      "stream": require.resolve("stream-browserify"),
      "util": require.resolve("util/"),
      "crypto": false,
      "fs": false,
      "path": false,
      "http": false,
      "https": false,
      "os": false,
      "zlib": false,
    },
  },
  externals: {
    // Exclude Sharp - we'll handle PNG in Flutter
    'sharp': 'null',
  },
  optimization: {
    minimize: false,
  },
};
