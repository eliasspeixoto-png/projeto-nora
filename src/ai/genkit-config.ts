
import { genkit } from 'genkit';
import { openAI } from 'genkitx-openai';

export const ai = genkit({
    plugins: [
        openAI({
            apiKey: process.env.DEEPSEEK_API_KEY,
            baseURL: 'https://api.deepseek.com/v1',
        })
    ],
});
