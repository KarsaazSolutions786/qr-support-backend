/**
 * Comprehensive test of multiple themed shapes
 */

const axios = require('axios');

const testShapes = [
    { name: 'star', category: 'Objects' },
    { name: 'heart', category: 'Nature' },
    { name: 'apple', category: 'Food' },
    { name: 'car', category: 'Objects' },
    { name: 'burger', category: 'Food' },
    { name: 'flower', category: 'Nature' },
    { name: 'home', category: 'Objects' }
];

async function testMultipleShapes() {
    console.log('🧪 Testing Multiple Themed Shapes\n');
    console.log('='.repeat(60));

    let successCount = 0;
    let failCount = 0;

    for (const shape of testShapes) {
        try {
            const response = await axios.post('http://localhost:3000/api/qr/preview', {
                type: 'url',
                data: {
                    url: `https://test.com/${shape.name}` + Date.now()
                },
                design: {
                    themed_shape: shape.name,
                    foreground_color: '#000000',
                    background_color: '#FFFFFF'
                },
                size: 512,
                quality: 90,
                use_laravel: true
            });

            if (response.data.data.strategy_reason === 'laravel_converted') {
                console.log(`\n✅ ${shape.name.toUpperCase()} (${shape.category})`);
                console.log(`   Strategy: ${response.data.data.strategy_reason}`);
                console.log(`   PNG Size: ${(response.data.data.images.png_base64.length / 1024).toFixed(2)} KB`);
                successCount++;
            } else {
                console.log(`\n⚠️  ${shape.name.toUpperCase()} - Unexpected strategy: ${response.data.data.strategy_reason}`);
                failCount++;
            }

        } catch (error) {
            console.log(`\n❌ ${shape.name.toUpperCase()} - Error: ${error.message}`);
            failCount++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Results: ${successCount}/${testShapes.length} successful`);

    if (successCount === testShapes.length) {
        console.log('\n🎉🎉🎉 ALL THEMED SHAPES WORKING PERFECTLY! 🎉🎉🎉\n');
    }
}

testMultipleShapes();
