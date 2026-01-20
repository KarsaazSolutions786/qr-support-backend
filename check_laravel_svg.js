const axios = require('axios');
const fs = require('fs');

async function checkLaravelSvg() {
    const url = 'http://127.0.0.1:8000/api/flutter/v2/preview/svg';
    const payload = {
        type: 'url',
        data: { url: 'https://karsaaz.com' },
        design: {
            themed_shape: 'house',
            color: '#FF0000'
        }
    };

    console.log(`Checking ${url}...`);
    try {
        const res = await axios.post(url, payload);
        console.log(`✅ Success: ${res.status}`);
        console.log('Content Type:', res.headers['content-type']);
        fs.writeFileSync('debug_laravel.svg', res.data);
        console.log('Saved debug_laravel.svg');
    } catch (err) {
        console.log(`❌ Failed: ${err.message}`);
        if (err.response) {
            console.log('Response:', err.response.data);
        }
    }
}

checkLaravelSvg();
