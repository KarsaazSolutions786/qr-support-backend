/**
 * Test if sticker parameter is correctly routed to Laravel
 */

const axios = require('axios');

async function testSticker() {
    console.log('🧪 Testing Sticker Integration\n');

    try {
        const response = await axios.post('http://localhost:3000/api/qr/preview', {
            type: 'url',
            data: {
                url: 'https://test.com/sticker-test'
            },
            design: {
                sticker: 'template1',  // Test sticker parameter
                foreground_color: '#000000',
                background_color: '#FFFFFF'
            },
            size: 512,
            quality: 90,
            use_laravel: true
        });

        console.log('\n✅ Response received');
        console.log('Strategy:', response.data.data.strategy_reason);
        console.log('Laravel source:', response.data.data.meta.laravel_source);
        console.log('Has PNG:', !!response.data.data.images.png_base64);

        if (response.data.data.images.png_base64) {
            const pngSize = (response.data.data.images.png_base64.length / 1024).toFixed(2);
            console.log('PNG Size:', pngSize, 'KB');
        }

        if (response.data.data.strategy_reason === 'laravel_converted') {
            console.log('\n🎉 STICKER ROUTING WORKING!');
        } else if (response.data.data.strategy_reason === 'node_fallback') {
            console.log('\n⚠️ Sticker not detected - using Node.js fallback');
            console.log('Check: Is sticker parameter being sent?');
        }

    } catch (error) {
        console.log('\n❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testSticker();
