/**
 * EMERGENCY DEBUG: Write to file to bypass console issues
 */

const axios = require('axios');
const fs = require('fs');

async function testWithFileLogging() {
    const logFile = 'debug_log.txt';
    fs.writeFileSync(logFile, '=== STICKER DEBUG TEST ===\n');

    const request = {
        type: 'url',
        data: { url: 'https://test.com' },
        design: {
            advancedShape: 'healthcare',
            text: 'SCAN ME',
            foregroundColor: '#000000',
            backgroundColor: '#FFFFFF'
        },
        size: 512,
        quality: 90
    };

    fs.appendFileSync(logFile, '\nSending advancedShape: ' + request.design.advancedShape + '\n');

    try {
        const response = await axios.post('http://localhost:3000/api/qr/preview', request);

        fs.appendFileSync(logFile, '\nResponse received:\n');
        fs.appendFileSync(logFile, '  Strategy: ' + response.data.data.strategy_reason + '\n');
        fs.appendFileSync(logFile, '  Laravel: ' + response.data.data.meta.laravel_source + '\n');
        console.log('\n✅ Response logged to', logFile);
        console.log('Strategy:', response.data.data.strategy_reason);

        if (response.data.data.strategy_reason === 'laravel_converted') {
            console.log('🎉 SUCCESS - Routing to Laravel!');
        } else {
            console.log('❌ FAIL - Not routing to Laravel');
            console.log('Check debug_log.txt for details');
        }

    } catch (error) {
        fs.appendFileSync(logFile, '\nERROR: ' + error.message + '\n');
        console.log('❌ Error logged to', logFile);
    }
}

testWithFileLogging();
