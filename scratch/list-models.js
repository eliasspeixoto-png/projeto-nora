const https = require('https');
const fs = require('fs');

const GEMINI_API_KEY = 'AQ.Ab8RN6KPNlZlSMqfTnDFoUHKi6jd4a_SG20hNif8Ia6bdKIPgA';

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("Models:", data);
    });
});
