const http = require('http');

const req = http.request('http://localhost:3001/api/xcot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("STATUS:", res.statusCode);
        console.log("RESPONSE:", data);
        process.exit(0);
    });
});

req.on('error', (err) => console.error(err));
req.write(JSON.stringify({
    messages: [{ role: 'user', content: 'oi' }],
    userContext: {
        companyId: 'Z6XlJobG4TfPoYMwLNC0',
        displayName: 'Elias',
        role: 'admin'
    }
}));
req.end();
