const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const match = envContent.match(/DEEPSEEK_API_KEY=(.*)/);
const apiKey = match[1].trim();

// Pega a lista de tools do flow.ts
const flowContent = fs.readFileSync(path.join(__dirname, '../src/app/api/xcot/flow.ts'), 'utf8');

async function testAllTools() {
    // Simula a requisição real
    const payload = JSON.stringify({
        messages: [{ role: 'user', content: 'Qual é o valor da câmera do código 798455423628?' }],
        userContext: {
            uid: 'wa_557999890130',
            companyId: 'Z6XlJobG4TfPoYMwLNC0',
            role: 'admin',
            displayName: 'Elias'
        }
    });

    const http = require('http');
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

    req.write(payload);
    req.end();
}

testAllTools();
