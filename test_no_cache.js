const axios = require('axios');

async function testWithUniqueDesign() {
    console.log('Testing with unique design to bypass cache...\n');

    try {
        const response = await axios.post('http://localhost:3000/api/qr/preview', {
            type: 'url',
            data: {
                url: 'https://test.com?t=' + Date.now()
            },
            design: {
                themed_shape: 'star',
                foreground_color: '#' + Math.random().toString(16).substr(2, 6), // Random color to bypass cache
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
    }
}

testWithUniqueDesign();
