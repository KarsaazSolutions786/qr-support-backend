/**
 * REAL FLUTTER TEST - Simulate EXACT Flutter request
 * Based on what Flutter ACTUALLY sends
 */

const axios = require('axios');
const fs = require('fs');

async function testRealFlutterRequest() {
    console.log('🔍 Testing REAL Flutter Sticker Request\n');
    console.log('='.repeat(70));

    // This is what Flutter QRRenderingService actually sends
    // Based on qr_rendering_service.dart line 29-36
    const realFlutterRequest = {
        type: 'url',
        data: {
            url: 'https://example.com'
        },
        design: {
            // All parameters Flutter sends in camelCase
            advancedShape: 'healthcare',
            text: 'SCAN ME',
            textColor: '#ffffff',
            textBackgroundColor: '#1c57cb',
            foregroundColor: '#000000',
            backgroundColor: '#ffffff',
            module: 'square',
            finder: 'default',
            finderDot: 'default',
            shape: 'none',
            fillType: 'solid',
            logoUrl: '',
            logoType: 'preset',
            logoScale: 0.2
        },
        size: 512,
        quality: 90,
        force_png: true
    };

    console.log('📤 Sending Flutter-style request...');
    console.log('Design:', JSON.stringify(realFlutterRequest.design, null, 2));

    try {
        const response = await axios.post(
            'http://localhost:3000/api/qr/preview',
            realFlutterRequest,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('\n✅ Response received');
        console.log('Success:', response.data.success);
        console.log('Strategy:', response.data.data.strategy_reason);
        console.log('Laravel source:', response.data.data.meta?.laravel_source);
        console.log('Cached:', response.data.data.meta?.cached);

        if (response.data.data.images?.png_base64) {
            const pngSize = (response.data.data.images.png_base64.length / 1024).toFixed(2);
            console.log('PNG Size:', pngSize, 'KB');
            console.log('Has PNG: ✅ YES');

            // Save PNG to file for inspection
            const base64Data = response.data.data.images.png_base64.replace(/^data:image\/png;base64,/, '');
            fs.writeFileSync('test_sticker_output.png', Buffer.from(base64Data, 'base64'));
            console.log('Saved to: test_sticker_output.png');
        } else {
            console.log('Has PNG: ❌ NO');
        }

        console.log('\n' + '='.repeat(35));
        if (response.data.data.strategy_reason === 'laravel_converted') {
            console.log('✅ STICKER SHOULD APPEAR IN FLUTTER!');
            console.log('If not appearing, the issue is:');
            console.log('1. Flutter PNG rendering problem');
            console.log('2. Flutter cache not cleared');
            console.log('3. Different request being sent');
        } else if (response.data.data.strategy_reason === 'cached') {
            console.log('⚠️  CACHED RESPONSE');
            console.log('May be old response without sticker!');
            console.log('Solution: Change text in Flutter to bypass cache');
        } else {
            console.log('❌ NOT USING LARAVEL!');
            console.log('Strategy:', response.data.data.strategy_reason);
            console.log('Stickers WILL NOT appear!');
        }
        console.log('='.repeat(35));

    } catch (error) {
        console.log('\n❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }

    console.log('\n' + '='.repeat(70));
}

testRealFlutterRequest();
