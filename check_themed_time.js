const axios = require('axios');

async function checkThemedShapes() {
    const url = 'http://127.0.0.1:8000/api/flutter/v2/themed-shapes';
    console.log(`Checking ${url}...`);
    const start = Date.now();
    try {
        const res = await axios.get(url, { timeout: 10000 });
        const duration = Date.now() - start;
        console.log(`✅ Success in ${duration}ms`);
        console.log(`Got ${Object.keys(res.data.data.shapes).length} shapes.`);
    } catch (err) {
        const duration = Date.now() - start;
        console.log(`❌ Failed after ${duration}ms: ${err.message}`);
    }
}

checkThemedShapes();
