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
    const headerAvatar = document.getElementById('header-avatar');
    const chatContainer = document.getElementById('chat-container');
    const modalTitle = document.getElementById('modal-title');

    // Image Upload Elements
    const newTagNameInput = document.getElementById('new-tag-name');
    const newTagFileInput = document.getElementById('new-tag-file');
    const addTagBtn = document.getElementById('add-tag-btn');
    const tagsList = document.getElementById('tags-list');

    // Data State
    let bots = JSON.parse(localStorage.getItem('bots')) || [
        {
            id: 'bot_1',
            name: 'Meu Primeiro Bot',
            personality: 'Você é super legal.',
            history: [],
            imageMap: {} // tag -> base64
        }
    ];
    let activeBotId = localStorage.getItem('activeBotId') || bots[0].id;
    let isCreatingNew = false;
    let tempImageMap = {}; // para a modal antes de salvar

    // --- Helpers ---
    function saveState() {
        localStorage.setItem('bots', JSON.stringify(bots));
        localStorage.setItem('activeBotId', activeBotId);
    }

    function getActiveBot() {
        return bots.find(b => b.id === activeBotId) || bots[0];
    }

    // Comprimir imagem para caber no LocalStorage
    function resizeAndConvertImage(file, callback) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400; // Tamanho compacto para economizar limite de 5MB
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                callback(dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // --- Renderização ---
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

    function renderTagsList() {
        tagsList.innerHTML = '';
        Object.keys(tempImageMap).forEach(tag => {
            const li = document.createElement('li');
            li.classList.add('tag-item');
            
            const img = document.createElement('img');
            img.src = tempImageMap[tag];
            
            const span = document.createElement('span');
            span.innerText = `Tag: [${tag}]`;
            
            const delBtn = document.createElement('button');
            delBtn.innerText = '🗑️';
            delBtn.onclick = () => {
                delete tempImageMap[tag];
                renderTagsList();
            };

            li.appendChild(img);
            li.appendChild(span);
            li.appendChild(delBtn);
            tagsList.appendChild(li);
        });
    }

    function updateAvatar() {
        const bot = getActiveBot();
        const fallback = bot.imageMap['default'] || bot.imageMap['feliz'] || Object.values(bot.imageMap)[0];
        if (fallback) {
            headerAvatar.innerText = '';
            headerAvatar.style.backgroundImage = `url(${fallback})`;
        } else {
            headerAvatar.innerText = '🤖';
            headerAvatar.style.backgroundImage = 'none';
        }
    }

    function loadChat() {
        messagesContainer.innerHTML = '';
        const bot = getActiveBot();
        botNameDisplay.innerText = bot.name;
        
        if (!bot.imageMap) bot.imageMap = {};

        updateAvatar();
        
        if (bot.history.length === 0) {
            appendMessage(`Olá! Eu sou ${bot.name}.`, 'bot');
        } else {
            bot.history.forEach(msg => {
                let imgData = null;
                // Se a msg tinha imageTag salva
                if (msg.imageTag && bot.imageMap[msg.imageTag]) {
                    imgData = bot.imageMap[msg.imageTag];
                }
                appendMessage(msg.text, msg.sender, imgData, false, msg.imageTag);
            });
        }
    }

    // --- Modal e Uploads ---
    addTagBtn.addEventListener('click', () => {
        let tag = newTagNameInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (!tag) return alert('Digite um nome para a tag.');
        if (newTagFileInput.files.length === 0) return alert('Selecione uma imagem.');

        const file = newTagFileInput.files[0];
        resizeAndConvertImage(file, (base64) => {
            tempImageMap[tag] = base64;
            newTagNameInput.value = '';
            newTagFileInput.value = '';
            renderTagsList();
        });
    });

    settingsBtn.addEventListener('click', () => {
        isCreatingNew = false;
        const bot = getActiveBot();
        botNameInput.value = bot.name;
        botPersonalityInput.value = bot.personality;
        tempImageMap = JSON.parse(JSON.stringify(bot.imageMap || {})); // clone
        modalTitle.innerText = "Configurar Personagem";
        deleteBotBtn.style.display = bots.length > 1 ? 'block' : 'none';
        renderTagsList();
        settingsModal.classList.remove('hidden');
    });

    newCharacterBtn.addEventListener('click', () => {
        isCreatingNew = true;
        botNameInput.value = '';
        botPersonalityInput.value = '';
        tempImageMap = {};
        modalTitle.innerText = "Criar Novo Personagem";
        deleteBotBtn.style.display = 'none';
        renderTagsList();
        settingsModal.classList.remove('hidden');
        sidebar.classList.add('hidden');
    });

    saveSettingsBtn.addEventListener('click', () => {
        const name = botNameInput.value.trim() || 'Sem Nome';
        const personality = botPersonalityInput.value.trim() || 'Você é um bot.';

        try {
            if (isCreatingNew) {
                const newBot = {
                    id: 'bot_' + Date.now(),
                    name,
                    personality,
                    history: [],
                    imageMap: tempImageMap
                };
                bots.push(newBot);
                activeBotId = newBot.id;
            } else {
                const bot = getActiveBot();
                bot.name = name;
                bot.personality = personality;
                bot.imageMap = tempImageMap;
            }
            saveState(); // Isso pode falhar se passar de 5MB
        } catch (e) {
            alert('Atenção: O armazenamento do seu navegador está cheio. Apague algumas fotos ou bots antigos.');
            return;
        }

        renderCharacterList();
        loadChat();
        settingsModal.classList.add('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    menuBtn.addEventListener('click', () => sidebar.classList.remove('hidden'));
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.add('hidden'));

    deleteBotBtn.addEventListener('click', () => {
        if (confirm("Tem certeza que deseja apagar este personagem?")) {
            bots = bots.filter(b => b.id !== activeBotId);
            activeBotId = bots[0].id; 
            saveState();
            renderCharacterList();
            loadChat();
            settingsModal.classList.add('hidden');
        }
    });

    // --- Chat Logic ---
    const appendMessage = (text, sender, imageUrl = null, save = true, imageTag = null) => {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', sender);
        
        const textSpan = document.createElement('span');
        textSpan.innerText = text;
        msgDiv.appendChild(textSpan);

        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            msgDiv.appendChild(img);
        }

        messagesContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        if (save) {
            const bot = getActiveBot();
            bot.history.push({ sender, text, imageTag });
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
        if (indicator) indicator.remove();
    };

    const sendMessage = async () => {
        const text = messageInput.value.trim();
        if (!text) return;

        messageInput.value = '';
        messageInput.focus();
        
        appendMessage(text, 'user');
        appendTypingIndicator();

        const bot = getActiveBot();
        const availableTags = Object.keys(bot.imageMap || {});

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: bot.history.map(h => ({ sender: h.sender, text: h.text })),
                    personality: bot.personality,
                    availableTags: availableTags
                })
            });

            const data = await response.json();
            removeTypingIndicator();

            if (data.error) {
                appendMessage("Ocorreu um erro no servidor.", 'bot');
            } else {
                let imgData = null;
                if (data.imageTag && bot.imageMap[data.imageTag]) {
                    imgData = bot.imageMap[data.imageTag];
                }
                appendMessage(data.text, 'bot', imgData, true, data.imageTag);
            }

        } catch (err) {
            console.error(err);
            removeTypingIndicator();
            appendMessage("Erro de conexão.", 'bot');
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    renderCharacterList();
    loadChat();
});
