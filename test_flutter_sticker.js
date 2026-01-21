/**
 * Test simulating Flutter app's exact request for stickers
 * This mimics what the Flutter app sends
 */

const axios = require('axios');

async function testFlutterStickerRequest() {
    console.log('🧪 Simulating Flutter App Sticker Request\n');
    console.log('='.repeat(70));

    // Exact format Flutter sends (from qr_rendering_service.dart line 29-36)
    const flutterRequest = {
        type: 'url',
        data: {
            url: 'https://flutter-test.com'
        },
        design: {
            advancedShape: 'healthcare',  // User selected healthcare sticker
            text: 'SCAN ME',
            textColor: '#FFFFFF',
            textBackgroundColor: '# 1c57cb',
            foregroundColor: '#000000',
            backgroundColor: '#FFFFFF',
            module: 'square',
            finder: 'default',
            finderDot: 'default',
            shape: 'none',
        },
        size: 512,
        quality: 90,
        force_png: true
    };

    try {
        console.log('\n📤 Sending request to:', 'http://localhost:3000/api/qr/preview');
        console.log('Design params:', JSON.stringify(flutterRequest.design, null, 2));

        const response = await axios.post(
            'http://localhost:3000/api/qr/preview',
            flutterRequest
        );

        console.log('\n✅ Response received');
        console.log('Success:', response.data.success);
        console.log('Strategy:', response.data.data.strategy_reason);
        console.log('Laravel source:', response.data.data.meta?.laravel_source);

        if (response.data.data.images?.png_base64) {
            const pngSize = (response.data.data.images.png_base64.length / 1024).toFixed(2);
            console.log('PNG Size:', pngSize, 'KB');
            console.log('Has PNG:', '✅ YES');
        } else {
            console.log('Has PNG:', '❌ NO');
        }

        // Check if it's using Laravel
        if (response.data.data.strategy_reason === 'laravel_converted') {
            console.log('\n🎉 STICKER REQUEST ROUTED TO LARAVEL!');
            console.log('The sticker SHOULD be in the PNG.');
            console.log('If Flutter shows no sticker, the issue is likely:');
            console.log('1. Flutter PNG rendering issue');
            console.log('2. Laravel generating QR without sticker overlay');
            console.log('3. Text parameters not being processed');
        } else {
            console.log('\n⚠️ NOT USING LARAVEL!');
            console.log('Strategy:', response.data.data.strategy_reason);
            console.log('This means stickers WILL NOT appear!');
        }

    } catch (error) {
        console.log('\n❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
        }
    }

    console.log('\n' + '='.repeat(70));
}

testFlutterStickerRequest();
