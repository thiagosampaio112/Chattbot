document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const characterList = document.getElementById('character-list');
    const newCharacterBtn = document.getElementById('new-character-btn');
    
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const deleteBotBtn = document.getElementById('delete-bot-btn');
    
    const botNameInput = document.getElementById('bot-name');
    const botPersonalityInput = document.getElementById('bot-personality');
    const botNameDisplay = document.getElementById('bot-name-display');
    const chatContainer = document.getElementById('chat-container');
    const modalTitle = document.getElementById('modal-title');

    // Data State
    let bots = JSON.parse(localStorage.getItem('bots')) || [
        {
            id: 'bot_1',
            name: 'Ana',
            personality: 'Você é a Ana, uma assistente divertida e prestativa. Gosta de responder de forma natural e amigável.',
            history: []
        }
    ];
    let activeBotId = localStorage.getItem('activeBotId') || bots[0].id;
    let isCreatingNew = false;

    // Load Initial State
    function saveState() {
        localStorage.setItem('bots', JSON.stringify(bots));
        localStorage.setItem('activeBotId', activeBotId);
    }

    function getActiveBot() {
        return bots.find(b => b.id === activeBotId) || bots[0];
    }

    function renderCharacterList() {
        characterList.innerHTML = '';
        bots.forEach(bot => {
            const li = document.createElement('li');
            li.innerText = bot.name;
            if (bot.id === activeBotId) li.classList.add('active');
            
            li.addEventListener('click', () => {
                activeBotId = bot.id;
                saveState();
                renderCharacterList();
                loadChat();
                sidebar.classList.add('hidden');
            });
            characterList.appendChild(li);
        });
    }

    function loadChat() {
        messagesContainer.innerHTML = '';
        const bot = getActiveBot();
        botNameDisplay.innerText = bot.name;
        
        if (bot.history.length === 0) {
            appendMessage(`Olá! Eu sou ${bot.name}.`, 'bot');
        } else {
            bot.history.forEach(msg => {
                appendMessage(msg.text, msg.sender, msg.imageUrl, false);
            });
        }
    }

    // Sidebar Toggle
    menuBtn.addEventListener('click', () => sidebar.classList.remove('hidden'));
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.add('hidden'));

    // Modal Handlers
    settingsBtn.addEventListener('click', () => {
        isCreatingNew = false;
        const bot = getActiveBot();
        botNameInput.value = bot.name;
        botPersonalityInput.value = bot.personality;
        modalTitle.innerText = "Configurar Personagem";
        deleteBotBtn.style.display = bots.length > 1 ? 'block' : 'none'; // Only allow delete if more than 1
        settingsModal.classList.remove('hidden');
    });

    newCharacterBtn.addEventListener('click', () => {
        isCreatingNew = true;
        botNameInput.value = '';
        botPersonalityInput.value = '';
        modalTitle.innerText = "Criar Novo Personagem";
        deleteBotBtn.style.display = 'none';
        settingsModal.classList.remove('hidden');
        sidebar.classList.add('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    saveSettingsBtn.addEventListener('click', () => {
        const name = botNameInput.value.trim() || 'Sem Nome';
        const personality = botPersonalityInput.value.trim() || 'Você é um bot.';

        if (isCreatingNew) {
            const newBot = {
                id: 'bot_' + Date.now(),
                name,
                personality,
                history: []
            };
            bots.push(newBot);
            activeBotId = newBot.id;
        } else {
            const bot = getActiveBot();
            bot.name = name;
            bot.personality = personality;
        }

        saveState();
        renderCharacterList();
        loadChat();
        settingsModal.classList.add('hidden');
    });

    deleteBotBtn.addEventListener('click', () => {
        if (confirm("Tem certeza que deseja apagar este personagem?")) {
            bots = bots.filter(b => b.id !== activeBotId);
            activeBotId = bots[0].id; // fallback to first bot
            saveState();
            renderCharacterList();
            loadChat();
            settingsModal.classList.add('hidden');
        }
    });

    // Chat Functions
    const appendMessage = (text, sender, imageUrl = null, save = true) => {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', sender);
        
        const textSpan = document.createElement('span');
        textSpan.innerText = text;
        msgDiv.appendChild(textSpan);

        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.onerror = () => { img.style.display = 'none'; };
            msgDiv.appendChild(img);
        }

        messagesContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        if (save) {
            const bot = getActiveBot();
            bot.history.push({ sender, text, imageUrl });
            saveState();
        }
    };

    const appendTypingIndicator = () => {
        const div = document.createElement('div');
        div.classList.add('typing');
        div.id = 'typing-indicator';
        div.innerText = 'Digitando...';
        messagesContainer.appendChild(div);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    const removeTypingIndicator = () => {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    };

    const sendMessage = async () => {
        const text = messageInput.value.trim();
        if (!text) return;

        messageInput.value = '';
        messageInput.focus();
        
        appendMessage(text, 'user');
        appendTypingIndicator();

        const bot = getActiveBot();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    // Send only history, exclude imageUrl to save token space if needed
                    messages: bot.history.map(h => ({ sender: h.sender, text: h.text })),
                    personality: bot.personality
                })
            });

            const data = await response.json();
            removeTypingIndicator();

            if (data.error) {
                appendMessage("Ocorreu um erro no servidor.", 'bot');
            } else {
                appendMessage(data.text, 'bot', data.image);
            }

        } catch (err) {
            console.error(err);
            removeTypingIndicator();
            appendMessage("Erro de conexão.", 'bot');
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Init
    renderCharacterList();
    loadChat();
});
