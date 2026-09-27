const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Gemini API (User needs to put API key in .env)
const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;
if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
}

// Banco de imagens (o usuário pode colocar imagens na pasta public/images/ e atualizar isso)
const imageDatabase = {
    "happy": "/images/happy.jpg",
    "flirty": "/images/flirty.jpg",
    "angry": "/images/angry.jpg",
    "nsfw": "/images/nsfw.jpg", // Exemplo de conteúdo adulto
    "default": "/images/default.jpg"
};

app.post('/api/chat', async (req, res) => {
    try {
        const { messages, personality } = req.body;
        
        if (!genAI) {
            return res.json({ 
                text: "⚠️ Chave da API do Gemini não configurada. Por favor, crie um arquivo .env na pasta do projeto com: GEMINI_API_KEY=sua_chave_aqui e reinicie o servidor.", 
                image: null 
            });
        }

        // Constrói as instruções de sistema para o modelo
        const systemInstruction = `Você é um chatbot de roleplay interativo, similar aos personagens do Crushon AI.
Sua personalidade é descrita a seguir:
${personality}

Regras:
1. Permaneça estritamente no personagem o tempo todo.
2. Seja natural, envolvente e reativo ao usuário.
3. Ocasionalmente, se a emoção ou o contexto mudar significativamente, você DEVE solicitar a exibição de uma imagem baseada no banco de imagens disponível.
4. Para solicitar a imagem, inclua EXATAMENTE esta tag no final da sua resposta: [IMAGE: contexto].
5. Os contextos de imagem disponíveis são: happy, flirty, angry, nsfw, default. Escolha o que melhor se adapta. (Exemplo de uso: "Eu amei isso! [IMAGE: happy]")`;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction 
        });

        // Formata o histórico
        const formattedMessages = messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const chat = model.startChat({
            history: formattedMessages.slice(0, -1) // All except the last user message
        });

        const lastMessage = formattedMessages[formattedMessages.length - 1];
        
        const response = await chat.sendMessage(lastMessage.parts[0].text);

        let responseText = response.response.text();
        let imageUrl = null;

        // Procura pela tag de imagem na resposta do modelo
        const imageRegex = /\[IMAGE:\s*([a-zA-Z0-9_-]+)\]/gi;
        const match = imageRegex.exec(responseText);
        if (match) {
            const context = match[1].toLowerCase();
            if (imageDatabase[context]) {
                imageUrl = imageDatabase[context];
            } else {
                imageUrl = imageDatabase['default'];
            }
            // Remove a tag do texto final
            responseText = responseText.replace(imageRegex, '').trim();
        }

        res.json({ text: responseText, image: imageUrl });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao processar a mensagem no servidor." });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});

module.exports = app;
