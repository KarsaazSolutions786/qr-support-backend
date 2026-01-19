const QRCodeGenerator = require('./src/services/qr/QRCodeGenerator');
const fs = require('fs');
const path = require('path');

async function debugDotRendering() {
    const generator = new QRCodeGenerator();

    console.log('=== Debugging Finder Dot Rendering ===\n');

    // Test with whirlpool + square dot (what user is seeing)
    const design = {
        finder: 'whirlpool',
        finderDot: 'square',  // Simple square dot
        module: 'square',
        eyeExternalColor: '#FF0000',  // Red finder
        eyeInternalColor: '#0000FF',  // Blue dot
        foregroundColor: '#000000',
        backgroundColor: '#FFFFFF',
        size: 500,
        margin: 4
    };

    console.log('Test: whirlpool finder + square dot');
    console.log('Expected: Blue square dot centered in red whirlpool\n');

    const result = await generator.generate('text', 'Debug Test', design);
    fs.writeFileSync(path.join(__dirname, 'debug_dot.svg'), result.svg);

    // Parse SVG to check transforms
    const svgContent = result.svg;

    // Check for finder paths
    const finderMatches = svgContent.match(/path[^>]*d="m 466\.66602/g);
    console.log(`Finder paths found: ${finderMatches ? finderMatches.length : 0}`);

    // Check for dot transforms
    const dotTransforms = svgContent.match(/translate\([^)]+\)\s*scale\([^)]+\)\s*translate\(-350,-350\)/g);
    console.log(`Dot centering transforms found: ${dotTransforms ? dotTransforms.length : 0}`);

    // Check for simple square paths (non-Laravel)
    const squarePaths = svgContent.match(/M\s+\d+\.?\d*\s+\d+\.?\d*\s+L[^Z]+Z/g);
    console.log(`Simple square paths found: ${squarePaths ? squarePaths.length : 0}`);

    // Find paths with blue color (internal color)
    const bluePathMatches = svgContent.match(/<path[^>]*fill="[^"]*0000FF[^"]*"[^>]*>/g);
    console.log(`\nBlue (internal color) paths: ${bluePathMatches ? bluePathMatches.length : 0}`);

    if (bluePathMatches && bluePathMatches.length > 0) {
        console.log('\nFirst blue path:');
        console.log(bluePathMatches.slice(0, 1).join('\n').substring(0, 200) + '...');
    }

    console.log('\n✓ Generated debug_dot.svg');
    console.log('Check the SVG to see if dots are rendering correctly');
}

debugDotRendering().catch(console.error);
