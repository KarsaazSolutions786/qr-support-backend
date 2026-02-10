const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/services/qr/index.flutter.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'qr-engine.bundle.js',
    library: {
      name: 'QREngine',
      type: 'var',
      export: 'default',
    },
    globalObject: 'this',
  },
  target: 'web',
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
    minimize: true,
  },
};
