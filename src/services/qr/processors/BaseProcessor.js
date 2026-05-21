/**
 * Purpose: BaseProcessor - Abstract base class for all QR code processors This follows the processor pipeline pattern similar to Laravel's CompatibleSVGManager. Each processor handles a specific aspect of QR code styling/generation.
 * Owner/Author: Syed Ashhad
 * Created/Updated: January 2026
 */

class BaseProcessor {
    /**
     * Purpose: Constructor for constructor.
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    constructor(name, sortOrder = 100) {
        if (new.target === BaseProcessor) {
            throw new Error('BaseProcessor is abstract and cannot be instantiated directly');
        }
        this.name = name;
        this.sortOrder = sortOrder;
    }

    /**
     * Purpose: Check if this processor should process the given payload Override in subclasses to add conditions
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    shouldProcess(payload) {
        return true;
    }

    /**
     * Purpose: Process the payload Must be implemented by subclasses
     * Owner/Author: Syed Ashhad
     * Created: January 2026
     * Last Editor: Syed Ashhad
     * Last Updated: February 2026
     */
    
    process(payload) {
        throw new Error(`${this.name}: process() method must be implemented`);
    }

    /**
     * Purpose: Helper to safely get a design property with default value
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    getDesignValue(design, key, defaultValue = null) {
        if (!design || design[key] === undefined || design[key] === null) {
            return defaultValue;
        }
        return design[key];
    }

    /**
     * Purpose: Helper to safely get a nested design property
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
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
     * Purpose: Log processor activity
     * Owner/Author: Syed Ashhad
     * Created/Updated: January 2026
     */
    
    log(message, level = 'debug') {
        const logger = require('../../../utils/logger');
        logger[level](`[${this.name}] ${message}`);
    }
}

module.exports = BaseProcessor;
