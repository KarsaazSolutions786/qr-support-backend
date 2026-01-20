const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api/qr'; // Assuming Node runs on 3000

async function testThemedShapes() {
    console.log('--- Testing Themed Shapes List ---');
    try {
        const response = await axios.get(`${BASE_URL}/themed-shapes`);
        if (response.data.success) {
            console.log('✅ Successfully fetched themed shapes');
            console.log(`Found ${Object.keys(response.data.data.shapes).length} shapes`);
            console.log('Sample shapes:', Object.keys(response.data.data.shapes).slice(0, 5));
        } else {
            console.error('❌ Failed to fetch themed shapes:', response.data);
        }
    } catch (error) {
        console.error('❌ Error fetching themed shapes:', error.message);
        if (error.response) console.error('Response:', error.response.data);
    }
}

async function testGenerateThemedQR() {
    console.log('\n--- Testing Themed QR Generation ---');

    // Using 'house' as example (from user request)
    // Note: Laravel endpoint expects 'shape' or 'themed_shape'
    const payload = {
        type: 'url',
        data: { url: 'https://karsaaz.com' },
        design: {
            themed_shape: 'house', // Provide one available shape
            color: '#FF0000',
            bgColor: '#FFFFFF'
        },
        size: 300
    };

    try {
        const response = await axios.post(`${BASE_URL}/preview`, payload);

        if (response.data.success) {
            console.log('✅ Successfully generated themed QR');
            console.log('Strategy used:', response.data.data.strategy_reason);
            console.log('Laravel Source:', response.data.data.meta.laravel_source);

            // Save image for inspection
            const base64Data = response.data.data.images.png_base64;
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync('test_themed_house.png', buffer);
            console.log('✅ Saved test_themed_house.png');
        } else {
            console.error('❌ Failed to generate themed QR:', response.data);
        }
    } catch (error) {
        console.error('❌ Error generating themed QR:', error.message);
        if (error.response) console.error('Response:', error.response.data);
    }
}

async function run() {
    await testThemedShapes();
    await testGenerateThemedQR();
}

run();
