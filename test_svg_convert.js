const sharp = require('sharp');
const fs = require('fs');

async function testConvert() {
    try {
        const svgContent = fs.readFileSync('debug_laravel.svg');
        console.log('Read SVG file, size:', svgContent.length);

        console.log('Attempting conversion...');
        const pngBuffer = await sharp(svgContent, { density: 150 })
            .resize(500, 500)
            .png()
            .toBuffer();

        console.log('✅ Conversion success! PNG size:', pngBuffer.length);
        fs.writeFileSync('debug_laravel.png', pngBuffer);
    } catch (error) {
        console.error('❌ Conversion failed:', error.message);
    }
}

testConvert();
