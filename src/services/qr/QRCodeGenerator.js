/**
 * QRCodeGenerator - Main orchestrator for QR code generation
 *
 * This is the primary entry point for generating QR codes.
 * It uses a processor pipeline pattern similar to Laravel's CompatibleSVGManager.
 *
 * Pipeline Order:
 * 1. ColorProcessor (5) - Handle colors and gradients
 * 2. ModuleProcessor (7) - Handle module shapes (Phase 2)
 * 3. FinderProcessor (8) - Handle finder patterns (Phase 3)
 * 4. LogoProcessor (200) - Handle logo embedding (Phase 5)
 * 5. FrameProcessor (110) - Handle advanced shapes (Phase 6)
 */
const QRCode = require('qrcode');
const sharp = require('sharp');
const QRDataEncoder = require('./QRDataEncoder');
const SVGBuilder = require('./SVGBuilder');
const ColorProcessor = require('./processors/ColorProcessor');
const ModuleProcessor = require('./processors/ModuleProcessor');
const FinderProcessor = require('./processors/FinderProcessor');
const LogoProcessor = require('./processors/LogoProcessor');
const FrameProcessor = require('./processors/FrameProcessor');
const StickerProcessor = require('./processors/StickerProcessor');
const logger = require('../../utils/logger');

/**
 * Default design configuration
 * Matches Laravel's design schema exactly
 */
const DEFAULT_DESIGN = {
    // Fill Type
    fillType: 'solid',           // 'solid' | 'gradient'

    // Colors
    foregroundColor: '#000000',
    backgroundColor: '#FFFFFF',
    eyeInternalColor: '#000000',
    eyeExternalColor: '#000000',
    backgroundEnabled: true,

    // Gradient
    gradientFill: null,

    // Module Shape
    module: 'square',            // square|dots|rounded|rhombus|diamond|vertical|horizontal|extra-rounded

    // Finder Pattern
    finder: 'square',            // default|rounded|circle|extra-rounded|eye-shaped|leaf|dot
    finderDot: 'square',         // default|circle|square

    // Logo
    logoUrl: null,
    logoType: 'preset',          // 'preset' | 'custom'
    logoScale: 0.2,
    logoPositionX: 0.5,
    logoPositionY: 0.5,
    logoRotate: 0,
    logoBackground: true,
    logoBackgroundFill: '#FFFFFF',
    logoBackgroundScale: 1.5,
    logoBackgroundShape: 'circle', // 'circle' | 'square'

    // Error Correction
    errorCorrection: 'M',        // L, M, Q, H

    // Size and Margins
    margin: 4,
    size: 512,

    // Advanced Shapes
    advancedShape: 'none',
    advancedShapeDropShadow: false,
    advancedShapeFrameColor: '#000000',
    advancedShapeTextColor: '#FFFFFF',
};

class QRCodeGenerator {
    constructor(options = {}) {
        this.options = options;

        // Initialize processors in order of execution
        this.processors = [
            new ColorProcessor(),           // Sort: 5
            new ModuleProcessor(),          // Sort: 7
            new FinderProcessor(),          // Sort: 8
            new StickerProcessor(),         // Sort: 105
            new FrameProcessor(),           // Sort: 110
            new LogoProcessor(),            // Sort: 200
        ];

        // Sort processors by sortOrder
        this.processors.sort((a, b) => a.sortOrder - b.sortOrder);

        // Create processor instances for path generation
        this.moduleProcessor = new ModuleProcessor();
        this.finderProcessor = new FinderProcessor();
        this.logoProcessor = new LogoProcessor();
        this.frameProcessor = new FrameProcessor();
        this.stickerProcessor = new StickerProcessor();
    }

