/**
 * Test Flutter's themed shape request format
 * Check if 'shape' parameter is detected correctly
 */

const axios = require('axios');

async function testThemeemShapes() {
    console.log('🧪 Testing Themed Shapes (Outlined Shapes)\n');
    console.log('='.repeat(70));

    const tests = [
        {
            name: 'Star Shape (Flutter format)',
            design: {
                shape: 'star',  // Flutter sends 'shape' in camelCase
                foregroundColor: '#000000',
                backgroundColor: '#FFFFFF',
                frameColor: '#FF0000'
            }
        },
        {
            name: 'Heart Shape',
            design: {
                shape: 'heart',
                foregroundColor: '#FF1493',
                backgroundColor: '#FFFFFF',
                frameColor: '#FF0000'
            }
        },
        {
            name: 'Apple Shape',
            design: {
                shape: 'apple',
                foregroundColor: '#00FF00',
                backgroundColor: '#FFFFFF',
                frameColor: '#228B22'
            }
        }
    ];

    for (const test of tests) {
        try {
            console.log(`\n📤 Testing: ${test.name}`);

            const response = await axios.post('http://localhost:3000/api/qr/preview', {
                type: 'url',
                data: { url: 'https://test-shapes.com' },
                design: test.design,
                size: 512,
                quality: 90
            });

            const strategy = response.data.data.strategy_reason;
            const laravel = response.data.data.meta?.laravel_source;
            const pngSize = (response.data.data.images.png_base64.length / 1024).toFixed(2);

            if (strategy === 'laravel_converted' || strategy === 'cached') {
                console.log(`   ✅ ${test.name}: ${strategy} - ${pngSize} KB`);
            } else {
                console.log(`   ❌ ${test.name}: ${strategy} (NOT using Laravel!)`);
            }

        } catch (error) {
            console.log(`   ❌ ${test.name}: ERROR - ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(70));
}

testThemeemShapes();
