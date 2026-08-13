const http = require('http');

async function testNoraFlow() {
    const payload = JSON.stringify({
        messages: [{ role: 'user', content: 'Qual é o valor da câmera do código 798455423628?' }],
        userContext: {
            uid: 'wa_557999890130',
            companyId: 'Z6XlJobG4TfPoYMwLNC0',
            role: 'admin',
            displayName: 'Elias'
        }
    });

    const req = http.request({
        host: 'localhost',
        port: 3000,
        path: '/api/xcot',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
            console.log("=== API RESPONSE ===");
            console.log(d);
            process.exit(0);
        });
    });

    req.on('error', e => {
        console.error("HTTP Error:", e);
        process.exit(1);
    });

    req.write(payload);
    req.end();
}

testNoraFlow();
