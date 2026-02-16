/**
 * Flutter Adapter for QR Code Generation Engine
 * Exposes QR generation functionality to flutter_js
 */

const QRCodeGenerator = require('./QRCodeGenerator');
const QRDataEncoder = require('./QRDataEncoder');
const SVGBuilder = require('./SVGBuilder');
const ColorProcessor = require('./processors/ColorProcessor');
const ModuleProcessor = require('./processors/ModuleProcessor');
const FinderProcessor = require('./processors/FinderProcessor');
const StickerProcessor = require('./processors/StickerProcessor');
const FrameProcessor = require('./processors/FrameProcessor');
const LogoProcessor = require('./processors/LogoProcessor');

/**
 * Main QR Engine API for Flutter
 */
class FlutterQREngine {
  constructor() {
    this.generator = new QRCodeGenerator();
    this.encoder = new QRDataEncoder();
  }

  /**
   * Generate QR code SVG (main entry point)
   * @param {Object} params - { type, data, design, options }
   * @returns {Object} - { svg, svgBase64, meta }
   */
  generateSVG(params) {
    try {
      const { type, data, design, options = {} } = params;

      // Encode QR data
      const qrPayload = this.encoder.encode(type, data);

      // Generate QR matrix
      const qrMatrix = this.generator.generateQRMatrix(
        qrPayload,
        design
      );

      // Create SVG builder
      const builder = new SVGBuilder({
        size: options.size || 512,
        moduleCount: qrMatrix.moduleCount,
      });

      // Prepare payload for processors
      const payload = {
        qrMatrix,
        design: this.generator.mergeDesign(design),
        builder,
        options,
      };

      // Run processor pipeline
      const processors = [
        new ColorProcessor(),
        new ModuleProcessor(),
        new FinderProcessor(),
        new StickerProcessor(),
        new FrameProcessor(),
        new LogoProcessor(),
      ];

      // Sort by priority
      processors.sort((a, b) => a.sortOrder - b.sortOrder);

      // Execute processors sequentially
      for (const processor of processors) {
        if (processor.shouldProcess(payload)) {
          // Note: In Flutter environment, we must use synchronous processing
          processor.process(payload);
        }
      }

      // Build final SVG
      const svg = builder.build();

      // Convert to base64 using Buffer (already available via webpack polyfill)
      const svgBase64 = Buffer.from(svg).toString('base64');

      return {
        success: true,
        svg,
        svgBase64,
        meta: {
          type,
          moduleCount: qrMatrix.moduleCount,
          size: options.size || 512,
          renderEngine: 'javascript',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Validate design configuration
   * @param {Object} design
   * @returns {Object} - { valid, errors }
   */
  validateDesign(design) {
    const errors = [];

    // Validate colors
    if (design.foregroundColor && !this._isValidColor(design.foregroundColor)) {
      errors.push('Invalid foregroundColor');
    }

    // Validate module shape
    const validModules = [
      'square', 'dots', 'rounded', 'extra-rounded', 'rhombus',
      'diamond', 'vertical', 'horizontal', 'triangle', 'star',
      'star-5', 'star-7', 'heart', 'fish', 'tree',
    ];
    if (design.module && !validModules.includes(design.module)) {
      errors.push(`Invalid module: ${design.module}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get supported features
   * @returns {Object}
   */
  getCapabilities() {
    return {
      qrTypes: [
        'url', 'text', 'email', 'phone', 'sms', 'wifi', 'vcard',
        'location', 'event', 'whatsapp', 'social', 'crypto', 'upi', 'pix',
      ],
      moduleShapes: [
        'square', 'dots', 'rounded', 'extra-rounded', 'rhombus',
        'diamond', 'vertical', 'horizontal', 'triangle', 'star',
        'star-5', 'star-7', 'heart', 'fish', 'tree', 'classy',
        'classy-rounded', 'roundness', 'twoTrianglesWithCircle',
        'fourTriangles', 'triangle-end',
      ],
      finderPatterns: [
        'default', 'eye-shaped', 'octagon', 'rounded-corners',
        'whirlpool', 'water-drop', 'circle', 'zigzag', 'circle-dots',
      ],
      outlinedShapes: [
        'circle', 'cloud', 'shopping-cart', 'gift', 'cup', 't-shirt',
        'home', 'book', 'message', 'bag', 'truck', 'trophy', 'umbrella',
        // ... 60+ shapes
      ],
      advancedShapes: [
        'rect-frame-text-top', 'rect-frame-text-bottom',
        'simple-text-bottom', 'simple-text-top', 'four-corners-text-top',
        'four-corners-text-bottom', 'coupon', 'review-collector',
        'healthcare', 'pincode-protected', 'qrcode-details',
      ],
      features: {
        gradients: true,
        logos: true,
        stickers: true,
        frames: true,
        customColors: true,
      },
    };
  }

  _isValidColor(color) {
    return /^#[0-9A-Fa-f]{6}$/.test(color) || /^#[0-9A-Fa-f]{3}$/.test(color);
  }
}

// Export for webpack
module.exports = FlutterQREngine;

// Expose globally for flutter_js (use robust detection)
(function() {
  var g = (typeof globalThis !== 'undefined') ? globalThis : 
          (typeof window !== 'undefined') ? window : 
          (typeof global !== 'undefined') ? global : 
          (typeof self !== 'undefined') ? self : this;
          
  if (g) {
    g.QREngine = FlutterQREngine;
    g.FlutterQREngine = FlutterQREngine;
  }
})();
