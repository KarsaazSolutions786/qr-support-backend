const axios = require('axios');
const fs = require('fs');

axios.post('http://localhost:8000/api/flutter/preview', {
    type: 'url',
    data: { url: 'test.com' },
    design: { shape: 'star' }
})
    .then(r => {
        const output = [];
        output.push('\n=== Laravel Response Structure ===\n');
        output.push('Top-level keys: ' + Object.keys(r.data).join(', '));
        output.push('\nPreview type: ' + typeof r.data.preview);

        if (typeof r.data.preview === 'object') {
            output.push('\nPreview keys: ' + Object.keys(r.data.preview).join(', '));

            // Check each key
            for (const key of Object.keys(r.data.preview)) {
                const value = r.data.preview[key];
                output.push(`\npreview.${key} type: ${typeof value}`);
                if (typeof value === 'string') {
                    if (value.includes('<svg')) {
                        output.push(`✅ FOUND SVG in preview.${key}`);
                        output.push(`SVG length: ${value.length}`);
                        output.push(`SVG start: ${value.substring(0, 200)}...`);
                    } else {
                        output.push(`preview.${key} sample: ${value.substring(0, 100)}`);
                    }
                }
            }
        }

        const result = output.join('\n');
        console.log(result);
        fs.writeFileSync('laravel_response_debug.txt', result);
        console.log('\n✅ Written to laravel_response_debug.txt');
    })
    .catch(e => console.error('Error:', e.message));
