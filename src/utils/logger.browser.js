/**
 * Browser-compatible logger
 * Replaces winston for Flutter JavaScript bundle
 */

const logger = {
  info: (message) => {
    if (typeof console !== 'undefined') {
      console.log(`[INFO] ${message}`);
    }
  },
  debug: (message) => {
    if (typeof console !== 'undefined') {
      console.log(`[DEBUG] ${message}`);
    }
  },
  warn: (message) => {
    if (typeof console !== 'undefined') {
      console.warn(`[WARN] ${message}`);
    }
  },
  error: (message) => {
    if (typeof console !== 'undefined') {
      console.error(`[ERROR] ${message}`);
    }
  },
};

module.exports = logger;
