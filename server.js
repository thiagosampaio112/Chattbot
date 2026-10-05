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

app.post('/api/clean-text', async (req, res) => {
    try {
        const { rawText } = req.body;
        if (!genAI) return res.status(500).json({ error: "Gemini não configurado." });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `O texto a seguir é uma transcrição de áudio crua. Ele pode conter hesitações (ééé, hum), pausas, repetições e gagueiras. 
Seu trabalho é limpar o texto, removendo a sujeira e corrigindo a pontuação, tornando a frase natural e fluida.
CRÍTICO: Você não deve responder à frase, não deve continuar a história, e deve manter exatamente o mesmo idioma, tom e intenção da frase original (se for em inglês, limpe em inglês; se for gíria, mantenha gíria, etc).

TEXTO ORIGINAL: "${rawText}"

Retorne APENAS o texto limpo, sem aspas e sem explicações extras.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const cleanedText = response.text().trim();
        
        res.json({ text: cleanedText });
    } catch (error) {
        console.error("Erro ao limpar texto:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { messages, personality, scenario, availableTags } = req.body;
        
        if (!genAI) {
            return res.json({ 
                text: "⚠️ Chave da API do Gemini não configurada. Verifique o Vercel.", 
                imageTag: null 
            });
        }

        const tagsList = (availableTags && availableTags.length > 0) 
            ? availableTags.join(', ') 
            : 'nenhuma imagem disponível';

        let scenarioPrompt = '';
        if (scenario && scenario.trim() !== '') {
            scenarioPrompt = `\nAlém do seu personagem principal, você também tem autoridade e DEVE narrar e interpretar as falas e ações dos seguintes personagens secundários quando eles estiverem na cena:\n[MUNDO/SECUNDÁRIOS: ${scenario}]\nQuando um personagem secundário falar, escreva o nome dele antes da fala (Ex: **Ana:** "Oii!"). Ocasionalmente faça eles interagirem naturalmente.`;
        }

        const systemInstruction = `Você é um chatbot de roleplay interativo.
Sua personalidade é descrita a seguir:
${personality}
${scenarioPrompt}

Regras:
1. Permaneça estritamente no personagem o tempo todo.
2. Seja natural, envolvente e reativo ao usuário.
3. Você DEVE SEMPRE, OBRIGATORIAMENTE, incluir a tag de uma imagem no final de TODAS as suas respostas. Nunca envie uma mensagem de texto sem uma tag de imagem.
4. Escolha a imagem da lista que melhor representa a sua emoção ou ação atual e inclua EXATAMENTE no formato: [IMAGE: contexto].
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

        // Limita o histórico para não gastar muitos tokens de input e otimizar custos
        // 100 mensagens = ~50 trocas (muito mais que suficiente para manter coerência no roleplay)
        const recentMessages = messages.slice(-100);

        // Formata e garante alternância
        const formattedMessages = [];
        let lastRole = null;
        for (const msg of recentMessages) {
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

        // Injeção de Prompt (Lembrete Forte): Colocar a regra no final do último turno do usuário
        // garante que a IA não "esqueça" a formatação por estar focada demais na narrativa.
        if (formattedMessages.length > 0) {
            const lastMsg = formattedMessages[formattedMessages.length - 1];
            lastMsg.parts[0].text += '\n\n[LEMBRETE DO SISTEMA: Lembre-se da regra OBRIGATÓRIA. Termine esta sua resposta com a tag [IMAGE: contexto] escolhendo a imagem mais adequada da lista.]';
        }

        const response = await model.generateContent({
            contents: formattedMessages
        });

        let responseText = response.response.text();
        let imageTag = null;

        const imageRegex = /\[IMAGE?M?:\s*([^\]]+)\]/gi;
        const match = imageRegex.exec(responseText);
        if (match) {
            imageTag = match[1].trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
            responseText = responseText.replace(imageRegex, '').trim();
        }

        res.json({ text: responseText, imageTag: imageTag });

    } catch (error) {
        console.error("Erro detalhado do servidor:", error);
        res.status(500).json({ error: "Erro no servidor da IA: " + (error.message || "Falha desconhecida") });
    }
});

// Rotas de Banco de Dados em Nuvem (Vercel KV)
const { kv } = require('@vercel/kv');
const zlib = require('zlib');

app.get('/api/state', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    if (!process.env.KV_REST_API_URL) {
        return res.status(400).json({ error: "Banco de dados não configurado" });
    }
    try {
        let state = null;
        const compressed = await kv.get('chattbot_state_v2');
        if (compressed) {
            const buffer = Buffer.from(compressed, 'base64');
            state = JSON.parse(zlib.gunzipSync(buffer).toString());
        } else {
            state = await kv.get('chattbot_state');
        }
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
        const jsonString = JSON.stringify(req.body.state);
        const compressedBase64 = zlib.gzipSync(Buffer.from(jsonString)).toString('base64');
        await kv.set('chattbot_state_v2', compressedBase64);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: "Erro ao salvar banco de dados", details: e.message });
    }
});

module.exports = app;
