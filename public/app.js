document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('mic-btn');
    
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
    const duplicateBotBtn = document.getElementById('duplicate-bot-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const groupBtn = document.getElementById('group-btn');
    const groupModal = document.getElementById('group-modal');
    const groupBotList = document.getElementById('group-bot-list');
    const saveGroupBtn = document.getElementById('save-group-btn');
    const closeGroupBtn = document.getElementById('close-group-btn');
    const botNameInput = document.getElementById('bot-name');
    const botPersonalityInput = document.getElementById('bot-personality');
    const botScenarioInput = document.getElementById('bot-scenario');
    const botLanguageInput = document.getElementById('bot-language');
    const botVoiceSpeedInput = document.getElementById('bot-voice-speed');
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
            background: null,
            linkedBots: []
        }
    ];
    let activeBotId = localStorage.getItem('activeBotId') || bots[0].id;
    let isCreatingNew = false;
    
    // Temp state for modal
    let tempImageMap = {}; 
    let tempAvatar = null;
    let tempBg = null;
    let tagRenames = {};

    // --- Helpers ---
    async function saveState() {
        const timestamp = Date.now();
        try {
            localStorage.setItem('bots', JSON.stringify(bots));
            localStorage.setItem('activeBotId', activeBotId);
            localStorage.setItem('lastUpdated', timestamp.toString());
        } catch (e) {
            alert("Atenção: A memória do seu navegador está muito cheia! O aplicativo não conseguiu salvar a duplicação ou as imagens. Você atingiu o limite de 5MB do celular.");
            return;
        }

        // Sync com a nuvem (silencioso no background)
        try {
            const response = await fetch('/api/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: { bots, activeBotId, lastUpdated: timestamp } })
            });
            if (!response.ok) {
                console.warn("Nuvem cheia ou indisponível. Dados salvos apenas localmente.");
            }
        } catch(e) {
            console.log("Aguardando configuração da nuvem...");
        }
    }

    async function loadCloudState() {
        try {
            const res = await fetch('/api/state', { cache: 'no-store' });
            const data = await res.json();
            if (data.state && data.state.bots) {
                const cloudTime = parseInt(data.state.lastUpdated) || 0;
                const localTime = parseInt(localStorage.getItem('lastUpdated')) || 0;
                
                // Se a nuvem for estritamente mais nova, OU se o local estiver vazio (novo aparelho/cache limpo)
                if (cloudTime > localTime || localTime === 0) {
                    bots = data.state.bots;
                    activeBotId = data.state.activeBotId;
                    localStorage.setItem('bots', JSON.stringify(bots));
                    localStorage.setItem('activeBotId', activeBotId);
                    localStorage.setItem('lastUpdated', cloudTime.toString());
                    renderCharacterList();
                    loadChat();
                } else if (localTime > cloudTime) {
                    // Local é mais recente, re-sincroniza com a nuvem
                    saveState();
                }
            }
        } catch(e) {
            console.error("Erro ao carregar nuvem", e);
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
            
            const btnGroup = document.createElement('div');
            
            const editBtn = document.createElement('button');
            editBtn.innerText = '✏️';
            editBtn.onclick = () => {
                const newTagRaw = prompt('Digite o novo nome para esta tag:', tag);
                if (newTagRaw !== null) {
                    const newTag = newTagRaw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
                    if (newTag && newTag !== tag) {
                        tempImageMap[newTag] = tempImageMap[tag];
                        delete tempImageMap[tag];
                        tagRenames[tag] = newTag;
                        renderTagsList();
                    }
                }
            };
            
            const delBtn = document.createElement('button');
            delBtn.innerText = '🗑️';
            delBtn.onclick = () => {
                delete tempImageMap[tag];
                renderTagsList();
            };

            btnGroup.appendChild(editBtn);
            btnGroup.appendChild(delBtn);

            li.appendChild(img);
            li.appendChild(span);
            li.appendChild(btnGroup);
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
                let avatarUrl = null;
                let isGroupChatMsg = !!msg.customName;
                
                if (isGroupChatMsg && msg.customName !== bot.name) {
                    bot.linkedBots = bot.linkedBots || [];
                    const linked = bot.linkedBots.map(id => bots.find(b => b.id === id)).filter(Boolean);
                    const linkedBot = linked.find(b => b.name === msg.customName);
                    
                    if (linkedBot) {
                        avatarUrl = linkedBot.avatar;
                        if (activeTag && activeTag.startsWith(`${msg.customName}_`)) {
                            let realTag = activeTag.replace(`${msg.customName}_`, '');
                            if (linkedBot.imageMap[realTag]) imgData = linkedBot.imageMap[realTag];
                        }
                    }
                } else {
                    if (activeTag && bot.imageMap[activeTag]) {
                        imgData = bot.imageMap[activeTag];
                    }
                }
                
                const displayAvatar = isGroupChatMsg ? (avatarUrl || bot.avatar) : null;
                const displayName = isGroupChatMsg ? msg.customName : null;

                appendMessage(msg.text, msg.sender, imgData, false, msg.imageTag, displayAvatar, displayName);
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
        botLanguageInput.value = bot.language || 'pt-BR';
        botVoiceSpeedInput.value = bot.voiceSpeed || '1.0';
        tempImageMap = JSON.parse(JSON.stringify(bot.imageMap || {})); 
        tagRenames = {};
        tempAvatar = bot.avatar || null;
        tempBg = bot.background || null;
        botAvatarFile.value = '';
        botBgFile.value = '';
        
        modalTitle.innerText = "Configurar Personagem";
        deleteBotBtn.style.display = bots.length > 1 ? 'block' : 'none';
        duplicateBotBtn.style.display = 'block';
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
        duplicateBotBtn.style.display = 'none';
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
        const language = botLanguageInput.value;
        const voiceSpeed = botVoiceSpeedInput.value;

        try {
            if (isCreatingNew) {
                const newBot = {
                    id: 'bot_' + Date.now(),
                    name,
                    personality,
                    scenario,
                    language,
                    voiceSpeed,
                    history: [],
                    imageMap: tempImageMap,
                    avatar: tempAvatar,
                    background: tempBg,
                    linkedBots: []
                };
                bots.push(newBot);
                activeBotId = newBot.id;
            } else {
                const bot = getActiveBot();
                bot.name = name;
                bot.personality = personality;
                bot.scenario = scenario;
                bot.language = language;
                bot.voiceSpeed = voiceSpeed;
                bot.imageMap = tempImageMap;
                bot.avatar = tempAvatar;
                bot.background = tempBg;
                
                // Update history with renamed tags
                Object.keys(tagRenames).forEach(oldTag => {
                    bot.history.forEach(msg => {
                        if (msg.imageTag === oldTag) {
                            msg.imageTag = tagRenames[oldTag];
                        }
                    });
                });
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

    duplicateBotBtn.addEventListener('click', () => {
        if (confirm("Criar uma cópia deste personagem? (O histórico de conversas não será copiado)")) {
            const currentBot = getActiveBot();
            const newBot = {
                id: 'bot_' + Date.now(),
                name: currentBot.name + ' (Cópia)',
                personality: currentBot.personality,
                scenario: currentBot.scenario,
                history: [], 
                imageMap: JSON.parse(JSON.stringify(currentBot.imageMap || {})),
                avatar: currentBot.avatar,
                background: currentBot.background,
                linkedBots: []
            };
            bots.push(newBot);
            activeBotId = newBot.id;
            saveState();
            renderCharacterList();
            loadChat();
            settingsModal.classList.add('hidden');
        }
    });

    // --- Group Logic ---
    groupBtn.addEventListener('click', () => {
        const currentBot = getActiveBot();
        currentBot.linkedBots = currentBot.linkedBots || [];
        groupBotList.innerHTML = '';
        
        let addedCount = 0;
        bots.forEach(b => {
            if (b.id !== currentBot.id) {
                const label = document.createElement('label');
                label.style.display = 'block';
                label.style.marginBottom = '8px';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = b.id;
                checkbox.checked = currentBot.linkedBots.includes(b.id);
                checkbox.style.marginRight = '10px';
                
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(b.name));
                groupBotList.appendChild(label);
                addedCount++;
            }
        });
        
        if (addedCount === 0) {
            groupBotList.innerHTML = '<p style="color: #888;">Você precisa criar outro personagem primeiro para poder adicioná-lo ao grupo.</p>';
        }
        
        groupModal.classList.remove('hidden');
    });

    closeGroupBtn.addEventListener('click', () => {
        groupModal.classList.add('hidden');
    });

    saveGroupBtn.addEventListener('click', () => {
        const currentBot = getActiveBot();
        const checkboxes = groupBotList.querySelectorAll('input[type="checkbox"]');
        currentBot.linkedBots = [];
        checkboxes.forEach(cb => {
            if (cb.checked) currentBot.linkedBots.push(cb.value);
        });
        saveState();
        groupModal.classList.add('hidden');
        alert("Grupo atualizado! Nas próximas mensagens, a IA poderá responder como esses personagens.");
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
    const appendMessage = (text, sender, imageUrl = null, save = true, imageTag = null, customAvatar = null, customName = null) => {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', sender);
        
        // Se for o bot e tivermos um customName/Avatar, adicionamos um cabeçalho no balão
        if (sender === 'bot' && (customName || customAvatar)) {
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.marginBottom = '5px';
            header.style.gap = '8px';
            
            if (customAvatar) {
                const img = document.createElement('img');
                img.src = customAvatar;
                img.style.width = '24px';
                img.style.height = '24px';
                img.style.borderRadius = '50%';
                img.style.objectFit = 'cover';
                header.appendChild(img);
            }
            if (customName) {
                const nameSpan = document.createElement('strong');
                nameSpan.innerText = customName;
                nameSpan.style.fontSize = '0.85em';
                nameSpan.style.color = 'var(--accent-color)';
                header.appendChild(nameSpan);
            }
            msgDiv.appendChild(header);
        }

        const textSpan = document.createElement('span');
        textSpan.innerText = text;
        msgDiv.appendChild(textSpan);

        if (sender === 'bot') {
            const ttsBtn = document.createElement('button');
            ttsBtn.innerText = '🔊';
            ttsBtn.title = "Ouvir Mensagem";
            ttsBtn.style.background = 'none';
            ttsBtn.style.border = 'none';
            ttsBtn.style.cursor = 'pointer';
            ttsBtn.style.marginLeft = '8px';
            ttsBtn.style.opacity = '0.7';
            
            ttsBtn.addEventListener('click', () => {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    
                    const cleanSpeech = text.replace(/\[IMAGE:.*?\]/g, '').replace(/[*_~`#]/g, '').trim();
                    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
                    const bot = getActiveBot();
                    
                    utterance.lang = bot.language || 'pt-BR';
                    utterance.rate = parseFloat(bot.voiceSpeed) || 1.0;
                    
                    const voices = window.speechSynthesis.getVoices();
                    
                    // Prioriza vozes Premium (Online/Natural/Cloud) que são nativas e gratuitas nos navegadores modernos
                    let bestVoice = voices.find(v => v.lang.includes(utterance.lang) && (v.name.includes('Online') || v.name.includes('Natural') || v.name.includes('Premium')));
                    
                    // Se não achar Premium, tenta achar uma voz feminina básica
                    if (!bestVoice) {
                        bestVoice = voices.find(v => v.lang.includes(utterance.lang) && (v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Maria') || v.name.includes('Francisca')));
                    }
                    
                    // Se não achar, pega a primeira disponível do idioma
                    if (!bestVoice) {
                        bestVoice = voices.find(v => v.lang.includes(utterance.lang));
                    }

                    if (bestVoice) {
                        utterance.voice = bestVoice;
                    }
                    
                    window.speechSynthesis.speak(utterance);
                } else {
                    alert('Seu navegador não suporta leitura de tela.');
                }
            });
            
            // Coloca o botão de som ao lado do texto
            const flexContainer = document.createElement('div');
            flexContainer.style.display = 'flex';
            flexContainer.style.justifyContent = 'space-between';
            flexContainer.style.alignItems = 'flex-end';
            
            msgDiv.replaceChild(flexContainer, textSpan);
            flexContainer.appendChild(textSpan);
            flexContainer.appendChild(ttsBtn);
        }

        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            msgDiv.appendChild(img);
        }

        messagesContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        if (save) {
            const bot = getActiveBot();
            bot.history.push({ sender, text, imageTag, customName });
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
        bot.linkedBots = bot.linkedBots || [];
        const linked = bot.linkedBots.map(id => bots.find(b => b.id === id)).filter(Boolean);
        
        let combinedPersonality = bot.personality;
        let combinedTags = Object.keys(bot.imageMap || {});
        let combinedScenario = bot.scenario || '';
        let isGroupChat = linked.length > 0;

        if (isGroupChat) {
            combinedPersonality = `ATENÇÃO: Este é um CHAT EM GRUPO. Você atuará como MÚLTIPLOS personagens principais simultaneamente.\n\n` +
                                  `Personagem 1 (Host): NOME: ${bot.name}\nPERSONALIDADE: ${bot.personality}\n\n`;
            
            linked.forEach((lb, i) => {
                combinedPersonality += `Personagem ${i+2}: NOME: ${lb.name}\nPERSONALIDADE: ${lb.personality}\n\n`;
                combinedTags = combinedTags.concat(Object.keys(lb.imageMap || {}).map(t => `${lb.name}_${t}`));
                if (lb.scenario) combinedScenario += `\n[Cenário de ${lb.name}]: ${lb.scenario}`;
            });

            combinedPersonality += `\n\nREGRAS CRÍTICAS DE RESPOSTA NO GRUPO:
            1. Você DEVE indicar quem está falando colocando o nome entre colchetes no início da fala. Exemplo: "[${bot.name}] Oi Thiago!" ou "[${linked[0].name}] Olá!".
            2. Você pode responder com apenas um personagem, ou com vários na mesma mensagem (escrevendo a fala de um, quebrando linha, e escrevendo a fala do outro).
            3. Se você for enviar uma imagem de um personagem, certifique-se de que a tag corresponda àquele personagem. Para o Host (${bot.name}), use as tags originais [IMAGE: tag]. Para os convidados, o nome foi embutido na tag: [IMAGE: NomedaPessoa_tag].`;
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: bot.history.slice(-100).map(h => ({ sender: h.sender, text: h.text })),
                    personality: combinedPersonality,
                    scenario: combinedScenario,
                    availableTags: combinedTags
                })
            });

            const data = await response.json();
            removeTypingIndicator();

            if (data.error) {
                bot.history.pop();
                saveState();
                loadChat();
                appendMessage("⚠️ Mensagem bloqueada e revertida! Motivo: " + data.error, 'bot', null, false);
            } else {
                if (data.imageTag) bot.lastImageTag = data.imageTag;
                let activeTag = data.imageTag || bot.lastImageTag;
                
                let messagesToRender = [];
                let rawText = data.text;
                
                if (isGroupChat) {
                    // Divide o texto pelo padrão [Nome]
                    const regex = /\[(.*?)\]\s*(.*?(?=\[|$))/gs;
                    let match;
                    let lastIndex = 0;
                    
                    while ((match = regex.exec(rawText)) !== null) {
                        const senderName = match[1];
                        const msgText = match[2].trim();
                        if (msgText) {
                            messagesToRender.push({ name: senderName, text: msgText });
                        }
                        lastIndex = regex.lastIndex;
                    }
                    // Se a IA esqueceu as tags, joga tudo pro host
                    if (messagesToRender.length === 0 && rawText.trim()) {
                        messagesToRender.push({ name: bot.name, text: rawText.trim() });
                    }
                } else {
                    messagesToRender.push({ name: bot.name, text: rawText });
                }

                messagesToRender.forEach((msg, index) => {
                    let avatarUrl = bot.avatar;
                    let imgData = null;
                    
                    if (msg.name !== bot.name) {
                        const linkedBot = linked.find(b => b.name === msg.name);
                        if (linkedBot) {
                            avatarUrl = linkedBot.avatar;
                            if (activeTag && activeTag.startsWith(`${msg.name}_`)) {
                                let realTag = activeTag.replace(`${msg.name}_`, '');
                                if (linkedBot.imageMap[realTag]) imgData = linkedBot.imageMap[realTag];
                            }
                        }
                    } else {
                        if (activeTag && bot.imageMap[activeTag]) {
                            imgData = bot.imageMap[activeTag];
                        }
                    }
                    
                    // Mostramos o nome se for grupo, senão não precisa
                    const displayName = isGroupChat ? msg.name : null;
                    const displayAvatar = isGroupChat ? avatarUrl : null;
                    
                    // Apenas a última mensagem do bloco leva a imagem (se houver) para não duplicar visualmente
                    const isLast = (index === messagesToRender.length - 1);
                    appendMessage(msg.text, 'bot', isLast ? imgData : null, true, isLast ? activeTag : null, displayAvatar, displayName);
                });
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

    // --- Voice Recognition Logic ---
    let recognition;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR'; // Pode ser alterado dinamicamente para 'en-US' no futuro
        recognition.interimResults = false;
        recognition.continuous = false;

        recognition.onstart = () => {
            micBtn.innerText = '🔴';
            messageInput.placeholder = 'Ouvindo...';
        };

        recognition.onresult = async (event) => {
            const rawTranscript = event.results[0][0].transcript;
            micBtn.innerText = '⏳';
            messageInput.placeholder = 'Limpando áudio...';
            
            try {
                const response = await fetch('/api/clean-text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rawText: rawTranscript })
                });
                const data = await response.json();
                
                if (data.text) {
                    messageInput.value = data.text;
                } else {
                    messageInput.value = rawTranscript; // Fallback
                }
            } catch (e) {
                console.error("Erro ao limpar texto", e);
                messageInput.value = rawTranscript; // Fallback
            }
            
            micBtn.innerText = '🎤';
            messageInput.placeholder = 'Digite sua mensagem...';
        };

        recognition.onerror = (event) => {
            console.error("Erro de reconhecimento de voz:", event.error);
            micBtn.innerText = '🎤';
            messageInput.placeholder = 'Digite sua mensagem...';
        };

        recognition.onend = () => {
            if (micBtn.innerText === '🔴') {
                micBtn.innerText = '🎤';
                messageInput.placeholder = 'Digite sua mensagem...';
            }
        };

        micBtn.addEventListener('click', () => {
            if (micBtn.innerText === '🎤') {
                recognition.lang = getActiveBot().language || 'pt-BR';
                recognition.start();
            } else {
                recognition.stop();
            }
        });
    } else {
        micBtn.style.display = 'none';
        console.warn("SpeechRecognition não suportado neste navegador.");
    }

    renderCharacterList();
    loadChat();
    loadCloudState(); // Carrega da nuvem logo após carregar o local
});
