/**
 * Test Laravel Endpoint Directly
 * 
 * This tests the Laravel /api/flutter/preview endpoint directly
 * to see if it can handle shaped QR requests
 */

const axios = require('axios');

const LARAVEL_URL = 'http://127.0.0.1:8000';

async function testLaravelDirect() {
    console.log('🧪 Testing Laravel Endpoint Directly\n');
    console.log('='.repeat(60));

    // Test 1: Simple request without shape
    console.log('\n📋 Test 1: Simple QR (no shape)');
    try {
        const response = await axios.post(`${LARAVEL_URL}/api/flutter/preview`, {
            type: 'url',
            data: {
                url: 'https://example.com'
            },
            design: {
                foreground_color: '#000000',
                background_color: '#FFFFFF'
            }
        });

        console.log('  ✅ SUCCESS');
        console.log(`     Status: ${response.status}`);
        console.log(`     Has SVG: ${!!response.data?.data?.svg || !!response.data?.svg}`);
    } catch (error) {
        console.log('  ❌ FAILED');
        console.log(`     Error: ${error.message}`);
        if (error.response) {
            console.log(`     Status: ${error.response.status}`);
            console.log(`     Data: ${JSON.stringify(error.response.data)}`);
        }
    }

    // Test 2: Request with themed shape
    console.log('\n📋 Test 2: Shaped QR (star)');
    try {
        const response = await axios.post(`${LARAVEL_URL}/api/flutter/preview`, {
            type: 'url',
            data: {
                url: 'https://example.com'
            },
            design: {
                foreground_color: '#000000',
                background_color: '#FFFFFF',
                shape: 'star'  // Themed shape
            }
        });

        console.log('  ✅ SUCCESS');
        console.log(`     Status: ${response.status}`);
        console.log(`     Has SVG: ${!!response.data?.data?.svg || !!response.data?.svg}`);

        // Check response structure
        const keys = Object.keys(response.data || {});
        console.log(`     Response keys: ${keys.join(', ')}`);

        if (response.data?.data) {
            const dataKeys = Object.keys(response.data.data);
            console.log(`     Data keys: ${dataKeys.join(', ')}`);
        }
    } catch (error) {
        console.log('  ❌ FAILED');
        console.log(`     Error: ${error.message}`);
        if (error.response) {
            console.log(`     Status: ${error.response.status}`);
            console.log(`     Data: ${JSON.stringify(error.response.data, null, 2)}`);
        }
    }

    // Test 3: Check the exact endpoint Node.js uses
    console.log('\n📋 Test 3: With format=svg parameter');
    try {
        const response = await axios.post(`${LARAVEL_URL}/api/flutter/preview`, {
            type: 'url',
            data: {
                url: 'https://example.com'
            },
            design: {
                shape: 'star'
            },
            output_format: 'svg',
            format: 'svg'
        });

        console.log('  ✅ SUCCESS');
        console.log(`     Status: ${response.status}`);

        // Try to find SVG in response
        let foundSvg = false;
        if (response.data?.data?.svg) {
            console.log(`     ✅ Found SVG at data.svg`);
            console.log(`     SVG length: ${response.data.data.svg.length}`);
            foundSvg = true;
        } else if (response.data?.svg) {
            console.log(`     ✅ Found SVG at root.svg`);
            console.log(`     SVG length: ${response.data.svg.length}`);
            foundSvg = true;
        } else {
            console.log(`     ❌ No SVG found`);
            console.log(`     Response structure: ${JSON.stringify(Object.keys(response.data), null, 2)}`);
        }
    } catch (error) {
        console.log('  ❌ FAILED');
        console.log(`     Error: ${error.message}`);
        if (error.response) {
            console.log(`     Status: ${error.response.status}`);
            console.log(`     Message: ${error.response.data?.message || 'unknown'}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Laravel endpoint test complete!');
}

// Run test
testLaravelDirect().catch(console.error);
