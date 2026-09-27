const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
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
            systemInstruction: systemInstruction,
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
            ]
        });

        // Formata e garante alternância
        const formattedMessages = [];
        let lastRole = null;
        for (const msg of messages) {
            const role = msg.sender === 'user' ? 'user' : 'model';
            const text = msg.text || '...';
            
            if (role === lastRole) {
                // Junta mensagens consecutivas do mesmo remetente para evitar erro na API
                formattedMessages[formattedMessages.length - 1].parts[0].text += '\n\n' + text;
            } else {
                formattedMessages.push({ role, parts: [{ text }] });
                lastRole = role;
            }
        }

        // Gemini requer que o usuário seja o último
        if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role !== 'user') {
            formattedMessages.push({ role: 'user', parts: [{ text: 'continue' }] });
        }

        const response = await model.generateContent({
            contents: formattedMessages
        });

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

// Rotas de Banco de Dados em Nuvem (Vercel KV)
const { kv } = require('@vercel/kv');

app.get('/api/state', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    if (!process.env.KV_REST_API_URL) {
        return res.status(400).json({ error: "Banco de dados não configurado" });
    }
    try {
        const state = await kv.get('chattbot_state');
        res.json({ state });
    } catch(e) {
        res.status(500).json({ error: "Erro ao ler banco de dados", details: e.message });
    }
});

app.post('/api/state', async (req, res) => {
    if (!process.env.KV_REST_API_URL) {
        return res.status(400).json({ error: "Banco de dados não configurado" });
    }
    try {
        await kv.set('chattbot_state', req.body.state);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: "Erro ao salvar banco de dados", details: e.message });
    }
});

module.exports = app;
