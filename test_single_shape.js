/**
 * Single Shape Test with Detailed Logs
 */

const axios = require('axios');

async function testSingleShape() {
    console.log('Testing single shape (star) with Laravel...\n');

    try {
        const response = await axios.post('http://localhost:3000/api/qr/preview', {
            type: 'url',
            data: {
                url: 'https://test.com?t=' + Date.now()
            },
            design: {
                themed_shape: 'star',
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

    } catch (error) {
        console.log('\n❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testSingleShape();
