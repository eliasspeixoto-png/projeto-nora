
/**
 * @fileOverview Cliente de conexão direta com a API da DeepSeek.
 */

export async function callDeepSeek(
  messages: { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_call_id?: string; name?: string }[],
  tools?: any[],
  temperature: number = 0.2
) {
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        tools: tools,
        tool_choice: tools ? 'auto' : undefined,
        temperature: temperature,
        max_tokens: 2048,
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro DeepSeek API Status:', response.status, response.statusText);
      console.error('Erro DeepSeek API Data:', errorData);
      throw new Error(`DeepSeek API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message;
  } catch (error) {
    console.error('Erro ao chamar DeepSeek:', error);
    throw error;
  }
}
