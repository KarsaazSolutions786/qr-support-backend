/**
 * BaseProcessor - Abstract base class for all QR code processors
 *
 * This follows the processor pipeline pattern similar to Laravel's CompatibleSVGManager.
 * Each processor handles a specific aspect of QR code styling/generation.
 */
class BaseProcessor {
    /**
     * @param {string} name - Processor name for logging
     * @param {number} sortOrder - Order in which processors execute (lower = earlier)
     */
    constructor(name, sortOrder = 100) {
        if (new.target === BaseProcessor) {
            throw new Error('BaseProcessor is abstract and cannot be instantiated directly');
        }
        this.name = name;
        this.sortOrder = sortOrder;
    }

    /**
     * Check if this processor should process the given payload
     * Override in subclasses to add conditions
     *
     * @param {Object} payload - The processing payload
     * @param {Object} payload.design - Design configuration
     * @param {Object} payload.qrMatrix - QR code matrix data
     * @param {string} payload.svg - Current SVG string
     * @returns {boolean} - Whether to process
     */
    shouldProcess(payload) {
        return true;
    }

    /**
     * Process the payload
     * Must be implemented by subclasses
     *
     * @param {Object} payload - The processing payload
     * @returns {Object} - Modified payload
     */
    process(payload) {
        throw new Error(`${this.name}: process() method must be implemented`);
    }

    /**
     * Helper to safely get a design property with default value
     *
     * @param {Object} design - Design object
     * @param {string} key - Property key
     * @param {*} defaultValue - Default value if property doesn't exist
     * @returns {*} - Property value or default
     */
    getDesignValue(design, key, defaultValue = null) {
        if (!design || design[key] === undefined || design[key] === null) {
            return defaultValue;
        }
        return design[key];
    }

    /**
     * Helper to safely get a nested design property
     *
     * @param {Object} design - Design object
     * @param {string} path - Dot-separated path (e.g., 'gradientFill.type')
     * @param {*} defaultValue - Default value if property doesn't exist
     * @returns {*} - Property value or default
     */
    getNestedValue(design, path, defaultValue = null) {
        if (!design) return defaultValue;

        const keys = path.split('.');
        let value = design;

        for (const key of keys) {
            if (value === undefined || value === null || typeof value !== 'object') {
                return defaultValue;
            }
            value = value[key];
        }

        return value !== undefined && value !== null ? value : defaultValue;
    }

    /**
     * Log processor activity
     *
     * @param {string} message - Message to log
     * @param {string} level - Log level (debug, info, warn, error)
     */
    log(message, level = 'debug') {
        const logger = require('../../../utils/logger');
        logger[level](`[${this.name}] ${message}`);
    }
}

module.exports = BaseProcessor;
