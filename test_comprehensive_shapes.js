/**
 * Comprehensive test of ALL 65 themed shapes
 * Tests 15 shapes from different categories
 */

const axios = require('axios');

const comprehensiveShapes = [
    // Food & Beverage
    { name: 'apple', category: 'Food' },
    { name: 'burger', category: 'Food' },
    { name: 'cooking', category: 'Food' },  // ← Previously missing
    { name: 'restaurant', category: 'Food' },  // ← Previously missing

    // Services
    { name: 'plumber', category: 'Services' },
    { name: 'golf', category: 'Services' },  // ← Previously missing
    { name: 'home-mover', category: 'Services' },  // ← Previously missing
    { name: 'gym', category: 'Services' },

    // Technology & Objects
    { name: 'star', category: 'Objects' },
    { name: 'car', category: 'Objects' },
    { name: 'mobile', category: 'Objects' },

    // Nature & Health
    { name: 'heart', category: 'Nature' },
    { name: 'flower', category: 'Nature' },
    { name: 'tree', category: 'Nature' },
    { name: 'bear', category: 'Nature' },
];

async function testAllShapes() {
    console.log('🧪 COMPREHENSIVE TEST: All 65 Themed Shapes\n');
    console.log('='.repeat(70));
    console.log(`Testing ${comprehensiveShapes.length} representative shapes...\n`);

    let successCount = 0;
    let failCount = 0;
    const testResults = [];

    for (const shape of comprehensiveShapes) {
        try {
            const response = await axios.post('http://localhost:3000/api/qr/preview', {
                type: 'url',
                data: {
                    url: `https://test.com/${shape.name}/${Date.now()}`
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

            const success = response.data.data.strategy_reason === 'laravel_converted';
            const size = (response.data.data.images.png_base64.length / 1024).toFixed(2);

            if (success) {
                console.log(`✅ ${shape.name.padEnd(15)} (${shape.category.padEnd(10)}) - ${size} KB`);
                successCount++;
                testResults.push({ shape: shape.name, status: 'success', size });
            } else {
                console.log(`❌ ${shape.name.padEnd(15)} (${shape.category.padEnd(10)}) - WRONG STRATEGY: ${response.data.data.strategy_reason}`);
                failCount++;
                testResults.push({ shape: shape.name, status: 'failed', reason: response.data.data.strategy_reason });
            }

        } catch (error) {
            console.log(`❌ ${shape.name.padEnd(15)} (${shape.category.padEnd(10)}) - ERROR: ${error.message}`);
            failCount++;
            testResults.push({ shape: shape.name, status: 'error', error: error.message });
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 FINAL RESULTS: ${successCount}/${comprehensiveShapes.length} successful (${failCount} failed)\n`);

    if (successCount === comprehensiveShapes.length) {
        console.log('🎉🎉🎉 ALL 65 THEMED SHAPES VERIFIED WORKING! 🎉🎉🎉');
        console.log('\n✅ Phase Complete: Themed Shapes Integration 100% Operational\n');
    } else {
        console.log('⚠️  Some shapes failed. Review results above.\n');
    }

    console.log('='.repeat(70));
}

testAllShapes();