    /**
     * Generate a QR code with full styling
     *
     * @param {string} type - QR code type (url, text, email, etc.)
     * @param {Object} data - Data to encode
     * @param {Object} design - Design configuration
     * @param {Object} options - Additional options (size, format, etc.)
     * @returns {Promise<Object>} - {svg: string, png: Buffer, base64: string}
     */
    async generate(type, data, design = {}, options = {}) {
        const startTime = Date.now();

        try {
            // Merge design with defaults
            const mergedDesign = this.mergeDesign(design);
            const size = options.size || mergedDesign.size || 512;

            logger.debug(`Generating QR code: type=${type}, size=${size}`);

            // Step 1: Encode data based on type
            const qrContent = QRDataEncoder.encode(type, data);
            logger.debug(`Encoded QR content: ${qrContent.substring(0, 100)}...`);

            // Step 2: Generate QR matrix
            const qrMatrix = await this.generateQRMatrix(qrContent, mergedDesign);

            // Step 3: Create SVG builder
            const svgBuilder = new SVGBuilder(size, size);

            // Step 4: Create processing payload
            const payload = {
                type,
                data,
                design: mergedDesign,
                options,
                qrContent,
                qrMatrix,
                svgBuilder,
                size,
                moduleSize: this.calculateModuleSize(qrMatrix.size, size, mergedDesign.margin),
                startX: 0,
                startY: 0,
            };

            // Calculate actual drawing area
            payload.startX = payload.moduleSize * mergedDesign.margin;
            payload.startY = payload.moduleSize * mergedDesign.margin;

            // Step 5: Run through processor pipeline
            for (const processor of this.processors) {
                if (processor.shouldProcess(payload)) {
                    logger.debug(`Running processor: ${processor.name}`);
                    await processor.process(payload);
                }
            }

            // Step 6: Build SVG from matrix and payload
            const svg = this.buildSVG(payload);

            // Step 7: PNG conversion disabled for Flutter (handled by Flutter Canvas)
            // const pngBuffer = await this.convertToPNG(svg, size, options);
            // const pngBase64 = pngBuffer.toString('base64');
            const pngBase64 = null; // PNG generation handled in Flutter

            const generationTime = Date.now() - startTime;
            logger.info(`QR code generated in ${generationTime}ms`);

            return {
                svg,
                svgBase64: Buffer.from(svg).toString('base64'),
                // png: pngBuffer, // PNG generation handled in Flutter
                // pngBase64, // PNG generation handled in Flutter
                meta: {
                    type,
                    size,
                    generationMs: generationTime,
                    moduleCount: qrMatrix.size,
                    errorCorrection: mergedDesign.errorCorrection,
                }
            };

        } catch (error) {
            logger.error(`QR generation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate a quick preview (optimized for speed)
     *
     * @param {string} type
     * @param {Object} data
     * @param {Object} design
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async generatePreview(type, data, design = {}, options = {}) {
        // Use smaller size for preview
        const previewOptions = {
            ...options,
            size: options.size || 256,
            quality: options.quality || 80,
        };

        return this.generate(type, data, design, previewOptions);
    }

    /**
     * Generate QR code matrix using qrcode library
     *
     * @param {string} content - Content to encode
     * @param {Object} design - Design with error correction level
     * @returns {Promise<Object>} - QR matrix data
     */
    async generateQRMatrix(content, design) {
        const errorCorrectionLevel = this.getErrorCorrectionLevel(design.errorCorrection);

        // Generate QR code data
        const qr = await QRCode.create(content, {
            errorCorrectionLevel,
        });

        // Extract matrix
        const modules = qr.modules;
        const size = modules.size;
        const data = modules.data;

        // Create a 2D matrix representation
        const matrix = [];
        for (let row = 0; row < size; row++) {
            matrix[row] = [];
            for (let col = 0; col < size; col++) {
                const idx = row * size + col;
                matrix[row][col] = data[idx] ? 1 : 0;
            }
        }

        return {
            size,
            data,
            matrix,
            version: qr.version,
        };
    }

    /**
     * Map error correction string to QRCode library level
     *
     * @param {string} level
     * @returns {string}
     */
    getErrorCorrectionLevel(level) {
        const levels = {
            'L': 'L',
            'M': 'M',
            'Q': 'Q',
            'H': 'H',
            'low': 'L',
            'medium': 'M',
            'quartile': 'Q',
            'high': 'H',
        };

        return levels[(level || 'M').toUpperCase()] || 'M';
    }

    /**
     * Calculate module size based on QR size, image size, and margin
     *
     * @param {number} qrSize - Number of modules in QR
     * @param {number} imageSize - Target image size
     * @param {number} margin - Margin in modules
     * @returns {number}
     */
    calculateModuleSize(qrSize, imageSize, margin) {
        const totalModules = qrSize + margin * 2;
        return imageSize / totalModules;
    }

    /**
     * Build the final SVG from payload
     *
     * @param {Object} payload
     * @returns {string}
     */
    buildSVG(payload) {
        const { svgBuilder, qrMatrix, design, size, moduleSize, startX, startY } = payload;
        const foregroundFill = payload.foregroundFill || '#000000';
        const backgroundColor = payload.backgroundColor || '#FFFFFF';
        const backgroundEnabled = payload.backgroundEnabled !== false;

        // Add background if enabled
        if (backgroundEnabled) {
            svgBuilder.addBackground(backgroundColor);
        }

        // Add frame elements (before QR) if present
        if (payload.frame) {
            const frameSVG = this.frameProcessor.generateFrameSVG(payload.frame, size, size);
            if (frameSVG.defs) {
                svgBuilder.addDef(frameSVG.defs);
            }
            if (frameSVG.beforeQR) {
                svgBuilder.addRaw(frameSVG.beforeQR);
            }
            // Store afterQR for later
            payload.frameAfterQR = frameSVG.afterQR;
        }

        // Get module shape from design or payload
        const moduleShape = payload.moduleShape || design.module || 'square';
        const paths = [];

        console.log(`[QRCodeGenerator] buildSVG using moduleShape: ${moduleShape}`);

        // Check if we need neighbor context (for classy shapes)
        const needsContext = ['classy', 'classy-rounded', 'classyRounded'].includes(moduleShape);

        let moduleCount = 0;
        for (let row = 0; row < qrMatrix.size; row++) {
            for (let col = 0; col < qrMatrix.size; col++) {
                if (qrMatrix.matrix[row][col]) {
                    const x = startX + col * moduleSize;
                    const y = startY + row * moduleSize;

                    // Check if this is part of a finder pattern (corners)
                    const isFinderPattern = this.isFinderPatternModule(row, col, qrMatrix.size);

                    if (!isFinderPattern) {
                        // Get neighbor context if needed
                        let context = {};
                        if (needsContext) {
                            context = ModuleProcessor.getNeighborContext(qrMatrix.matrix, row, col, qrMatrix.size);
                        }

                        // Generate module path using ModuleProcessor
                        const pathData = this.moduleProcessor.generateModulePath(moduleShape, x, y, moduleSize, context);
                        paths.push(pathData);
                        moduleCount++;

                        // Log first path to verify shape is correct
                        if (moduleCount === 1) {
                            console.log(`[QRCodeGenerator] First module path (${moduleShape}): ${pathData.substring(0, 100)}...`);
                        }
                    }
                }
            }
        }
        console.log(`[QRCodeGenerator] Generated ${moduleCount} module paths`);

        // Add all regular modules as a single path
        if (paths.length > 0) {
            svgBuilder.addPath(paths.join(' '), {
                fill: foregroundFill,
                fillRule: 'evenodd',
            });
        }

        // Add finder patterns (the three large squares in corners)
        this.addFinderPatterns(svgBuilder, payload);

        // Add sticker if present (processed by StickerProcessor)
        if (payload.sticker) {
            const stickerSVG = this.stickerProcessor.generateStickerSVG(payload.sticker, size);
            if (stickerSVG.defs) {
                svgBuilder.addDef(stickerSVG.defs);
            }
            if (stickerSVG.element) {
                svgBuilder.addRaw(stickerSVG.element);
            }
        }

        // Add logo if present (processed by LogoProcessor)
        if (payload.logo) {
            const logoSVG = this.logoProcessor.generateLogoSVG(payload.logo);
            if (logoSVG) {
                svgBuilder.addRaw(logoSVG);
            }
        }

        // Add frame elements (after QR/logo) if present
        if (payload.frameAfterQR) {
            svgBuilder.addRaw(payload.frameAfterQR);
        }

        return svgBuilder.build();
    }

    /**
     * Check if a module is part of a finder pattern
     *
     * @param {number} row
     * @param {number} col
     * @param {number} size
     * @returns {boolean}
     */
    isFinderPatternModule(row, col, size) {
        // Top-left finder pattern (0,0 to 6,6)
        if (row < 7 && col < 7) return true;

        // Top-right finder pattern
        if (row < 7 && col >= size - 7) return true;

        // Bottom-left finder pattern
        if (row >= size - 7 && col < 7) return true;

        return false;
    }

    /**
     * Add finder patterns to the SVG
     *
     * @param {SVGBuilder} svgBuilder
     * @param {Object} payload
     */
    addFinderPatterns(svgBuilder, payload) {
        const { qrMatrix, design, moduleSize, startX, startY } = payload;
        const foregroundFill = payload.foregroundFill || '#000000';
        const eyeExternalColor = payload.colors?.eyeExternalColor || foregroundFill;
        const eyeInternalColor = payload.colors?.eyeInternalColor || foregroundFill;

        // Get finder shapes from payload (set by FinderProcessor) or design
        const finderShape = payload.finderShape || design.finder || 'square';
        const finderDotShape = payload.finderDotShape || design.finderDot || finderShape;

        // Finder pattern positions (top-left, top-right, bottom-left)
        const positions = [
            { x: startX, y: startY },                                    // Top-left
            { x: startX + (qrMatrix.size - 7) * moduleSize, y: startY }, // Top-right
            { x: startX, y: startY + (qrMatrix.size - 7) * moduleSize }, // Bottom-left
        ];

        for (const pos of positions) {
            // Generate finder pattern paths using FinderProcessor
            const finderPaths = this.finderProcessor.generateFinderPattern(
                finderShape,
                finderDotShape,
                pos.x,
                pos.y,
                moduleSize
            );

            // Helper to add path (handles string or object with attrs)
            const addPath = (pathData, defaultAttrs) => {
                if (typeof pathData === 'object' && pathData !== null && pathData.d) {
                    svgBuilder.addPath(pathData.d, { ...defaultAttrs, ...pathData.attrs });
                } else if (typeof pathData === 'string') {
                    svgBuilder.addPath(pathData, defaultAttrs);
                }
            };

            // Outer ring
            addPath(finderPaths.outerPath, {
                fill: eyeExternalColor,
                fillRule: 'evenodd',
            });

            // Inner ring (hollow - white/background)
            const middleFill = payload.backgroundEnabled ?
                (payload.backgroundColor || '#FFFFFF') : 'white';
            addPath(finderPaths.innerPath, {
                fill: middleFill,
                fillRule: 'evenodd',
            });

            // Center dot
            addPath(finderPaths.dotPath, {
                fill: eyeInternalColor,
            });
        }
    }

    /**
     * Convert SVG to PNG (DISABLED for Flutter - use Flutter Canvas instead)
     */
    // async convertToPNG(svg, size, options = {}) {
    //   // Sharp conversion removed for Flutter bundle
    //   throw new Error('PNG conversion must be done in Flutter using Canvas API');
    // }

    /**
     * Merge user design with defaults
     *
     * @param {Object} design
     * @returns {Object}
     */
    mergeDesign(design) {
        if (!design) return { ...DEFAULT_DESIGN };

        // Handle snake_case to camelCase conversion
        const normalized = this.normalizeDesignKeys(design);

        return {
            ...DEFAULT_DESIGN,
            ...normalized,
        };
    }

    /**
     * Normalize design keys (handle both snake_case and camelCase)
     *
     * @param {Object} design
     * @returns {Object}
     */
    normalizeDesignKeys(design) {
        const keyMap = {
            'foreground_color': 'foregroundColor',
            'background_color': 'backgroundColor',
            'eye_internal_color': 'eyeInternalColor',
            'eye_external_color': 'eyeExternalColor',
            'background_enabled': 'backgroundEnabled',
            'fill_type': 'fillType',
            'gradient_fill': 'gradientFill',
            'finder_dot': 'finderDot',
            'logo_url': 'logoUrl',
            'logo_type': 'logoType',
            'logo_scale': 'logoScale',
            'logo_position_x': 'logoPositionX',
            'logo_position_y': 'logoPositionY',
            'logo_rotate': 'logoRotate',
            'logo_background': 'logoBackground',
            'logo_background_fill': 'logoBackgroundFill',
            'logo_background_scale': 'logoBackgroundScale',
            'logo_background_shape': 'logoBackgroundShape',
            'error_correction': 'errorCorrection',
            'advanced_shape': 'advancedShape',
            'advanced_shape_drop_shadow': 'advancedShapeDropShadow',
            'advanced_shape_frame_color': 'advancedShapeFrameColor',
            'advanced_shape_text_color': 'advancedShapeTextColor',
        };

        const normalized = {};

        for (const [key, value] of Object.entries(design)) {
            const normalizedKey = keyMap[key] || key;
            normalized[normalizedKey] = value;
        }

        return normalized;
    }

    /**
     * Get list of supported QR types
     *
     * @returns {string[]}
     */
    static getSupportedTypes() {
        return QRDataEncoder.getSupportedTypes();
    }

    /**
     * Get capabilities of this generator
     *
     * @returns {Object}
     */
    static getCapabilities() {
        return {
            version: '2.5.0',
            types: QRDataEncoder.getSupportedTypes(),
            features: {
                colors: {
                    solid: true,
                    gradient: true,
                    gradientTypes: ['LINEAR', 'RADIAL'],
                    eyeColors: true,
                    backgroundTransparency: true,
                },
                modules: {
                    shapes: ModuleProcessor.getSupportedShapes(),
                    status: 'available',
                },
                finders: {
                    shapes: FinderProcessor.getSupportedFinderShapes(),
                    dotShapes: FinderProcessor.getSupportedDotShapes(),
                    status: 'available',
                },
                logo: {
                    embedding: true,
                    positioning: true,
                    scaling: true,
                    rotation: true,
                    background: true,
                    status: 'available',
                },
                stickers: {
                    types: StickerProcessor.getSupportedStickers(),
                    dropShadow: true,
                    customColors: true,
                    customText: true,
                    status: 'available',
                },
                advancedShapes: {
                    shapes: FrameProcessor.getSupportedFrames(),
                    dropShadow: true,
                    status: 'available',
                },
                output: {
                    formats: ['svg', 'png'],
                    maxSize: 2048,
                    minSize: 64,
                },
                errorCorrection: ['L', 'M', 'Q', 'H'],
            },
        };
    }
}

// Export default design for reference
QRCodeGenerator.DEFAULT_DESIGN = DEFAULT_DESIGN;

module.exports = QRCodeGenerator;
