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
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const botNameInput = document.getElementById('bot-name');
    const botPersonalityInput = document.getElementById('bot-personality');
    const botScenarioInput = document.getElementById('bot-scenario');
    const botNameDisplay = document.getElementById('bot-name-display');
    const headerAvatar = document.getElementById('header-avatar');
    const chatContainer = document.getElementById('chat-container');
    const modalTitle = document.getElementById('modal-title');

    // Visual Settings Elements
    const botAvatarFile = document.getElementById('bot-avatar-file');
    const botBgFile = document.getElementById('bot-bg-file');
    const avatarPreview = document.getElementById('avatar-preview');
    const bgPreview = document.getElementById('bg-preview');

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
            imageMap: {},
            avatar: null,
            background: null
        }
    ];
    let activeBotId = localStorage.getItem('activeBotId') || bots[0].id;
    let isCreatingNew = false;
    
    // Temp state for modal
    let tempImageMap = {}; 
    let tempAvatar = null;
    let tempBg = null;

    // --- Helpers ---
    async function saveState() {
        localStorage.setItem('bots', JSON.stringify(bots));
        localStorage.setItem('activeBotId', activeBotId);

        // Sync com a nuvem (silencioso no background)
        try {
            await fetch('/api/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: { bots, activeBotId } })
            });
        } catch(e) {
            console.log("Aguardando configuração da nuvem...");
        }
    }

    async function loadCloudState() {
        try {
            const res = await fetch('/api/state', { cache: 'no-store' });
            const data = await res.json();
            if (data.state) {
                bots = data.state.bots || bots;
                activeBotId = data.state.activeBotId || activeBotId;
                localStorage.setItem('bots', JSON.stringify(bots));
                localStorage.setItem('activeBotId', activeBotId);
                renderCharacterList();
                loadChat();
            }
        } catch(e) {
            // Nuvem ainda não configurada
        }
    }

    function getActiveBot() {
        return bots.find(b => b.id === activeBotId) || bots[0];
    }

    function resizeAndConvertImage(file, maxWidth, callback) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Backgrounds can be heavily compressed (0.6) to save space, avatars slightly better (0.8)
                const quality = maxWidth > 500 ? 0.6 : 0.8;
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
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
            span.innerText = `[${tag}]`;
            
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

    function renderPreviews() {
        if (tempAvatar) {
            avatarPreview.innerText = '';
            avatarPreview.style.backgroundImage = `url(${tempAvatar})`;
        } else {
            avatarPreview.innerText = 'Nenhuma foto';
            avatarPreview.style.backgroundImage = 'none';
        }

        if (tempBg) {
            bgPreview.innerText = '';
            bgPreview.style.backgroundImage = `url(${tempBg})`;
        } else {
            bgPreview.innerText = 'Nenhum fundo';
            bgPreview.style.backgroundImage = 'none';
        }
    }

    function applyVisuals() {
        const bot = getActiveBot();
        
        // Avatar
        if (bot.avatar) {
            headerAvatar.innerText = '';
            headerAvatar.style.backgroundImage = `url(${bot.avatar})`;
        } else {
            const fallback = bot.imageMap['default'] || bot.imageMap['feliz'] || Object.values(bot.imageMap)[0];
            if (fallback) {
                headerAvatar.innerText = '';
                headerAvatar.style.backgroundImage = `url(${fallback})`;
            } else {
                headerAvatar.innerText = '🤖';
                headerAvatar.style.backgroundImage = 'none';
            }
        }

        // Background
        if (bot.background) {
            chatContainer.style.backgroundImage = `url(${bot.background})`;
        } else {
            chatContainer.style.backgroundImage = 'none';
        }
    }

    function loadChat() {
        messagesContainer.innerHTML = '';
        const bot = getActiveBot();
        botNameDisplay.innerText = bot.name;
        
        if (!bot.imageMap) bot.imageMap = {};

        applyVisuals();
        
        if (bot.history.length === 0) {
            appendMessage(`Olá! Eu sou ${bot.name}.`, 'bot', null, false);
        } else {
            let lastKnownTag = null;
            bot.history.forEach(msg => {
                if (msg.sender === 'bot' && msg.imageTag) {
                    lastKnownTag = msg.imageTag;
                }
                let activeTag = msg.imageTag || (msg.sender === 'bot' ? lastKnownTag : null);
                
                let imgData = null;
                if (activeTag && bot.imageMap[activeTag]) {
                    imgData = bot.imageMap[activeTag];
                }
                appendMessage(msg.text, msg.sender, imgData, false, msg.imageTag);
            });
        }
    }

    // --- Modal Inputs ---
    botAvatarFile.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            resizeAndConvertImage(e.target.files[0], 200, (base64) => {
                tempAvatar = base64;
                renderPreviews();
            });
        }
    });

    botBgFile.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            resizeAndConvertImage(e.target.files[0], 800, (base64) => {
                tempBg = base64;
                renderPreviews();
            });
        }
    });

    addTagBtn.addEventListener('click', () => {
        let tag = newTagNameInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (!tag) return alert('Digite um nome para a tag.');
        if (newTagFileInput.files.length === 0) return alert('Selecione uma imagem.');

        resizeAndConvertImage(newTagFileInput.files[0], 400, (base64) => {
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
        botScenarioInput.value = bot.scenario || '';
        tempImageMap = JSON.parse(JSON.stringify(bot.imageMap || {})); 
        tempAvatar = bot.avatar || null;
        tempBg = bot.background || null;
        botAvatarFile.value = '';
        botBgFile.value = '';
        
        modalTitle.innerText = "Configurar Personagem";
        deleteBotBtn.style.display = bots.length > 1 ? 'block' : 'none';
        clearChatBtn.style.display = 'block';
        
        renderTagsList();
        renderPreviews();
        settingsModal.classList.remove('hidden');
    });

    newCharacterBtn.addEventListener('click', () => {
        isCreatingNew = true;
        botNameInput.value = '';
        botPersonalityInput.value = '';
        botScenarioInput.value = '';
        tempImageMap = {};
        tempAvatar = null;
        tempBg = null;
        botAvatarFile.value = '';
        botBgFile.value = '';
        
        modalTitle.innerText = "Criar Novo Personagem";
        deleteBotBtn.style.display = 'none';
        clearChatBtn.style.display = 'none';
        
        renderTagsList();
        renderPreviews();
        settingsModal.classList.remove('hidden');
        sidebar.classList.add('hidden');
    });

    saveSettingsBtn.addEventListener('click', () => {
        const name = botNameInput.value.trim() || 'Sem Nome';
        const personality = botPersonalityInput.value.trim() || 'Você é um bot.';
        const scenario = botScenarioInput.value.trim() || '';

        try {
            if (isCreatingNew) {
                const newBot = {
                    id: 'bot_' + Date.now(),
                    name,
                    personality,
                    scenario,
                    history: [],
                    imageMap: tempImageMap,
                    avatar: tempAvatar,
                    background: tempBg
                };
                bots.push(newBot);
                activeBotId = newBot.id;
            } else {
                const bot = getActiveBot();
                bot.name = name;
                bot.personality = personality;
                bot.scenario = scenario;
                bot.imageMap = tempImageMap;
                bot.avatar = tempAvatar;
                bot.background = tempBg;
            }
            saveState(); 
        } catch (e) {
            alert('Atenção: O armazenamento do seu navegador está cheio. Tente imagens menores ou apague bots antigos.');
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

    clearChatBtn.addEventListener('click', () => {
        if (confirm("Tem certeza que deseja apagar todo o histórico de conversa com este personagem?")) {
            const bot = getActiveBot();
            bot.history = [];
            saveState();
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
                    scenario: bot.scenario || '',
                    availableTags: availableTags
                })
            });

            const data = await response.json();
            removeTypingIndicator();

            if (data.error) {
                appendMessage("Ocorreu um erro no servidor.", 'bot');
            } else {
                if (data.imageTag) {
                    bot.lastImageTag = data.imageTag;
                }
                let activeTag = data.imageTag || bot.lastImageTag;
                let imgData = null;
                if (activeTag && bot.imageMap[activeTag]) {
                    imgData = bot.imageMap[activeTag];
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
    loadCloudState(); // Carrega da nuvem logo após carregar o local
});
