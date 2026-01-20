const axios = require('axios');

async function checkLaravel() {
    const urls = [
        'http://127.0.0.1:8000/api/flutter/v2/health',
        'http://localhost:8000/api/flutter/v2/health'
    ];

    for (const url of urls) {
        console.log(`Checking ${url}...`);
        try {
            const res = await axios.get(url, { timeout: 2000 });
            console.log(`✅ Success: ${res.status}`);
            console.log('Data:', res.data);
        } catch (err) {
            console.log(`❌ Failed: ${err.message}`);
        }
    }
}

checkLaravel();
