const https = require('https');
const fs = require('fs');

const GEMINI_API_KEY = 'AQ.Ab8RN6KPNlZlSMqfTnDFoUHKi6jd4a_SG20hNif8Ia6bdKIPgA';

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Create a dummy 1-page PDF base64 for testing, or just send a tiny text file as PDF
const dummyBase64 = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n188\n%%EOF').toString('base64');

const payload = {
    contents: [{
        parts: [
            { text: "Descreva o que vê" },
            {
                inline_data: {
                    mime_type: 'application/pdf',
                    data: dummyBase64
                }
            }
        ]
    }]
};

const reqData = JSON.stringify(payload);
const req = https.request(url, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(reqData)
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("Response:", data);
    });
});
req.on('error', console.error);
req.write(reqData);
req.end();
