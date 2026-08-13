const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const match = envContent.match(/DEEPSEEK_API_KEY=(.*)/);
const apiKey = match[1].trim();

async function testDeepSeekTools() {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'search_products',
          description: 'Pesquisa produtos no catálogo e estoque pelo código de barras, EAN, modelo, nome ou descrição detalhada.',
          parameters: {
            type: 'object',
            properties: {
              term: { type: 'string', description: 'Código (EAN/item), modelo ou nome do produto a pesquisar.' }
            },
            required: ['term']
          }
        }
      }
    ];

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Qual é o valor da câmera do código 798455423628?' }],
        tools: tools,
        temperature: 0.2,
      })
    });

    console.log("Status:", response.status, response.statusText);
    const text = await response.text();
    console.log("Body:", text);
}

testDeepSeekTools();
