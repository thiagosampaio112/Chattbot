const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;
if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
}

app.post('/api/chat', async (req, res) => {
    try {
        const { messages, personality, availableTags } = req.body;
        
        if (!genAI) {
            return res.json({ 
                text: "⚠️ Chave da API do Gemini não configurada. Verifique o Vercel.", 
                imageTag: null 
            });
        }

        const tagsList = (availableTags && availableTags.length > 0) 
            ? availableTags.join(', ') 
            : 'nenhuma imagem disponível';

        const systemInstruction = `Você é um chatbot de roleplay interativo.
Sua personalidade é descrita a seguir:
${personality}

Regras:
1. Permaneça estritamente no personagem o tempo todo.
2. Seja natural, envolvente e reativo ao usuário.
3. Se a emoção ou o contexto mudar, você DEVE solicitar a exibição de uma imagem baseada na lista disponível.
4. Para solicitar a imagem, inclua EXATAMENTE esta tag no final da sua resposta: [IMAGE: contexto].
5. IMPORTANTE: Os únicos contextos de imagem que existem para você usar são: ${tagsList}. NUNCA invente um contexto que não esteja nessa lista.`;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction 
        });

        const formattedMessages = messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const chat = model.startChat({
            history: formattedMessages.slice(0, -1)
        });

        const lastMessage = formattedMessages[formattedMessages.length - 1];
        const response = await chat.sendMessage(lastMessage.parts[0].text);

        let responseText = response.response.text();
        let imageTag = null;

        const imageRegex = /\[IMAGE:\s*([a-zA-Z0-9_-]+)\]/gi;
        const match = imageRegex.exec(responseText);
        if (match) {
            imageTag = match[1].toLowerCase();
            responseText = responseText.replace(imageRegex, '').trim();
        }

        res.json({ text: responseText, imageTag: imageTag });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao processar a mensagem no servidor." });
    }
});

module.exports = app;
