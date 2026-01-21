/**
 * Test advanced shapes (stickers) with proper parameters
 */

const axios = require('axios');

const tests = [
    {
        name: 'Healthcare Sticker',
        design: {
            advanced_shape: 'healthcare',
            text_content: 'Dr. Smith Clinic',
            text_color: '#000000',
            text_bg_color: '#FFFFFF',
            healthcare_frame_color: '#00A8E8',
            healthcare_heart_color: '#FF0000',
            foreground_color: '#000000',
            background_color: '#FFFFFF'
        }
    },
    {
        name: 'Coupon Sticker',
        design: {
            advanced_shape: 'coupon',
            coupon_text_line_1: '50% OFF',
            coupon_text_line_2: 'Code: SAVE50',
            coupon_text_line_3: 'Valid until Dec 31',
            coupon_left_color: '#FF0000',
            coupon_right_color: '#00FF00',
            foreground_color: '#000000',
            background_color: '#FFFFFF'
        }
    },
    {
        name: 'Four Corners Text Top',
        design: {
            advanced_shape: 'four-corners-text-top',
            text_content: 'SCAN ME!',
            text_color: '#FFFFFF',
            text_bg_color: '#000000',
            advanced_shape_frame_color: '#FFD700',
            foreground_color: '#000000',
            background_color: '#FFFFFF'
        }
    }
];

async function testAdvancedShapes() {
    console.log('🧪 Testing Advanced Shapes (Stickers)\n');
    console.log('='.repeat(70));

    let successCount = 0;
    let failCount = 0;

    for (const test of tests) {
        try {
            const response = await axios.post('http://localhost:3000/api/qr/preview', {
                type: 'url',
                data: {
                    url: `https://test.com/${test.name.replace(/\s+/g, '-').toLowerCase()}/${Date.now()}`
                },
                design: test.design,
                size: 512,
                quality: 90,
                use_laravel: true
            });

            const success = response.data.data.strategy_reason === 'laravel_converted';
            const size = (response.data.data.images.png_base64.length / 1024).toFixed(2);

            if (success) {
                console.log(`\n✅ ${test.name.padEnd(30)} - ${size} KB`);
                successCount++;
            } else {
                console.log(`\n❌ ${test.name.padEnd(30)} - Strategy: ${response.data.data.strategy_reason}`);
                failCount++;
            }

        } catch (error) {
            console.log(`\n❌ ${test.name.padEnd(30)} - ERROR: ${error.message}`);
            failCount++;
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 RESULTS: ${successCount}/${tests.length} successful\n`);

    if (successCount === tests.length) {
        console.log('🎉🎉🎉 ALL ADVANCED SHAPES (STICKERS) WORKING! 🎉🎉🎉\n');
    }

    console.log('='.repeat(70));
}

testAdvancedShapes();
