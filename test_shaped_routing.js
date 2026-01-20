/**
 * Test Script: Verify Themed Shapes Route to Laravel
 * 
 * This test verifies that themed shapes are detected and sent to Laravel
 * for SVG generation, not handled by Node.js standalone.
 */

const axios = require('axios');

const NODE_BACKEND_URL = 'http://localhost:3000';

// Test all shape categories
const testShapes = [
    // Food & Beverage
    { name: 'apple', category: 'Food' },
    { name: 'star', category: 'Objects' },
    { name: 'heart', category: 'Nature' },
    { name: 'car', category: 'Objects' },
    { name: 'burger', category: 'Food' },

    // Services
    { name: 'gym', category: 'Services' },
    { name: 'plumber', category: 'Services' },

    // Add more as needed
];

async function testShapeRouting() {
    console.log('🧪 Testing Themed Shapes Routing to Laravel\\n');
    console.log('='.repeat(60));

    for (const shape of testShapes) {
        console.log(`\\n📋 Testing: ${shape.name} (${shape.category})`);

        try {
            const startTime = Date.now();

            const response = await axios.post(`${NODE_BACKEND_URL}/api/qr/preview`, {
                type: 'url',
                data: {
                    url: 'https://example.com?test=' + Date.now()  // ← Unique URL to bypass cache
                },
                design: {
                    themed_shape: shape.name,  // or shape: shape.name
                    foreground_color: '#000000',
                    background_color: '#FFFFFF'
                },
                size: 512,
                quality: 90,
                use_laravel: true  // ← Force Laravel routing
            });

            const duration = Date.now() - startTime;

            if (response.data.success) {
                const meta = response.data.data.meta;
                const reason = response.data.data.strategy_reason;

                // Check if it went through Laravel
                const usedLaravel = meta.laravel_source || reason.includes('laravel');

                if (usedLaravel) {
                    console.log(`  ✅ SUCCESS - Routed to Laravel`);
                    console.log(`     Strategy: ${reason}`);
                    console.log(`     Time: ${duration}ms`);
                } else {
                    console.log(`  ❌ FAILED - Used Node.js instead of Laravel`);
                    console.log(`     Strategy: ${reason}`);
                }
            } else {
                console.log(`  ❌ FAILED - Request failed`);
                console.log(`     Error: ${response.data.error?.message}`);
            }
        } catch (error) {
            console.log(`  ❌ ERROR - ${error.message}`);
            if (error.response?.data) {
                console.log(`     Details: ${JSON.stringify(error.response.data)}`);
            }
        }
    }

    console.log('\\n' + '='.repeat(60));
    console.log('✅ Test complete!');
}

// Run test
testShapeRouting().catch(console.error);
