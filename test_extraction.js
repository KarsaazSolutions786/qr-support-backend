/**
 * FINAL TEST - Check if SVG extraction works by calling extractSvgFromResponse directly
 */

const laravelService = require('./src/services/laravelService');

// Simulate Laravel's actual response format
const mockLaravelResponse = {
    success: true,
    preview: {
        svg: '<svg xmlns="http://www.w3.org/2000/svg">TEST SVG</svg>'
    },
    meta: {}
};

console.log('\n=== Testing SVG Extraction Directly ===\n');
console.log('Mock response:', JSON.stringify(mockLaravelResponse, null, 2));

// This will call the actual extractSvgFromResponse method
const result = laravelService.extractSvgFromResponse(mockLaravelResponse);

console.log('\n=== Extraction Result ===');
console.log('Has SVG?:', !!result.svg);
console.log('SVG content:', result.svg);
console.log('Result:', JSON.stringify(result, null, 2));
