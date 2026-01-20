/**
 * Test explicit Laravel endpoint
 * This endpoint ALWAYS uses Laravel, no auto-detection
 */

const axios = require('axios');

async function testExplicitLaravelEndpoint() {
    console.log('🧪 Testing EXPLICIT Laravel endpoint /api/qr/preview/laravel\n');

    try {
        const response = await axios.post('http://localhost:3000/api/qr/preview/laravel', {
            type: 'url',
            data: {
                url: 'https://test.com?explicit=' + Date.now()
            },
            design: {
                themed_shape: 'heart',  // Different shape
                foreground_color: '#FF0000',
                background_color: '#FFFFFF'
            },
            size: 512,
            quality: 90
        });

        console.log('\n✅ SUCCESS!');
        console.log('Strategy:', response.data.data.strategy_reason);
        console.log('Laravel source:', response.data.data.meta.laravel_source);
        console.log('Has PNG:', !!response.data.data.images.png_base64);
        console.log('PNG size:', response.data.data.images.png_base64 ?
            (response.data.data.images.png_base64.length / 1024).toFixed(2) + ' KB' : 'N/A');

        if (response.data.data.strategy_reason === 'laravel_converted') {
            console.log('\n🎉🎉🎉 THEMED SHAPES WORKING! 🎉🎉🎉');
        }

    } catch (error) {
        console.log('\n❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testExplicitLaravelEndpoint();
