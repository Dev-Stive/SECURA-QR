
        
        function getAuthToken() {
            return localStorage.getItem('secura_event_session_token') 
                || localStorage.getItem('secura_token') 
                || window.storage?.token 
                || null;
        }

        // Variables globales
        let currentUser = null;
        let currentEvent = null;
        let currentConversation = null;
        let currentConversationId = null;
        let conversations = [];
        let messages = [];
        let typingTimeout = null;
        let messagePollingInterval = null;
        let conversationPollingInterval = null;
        let chatSocket = null; // WebSocket connection
        let selectedFile = null;
        let replyingToMessage = null;
        let reactingToMessage = null;
        let isOnline = navigator.onLine;
        let messagePage = 1;
        const messagesPerPage = 50;
        
        // Gestion de l'état de connexion
        let isServerOnline = true;
        let connectionRetryCount = 0;
        let maxConnectionRetries = 5;
        let connectionRetryInterval = null;
        const connectionRetryDelay = 3000; // 3 secondes

        // Initialisation
        document.addEventListener('DOMContentLoaded', async () => {
            try {


                // Vérifier l'authentification
                await checkAuthentication();
                
                
                // Charger l'utilisateur courant
                await loadCurrentUser();
                
                // Initialiser les composants
                initComponents();
                
                // Initialiser WebSocket après chargement de l'utilisateur
                setTimeout(() => initWebSocket(), 500);
                
                // Charger les conversations
                await loadConversations();
                
                // Démarrer le polling
                startPolling();
                
                // Gérer la connexion/réseau
                setupNetworkHandling();
                
            } catch (error) {
                console.error('Erreur d\'initialisation:', error);
                showToast('Erreur de chargement du chat', 'error');
            }
        });

        // Vérifier l'authentification de session d'événement
        async function checkAuthentication() {
            const token = localStorage.getItem('secura_event_session_token');
            if (!token) {
                window.location.href = '../access.html';
                throw new Error('Aucune session d\'événement active');
            }
            
            try {
                // Vérifier que la session existe et est valide
                const sessionResult = await storage.getCurrentSessionDetails();
                
                if (!sessionResult?.success || !sessionResult?.data) {
                    throw new Error('Session invalide ou expirée');
                }
                
                const sessionData = sessionResult.data;
                
                // Vérifier qu'on a au minimum une table
                if (!sessionData.table) {
                    throw new Error('Table non associée à la session');
                }
                
                console.log('✅ Session valide:', sessionData);
                return sessionData;
                
            } catch (error) {
                console.error('❌ Erreur vérification session:', error);
                throw error;
            }
        }

        // Charger l'invité courant de la session
        async function loadCurrentUser() {
            try {
                // Récupérer les détails de la session d'événement
                const sessionResult = await window.storage.getCurrentSessionDetails();
                
                if (!sessionResult?.success || !sessionResult?.data) {
                    throw new Error('Session introuvable');
                }
                
                const sessionData = sessionResult.data;
                
                
                // L'invité courant (peut être null en mode anonyme)
                currentUser = sessionData.guest || null;
                currentEvent = sessionData.event || null;
                
                // Stocker aussi les données de session pour utilisation ultérieure
                window.storage.currentSession = sessionData;
                
                if (currentUser) {
                    console.log('✅ Invité chargé:', {
                        id: currentUser.id,
                        name: `${currentUser.firstName} ${currentUser.lastName}`,
                        email: currentUser.email,
                    });
                } else {
                    console.log('ℹ️ Mode anonyme - table:', sessionData.table?.tableNumber);
                }
                
                return currentUser;
                
            } catch (error) {
                console.error('❌ Erreur chargement invité:', error);
                throw error;
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // 🔌 WEBSOCKET - INITIALISATION ET GESTION
        // ════════════════════════════════════════════════════════════════════

        // Initialiser la connexion WebSocket
        async function initWebSocket() {
            if (!currentUser || !window.storage?.currentSession) {
                console.warn('⚠️ WebSocket: Session non disponible, tentative en mode anonyme');
            }

            try {
                const token = localStorage.getItem('secura_event_session_token');
                const eventId = currentEvent?.id || 'unknown_event';
                const userId = currentUser?.id || 'anonymous';

                // Configuration de la connexion WebSocket
                const socketConfig = {
                    auth: {
                        token,
                        userId,
                        eventId
                    },
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000,
                    reconnectionAttempts: 5,
                    transports: ['websocket', 'polling']
                };

                // Déterminer l'URL du serveur (développement ou production)
                const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const serverUrl = isLocalhost 
                    ? 'http://localhost:3000' 
                    : window.location.origin.replace(/\/welcome.*/, ''); // Récupère l'origin correct sans /api

                console.log('🌐 WebSocket URL:', serverUrl, '| Socket path: /chat | User:', userId);

                // Se connecter au namespace /chat
                chatSocket = io(serverUrl + '/chat', socketConfig);

                // Configurer les écouteurs WebSocket
                setupWebSocketListeners();

                console.log('✅ WebSocket: Initialisation en cours...');

            } catch (error) {
                console.error('❌ WebSocket: Erreur initialisation', error);
            }
        }

        // Configurer les écouteurs WebSocket
        function setupWebSocketListeners() {
            if (!chatSocket) {
                console.warn('⚠️ WebSocket: Socket non disponible');
                return;
            }

            // ────────────────────────────────────────────────────────
            // 🔌 Événements de connexion
            // ────────────────────────────────────────────────────────

            chatSocket.on('connect', () => {
                console.log('✅ WebSocket: Connecté au serveur | Socket ID:', chatSocket.id);
                isOnline = true;
                updateConnectionStatus();
                
                console.log('📤 Émission user:online:', {
                    userId: currentUser?.id || 'anonymous',
                    timestamp: new Date()
                });
                
                // Notifier le serveur que l'utilisateur est en ligne
                chatSocket.emit('user:online', {
                    userId: currentUser?.id || 'anonymous',
                    timestamp: new Date()
                });
            });

            chatSocket.on('disconnect', () => {
                console.log('❌ WebSocket: Déconnecté du serveur');
                isOnline = false;
                updateConnectionStatus();
            });

            chatSocket.on('connect_error', (error) => {
                console.warn('⚠️ WebSocket: Erreur de connexion', error);
                console.log('Erreur détails:', {
                    message: error.message,
                    type: error.type,
                    data: error.data
                });
                isOnline = false;
                updateConnectionStatus();
            });

            // ────────────────────────────────────────────────────────
            // 💬 Événements de messages
            // ────────────────────────────────────────────────────────

            // Nouveau message reçu
            chatSocket.on('message:new', (data) => {
                const { id, conversationId, senderId, content, timestamp, type, createdAt } = data;
                
                console.log('💬 WebSocket: Nouveau message reçu', { conversationId, senderId, id });

                if (!Array.isArray(messages)) {
                    messages = [];
                }

                if (!messages.some(m => m.id === id)) {
                    messages.push({
                        id,
                        conversationId,
                        senderId,
                        content,
                        createdAt: createdAt || timestamp,
                        type: type || 'text',
                        delivered: true,
                        readBy: [],
                        reactions: {}
                    });

                    // 📋 TOUJOURS mettre à jour la liste des conversations
                    const conv = conversations.find(c => c.id === conversationId);
                    if (conv) {
                        // ✅ Construire un objet message complet pour lastMessage
                        const messageTimestamp = createdAt || timestamp;
                        conv.lastMessage = {
                            id,
                            content,
                            senderId,
                            createdAt: messageTimestamp,
                            type: type || 'text',
                            delivered: true,
                            readBy: [],
                            reactions: {}
                        };
                        
                        // ✅ Mettre à jour updatedAt pour le tri
                        conv.updatedAt = messageTimestamp;
                        
                        // ✅ Réordonner les conversations
                        conversations.sort((a, b) => 
                            new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
                        );
                        
                        // ✅ Rendu de la liste des conversations
                        renderConversationsList(conversations);
                    }

                    // 💬 Afficher le message UNIQUEMENT si c'est un message d'un autre utilisateur
                    if (currentConversationId === conversationId && senderId !== (currentUser?.id || 'anonymous')) {
                        renderMessages(messages);
                        setTimeout(scrollToBottom, 100);
                    }
                } else {
                    console.log('⚠️ Message déjà existant, ignoré');
                }
            });

            chatSocket.on('conversation:message-received', (data) => {
                const { conversationId, senderId, messagePreview, timestamp, participantIds, lastMessage } = data;
                
                console.log('📬 WebSocket: Message reçu dans conversation', { 
                    conversationId,
                    isMember: participantIds?.includes(currentUser?.id)
                });

                // ✅ Vérifier si JE suis un participant de cette conversation
                if (participantIds && !participantIds.includes(currentUser?.id)) {
                    console.log('ℹ️ Message pour une conversation dont je ne suis pas membre');
                    return;
                }

                const conv = conversations.find(c => c.id === conversationId);
                if (conv) {
                    // Utiliser le lastMessage complet du serveur s'il est fourni, sinon construire
                    conv.lastMessage = lastMessage || {
                        content: messagePreview,
                        senderId,
                        createdAt: timestamp,
                        type: 'text',
                        delivered: true,
                        readBy: [],
                        reactions: {}
                    };
                    
                    // ✅ Mettre à jour updatedAt pour le tri
                    conv.updatedAt = timestamp;
                    
                    // ✅ Réordonner les conversations
                    conversations.sort((a, b) => 
                        new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
                    );

                    // ✅ Rendu de la liste des conversations
                    renderConversationsList(conversations);
                    
                    // Animation de notification
                    const convElement = document.querySelector(`[data-conversation-id="${conversationId}"]`);
                    if (convElement && currentConversationId !== conversationId) {
                        convElement.classList.add('pulse-notification');
                        setTimeout(() => convElement.classList.remove('pulse-notification'), 1000);
                    }
                }
            });

            // ────────────────────────────────────────────────────────
            // ✏️ Événements d'édition/suppression
            // ────────────────────────────────────────────────────────

            chatSocket.on('message:edited', (data) => {
                const { messageId, newContent, editedBy, editedAt } = data;
                
                const message = messages.find(m => m.id === messageId);
                if (message) {
                    message.content = newContent;
                    message.edited = true;
                    message.editedAt = new Date(editedAt);
                    
                    if (currentConversationId) {
                        renderMessages();
                    }
                }
            });

            chatSocket.on('message:deleted', (data) => {
                const { messageId, deletedBy, deletedAt } = data;
                
                const messageIndex = messages.findIndex(m => m.id === messageId);
                if (messageIndex > -1) {
                    messages.splice(messageIndex, 1);
                    
                    if (currentConversationId) {
                        renderMessages();
                    }
                }
            });

            // ────────────────────────────────────────────────────────
            // � Événements de réactions
            // ────────────────────────────────────────────────────────

            chatSocket.on('message:reaction:add', (data) => {
                const { conversationId, messageId, userId: reactionUserId, emoji, action, timestamp } = data;
                
                // Mettre à jour le message localement
                const message = messages.find(m => m.id === messageId);
                if (!message) return;
                
                if (!message.reactions) {
                    message.reactions = {};
                }
                
                if (action === 'added') {
                    // Ajouter la réaction
                    if (!message.reactions[emoji]) {
                        message.reactions[emoji] = [];
                    }
                    
                    if (!message.reactions[emoji].includes(reactionUserId)) {
                        message.reactions[emoji].push(reactionUserId);
                    }
                } else if (action === 'removed') {
                    // Retirer la réaction
                    if (message.reactions[emoji]) {
                        const index = message.reactions[emoji].indexOf(reactionUserId);
                        if (index !== -1) {
                            message.reactions[emoji].splice(index, 1);
                        }
                        
                        // Supprimer l'emoji s'il n'y a plus de réactions
                        if (message.reactions[emoji].length === 0) {
                            delete message.reactions[emoji];
                        }
                    }
                }
                
                renderMessages(messages);
                renderConversationsList(conversations);
                
                
                console.log(`👍 WebSocket: Réaction ${action}`, {
                    messageId,
                    emoji,
                    userId: reactionUserId
                });
            });



            chatSocket.on('message:reaction', (data) => {
                const { conversationId, messageId, userId: reactionUserId, emoji, action, timestamp } = data;
                
                loadConversations();
                loadMessages(conversationId, false);
                renderMessages(messages);
                renderConversationsList(conversations);
                
                
                console.log(`👍 WebSocket: Réaction ${action}`, {
                    messageId,
                    emoji,
                    userId: reactionUserId
                });
            });

            // ────────────────────────────────────────────────────────
            // �👁️ Événements de saisie
            // ────────────────────────────────────────────────────────

            chatSocket.on('message:typing', (data) => {
                const { userId: typingUserId, conversationId, isTyping } = data;
                
                console.log(`🔊 WebSocket typing event:`, {
                    typingUserId,
                    conversationId,
                    isTyping,
                    currentUserId: currentUser?.id,
                    currentConversationId,
                    conversationExists: !!conversations.find(c => c.id === conversationId)
                });
                
                if (isTyping && typingUserId !== (currentUser?.id || 'anonymous')) {
                    showTypingIndicator(conversationId, typingUserId);
                } else {
                    hideTypingIndicator(conversationId, typingUserId);
                }
            });

            // ────────────────────────────────────────────────────────
            // 👤 Événements d'utilisateur
            // ────────────────────────────────────────────────────────

            chatSocket.on('user:status', (data) => {
                const { userId, status, isOnline, lastSeenAt } = data;
                
                console.log(`👤 WebSocket: Utilisateur ${status}`, userId, {
                    isOnline,
                    lastSeenAt
                });

                // Mettre à jour le statut utilisateur dans les conversations
                let updateCount = 0;
                conversations.forEach(conv => {
                    if (conv.participants?.some(p => p.userId === userId)) {
                        const participant = conv.participants.find(p => p.userId === userId);
                        if (participant) {
                            console.log(`  📍 Conversation ${conv.id}: Mise à jour participant`, {
                                before: {
                                    isOnline: participant.isOnline,
                                    status: participant.status,
                                    lastSeenAt: participant.lastSeenAt
                                },
                                after: {
                                    isOnline: isOnline || false,
                                    status: status,
                                    lastSeenAt: lastSeenAt || null
                                }
                            });
                            
                            participant.status = status;
                            participant.isOnline = isOnline || false;
                            participant.lastSeenAt = lastSeenAt || null;
                            updateCount++;
                        }
                    }
                });
                
                console.log(`✅ ${updateCount} conversation(s) mises à jour`);

                // Mettre à jour l'en-tête du chat si c'est la conversation courante
                if (currentConversation) {
                    updateChatHeader();
                }

                // Re-appliquer le filtre actif (important pour le filtre "online")
                filterConversations();
                renderConversationsList(conversations);
            });

            // ────────────────────────────────────────────────────────
            // 👥 Événements de conversation
            // ────────────────────────────────────────────────────────

            chatSocket.on('conversation:user-joined', (data) => {
                const { userId: joinedUserId, userCount } = data;
                console.log(`👥 WebSocket: ${joinedUserId} a rejoint`, { userCount });
                updateConversationUserCount(userCount);
            });

            chatSocket.on('conversation:user-left', (data) => {
                const { userId: leftUserId, userCount } = data;
                console.log(`👥 WebSocket: ${leftUserId} a quitté`, { userCount });
                updateConversationUserCount(userCount);
            });

            // ────────────────────────────────────────────────────────
            //  Événements de synchronisation
            // ────────────────────────────────────────────────────────

            chatSocket.on('conversations:sync-request', (data) => {
                console.log('🔄 WebSocket: Demande de synchronisation', data);
                // Le serveur demande une synchronisation
                loadConversations(true);
            });

            // ────────────────────────────────────────────────────────
            // 🗑️ Événement de suppression de conversation
            // ────────────────────────────────────────────────────────

            chatSocket.on('conversation:deleted', (data) => {
                const { conversationId, deletedBy, timestamp } = data;
                
                console.log('🗑️ WebSocket: Conversation supprimée', { conversationId, deletedBy });

                // ✅ Supprimer la conversation de la liste locale
                const conversationIndex = conversations.findIndex(c => c.id === conversationId);
                if (conversationIndex > -1) {
                    conversations.splice(conversationIndex, 1);
                }

                if (currentConversationId === conversationId) {
                    // Déterminer qui a supprimé (nom du supprimant)
                    let deleterName = 'Un utilisateur';
                    if (deletedBy !== (currentUser?.id || 'anonymous')) {
                        // Chercher le nom dans les participants
                        const deleterConv = conversations.find(c => 
                            c.participants?.some(p => p.userId === deletedBy)
                        );
                        if (deleterConv) {
                            const deleter = deleterConv.participants.find(p => p.userId === deletedBy);
                            if (deleter) {
                                deleterName = deleter.name || deleter.email || 'Un utilisateur';
                            }
                        }
                    }

                    // Fermer le chat
                    currentConversationId = null;
                    currentConversation = null;
                    messages = [];
                    messagePage = 1;

                    // Afficher le message
                    if (deletedBy === (currentUser?.id || 'anonymous')) {
                        showToast('Vous avez supprimé cette conversation', 'info');
                    } else {
                        showToast(`${deleterName} a supprimé cette conversation`, 'info');
                    }

                    // Cacher le chat
                    hideChatArea();
                } else {
                    showToast('Une conversation a été supprimée', 'info');
                }

                // Rerendre la liste des conversations
                renderConversationsList(conversations);
            });

            // ────────────────────────────────────────────────────────
            // ✨ Événement: Nouvelle conversation créée (par d'autres utilisateurs)
            // ────────────────────────────────────────────────────────
            
            chatSocket.on('conversation:created', (data) => {
                const { conversationId, conversation, participantIds, createdBy, createdAt } = data;
                
                console.log('✨ WebSocket: Nouvelle conversation créée', { 
                    conversationId, 
                    createdBy,
                    participantIds,
                    isMember: participantIds?.includes(currentUser?.id)
                });
                
                // ✅ Vérifier si MOI je suis dans les participants
                if (!participantIds?.includes(currentUser?.id) && createdBy !== currentUser?.id) {
                    console.log('ℹ️ Conversation créée pour d\'autres participants, ignorée pour moi');
                    return;
                }
                
                // ✅ Ajouter la conversation à notre liste si elle n'existe pas
                if (!conversations.find(c => c.id === conversationId)) {
                    conversations.push(conversation);
                    console.log('✅ Conversation ajoutée à la liste locale');
                    
                    // Mettre à jour l'affichage
                    renderConversationsList(conversations);
                    
                    // Si c'est MOI qui l'ai créée, la sélectionner automatiquement
                    if (createdBy === currentUser?.id) {
                        setTimeout(() => selectConversation(conversationId), 100);
                    }
                }
            });

            // ────────────────────────────────────────────────────────
            // 📨 Événement: Conversation mise à jour (pour les listes)
            // ────────────────────────────────────────────────────────
            
            chatSocket.on('conversation:updated', (data) => {
                const { conversationId, conversation, participantIds, updatedBy } = data;
                
                console.log('📨 WebSocket: Conversation mise à jour', { 
                    conversationId, 
                    updatedBy,
                    isMember: participantIds?.includes(currentUser?.id)
                });
                
                // ✅ Vérifier si MOI je suis dans les participants
                if (!participantIds?.includes(currentUser?.id)) {
                    return;
                }
                
                // ✅ Mettre à jour la conversation dans notre liste
                const convIndex = conversations.findIndex(c => c.id === conversationId);
                if (convIndex !== -1) {
                    conversations[convIndex] = {
                        ...conversations[convIndex],
                        ...conversation
                    };
                    console.log('✅ Conversation mise à jour dans la liste locale');
                    renderConversationsList(conversations);
                }
            });

            // ────────────────────────────────────────────────────────
            // 🗑️ Événement: Message supprimé par quelqu'un d'autre
            // ────────────────────────────────────────────────────────
            
            chatSocket.on('message:deleted', (data) => {
                const { conversationId, messageId, deletedAt, participantIds } = data;
                
                // ✅ Vérifier si MOI je suis dans les participants
                if (!participantIds?.includes(currentUser?.id)) {
                    return;
                }
                
                // Si c'est dans la conversation courante, mettre à jour les messages
                if (conversationId === currentConversationId) {
                    const msg = messages.find(m => m.id === messageId);
                    if (msg) {
                        msg.deletedAt = deletedAt;
                        console.log(`🗑️ Message supprimé dans la conversation courante: ${messageId}`);
                        renderMessages(messages);
                    }
                }
            });
        }

        // Fonctions utilitaires WebSocket
        function showTypingIndicator(conversationId, userId) {
            if (userId === (currentUser?.id || 'anonymous')) return;
            
            if (conversationId !== currentConversationId) {
                console.log(`⚠️ Typing: Conversation ${conversationId} n'est pas active (currentConversationId=${currentConversationId})`);
                updateConversationTypingPreview(conversationId, userId, true);
                return;
            }
            
            const typingElement = document.querySelector('[data-typing-indicator]');
            if (typingElement) {
                typingElement.style.display = 'flex';
                if (userId) {
                    typingElement.setAttribute('data-typing-indicator', userId);
                    
                    let typingUserName = 'quelqu\'un';
                    let foundUser = null;
                    let searchLocations = [];
                 
                    
                    // Chercher dans currentConversation
                    if (currentConversation?.participants) {
                        foundUser = currentConversation.participants.find(p => p.userId === userId);
                        if (foundUser) searchLocations.push('currentConversation');
                    }
                    
                    // Si pas trouvé, chercher dans la conversation du groupe
                    if (!foundUser) {
                        const targetConversation = conversations.find(c => c.id === conversationId);
                        if (targetConversation?.participants) {
                          
                            foundUser = targetConversation.participants.find(p => p.userId === userId);
                            if (foundUser) searchLocations.push(`targetConversation(${conversationId})`);
                        }
                    }
                    
                    // Si toujours pas trouvé, chercher dans TOUTES les conversations
                    if (!foundUser) {
                        for (const conv of conversations) {
                            if (conv.participants) {
                                foundUser = conv.participants.find(p => p.userId === userId);
                                if (foundUser) {
                                    searchLocations.push(`allConversations(${conv.id})`);
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (foundUser) {
                        typingUserName = foundUser.name || foundUser.email || 'Utilisateur';
                    }
               
                    
                    // Mettre à jour le texte
                    const typingText = typingElement.querySelector('#typingText');
                    if (typingText) {
                        typingText.textContent = `${typingUserName} est en train d'écrire...`;
                    }
                }
            }
            
            // 📝 Mettre à jour aussi le preview dans la liste des conversations
            updateConversationTypingPreview(conversationId, userId, true);
        }

        function hideTypingIndicator(conversationId, userId) {
            const typingElement = document.querySelector('[data-typing-indicator]');
            if (typingElement) {
                typingElement.style.display = 'none';
                typingElement.setAttribute('data-typing-indicator', '');
            }
            
            // 📝 Mettre à jour aussi le preview dans la liste des conversations
            updateConversationTypingPreview(conversationId, userId, false);
        }
        
        // 📝 Mettre à jour le preview de typing dans la liste des conversations
        function updateConversationTypingPreview(conversationId, userId, isTyping) {
            const previewElement = document.querySelector(`[data-conversation-preview="${conversationId}"]`);
            if (!previewElement) return;
            
            const conversation = conversations.find(c => c.id === conversationId);
            if (!conversation) return;
            
            if (isTyping) {
                // Ne pas afficher si c'est MOI qui tape
                if (userId === (currentUser?.id || 'anonymous')) return;
                
                // Récupérer le nom du participant qui tape
                let typingUserName = 'quelqu\'un';
                let foundUser = null;
                
                // Chercher dans la conversation
                if (conversation.participants) {
                    foundUser = conversation.participants.find(p => p.userId === userId);
                }
                
                // Si pas trouvé, chercher dans toutes les conversations
                if (!foundUser) {
                    for (const conv of conversations) {
                        if (conv.participants) {
                            foundUser = conv.participants.find(p => p.userId === userId);
                            if (foundUser) break;
                        }
                    }
                }
                
                if (foundUser) {
                    typingUserName = foundUser.name || foundUser.email || 'Utilisateur';
                }
                
                previewElement.innerHTML = `<em style="color: var(--placeholder-color);">${escapeHtml(typingUserName)} est en train d'écrire...</em>`;
                previewElement.classList.add('typing');
            } else {
                renderConversationsList(conversations);
            }
        }

        function updateConversationUserCount(userCount) {
            const userCountElement = document.querySelector('[data-user-count]');
            if (userCountElement) {
                userCountElement.textContent = `${userCount} en ligne`;
            }
        }

        // Envoyer un message via WebSocket
        function sendMessageViaWebSocket(conversationId, content) {
            if (chatSocket && chatSocket.connected) {
                const messageId = 'msg_' + Date.now();
                const timestamp = new Date();

                chatSocket.emit('message:send', {
                    conversationId,
                    content,
                    messageId,
                    timestamp
                });

                return true;
            }
            return false;
        }

        // Notifier une saisie en cours
        function notifyTyping(conversationId) {
            if (chatSocket && chatSocket.connected) {
                
                chatSocket.emit('message:typing', { conversationId });
            }
        }

        // Notifier fin de saisie
        function notifyStopTyping(conversationId) {
            if (chatSocket && chatSocket.connected) {
                chatSocket.emit('message:stop-typing', { conversationId });
            }
        }

        // Rejoindre une conversation
        function joinConversationViaWebSocket(conversationId) {
            if (chatSocket && chatSocket.connected) {
                chatSocket.emit('conversation:join', { conversationId });
            }
        }

        // Quitter une conversation
        function leaveConversationViaWebSocket(conversationId) {
            if (chatSocket && chatSocket.connected) {
                chatSocket.emit('conversation:leave', { conversationId });
            }
        }

        // Ajouter une réaction
        function addReactionViaWebSocket(conversationId, messageId, emoji) {
            if (chatSocket && chatSocket.connected) {
                chatSocket.emit('message:reaction:add', {
                    conversationId,
                    messageId,
                    emoji
                });
            }
        }

        // Éditer un message
        function editMessageViaWebSocket(conversationId, messageId, newContent) {
            if (chatSocket && chatSocket.connected) {
                chatSocket.emit('message:edit', {
                    conversationId,
                    messageId,
                    newContent
                });
            }
        }

        // Supprimer un message
        function deleteMessageViaWebSocket(conversationId, messageId) {
            if (chatSocket && chatSocket.connected) {
                chatSocket.emit('message:delete', {
                    conversationId,
                    messageId
                });
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // Initialiser les composants
        function initComponents() {
            // Initialiser le picker emoji
            initEmojiPicker();
            
            // Basculer input/actions
            setupActionsToggle();
            
            // Écouteurs d'événements
            setupEventListeners();
            
            // Gestion du drag and drop
            setupDragAndDrop();
            
            // Initialiser la saisie de message
            setupMessageInput();
            
            // Initialiser le panel de nouvelle conversation
            initializeConversationPanel();
            
            // Initialiser le profil du menu mobile
            updateMobileMenuProfile();
            
            // Initialiser le bouton profil du footer
            updateProfileButton();
            
            // Initialiser le retry manuel
            const manualRetryBtn = document.getElementById('manualRetryBtn');
            if (manualRetryBtn) {
                manualRetryBtn.addEventListener('click', manualRetryConnection);
            }
            
            // Mettre à jour l'état de connexion
            updateConnectionStatus();
        }

        // Initialiser le picker emoji
        function initEmojiPicker() {
            const picker = document.querySelector('emoji-picker');
            if (picker) {
                picker.addEventListener('emoji-click', event => {
                    const messageInput = document.getElementById('messageInput');
                    if (messageInput) {
                        messageInput.value += event.detail.unicode;
                        messageInput.focus();
                        adjustTextareaHeight(messageInput);
                    }
                });
            }
        }
        // ═══════════════════════════════════════════════════════════════════
        // ⚡ Basculer entre input et actions
        // ═══════════════════════════════════════════════════════════════════
        function setupActionsToggle() {
            const toggleActionsBtn = document.getElementById('toggleActionsBtn');
            const closeActionsBtn = document.getElementById('closeActionsBtn');
            const messageInputContainer = document.getElementById('messageInputContainer');
            
            if (toggleActionsBtn) {
                toggleActionsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    messageInputContainer.classList.remove('input-mode');
                    messageInputContainer.classList.add('actions-mode');
                });
            }
            
            if (closeActionsBtn) {
                closeActionsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    messageInputContainer.classList.remove('actions-mode');
                    messageInputContainer.classList.add('input-mode');
                    document.getElementById('messageInput')?.focus();
                });
            }
        }

        function setupEventListeners() {
            // Boutons de navigation
            document.getElementById('backToEventsBtn')?.addEventListener('click', () => {
                window.location.href = '../welcome/index.html';
            });

            document.getElementById('toggleConversationsBtn')?.addEventListener('click', () => {
                const conversationsPanel = document.getElementById('conversationsPanel');
                const chatMain = document.getElementById('chatMain');
                conversationsPanel.classList.toggle('active');
                chatMain.classList.toggle('active');
            });

            // Recherche de conversations
            const searchInput = document.getElementById('conversationsSearch');
            if (searchInput) {
                searchInput.addEventListener('input', debounce(filterConversations, 300));
            }

            // ✅ Filtres rapides des conversations
            const filterBtns = document.querySelectorAll('.filter-btn');
            filterBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Mettre à jour le style actif
                    filterBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Appliquer le filtre
                    const filterType = btn.dataset.filter;
                    applyConversationFilter(filterType);
                });
            });

            // Boutons d'action
            document.getElementById('newConversationBtn')?.addEventListener('click', openConversationPanel);
            document.getElementById('refreshConversationsBtn')?.addEventListener('click', () => {
                loadConversations(true);
            });

            // Menu mobile
            const mobileMenuBtn = document.getElementById('mobileMenuBtn');
            const mobileMenu = document.getElementById('mobileMenu');
            
            mobileMenuBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                mobileMenu?.classList.toggle('active');
                
                // Mettre à jour le profil dans le menu
                if (mobileMenu?.classList.contains('active') && currentUser) {
                    updateMobileMenuProfile();
                }
            });

            // Fermer le menu quand on clique ailleurs
            document.addEventListener('click', () => {
                if (mobileMenu?.classList.contains('active')) {
                    mobileMenu.classList.remove('active');
                }
            });

            // Cliquer sur le profile block pour ouvrir le panel profil
            document.getElementById('mobileMenuProfile')?.addEventListener('click', () => {
                mobileMenu?.classList.remove('active');
                openProfilePanel();
            });

            // Items du menu mobile
            document.getElementById('menuNewConversation')?.addEventListener('click', () => {
                mobileMenu?.classList.remove('active');
                openConversationPanel();
            });

            document.getElementById('menuRefresh')?.addEventListener('click', () => {
                mobileMenu?.classList.remove('active');
                loadConversations(true);
            });

            document.getElementById('menuSettings')?.addEventListener('click', () => {
                mobileMenu?.classList.remove('active');
                openSettingsPanel();
            });

            document.getElementById('menuProfile')?.addEventListener('click', () => {
                mobileMenu?.classList.remove('active');
                openProfilePanel();
            });

            document.getElementById('MenuProfile')?.addEventListener('click', () => {
                mobileMenu?.classList.remove('active');
                openProfilePanel();
            });

            

            // Boutons de la barre d'options (desktop)
            document.getElementById('conversationsProfileBtn')?.addEventListener('click', () => {
                openProfilePanel();
            });

            document.getElementById('conversationsSettingsBtn')?.addEventListener('click', () => {
                openSettingsPanel();
            });

           
            // Menu d'actions du chat
            document.getElementById('chatActionsBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = document.getElementById('actionsDropdown');
                dropdown?.classList.toggle('active');
            });

            // Fermer le menu d'actions quand on clique ailleurs
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.chat-actions-menu')) {
                    document.getElementById('actionsDropdown')?.classList.remove('active');
                }
            });

            // Bouton Info du menu
            document.getElementById('actionInfoBtn')?.addEventListener('click', () => {
                if (currentConversationId) {
                    showChatInfoModal();
                }
                document.getElementById('actionsDropdown')?.classList.remove('active');
            });

            // Bouton Fermer du menu
            document.getElementById('actionCloseBtn')?.addEventListener('click', () => {
                closeConversation();
                document.getElementById('actionsDropdown')?.classList.remove('active');
            });

            // Bouton Supprimer du menu
            document.getElementById('actionDeleteBtn')?.addEventListener('click', () => {
                if (currentConversationId) {
                    showDeleteConversationDialog(currentConversationId);
                }
                document.getElementById('actionsDropdown')?.classList.remove('active');
            });

            // Bouton d'appel audio
            document.getElementById('audioCallBtn')?.addEventListener('click', () => {
                startAudioCall();
            });

            // Bouton d'appel vidéo
            document.getElementById('videoCallBtn')?.addEventListener('click', () => {
                startVideoCall();
            });

            // Boutons des appels audio
            document.getElementById('endCallBtn')?.addEventListener('click', endAudioCall);
            document.getElementById('muteBtn')?.addEventListener('click', toggleMute);
            document.getElementById('speakerBtn')?.addEventListener('click', toggleSpeaker);
            
            // Bouton de retour depuis l'appel audio
            document.getElementById('backFromAudioBtn')?.addEventListener('click', endAudioCall);

            // Boutons des appels vidéo
            document.getElementById('videoEndCallBtn')?.addEventListener('click', endVideoCall);
            document.getElementById('videoMuteBtn')?.addEventListener('click', toggleVideoMute);
            document.getElementById('cameraBtn')?.addEventListener('click', toggleCamera);
            document.getElementById('videoSpeakerBtn')?.addEventListener('click', toggleVideoSpeaker);
            
            // Bouton de retour depuis l'appel vidéo
            document.getElementById('backFromVideoBtn')?.addEventListener('click', endVideoCall);

            // Boutons d'envoi
            document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
            document.getElementById('messageInput')?.addEventListener('keydown', handleMessageInputKeydown);
            
            // Boutons de pièces jointes
            document.getElementById('attachFileBtn')?.addEventListener('click', () => {
                document.getElementById('fileInput').click();
            });

            document.getElementById('attachImageBtn')?.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = handleImageSelection;
                input.click();
            });

            document.getElementById('emojiBtn')?.addEventListener('click', toggleMessageEmojiPicker);

            // Gestion des fichiers
            document.getElementById('fileInput').addEventListener('change', handleFileSelection);
            document.getElementById('removePreviewBtn').addEventListener('click', clearFilePreview);
            document.getElementById('cancelUploadBtn').addEventListener('click', closeFileUploadModal);
            document.getElementById('confirmUploadBtn').addEventListener('click', uploadFile);

            // Fermeture des modaux
            document.getElementById('closeInfoBtn').addEventListener('click', () => {
                document.getElementById('chatInfoModal').classList.remove('active');
            });

            document.getElementById('closeUploadBtn').addEventListener('click', closeFileUploadModal);

            // Gestion des clics hors des modaux
            document.addEventListener('click', handleOutsideClick);
            
            // Fermer les menus actions et réactions quand on clique ailleurs
            document.addEventListener('click', function(event) {
                // Si on ne clique pas sur un menu ou un bouton d'action
                if (!event.target.closest('.message-actions-menu') && 
                    !event.target.closest('.btn-message-actions') &&
                    !event.target.closest('.emoji-reactions-picker') &&
                    !event.target.closest('.add-reaction-btn') &&
                    !event.target.closest('.reaction-item')) {
                    
                    // Fermer tous les menus actions
                    document.querySelectorAll('.message-actions-menu.show').forEach(menu => {
                        menu.classList.remove('show');
                        const btn = menu.closest('.message-actions-dropdown')?.querySelector('.btn-message-actions');
                        if (btn) {
                            btn.classList.remove('open');
                        }
                        const wrapper = menu.closest('.message-wrapper');
                        if (wrapper) {
                            wrapper.style.zIndex = 'auto';
                        }
                    });
                    
                    // Fermer tous les pickers emoji
                    document.querySelectorAll('.emoji-reactions-picker.show').forEach(picker => {
                        picker.classList.remove('show');
                    });
                }
            });
            
            // Redimension
            // Boutons d'action
            const newConvBtn = document.getElementById('newConversationBtn');
            if (newConvBtn) {
                newConvBtn.addEventListener('click', openConversationPanel);
            }

            const refreshBtn = document.getElementById('refreshConversationsBtn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    loadConversations(true);
                });
            }
        }

function showLoadMoreMessagesIndicator() {
    const loadMoreContainer = document.createElement('div');
    loadMoreContainer.id = 'loadMoreMessages';
    loadMoreContainer.className = 'skeleton-loader-container';
    loadMoreContainer.style.padding = '12px';
    loadMoreContainer.style.marginBottom = '12px';
    
    // Créer 3 skeletons pour les anciens messages
    const skeletons = Array(3).fill(0).map((_, i) => {
        const isOutgoing = i % 2 === 0;
        return `
            <div class="skeleton-message ${isOutgoing ? 'outgoing' : 'incoming'}">
                <div class="skeleton-message-avatar"></div>
                <div class="skeleton-message-content">
                    <div class="skeleton-message-bubble"></div>
                    <div class="skeleton-message-time"></div>
                </div>
            </div>
        `;
    }).join('');
    
    loadMoreContainer.innerHTML = skeletons;
    
    const messagesContainer = document.getElementById('messagesContainer');
    const messagesWrapper = document.getElementById('messagesWrapper');
    
    if (messagesWrapper) {
        messagesWrapper.insertBefore(loadMoreContainer, messagesWrapper.firstChild);
    } else if (messagesContainer) {
        messagesContainer.insertBefore(loadMoreContainer, messagesContainer.firstChild);
    }
}

// Masquer l'indicateur de chargement de plus de messages
function hideLoadMoreMessagesIndicator() {
    const loadMoreIndicator = document.getElementById('loadMoreMessages');
    if (loadMoreIndicator) {
        loadMoreIndicator.remove();
    }
}

// ==========================================
// FONCTIONS PRINCIPALES DE GESTION DU CHAT
// ==========================================

function getConversations(conversations, eventId) {
    return conversations.map(conversation => {
        const enrichedParticipants = conversation.participants.map(participant => {
           
            if (participant.firstName && participant.lastName) {
                // Déjà enrichi
                return participant;
            }
            
            let guestInfo = window.storage.data?.guests?.find(g => 
                g.id === participant.userId && g.eventId === eventId
            );
            
            if (!guestInfo) {
                guestInfo = window.storage.data?.users?.find(u => u.id === participant.userId);
            }
            
            if (guestInfo) {
                return {
                    ...participant,
                    name: guestInfo.firstName && guestInfo.lastName 
                        ? `${guestInfo.firstName} ${guestInfo.lastName}` 
                        : guestInfo.name || 'Utilisateur',
                    email: guestInfo.email || '',
                    firstName: guestInfo.firstName || '',
                    lastName: guestInfo.lastName || '',
                    gender: guestInfo.gender || guestInfo.sexe || '',
                    notes: guestInfo.notes || '',
                    // Statut en ligne (défaut: false, pas stocké en BD)
                    isOnline: false,
                    status: 'offline',
                    // Attributs de conversation (rejointe, dernière lecture)
                    joinedAt: participant.joinedAt || null,
                    lastReadAt: participant.lastReadAt || null
                };
            }
            
            return participant;
        });
        
        return {
            ...conversation,
            participants: enrichedParticipants
        };
    });
}

// Charger les conversations
async function loadConversations(forceRefresh = false) {
    try {
        showLoader('conversations');
        
        // Récupérer la session actuelle
        const sessionResult = await window.storage.getCurrentSessionDetails();
        if (!sessionResult?.success) {
            throw new Error('Session invalide');
        }
        
        const eventId = sessionResult.data.event?.id;
        if (!eventId) {
            throw new Error('Aucun événement actif');
        }
        
        const result = await window.storage.getConversations(eventId, forceRefresh);
        
        // Serveur est revenu en ligne
        if (!isServerOnline) {
            isServerOnline = true;
            connectionRetryCount = 0;
            showConnectionStatus(true);
        }
       
        if (result && Array.isArray(result)) {
            conversations = result;
            
            conversations = getConversations(conversations, eventId);
            
            // 🔌 Rejoindre les salles WebSocket pour chaque conversation
            if (chatSocket && chatSocket.connected) {
                conversations.forEach(conv => {
                    joinConversationViaWebSocket(conv.id);
                    console.log(`✅ WebSocket: Rejoint la conversation ${conv.id}`);
                });
            }
            
            renderConversationsList(conversations);
        } else {
            conversations = [];
            renderConversationsList([]);
        }
        
        hideLoader('conversations');
        return conversations;
    } catch (error) {
        console.error('Erreur lors du chargement des conversations:', error);
        hideLoader('conversations');
        
        // Vérifier si c'est une erreur de connexion
        if (error.message.includes('Failed to fetch') || error.message.includes('REFUSED')) {
            handleConnectionError();
        }
        
        renderConversationsList([]);
        return [];
    }
}

// Gérer une erreur de connexion au serveur
function handleConnectionError() {
    if (isServerOnline) {
        isServerOnline = false;
        connectionRetryCount = 0;
        showConnectionStatus(false);
        startAutoRetry();
    }
}

// Afficher l'état de connexion
function showConnectionStatus(online) {
    const noConvSelected = document.getElementById('noConversationSelected');
    const errorState = document.getElementById('connectionErrorState');
    const messagesContainer = document.getElementById('messagesContainer');
    
    if (online) {
        // Serveur en ligne
        if (errorState) errorState.style.display = 'none';
        if (noConvSelected && !currentConversationId) {
            noConvSelected.style.display = 'flex';
        }
        if (messagesContainer) {
            messagesContainer.classList.remove('connection-error');
        }
        console.log('✅ Serveur en ligne');
    } else {
        // Serveur hors ligne
        if (currentConversationId) {
            // Si une conversation est ouverte, afficher l'état d'erreur
            if (messagesContainer) {
                messagesContainer.classList.add('connection-error');
            }
            if (errorState) {
                errorState.innerHTML = `
                    <i class="fas fa-wifi-off big"></i>
                    <h3>Connexion perdue</h3>
                    <p>Le serveur est actuellement indisponible.</p>
                    <p>Tentative de reconnexion automatique en cours...</p>
                    <button class="retry-btn" id="manualRetryBtn">
                        <i class="fas fa-redo me-2"></i>Réessayer maintenant
                    </button>
                `;
                errorState.style.display = 'flex';
                
                // Attacher le listener au bouton
                const retryBtn = document.getElementById('manualRetryBtn');
                if (retryBtn) {
                    retryBtn.onclick = () => manualRetryConnection();
                }
            }
        } else {
            // Pas de conversation ouverte, afficher le message normal
            if (noConvSelected) noConvSelected.style.display = 'flex';
            if (errorState) errorState.style.display = 'none';
        }
        console.log('❌ Serveur hors ligne');
    }
}

// Tentative de reconnexion automatique
function startAutoRetry() {
    if (connectionRetryInterval) clearInterval(connectionRetryInterval);
    
    connectionRetryInterval = setInterval(async () => {
        if (isServerOnline) {
            clearInterval(connectionRetryInterval);
            return;
        }
        
        connectionRetryCount++;
        console.log(`🔄 Tentative de reconnexion ${connectionRetryCount}/${maxConnectionRetries}`);
        
        try {
            // Tenter un appel simple au serveur
            const sessionResult = await window.storage.getCurrentSessionDetails();
            if (sessionResult?.success) {
                isServerOnline = true;
                connectionRetryCount = 0;
                clearInterval(connectionRetryInterval);
                showConnectionStatus(true);
                
                // Recharger les conversations
                await loadConversations(true);
                showToast('Reconnecté au serveur avec succès', 'success');
            }
        } catch (error) {
            console.log(`❌ Reconnexion échouée (tentative ${connectionRetryCount})`);
            
            if (connectionRetryCount >= maxConnectionRetries) {
                clearInterval(connectionRetryInterval);
                console.error('Impossible de se reconnecter après plusieurs tentatives');
            }
        }
    }, connectionRetryDelay);
}

// Retry manuel
async function manualRetryConnection() {
    const retryBtn = document.getElementById('manualRetryBtn');
    if (retryBtn) {
        retryBtn.disabled = true;
        retryBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Reconnexion...';
    }
    
    try {
        await loadConversations(true);
        showToast('Reconnecté avec succès', 'success');
    } catch (error) {
        showToast('Échec de la reconnexion. Réessayez dans quelques secondes.', 'error');
    } finally {
        if (retryBtn) {
            retryBtn.disabled = false;
            retryBtn.innerHTML = '<i class="fas fa-redo me-2"></i>Réessayer maintenant';
        }
    }
}

// Rendre la liste des conversations
function renderConversationsList(conversationsList) {
    const container = document.getElementById('conversationsList');
    if (!container) return;
    
    if (!conversationsList || conversationsList.length === 0) {
        container.innerHTML = `
            <div class="empty-conversations">
                <i class="fas fa-comments big"></i>
                <p>Aucune conversation</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">Commencez une nouvelle conversation</p>
                <button class="create-first-conversation-btn" id="createFirstConversationBtn">
                    <i class="fas fa-comments"></i>
                    <span class="btn-text">Nouvelle Conversation</span>
                </button>
            </div>
        `;
        
        document.getElementById('createFirstConversationBtn')?.addEventListener('click', openConversationPanel);

        return;
    }
    
    // Trier les conversations par dernier message
    conversationsList.sort((a, b) => {
        const aTime = a.updatedAt || a.createdAt;
        const bTime = b.updatedAt || b.createdAt;
        return new Date(bTime) - new Date(aTime);
    });
    
    container.innerHTML = conversationsList.map(conversation => {
        const isActive = conversation.id === currentConversationId;
        const lastMessage = conversation.lastMessage || conversation.messages?.[conversation.messages?.length - 1];
        const unreadCount = conversation.unreadCount || 0;
        
        // Formater la date du dernier message
        let timeText = '';
        if (lastMessage?.createdAt) {
            const messageDate = new Date(lastMessage.createdAt);
            const now = new Date();
            const diffMs = now - messageDate;
            const diffHours = diffMs / (1000 * 60 * 60);
            
            if (diffHours < 24) {
                timeText = messageDate.toLocaleTimeString('fr-FR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            } else {
                timeText = messageDate.toLocaleDateString('fr-FR', { 
                    day: '2-digit', 
                    month: '2-digit' 
                });
            }
        }
        
        // Extraire le preview du dernier message
        let previewText = '';
        if (lastMessage) {
            if (lastMessage.content) {
                previewText = lastMessage.content.length > 50 
                    ? lastMessage.content.substring(0, 20) + '...' 
                    : lastMessage.content;
            } else if (lastMessage.type === 'image') {
                previewText = '📷 Photo';
            } else if (lastMessage.type === 'file') {
                previewText = '📎 Fichier';
            }
        }
        
        // Vérifier si quelqu'un est en train d'écrire dans cette conversation
        let isTypingInConversation = false;
        let typingParticipantName = '';
        if (conversation.type === 'direct' && conversation.participants) {
            const otherParticipants = conversation.participants.filter(p => p.userId !== currentUser?.id);
            if (otherParticipants.length > 0) {
                // À mettre à jour via WebSocket - pour l'instant placeholder
                typingParticipantName = otherParticipants[0].name || otherParticipants[0].email || 'Utilisateur';
            }
        }
        
        // Nom de la conversation et infos de la personne
        let conversationName = conversation.name || 'Chat';
        let otherParticipant = null;
        let onlineStatus = '';
        
        if (conversation.type === 'direct' && conversation.participants) {
            // Pour les chats directs, afficher le nom de l'autre participant
            const otherParticipants = conversation.participants.filter(p => p.userId !== currentUser?.id);
            if (otherParticipants.length > 0) {
                otherParticipant = otherParticipants[0];
                conversationName = otherParticipant.name || otherParticipant.email || 'Utilisateur';
                
                if (otherParticipant.isOnline) {
                    onlineStatus = '<span class="status-dot online"></span>';
                } else if (otherParticipant.lastReadAt) {
                    const lastReadDate = new Date(otherParticipant.lastReadAt);
                    const now = new Date();
                    const diffMs = now - lastReadDate;
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);
                    
                    let lastReadText;
                    if (diffMins < 1) {
                        lastReadText = 'vu à l\'instant';
                    } else if (diffMins < 60) {
                        lastReadText = `vu il y a ${diffMins}m`;
                    } else if (diffHours < 24) {
                        lastReadText = `vu il y a ${diffHours}h`;
                    } else if (diffDays < 7) {
                        lastReadText = `vu il y a ${diffDays}j`;
                    } else {
                        lastReadText = `vu le ${lastReadDate.toLocaleDateString('fr-FR')}`;
                    }
                    onlineStatus = `<span class="status-dot offline"></span><span>${lastReadText}</span>`;
                } else {
                    onlineStatus = '<span class="status-dot offline"></span>Hors ligne';
                }
            }
        } else if (conversation.type === 'group') {
            const participantCount = conversation.participants ? conversation.participants.length : 0;
            conversationName = conversation.name ? `${conversation.name} (${participantCount})` : `Groupe (${participantCount})`;
        }
                
        // Avatar de la conversation - Générer via getGuestAvatarImage() selon sexe/nom
        let avatarHTML = '';
        if (otherParticipant) {

            const avatarUrl = getGuestAvatarImage(otherParticipant);
            if (avatarUrl) {
                // Avatar généré (homme.png, femme.png, couple.png, maman.png, etc.)
                avatarHTML = `<img src="${avatarUrl}" alt="${conversationName}" class="conversation-avatar-image">`;
            } else {
                // Fallback aux initiales si aucune détection
                const initials = (otherParticipant.name || otherParticipant.email || 'U').charAt(0).toUpperCase();
                avatarHTML = `<span class="conversation-avatar-text">${initials}</span>`;
            }
        } else {
            const avatarText = conversationName.charAt(0).toUpperCase();
            avatarHTML = `<span class="conversation-avatar-text">${avatarText}</span>`;
        }

        let statusIcon = '';
        let isOutgoing = lastMessage?.senderId === currentUser?.id;
        let isRead = lastMessage?.readBy && lastMessage.readBy.length > 0;

    if (isOutgoing) {
        if (isRead) {
            statusIcon = '<i class="fas fa-check-double status-icon read" title="Message lu"></i>';
        } else if (lastMessage?.delivered) {
           
            statusIcon = '<i class="fas fa-check status-icon delivered" title="Message délivré"></i>';
        } else {
            statusIcon = '<i class="fas fa-check status-icon sent" title="Message envoyé"></i>';
        }
    }
        
        return `
            <div class="conversation-item ${isActive ? 'active' : ''}" 
                 data-conversation-id="${conversation.id}"
                 data-type="${conversation.type}">
                <div class="conversation-avatar">
                    ${avatarHTML}
                    ${conversation.type === 'direct' && otherParticipant?.isOnline ? '<div class="conversation-status online"></div>' : conversation.type === 'direct' ? '<div class="conversation-status"></div>' : ''}
                </div>
                <div class="conversation-details">
                    <div class="conversation-header">
                        <div class="conversation-name">${escapeHtml(conversationName)}</div>
                        <div class="conversation-time-status">
                            <div class="conversation-time">${timeText}</div>
                           
                        </div>
                    </div>
                    

                    <div class="conversation-header">
                    <div class="conversation-preview" data-conversation-preview="${conversation.id}">
                        <span class="preview-status-icon">${statusIcon}</span>
                        <span class="preview-text">${escapeHtml(previewText || 'Envoyez un message')}</span>
                    </div>
                    ${onlineStatus ? `<div class="conversation-status-text">${onlineStatus}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Ajouter les écouteurs d'événements aux éléments de conversation
    container.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => {
            const conversationId = item.getAttribute('data-conversation-id');
            switchViewState('chat');
            selectConversation(conversationId);
        });
    });
}

async function selectConversationWithUser(conversationId){
    closeConversationPanel();
    await selectConversation(conversationId);
}

// Sélectionner une conversation
async function selectConversation(conversationId) {
    try {
        currentCallState = null;
        callStartTime = null;
        
        const audioCallState = document.getElementById('audioCallState');
        const videoCallState = document.getElementById('videoCallState');
        if (audioCallState) audioCallState.style.display = 'none';
        if (videoCallState) videoCallState.style.display = 'none';
        
        const toggles = document.querySelectorAll('.call-action-btn');
        toggles.forEach(btn => btn.classList.remove('active'));
        
        if (window.innerWidth <= 768) {
            const conversationsPanel = document.getElementById('conversationsPanel');
            const chatMain = document.getElementById('chatMain');
            
            if (conversationsPanel) {
                conversationsPanel.classList.remove('visible');
                conversationsPanel.classList.add('hidden');
            }
            
            // Afficher le chat avec transition
            if (chatMain) {
                chatMain.classList.add('active');
                chatMain.classList.remove('hidden');
            }
        }
        
        // Réinitialiser la pagination des messages
        messagePage = 1;
        messages = [];
        
        // Mettre à jour la conversation actuelle
        currentConversationId = conversationId;
        currentConversation = conversations.find(c => c.id === conversationId);
        
        if (!currentConversation) {
            throw new Error('Conversation non trouvée');
        }
        
        // 🔌 Rejoindre la salle WebSocket pour cette conversation
        if (chatSocket && chatSocket.connected) {
            joinConversationViaWebSocket(conversationId);
            console.log(`✅ WebSocket: Rejoint la conversation active ${conversationId}`);
        }
        
        // Mettre à jour l'interface
        updateChatHeader();
        showChatArea();
        
        // Charger les messages
        await loadMessages(conversationId);
        
        // Marquer comme lu
        await markConversationAsRead(conversationId);
        
        // Mettre à jour la liste des conversations
        renderConversationsList(conversations);
        
        // Focaliser sur le champ de saisie
        setTimeout(() => {
            document.getElementById('messageInput').focus();
        }, 100);
        
    } catch (error) {
        console.error('Erreur lors de la sélection de la conversation:', error);
        showToast('Impossible de charger la conversation', 'error');
    }
}

// Mettre à jour l'en-tête du chat
function updateChatHeader() {
    if (!currentConversation) return;
    
    const chatHeader = document.getElementById('chatHeader');
    const chatTitle = document.getElementById('chatTitle');
    const chatAvatar = document.getElementById('chatAvatar');
    const chatStatus = document.getElementById('statusText');
    
    if (!chatHeader || !chatTitle || !chatAvatar) return;
    
    // Afficher l'en-tête
    chatHeader.style.display = 'flex';
    
    // Mettre à jour le titre
    let conversationName = currentConversation.name || 'Chat';
    if (currentConversation.type === 'direct' && currentConversation.participants) {
        const otherParticipants = currentConversation.participants.filter(p => p.userId !== currentUser?.id);
        if (otherParticipants.length > 0) {
            const firstParticipant = otherParticipants[0];
            conversationName = firstParticipant.name || firstParticipant.email || 'Utilisateur';
        }
    }
    
    chatTitle.textContent = conversationName;
    
    // Mettre à jour l'avatar - Utiliser getGuestAvatarImage pour générer selon sexe/nom
    if (currentConversation.type === 'direct' && currentConversation.participants) {
        const otherParticipants = currentConversation.participants.filter(p => p.userId !== currentUser?.id);
        if (otherParticipants.length > 0) {
            const firstParticipant = otherParticipants[0];
            const avatarUrl = getGuestAvatarImage(firstParticipant);
            if (avatarUrl) {
                chatAvatar.innerHTML = `<img src="${avatarUrl}" alt="${conversationName}" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else {
                // Fallback aux initiales
                const avatarText = conversationName.charAt(0).toUpperCase();
                chatAvatar.innerHTML = avatarText;
            }
        }
    } else {
        // Chat de groupe : première lettre du nom
        const avatarText = conversationName.charAt(0).toUpperCase();
        chatAvatar.innerHTML = avatarText;
    }
    
    // Mettre à jour le statut de présence
    if (currentConversation.type === 'direct' && currentConversation.participants) {
        const otherParticipants = currentConversation.participants.filter(p => p.userId !== currentUser?.id);
        if (otherParticipants.length > 0) {
            const participant = otherParticipants[0];
            
            // Afficher le statut de présence
            if (participant.isOnline) {
                chatStatus.innerHTML = '<span class="status-dot online"></span>En ligne';
            } else if (participant.lastReadAt) {
                const lastReadDate = new Date(participant.lastReadAt);
                const now = new Date();
                const diffMs = now - lastReadDate;
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);
                
                let lastReadText;
                if (diffMins < 1) {
                    lastReadText = 'vu à l\'instant';
                } else if (diffMins < 60) {
                    lastReadText = `vu il y a ${diffMins}m`;
                } else if (diffHours < 24) {
                    lastReadText = `vu il y a ${diffHours}h`;
                } else if (diffDays < 7) {
                    lastReadText = `vu il y a ${diffDays}j`;
                } else {
                    lastReadText = `vu le ${lastReadDate.toLocaleDateString('fr-FR')}`;
                }
                chatStatus.innerHTML = `<span class="status-dot offline"></span><span>${lastReadText}</span>`;
            } else {
                chatStatus.innerHTML = '<span class="status-dot offline"></span>Hors ligne';
            }
        }
    } else {
        const participantCount = currentConversation.participants?.length || 0;
        chatStatus.textContent = `${participantCount} participant${participantCount > 1 ? 's' : ''}`;
    }
}

// Afficher la zone de chat
function showChatArea() {
    // Masquer "aucune conversation sélectionnée"
    const noConversationSelected = document.getElementById('noConversationSelected');
    if (noConversationSelected) {
        noConversationSelected.style.display = 'none';
    }
    
    // Afficher la zone de chat (noMessagesState s'affichera/masquera dans renderMessages)
    document.getElementById('chatInputArea').style.display = 'flex';
    document.getElementById('messagesContainer').style.display = 'flex';
    
    // Sur mobile: afficher le chat et masquer le panel conversations avec transition
    if (window.innerWidth <= 768) {
        const chatMain = document.getElementById('chatMain');
        const conversationsPanel = document.getElementById('conversationsPanel');
        
        if (chatMain) {
            chatMain.classList.add('active');
            chatMain.classList.remove('hidden');
        }
        
        if (conversationsPanel) {
            conversationsPanel.classList.remove('visible');
            conversationsPanel.classList.add('hidden');
        }
    } else {
        // Sur grand écran: s'assurer que les deux sont visibles
        const chatMain = document.getElementById('chatMain');
        const conversationsPanel = document.getElementById('conversationsPanel');
        if (chatMain) {
            chatMain.classList.remove('hidden', 'active');
        }
        if (conversationsPanel) {
            conversationsPanel.classList.remove('visible', 'hidden');
        }
    }
}

// Masquer la zone de chat et afficher "aucune conversation sélectionnée"
function hideChatArea() {
    // ✅ Vider le wrapper des messages
    const messagesWrapper = document.getElementById('messagesWrapper');
    if (messagesWrapper) {
        messagesWrapper.innerHTML = '';
    }
    
    // Afficher "aucune conversation sélectionnée"
    const noConversationSelected = document.getElementById('noConversationSelected');
    if (noConversationSelected) {
        noConversationSelected.style.display = 'flex';
    }
    
    // Masquer la zone de chat
    const chatInputArea = document.getElementById('chatInputArea');
    const chatHeader = document.getElementById('chatHeader');
    const messagesContainer = document.getElementById('messagesContainer');
    
    if (chatInputArea) {
        chatInputArea.style.display = 'none';
    }
    if (chatHeader) {
        chatHeader.style.display = 'none';
    }

    
    // ✅ Masquer le placeholder de messages vides
    const noMessagesState = document.getElementById('noMessagesState');
    if (noMessagesState) {
        noMessagesState.style.display = 'none';
    }
    
    // Sur mobile: afficher le panel conversations
    if (window.innerWidth <= 768) {
        const conversationsPanel = document.getElementById('conversationsPanel');
        const chatMain = document.getElementById('chatMain');
        
        if (conversationsPanel) {
            conversationsPanel.classList.add('visible');
            conversationsPanel.classList.remove('hidden');
        }
        
        if (chatMain) {
            chatMain.classList.remove('active');
            chatMain.classList.add('hidden');
        }
    }
}

// Charger les messages
async function loadMessages(conversationId, loadMore = false) {
    try {
        if (!loadMore) {
            showLoader('messages');
        } else {
            showLoadMoreMessagesIndicator();
        }
        
        // Utiliser la méthode du storage pour récupérer les messages
        const result = await window.storage.getMessages(conversationId, {
            limit: messagesPerPage,
            offset: loadMore ? (messagePage - 1) * messagesPerPage : 0
        });
        
        if (result && Array.isArray(result)) {
            if (loadMore) {
                // Ajouter les anciens messages au début
                // ✅ Déduplication: ne pas ajouter les messages qui existent déjà
                const newMessages = result.filter(rm => !messages.some(m => m.id === rm.id));
                messages = [...newMessages, ...messages];
            } else {
                // ✅ Au premier chargement, fusionner les messages WebSocket avec ceux du serveur
                // Les messages reçus via WebSocket ont déjà été ajoutés à messages[]
                // On doit éviter les doublons
                const existingIds = new Set(messages.map(m => m.id));
                const newMessages = result.filter(m => !existingIds.has(m.id));
                
                // Fusionner: messages du serveur + messages WebSocket non encore sauvegardés
                messages = [...result, ...messages.filter(m => !result.some(rm => rm.id === m.id))];
                
                console.log(`📊 loadMessages: ${result.length} du serveur + ${newMessages.length} de WebSocket = ${messages.length} total`);
            }
            
            renderMessages(messages, loadMore);
            
            if (loadMore) {
                messagePage++;
            }
        } else {
            messages = [];
            renderMessages([], loadMore);
        }
        
        if (loadMore) {
            hideLoadMoreMessagesIndicator();
        } else {
            hideLoader('messages');
        }
        
        // Faire défiler vers le bas si ce n'est pas un chargement de plus de messages
        if (!loadMore) {
            setTimeout(() => {
                scrollToBottom();
            }, 100);
        }
        
        return messages;
    } catch (error) {
        console.error('Erreur lors du chargement des messages:', error);
        
        if (loadMore) {
            hideLoadMoreMessagesIndicator();
        } else {
            hideLoader('messages');
        }
        
        return [];
    }
}

// Rendre les messages
function renderMessages(messagesList, loadMore = false) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    // Vérification de sécurité
    if (!Array.isArray(messagesList)) {
        console.warn('⚠️ renderMessages: messagesList n\'est pas un array', messagesList);
        messagesList = [];
    }
    
    // ✅ DÉDUPLICATION: Supprimer les doublons dans la liste
    const uniqueMessages = [];
    const seenIds = new Set();
    
    for (const message of messagesList) {
        if (!seenIds.has(message.id)) {
            seenIds.add(message.id);
            uniqueMessages.push(message);
        } else {
            console.warn(`⚠️ renderMessages: Doublon détecté et supprimé - ${message.id}`);
        }
    }
    
    // Mettre à jour la liste globale des messages pour éviter les doublons futurs
    if (uniqueMessages.length !== messagesList.length) {
        console.log(`🔄 renderMessages: ${messagesList.length} → ${uniqueMessages.length} (${messagesList.length - uniqueMessages.length} doublons supprimés)`);
        messages = uniqueMessages;
    }
    
    let messagesWrapper = document.getElementById('messagesWrapper');
    if (!messagesWrapper) {
        messagesWrapper = document.createElement('div');
        messagesWrapper.id = 'messagesWrapper';
        messagesWrapper.style.display = 'flex';
        messagesWrapper.style.flexDirection = 'column';
        messagesWrapper.style.flex = '1';
        messagesWrapper.style.overflowY = 'auto';
        messagesWrapper.style.paddingBottom = '20px';
        container.appendChild(messagesWrapper);
    }
    
    // Grouper les messages par date
    const groupedMessages = groupMessagesByDate(uniqueMessages);
    
    // Générer le HTML des messages
    let messagesHTML = '';
    
    // Si c'est un chargement de plus de messages, nous ajoutons au début
    if (loadMore) {
        const existingMessages = messagesWrapper.querySelectorAll('.message-wrapper, .message-date-group');
        const existingHTML = Array.from(existingMessages).map(el => el.outerHTML).join('');
        
        messagesHTML = renderGroupedMessages(groupedMessages) + existingHTML;
    } else {
        messagesHTML = renderGroupedMessages(groupedMessages);
        
        // Si aucun message
        if (messagesList.length === 0) {
            messagesHTML = ``;
            // Afficher le placeholder avec l'avatar de la personne
            const noMessagesElement = document.getElementById('noMessagesState');
            if (noMessagesElement) {
                noMessagesElement.style.display = 'flex';
                
                // Remplir l'avatar du placeholder avec l'avatar réel
                if (currentConversation?.type === 'direct' && currentConversation?.participants) {
                    const otherParticipants = currentConversation.participants.filter(p => p.userId !== currentUser?.id);
                    if (otherParticipants.length > 0) {
                        const participant = otherParticipants[0];
                        const emptyAvatar = document.getElementById('emptyStateAvatar');
                        if (emptyAvatar) {
                            const avatarUrl = getGuestAvatarImage(participant);
                            if (avatarUrl) {
                                emptyAvatar.innerHTML = `<img src="${avatarUrl}" alt="${participant.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                            } else {
                                // Fallback initiales
                                const initials = (participant.name || 'U').charAt(0).toUpperCase();
                                emptyAvatar.innerHTML = initials;
                            }
                        }
                    }
                }
            }
        } else {
            // Cacher le placeholder
            const noMessagesElement = document.getElementById('noMessagesState');
            if (noMessagesElement) {
                noMessagesElement.style.display = 'none';
            }
        }
    }
    
    // Ajouter le typing indicator à la fin du wrapper
    messagesHTML += `
        <div class="typing-indicator" data-typing-indicator="" style="display: none;">
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
            <span id="typingText">quelqu'un est en train d'écrire...</span>
        </div>
    `;
    
    messagesWrapper.innerHTML = messagesHTML;
    
    attachMessageEventListeners();
    
    // Si c'est un chargement de plus de messages, ajuster la position de défilement
    if (loadMore) {
        setTimeout(() => {
            const firstNewMessage = messagesWrapper.querySelector('.message-wrapper');
            if (firstNewMessage) {
                firstNewMessage.scrollIntoView({ behavior: 'auto' });
            }
        }, 50);
    }
}

// Grouper les messages par date
function groupMessagesByDate(messages) {
    const groups = {};
    
    // Vérification de sécurité - si messages n'est pas un array, retourner un objet vide
    if (!Array.isArray(messages)) {
        console.warn('⚠️ groupMessagesByDate: messages n\'est pas un array', messages);
        return groups;
    }
    
    messages.forEach(message => {
        if (!message || !message.createdAt) return;
        
        const messageDate = new Date(message.createdAt);
        const dateKey = messageDate.toDateString();
        
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        
        groups[dateKey].push(message);
    });
    
    return groups;
}

// Rendre les messages groupés
function renderGroupedMessages(groupedMessages) {
    let html = '';
    
    Object.keys(groupedMessages).forEach(dateKey => {
        const messages = groupedMessages[dateKey];
        const date = new Date(dateKey);
        
        // Formater la date
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateText = '';
        if (date.toDateString() === today.toDateString()) {
            dateText = 'Aujourd\'hui';
        } else if (date.toDateString() === yesterday.toDateString()) {
            dateText = 'Hier';
        } else {
            dateText = date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }
        
        html += `<div class="message-date-group">
                    <span class="date-separator">${dateText}</span>
                 </div>`;
        
        messages.forEach(message => {
            html += renderSingleMessage(message);
        });
    });
    
    return html;
}

// Rendre un seul message
function renderSingleMessage(message) {
    const isOutgoing = message.senderId === currentUser?.id;
    const messageDate = new Date(message.createdAt);
    const timeText = messageDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Récupérer les infos de l'expéditeur
    let sender = null;
    let senderName = 'Inconnu';
    if (currentConversation?.participants) {
        sender = currentConversation.participants.find(p => p.userId === message.senderId);
        if (sender) {
            senderName = sender.name || sender.email || 'Utilisateur';
        }
    }
    
    const isRead = message.readBy && message.readBy.length > 0;
    
    // Avatar de l'expéditeur avec getGuestAvatarImage() si disponible
    let avatarHTML = '';
    if (sender) {
        const avatarUrl = getGuestAvatarImage(sender);
        if (avatarUrl) {
            avatarHTML = `<img src="${avatarUrl}" alt="${senderName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            const initials = senderName.charAt(0).toUpperCase();
            avatarHTML = initials;
        }
    } else {
        const avatarText = senderName.charAt(0).toUpperCase();
        avatarHTML = avatarText;
    }
    
    // Contenu du message en fonction du type
    let messageContent = '';
    
    // ✅ Si le message est supprimé, afficher "message supprimé" en italic/muted
    if (message.deletedAt) {
        messageContent = `
            <div class="message-text" style="font-style: italic; opacity: 0.5; color: #9CA3AF;">message supprimé</div>
        `;
    } else {
        switch (message.type) {
            case 'text':
                messageContent = `
                    <div class="message-text">${escapeHtml(message.content || '')}</div>
                `;
                break;
                
            case 'image':
                messageContent = `
                    <div class="message-image">
                        <img src="${message.content}" alt="Image" onerror="this.src='https://via.placeholder.com/300?text=Image+non+disponible'">
                    </div>
                    ${message.caption ? `<div class="message-text">${escapeHtml(message.caption)}</div>` : ''}
                `;
                break;
                
            case 'file':
                const fileName = message.content.split('/').pop() || 'Fichier';
                const fileSize = message.fileSize ? formatFileSize(message.fileSize) : '';
                
                messageContent = `
                    <div class="message-file">
                        <div class="file-icon">
                            <i class="fas fa-file"></i>
                        </div>
                        <div class="file-info">
                            <div class="file-name">${escapeHtml(fileName)}</div>
                            ${fileSize ? `<div class="file-size">${fileSize}</div>` : ''}
                        </div>
                        <a href="${message.content}" class="download-btn" download>
                            <i class="fas fa-download"></i>
                        </a>
                    </div>
                `;
                break;
                
            default:
                messageContent = `
                    <div class="message-text">${escapeHtml(message.content || '')}</div>
                `;
        }
    }
    
    // Réponse à un message
    let replySection = '';
    if (message.replyTo) {
        const repliedMessage = messages.find(m => m.id === message.replyTo);
        if (repliedMessage) {
            const repliedSender = currentConversation?.participants?.find(p => p.userId === repliedMessage.senderId);
            const repliedSenderName = repliedSender?.name || repliedSender?.email || 'Utilisateur';
            const repliedContent = repliedMessage.content || '';
            
            replySection = `
                <div class="message-replied">
                    <div class="replied-sender">${escapeHtml(repliedSenderName)}</div>
                    <div class="replied-content">${escapeHtml(repliedContent.length > 100 ? repliedContent.substring(0, 100) + '...' : repliedContent)}</div>
                </div>
            `;
        }
    }
    
    // Réactions
    let reactionsSection = '';
    if (!message.deletedAt && message.reactions && Object.keys(message.reactions).length > 0) {
        // Vérifier si l'utilisateur a déjà réagi à au moins une réaction
        const userHasReacted = Object.values(message.reactions).some(users => 
            users.includes(currentUser.id)
        );
        
        const reactionsHTML = Object.entries(message.reactions)
            .map(([emoji, users]) => {
                const count = Array.isArray(users) ? users.length : 1;
                const hasReacted = users.includes(currentUser.id);
                const title = hasReacted ? `Cliquez pour retirer votre réaction` : `Cliquez pour ajouter votre réaction`;
                
                return `
                    <button class="reaction-item ${hasReacted ? 'user-reacted' : ''}" 
                            onclick="toggleReaction('${message.id}', '${emoji}')"
                            title="${title}">
                        <span class="reaction-emoji">${emoji}</span>
                      ${currentConversation.type !== 'direct' ?  `<span class="reaction-count">${count}</span>` : ''}
                    </button>
                `;
            })
            .join('');
        
        // N'afficher le bouton add QUE si l'utilisateur n'a pas déjà réagi
        const addButtonHTML = userHasReacted ? '' : `
            <button class="add-reaction-btn" onclick="let mssgId='${message.id}'; toggleEmojiPicker(mssgId)" title="Ajouter réaction">
                <span>❤️</span>
            </button>
        `;
        
        reactionsSection = `
            <div class="message-reactions">
                ${reactionsHTML}
                ${addButtonHTML}
            </div>
        `;
    } else if (!message.deletedAt) {
        reactionsSection = `
            <div class="message-reactions">
                <button class="add-reaction-btn" onclick="let mssgId='${message.id}'; toggleEmojiPicker(mssgId)" title="Ajouter réaction">
                    <span>❤️</span>
                </button>
            </div>
        `;
    }
    
    let statusIcon = '';
    if (isOutgoing) {
        if (isRead) {
            statusIcon = '<i class="fas fa-check-double status-icon read" title="Message lu"></i>';
        } else if (message.delivered) {
           
            statusIcon = '<i class="fas fa-check-double status-icon delivered" title="Message délivré"></i>';
        } else {
            statusIcon = '<i class="fas fa-check status-icon sent" title="Message envoyé"></i>';
        }
    }
    
    // Dropdown actions pour le message
    let actionsDropdown = '';
    let emojiPicker = '';
    
    // Le picker emoji est toujours accessible (au survol)
    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏'];
    const emojiPickerButtons = emojis.map(emoji => 
        `<button class="emoji-reaction-btn" onclick="addReaction('${message.id}', '${emoji}')" title="Réaction">${emoji}</button>`
    ).join('');
    

   
    
    if (isOutgoing) {

         emojiPicker = `
            <div class="emoji-reactions-picker outgoing" id="emoji-picker-${message.id}">
                ${emojiPickerButtons}
            </div>
        `;

        actionsDropdown = `
            <div class="message-actions-dropdown" style="position: absolute; top: 0; right: 0;">
                <button class="btn-message-actions" onclick="let mesgId='${message.id}'; toggleMessageActions(event, mesgId)" title="Autres actions">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="message-actions-menu outgoing" id="actions-${message.id}">
                    ${!message.deletedAt ? `
                        <button onclick="let mesgId='${message.id}'; replyToMessage(mesgId)">
                            <i class="fas fa-reply"></i> Répondre
                        </button>
                        <button onclick="let mesgId='${message.id}'; toggleEmojiPicker(mesgId)">
                            <i class="fas fa-smile"></i> Réagir
                        </button>
                        <button onclick="let mesgId='${message.id}'; copyMessageContent(mesgId)">
                            <i class="fas fa-copy"></i> Copier
                        </button>
                        <button onclick="let mesgId='${message.id}'; forwardMessageContent(mesgId)">
                            <i class="fas fa-share"></i> Transférer
                        </button>
                        <button onclick="editMessage('${message.id}')">
                            <i class="fas fa-edit"></i> Éditer
                        </button>
                    ` : ''}
                    <button class="danger" onclick="deleteMessage('${message.id}')">
                        <i class="fas fa-trash"></i> ${message.deletedAt ? 'Message supprimé' : 'Supprimer'}
                    </button>
                </div>
            </div>
            ${emojiPicker}
        `;
    }else{


            emojiPicker = `
                <div class="emoji-reactions-picker incoming" id="emoji-picker-${message.id}">
                    ${emojiPickerButtons}
                </div>
            `;

        actionsDropdown = `
            <div class="message-actions-dropdown" style="position: absolute; top: 0; right: 0;">
                <button class="btn-message-actions" onclick="let mesgId='${message.id}'; toggleMessageActions(event, mesgId)" title="Autres actions">
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="message-actions-menu incoming" id="actions-${message.id}">
                    ${!message.deletedAt ? `
                        <button onclick="let mesgId='${message.id}'; replyToMessage(mesgId)">
                            <i class="fas fa-reply"></i> Répondre
                        </button>
                        <button onclick="let mesgId='${message.id}'; toggleEmojiPicker(mesgId)">
                            <i class="fas fa-smile"></i> Réagir
                        </button>
                        <button onclick="let mesgId='${message.id}'; copyMessageContent(mesgId)">
                            <i class="fas fa-copy"></i> Copier
                        </button>
                        <button onclick="let mesgId='${message.id}'; forwardMessageContent(mesgId)">
                            <i class="fas fa-share"></i> Transférer
                        </button>
                        <button onclick="editMessage('${message.id}')">
                            <i class="fas fa-edit"></i> Éditer
                        </button>
                    ` : ''}
                    <button class="danger" onclick="deleteMessage('${message.id}')">
                        <i class="fas fa-trash"></i> ${message.deletedAt ? 'Message supprimé' : 'Supprimer'}
                    </button>
                </div>
            </div>
            ${emojiPicker}
        `;
    }
    
    return `
        <div class="message-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}" 
             data-message-id="${message.id}"
             data-sender-id="${message.senderId}">
            
           
            
            <div class="message-content">
                ${!isOutgoing ? `<div class="conversation-meta sender-name">${escapeHtml(senderName)}</div>` : ''}
                
                ${replySection}
                ${messageContent}
                
                <div class="message-footer">
                    <div class="conversation-meta message-time">${timeText}</div>
                    ${statusIcon ? `<div class="message-status-icons">${statusIcon}</div>` : ''}
                    ${actionsDropdown}
                </div>
                
                ${reactionsSection}
            </div>
            
           
        </div>
    `;
}

// Formater la taille du fichier
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Faire défiler vers le bas
function scrollToBottom() {
    const messagesWrapper = document.getElementById('messagesWrapper');
    if (messagesWrapper) {
        messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
    }
}

// Configurer la saisie du message
function setupMessageInput() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    
    // Ajuster automatiquement la hauteur
    messageInput.addEventListener('input', function() {
        adjustTextareaHeight(this);
    });
    
    // Détecter la saisie pour l'indicateur d'écriture
    let typingTimeout;
    messageInput.addEventListener('input', function() {
        if (!currentConversationId) return;
        
        emitTypingEvent();

        clearTimeout(typingTimeout);
        
        // Définir un nouveau timeout pour arrêter l'indicateur d'écriture
        typingTimeout = setTimeout(() => {
            emitStopTypingEvent();
        }, 1000);
    });
}

// Ajuster la hauteur du textarea
function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = newHeight + 'px';
    
    // Activer/désactiver le bouton d'envoi
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.disabled = textarea.value.trim().length === 0;
    }
}

// Gérer les touches du clavier pour l'envoi
function handleMessageInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// Envoyer un message
async function sendMessage() {
    try {
        const messageInput = document.getElementById('messageInput');
        const messageText = messageInput.value.trim();
        
        if (!messageText || !currentConversationId) return;
        
        // Récupérer l'ID du message auquel répondre (s'il existe)
        const replyToId = messageInput.dataset.replyToId || null;
        
        // Désactiver le champ pendant l'envoi
        messageInput.disabled = true;
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.disabled = true;
        
        // Créer l'objet message temporaire pour l'UI
        const tempMessageId = 'msg_temp_' + Date.now();
        const tempMessage = {
            id: tempMessageId,
            conversationId: currentConversationId,
            content: messageText,
            type: 'text',
            replyTo: replyToId,
            senderId: currentUser?.id,
            senderName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Anonyme',
            createdAt: new Date().toISOString(),
            delivered: false,
            readBy: []
        };
        
        // 1️⃣ Afficher immédiatement le message temporaire dans l'UI
        if (!Array.isArray(messages)) {
            messages = [];
        }
        messages.push(tempMessage);
        renderMessages(messages);
        scrollToBottom();
        
      
        const result = await window.storage.sendMessage(currentConversationId, messageText, {
            replyTo: replyToId
        });
        
        if (result && result.id) {
            
            const messageIndex = messages.findIndex(m => m.id === tempMessageId);
            if (messageIndex !== -1) {
                messages.splice(messageIndex, 1);
            }
            
            
            if (chatSocket && chatSocket.connected) {
                console.log('📡 Émission via WebSocket...');
                sendMessageViaWebSocket(currentConversationId, messageText);
            } else {
                messages.push({
                    id: result.id,
                    conversationId: currentConversationId,
                    senderId: currentUser?.id,
                    content: messageText,
                    replyTo: replyToId,
                    createdAt: result.createdAt || new Date().toISOString(),
                    type: 'text',
                    delivered: true,
                    readBy: [],
                    reactions: {}
                });
                renderMessages(messages);
                scrollToBottom();
            }

            renderConversationsList(conversations);
            
            SECURA_AUDIO.play('notification');
            
        } else {
            showToast('Impossible d\'envoyer le message', 'error');
            
            // Retirer le message temporaire
            const messageIndex = messages.findIndex(m => m.id === tempMessageId);
            if (messageIndex !== -1) {
                messages.splice(messageIndex, 1);
                renderMessages(messages);
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi du message:', error);
        showToast('Impossible d\'envoyer le message', 'error');
        
        // Essayer de retirer le message temporaire en cas d'erreur
        if (messages && Array.isArray(messages)) {
            const tempIndex = messages.findIndex(m => m.id?.startsWith('msg_temp_'));
            if (tempIndex !== -1) {
                messages.splice(tempIndex, 1);
                renderMessages(messages);
            }
        }
    } finally {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }
        
        if (sendBtn) {
            sendBtn.disabled = messageInput.value.trim().length === 0;
        }
        
        messageInput.focus();
        
        // Réinitialiser la réponse
        cancelReply();
    }
}

// Émettre l'événement de saisie
function emitTypingEvent() {
    if (chatSocket && chatSocket.connected && currentConversationId) {
        notifyTyping(currentConversationId);
    }
}

// Émettre l'événement d'arrêt de saisie
function emitStopTypingEvent() {
    // Utiliser WebSocket si disponible
    if (chatSocket && chatSocket.connected && currentConversationId) {
        notifyStopTyping(currentConversationId);
    }
}

// Marquer une conversation comme lue
async function markConversationAsRead(conversationId) {
    try {
        await window.storage.markAsRead(conversationId);
        
        // Mettre à jour localement
        const conversation = conversations.find(c => c.id === conversationId);
        if (conversation) {
            conversation.unreadCount = 0;
        }
    } catch (error) {
        console.error('Erreur lors du marquage comme lu:', error);
    }
}

// ==========================================
// GESTION DES PIÈCES JOINTES
// ==========================================

// Configurer le drag and drop
function setupDragAndDrop() {
    const uploadZone = document.getElementById('uploadZone');
    if (!uploadZone) return;
    
    // Événements pour le drag and drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelection({ target: { files } });
        }
    });
    
    uploadZone.addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
}

// Gérer la sélection de fichier
function handleFileSelection(e) {
    const file = e.target.files?.[0] || e.files?.[0];
    if (!file) return;
    
    selectedFile = file;
    showFilePreview(file);
}

// Gérer la sélection d'image
function handleImageSelection(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Vérifier que c'est bien une image
    if (!file.type.startsWith('image/')) {
        showToast('Veuillez sélectionner une image', 'error');
        return;
    }
    
    selectedFile = file;
    uploadFile(file, 'image');
}

// Afficher l'aperçu du fichier
function showFilePreview(file) {
    const previewContainer = document.getElementById('filePreview');
    const previewContent = document.getElementById('previewContent');
    
    if (!previewContainer || !previewContent) return;
    
    // Afficher le conteneur d'aperçu
    previewContainer.style.display = 'block';
    
    // Déterminer l'icône en fonction du type de fichier
    let fileIcon = 'fa-file';
    if (file.type.startsWith('image/')) fileIcon = 'fa-image';
    else if (file.type.includes('pdf')) fileIcon = 'fa-file-pdf';
    else if (file.type.includes('word')) fileIcon = 'fa-file-word';
    else if (file.type.includes('excel')) fileIcon = 'fa-file-excel';
    else if (file.type.includes('zip')) fileIcon = 'fa-file-archive';
    
    // Afficher l'aperçu
    previewContent.innerHTML = `
        <div class="preview-icon">
            <i class="fas ${fileIcon}"></i>
        </div>
        <div class="preview-info">
            <div class="preview-name">${escapeHtml(file.name)}</div>
            <div class="preview-size">${formatFileSize(file.size)}</div>
        </div>
    `;
    
    // Activer le bouton de confirmation
    document.getElementById('confirmUploadBtn').disabled = false;
    
    // Afficher le modal
    document.getElementById('fileUploadModal').classList.add('active');
}

// Effacer l'aperçu du fichier
function clearFilePreview() {
    selectedFile = null;
    
    const previewContainer = document.getElementById('filePreview');
    const fileInput = document.getElementById('fileInput');
    
    if (previewContainer) previewContainer.style.display = 'none';
    if (fileInput) fileInput.value = '';
    
    document.getElementById('confirmUploadBtn').disabled = true;
}

// Fermer le modal d'upload
function closeFileUploadModal() {
    document.getElementById('fileUploadModal').classList.remove('active');
    clearFilePreview();
}

// Uploader un fichier
async function uploadFile(file, type = 'file') {
    try {
        if (!file || !currentConversationId) return;
        
        // Afficher la progression
        const progressBar = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const uploadProgress = document.getElementById('uploadProgress');
        
        if (uploadProgress) uploadProgress.style.display = 'block';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        
        // Simuler la progression (dans une vraie implémentation, utiliser XMLHttpRequest avec événements de progression)
        simulateUploadProgress(progressBar, progressText, async () => {
            try {
                let result;
                
                if (type === 'image') {
                    // Uploader l'image
                    result = await window.storage.uploadFile(file, 'gallery', {
                        userId: currentUser?.id,
                        conversationId: currentConversationId
                    });
                } else {
                    // Uploader le fichier générique
                    result = await window.storage.uploadFile(file, 'chat', {
                        userId: currentUser?.id,
                        conversationId: currentConversationId
                    });
                }
                
                if (result) {
                    // Créer le message avec le fichier
                    const message = {
                        conversationId: currentConversationId,
                        content: result.url || result.path,
                        type: type === 'image' ? 'image' : 'file',
                        fileSize: file.size,
                        fileName: file.name
                    };
                    
                    // Envoyer le message via l'API
                    const messageResult = await window.storage.sendMessage(currentConversationId, 
                        type === 'image' ? '📷 Image' : '📎 ' + file.name);
                    
                    if (messageResult) {
                        // Ajouter le message à la liste locale
                        messages.push({
                            ...messageResult,
                            content: result.url || result.path,
                            type: type === 'image' ? 'image' : 'file',
                            fileSize: file.size,
                            fileName: file.name
                        });
                        
                        // Rendre les messages
                        renderMessages(messages);
                        
                        // Faire défiler vers le bas
                        setTimeout(scrollToBottom, 100);
                        
                        // Fermer le modal
                        closeFileUploadModal();
                        
                        // Émettre un son
                        SECURA_AUDIO.play('message_sent');
                        
                        showToast('Fichier envoyé avec succès', 'success');
                    }
                }
            } catch (error) {
                console.error('Erreur lors de l\'upload:', error);
                showToast('Erreur lors de l\'envoi du fichier', 'error');
            }
        });
        
    } catch (error) {
        console.error('Erreur lors de l\'upload:', error);
        showToast('Erreur lors de l\'envoi du fichier', 'error');
    }
}

// Simuler la progression de l'upload
function simulateUploadProgress(progressBar, progressText, callback) {
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress > 100) progress = 100;
        
        if (progressBar) progressBar.style.width = progress + '%';
        if (progressText) progressText.textContent = Math.round(progress) + '%';
        
        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(callback, 500);
        }
    }, 100);
}

// ==========================================
// GESTION DES RÉACTIONS ET RÉPONSES
// ==========================================

// Attacher les écouteurs d'événements aux messages
// ========================================
// GESTION DU SWIPE ET LONG-PRESS UNIFIÉE
// ========================================

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let touchStartElement = null;
const SWIPE_THRESHOLD = 50;
const LONG_PRESS_DURATION = 500;

// Variables globales supplémentaires
let currentContextMessage = null;
let touchHoldTimeout = null;
let uploadInProgress = false;

function attachMessageEventListeners() {
    document.querySelectorAll('.message-wrapper').forEach(messageWrapper => {
        const messageContent = messageWrapper.querySelector('.message-content');
        
        if (!messageContent) return;
        
        // Longpress pour sélection et emoji picker - PASSIVE EVENT LISTENERS
        messageContent.addEventListener('touchstart', handleTouchStart, { passive: true });
        messageContent.addEventListener('touchmove', handleTouchMove, { passive: true });
        messageContent.addEventListener('touchend', handleTouchEnd, { passive: true });
        
        // Desktop: Right-click context menu
        messageContent.addEventListener('contextmenu', handleMessageContextMenu, false);
        
        // Swipe right pour répondre - PASSIVE EVENT LISTENERS
        messageWrapper.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].clientX;
            touchStartY = e.changedTouches[0].clientY;
            touchStartTime = Date.now();
        }, { passive: true });
        
        messageWrapper.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const diffX = touchStartX - touchEndX;
            const diffY = Math.abs(touchStartY - touchEndY);
            
            // Swipe right pour répondre (glisser vers la droite)
            if (diffX < -SWIPE_THRESHOLD && diffY < 50) {
                const messageId = messageWrapper.dataset.messageId;
                if (messageId) {
                    const message = messages.find(m => m.id === messageId);
                    if (message) {
                        replyToMessage(message);
                    }
                }
            }
        }, { passive: true });
    });
}

// Touch handlers
function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    touchStartElement = e.target.closest('.message-wrapper');
}

function handleTouchMove(e) {
    // Peut être utilisé pour preview du swipe
}

function handleTouchEnd(e) {
    const touchEndTime = Date.now();
    const duration = touchEndTime - touchStartTime;
    
    // Long press (> 500ms sans mouvement significatif)
    if (duration > LONG_PRESS_DURATION && touchStartElement) {
        const messageWrapper = e.target.closest('.message-wrapper');
        if (messageWrapper) {
            const messageId = messageWrapper.dataset.messageId;
            
            if (messageId) {
                const message = messages.find(m => m.id === messageId);
                if (message) {
                    // Show context menu or emoji picker
                    const touch = e.changedTouches[0];
                    showMessageContextMenu(touch.clientX, touch.clientY, message);
                }
            }
        }
    }
    
    touchStartElement = null;
}

// Context menu handler (desktop)
function handleMessageContextMenu(e) {
    e.preventDefault();
    
    const messageWrapper = e.target.closest('.message-wrapper');
    if (!messageWrapper) return;
    
    const messageId = messageWrapper.getAttribute('data-message-id') || messageWrapper.dataset.messageId;
    if (!messageId) return;
    
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    // Afficher le menu contextuel à la position de la souris
    showMessageContextMenu(e.clientX, e.clientY, message);
}

// Afficher le menu contextuel du message
function showMessageContextMenu(x, y, message) {
    const menu = document.getElementById('messageContextMenu');
    if (!menu) return;
    
    // Positionner le menu
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';
    
    // Stocker le message actuel pour les actions
    currentContextMessage = message;
    
    // Ajouter les écouteurs d'événements aux boutons du menu
    const replyBtn = document.getElementById('replyMessageBtn');
    const reactBtn = document.getElementById('reactMessageBtn');
    const copyBtn = document.getElementById('copyMessageBtn');
    const forwardBtn = document.getElementById('forwardMessageBtn');
    const deleteBtn = document.getElementById('deleteMessageBtn');
    
    if (replyBtn) {
        replyBtn.onclick = () => {
            replyToMessage(message);
            hideMessageContextMenu();
        };
    }
    
    if (reactBtn) {
        reactBtn.onclick = () => {
            const messageId = message.id;
            const picker = document.getElementById(`emoji-picker-${messageId}`);
            if (picker) {
                picker.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
                
                // Fermer les autres pickers
                document.querySelectorAll('.emoji-reactions-picker').forEach(p => {
                    if (p.id !== `emoji-picker-${messageId}`) {
                        p.style.display = 'none';
                    }
                });
            }
            hideMessageContextMenu();
        };
    }
    
    if (copyBtn) {
        copyBtn.onclick = () => {
            copyMessage(message);
        };
    }
    
    if (forwardBtn) {
        forwardBtn.onclick = () => {
            forwardMessage(message);
        };
    }
    
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            deleteMessage(message);
        };
    }
    
    // Masquer le menu en cliquant ailleurs
    setTimeout(() => {
        document.addEventListener('click', hideMessageContextMenuOutside, { once: true });
    }, 10);
}

// Masquer le menu contextuel en cliquant ailleurs
function hideMessageContextMenuOutside(e) {
    const menu = document.getElementById('messageContextMenu');
    if (menu && !menu.contains(e.target)) {
        hideMessageContextMenu();
    }
}

function hideMessageContextMenu() {
    const menu = document.getElementById('messageContextMenu');
    if (menu) {
        menu.style.display = 'none';
    }
    currentContextMessage = null;
}

// Répondre à un message
// ⚠️ DEPRECATED: Old modal-based reply system removed. Now using inline reply preview in message-input-container

// Fermer le modal de réponse
function closeReplyModal() {
    // ⚠️ DEPRECATED: Old modal system. Use cancelReply() instead
    cancelReply();
}

// Afficher le menu de réactions
function showReactionMenu(message) {
    reactingToMessage = message;
    
    const menu = document.getElementById('reactionModal');
    if (!menu) return;
    
    // Positionner le menu près du message
    const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
    if (!messageElement) return;
    
    const rect = messageElement.getBoundingClientRect();
    menu.style.left = (rect.left + rect.width / 2 - 100) + 'px';
    menu.style.top = (rect.top - 60) + 'px';
    menu.style.display = 'flex';
    
    // Ajouter les écouteurs d'événements
    document.querySelectorAll('.reaction-option').forEach(option => {
        option.onclick = () => {
            const reaction = option.getAttribute('data-reaction');
            addReaction(message, reaction);
            hideReactionMenu();
        };
    });
    
    // Masquer le menu en cliquant ailleurs
    setTimeout(() => {
        document.addEventListener('click', hideReactionMenuOutside, { once: true });
    }, 10);
}

// Masquer le menu de réactions en cliquant ailleurs
function hideReactionMenuOutside(e) {
    const menu = document.getElementById('reactionModal');
    if (menu && !menu.contains(e.target)) {
        hideReactionMenu();
    }
}

function hideReactionMenu() {
    const menu = document.getElementById('reactionModal');
    if (menu) {
        menu.style.display = 'none';
    }
    reactingToMessage = null;
}

// Basculer une réaction (ajouter ou retirer)
function toggleReaction(messageId, emoji) {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    // Vérifier si l'utilisateur a déjà mis cette réaction
    if (message.reactions && message.reactions[emoji] && message.reactions[emoji].includes(currentUser.id)) {
        // Retirer la réaction
        removeReaction(messageId, emoji);
    } else {
        // Ajouter la réaction
        addReaction(messageId, emoji);
    }
}

// Ajouter une réaction à un message
async function addReaction(messageId, emoji) {
    try {
        if (!messageId || !currentConversationId) return;
        
        // Trouver le message
        const message = messages.find(m => m.id === messageId);
        if (!message) return;
        
        // 1️⃣ Mettre à jour localement en premier pour l'UI optimiste
        if (!message.reactions) {
            message.reactions = {};
        }
        
        if (!message.reactions[emoji]) {
            message.reactions[emoji] = [];
        }
        
        if (!message.reactions[emoji].includes(currentUser.id)) {
            message.reactions[emoji].push(currentUser.id);
        }
        
        // Rerendre les messages immédiatement avec la classe user-reacted
        renderMessages(messages);
        
        // 2️⃣ Envoyer via REST API au serveur
        try {
            const response = await fetch(
                `${window.storage.API_URL}/chat/conversations/${currentConversationId}/messages/${messageId}/reaction`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${getAuthToken()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ emoji })
                }
            );
            
            if (!response.ok) {
                throw new Error('Échec de l\'ajout au serveur');
            }
            
            const data = await response.json();
            console.log('✅ Réaction envoyée au serveur:', data);
          
            
        } catch (apiError) {
            console.error('❌ Erreur API:', apiError);
            // La réaction est déjà visuelle, afficher un warning
            showToast('Réaction envoyée en local (sync en arrière-plan)', 'info');
            // Recharger quand même pour synchroniser
            await loadMessages(currentConversationId, false);
        }
        
        // 4️⃣ Émettre via Socket.io pour les autres clients
        addReactionViaWebSocket(currentConversationId, messageId, emoji);
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'ajout de la réaction:', error);
        showToast('Impossible d\'ajouter la réaction', 'error');
        // Recharger pour revenir à l'état correct
        await loadMessages(currentConversationId, false);
    }
}

// Retirer une réaction d'un message
async function removeReaction(messageId, emoji) {
    try {
        if (!messageId || !currentConversationId) return;
        
        // Trouver le message
        const message = messages.find(m => m.id === messageId);
        if (!message || !message.reactions || !message.reactions[emoji]) return;
        
        // 1️⃣ Mettre à jour localement en premier pour l'UI optimiste
        const reactionIndex = message.reactions[emoji].indexOf(currentUser.id);
        if (reactionIndex !== -1) {
            message.reactions[emoji].splice(reactionIndex, 1);
            
            // Supprimer l'emoji s'il n'y a plus de réactions
            if (message.reactions[emoji].length === 0) {
                delete message.reactions[emoji];
            }
        }
        
        
        // 2️⃣ Envoyer via REST API au serveur
        try {
            const response = await fetch(
                `${window.storage.API_URL}/chat/conversations/${currentConversationId}/messages/${messageId}/reaction/${encodeURIComponent(emoji)}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${getAuthToken()}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error('Échec de la suppression au serveur');
            }
            
            const data = await response.json();
            console.log('✅ Réaction retirée du serveur:', data);
           
             renderMessages(messages);
            
        } catch (apiError) {
            console.error('❌ Erreur API:', apiError);
            showToast('Réaction retirée en local (sync en arrière-plan)', 'info');
        
            await loadMessages(currentConversationId, false);
        }
        
        // 4️⃣ Émettre via Socket.io pour les autres utilisateurs
        if (chatSocket && chatSocket.connected) {
            chatSocket.emit('message:reaction:remove', {
                conversationId: currentConversationId,
                messageId: messageId,
                emoji: emoji
            });
        }
        
    } catch (error) {
        console.error('❌ Erreur lors du retrait de la réaction:', error);
        showToast('Impossible de retirer la réaction', 'error');
        // Recharger pour revenir à l'état correct
        await loadMessages(currentConversationId, false);
    }
}

// Copier un message
function copyMessage(message) {
    const textToCopy = message.content || '';
    
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            showToast('Message copié dans le presse-papier', 'success');
        })
        .catch(err => {
            console.error('Erreur lors de la copie:', err);
            showToast('Impossible de copier le message', 'error');
        });
}

// Transférer un message
function forwardMessage(message) {
    // Afficher un modal pour sélectionner la conversation de destination
    showForwardMessageModal(message);
}

// Supprimer un message
async function deleteMessage(messageId) {
    try {
       
        // Demander confirmation
        const result = await Swal.fire({
            title: 'Supprimer le message ?',
            text: 'Cette action est irréversible',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#6B7280',
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler'
        });
        
        if (!result.isConfirmed) return;
        
        // Utiliser l'API pour supprimer le message
        const response = await fetch(`${window.storage.API_URL}/chat/conversations/${currentConversationId}/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
        }
    })
    
        const res = response.json();
        if (!response.ok) throw new Error(res.error || 'Échec de la suppression');
        
        loadMessages(currentConversationId);

        const msg = messages.find(m => m.id === messageId);
        if (msg) {
            msg.deletedAt = new Date().toISOString();
            msg.content = 'Message supprimé';
            renderMessages(messages);
        }


        if (chatSocket && chatSocket.connected) {
                console.log('📡 Émission via WebSocket...');
                deleteMessageViaWebSocket(currentConversationId, messageId);
              
            }
        

    // Rafraîchir l'affichage
    renderMessages(messages);
    showToast('Message supprimé', 'success');
        
    
    // Fermer le menu
    const menu = document.getElementById(`actions-${messageId}`);
    if (menu) {
        menu.classList.remove('show');
        const wrapper = menu.closest('.message-wrapper');
        if (wrapper) wrapper.style.zIndex = 'auto';
    }
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        showToast('Impossible de supprimer le message', 'error');
    }
}

// ==========================================
// MODAL POUR TRANSFÉRER UN MESSAGE
// ==========================================

function showForwardMessageModal(message) {
    // Créer le modal de transfert
    const modalHTML = `
        <div class="modal fade" id="forwardModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-share me-2"></i>
                            Transférer le message
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="search-container mb-3">
                            <input type="text" class="form-control" id="forwardSearch" placeholder="Rechercher une conversation...">
                        </div>
                        <div class="conversations-list" id="forwardConversationsList" style="max-height: 300px; overflow-y: auto;">
                            <!-- Conversations pour le transfert -->
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
                        <button type="button" class="btn btn-primary" id="confirmForwardBtn" disabled>
                            <i class="fas fa-paper-plane me-1"></i> Transférer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Ajouter le modal au DOM s'il n'existe pas
    if (!document.getElementById('forwardModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // Afficher le modal
    const modal = new bootstrap.Modal(document.getElementById('forwardModal'));
    modal.show();
    
    // Charger les conversations pour le transfert
    loadForwardConversations(message);
}

async function loadForwardConversations(messageToForward) {
    try {
        const container = document.getElementById('forwardConversationsList');
        if (!container) return;
        
        container.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary"></div>
                <p class="mt-2">Chargement des conversations...</p>
            </div>
        `;
        
        // Exclure la conversation actuelle
        const availableConversations = conversations.filter(conv => conv.id !== currentConversationId);
        
        if (availableConversations.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-comments fa-2x text-muted mb-3"></i>
                    <p>Aucune autre conversation disponible</p>
                </div>
            `;
            return;
        }
        
        // Afficher la liste des conversations
        container.innerHTML = availableConversations.map(conversation => {
            let conversationName = conversation.name || 'Chat';
            if (conversation.type === 'direct' && conversation.participants) {
                const otherParticipants = conversation.participants.filter(p => p.userId !== currentUser?.id);
                if (otherParticipants.length > 0) {
                    const firstParticipant = otherParticipants[0];
                    conversationName = firstParticipant.name || firstParticipant.email || 'Utilisateur';
                }
            }
            
            const avatarText = conversationName.charAt(0).toUpperCase();
            
            return `
                <div class="conversation-item-forward d-flex align-items-center p-3 border-bottom" 
                     data-conversation-id="${conversation.id}">
                    <div class="me-3">
                        <div class="conversation-avatar-small">
                            ${avatarText}
                        </div>
                    </div>
                    <div class="flex-grow-1">
                        <div class="fw-bold">${escapeHtml(conversationName)}</div>
                        <small class="text-muted">
                            ${conversation.participants?.length || 0} participant${conversation.participants?.length > 1 ? 's' : ''}
                        </small>
                    </div>
                    <div>
                        <input class="form-check-input" type="radio" name="forwardTo" value="${conversation.id}">
                    </div>
                </div>
            `;
        }).join('');
        
        // Ajouter les écouteurs d'événements
        container.querySelectorAll('.conversation-item-forward').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('form-check-input')) {
                    const radio = item.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.checked = !radio.checked;
                        updateForwardButton();
                    }
                }
            });
            
            const radio = item.querySelector('input[type="radio"]');
            if (radio) {
                radio.addEventListener('change', updateForwardButton);
            }
        });
        
        // Recherche dans les conversations
        const searchInput = document.getElementById('forwardSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                container.querySelectorAll('.conversation-item-forward').forEach(item => {
                    const text = item.textContent.toLowerCase();
                    item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
                });
            });
        }
        
        // Bouton de confirmation
        document.getElementById('confirmForwardBtn').onclick = () => {
            forwardToSelectedConversation(messageToForward);
        };
        
    } catch (error) {
        console.error('Erreur lors du chargement des conversations:', error);
        const container = document.getElementById('forwardConversationsList');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Erreur lors du chargement des conversations
                </div>
            `;
        }
    }
}

function updateForwardButton() {
    const selected = document.querySelector('input[name="forwardTo"]:checked');
    const confirmBtn = document.getElementById('confirmForwardBtn');
    
    if (confirmBtn) {
        confirmBtn.disabled = !selected;
    }
}

async function forwardToSelectedConversation(message) {
    try {
        const selectedRadio = document.querySelector('input[name="forwardTo"]:checked');
        if (!selectedRadio) return;
        
        const targetConversationId = selectedRadio.value;
        const targetConversation = conversations.find(c => c.id === targetConversationId);
        
        if (!targetConversation) {
            showToast('Conversation non trouvée', 'error');
            return;
        }
        
        // Préparer le texte à transférer
        let forwardedContent = '';
        if (message.type === 'text') {
            forwardedContent = message.content;
        } else if (message.type === 'image') {
            forwardedContent = '📷 Image transférée';
        } else if (message.type === 'file') {
            forwardedContent = `📎 ${message.fileName || 'Fichier transféré'}`;
        }
        
        // Ajouter la mention "Transféré"
        forwardedContent = `↪️ ${forwardedContent}`;
        
        // Envoyer le message transféré
        const response = await window.storage.sendMessage(targetConversationId, forwardedContent);
        
        if (response) {
            showToast('Message transféré avec succès', 'success');
            
            // Fermer le modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('forwardModal'));
            if (modal) {
                modal.hide();
            }
        }
        
    } catch (error) {
        console.error('Erreur lors du transfert:', error);
        showToast('Impossible de transférer le message', 'error');
    }
}

// ==========================================
// MODAL D'INFORMATIONS DE LA CONVERSATION
// ==========================================

// Récupérer les détails complets de la conversation
async function getConversationDetails(conversationId) {
    try {
        const response = await fetch(`${window.storage.API_URL}/chat/conversations/${conversationId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) throw new Error('Échec de la récupération des détails');
        
        const data = await response.json();
        return data.success ? data.conversation : null;
    } catch (error) {
        console.error('Erreur getConversationDetails:', error);
        return null;
    }
}

// Obtenir le temps écoulé depuis une date
function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'à l\'instant';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}j`;
    const weeks = Math.floor(days / 7);
    return `${weeks}sem`;
}

async function showChatInfoModal() {
    try {
        if (!currentConversationId) return;
        
        const modal = document.getElementById('chatInfoModal');
        const infoBody = document.getElementById('chatInfoBody');
        

        if (!modal || !infoBody) return;
        
        infoBody.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary"></div>
                <p class="mt-2">Chargement des informations...</p>
            </div>
        `;
        
        // Utiliser currentConversation (déjà chargée) ou récupérer les détails
        const conversationDetails = currentConversation || await getConversationDetails(currentConversationId);
        
        if (!conversationDetails) {
            throw new Error('Conversation non trouvée');
        }
        // Mettre à jour le contenu
        let infoHTML = '';
        
        // Infos générales
        infoHTML += `
            <div class="mb-4">
                <div class="section-title">Informations</div>
                <div class="d-flex align-items-center mb-3">
                    <div class="chat-avatar-large me-3">
                         <img src="../assets/images/logo.png" alt="secura-group" class="guest-avatar" onerror="this.style.display='none'">
                    </div>
                    <div>
                        <h4 class="mb-1">${escapeHtml(conversationDetails.name || 'Chat')}</h4>
                        <p class="mb-0">
                            <i class="fas fa-users me-1"></i>
                            ${conversationDetails.participants?.length || 0} participant${conversationDetails.participants?.length > 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                
                ${conversationDetails?.createdAt ? `
                    <div class="info-item">
                        <i class="fas fa-calendar-plus me-2"></i>
                        <span>Créé le ${new Date(conversationDetails.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                ` : ''}
                
                ${conversationDetails?.description ? `
                    <div class="info-item mt-2">
                        <i class="fas fa-align-left me-2"></i>
                        <span>${escapeHtml(conversationDetails.description)}</span>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Participants
        if (conversationDetails.participants && conversationDetails.participants.length > 0) {
            infoHTML += `
                <div class="participants-section">
                    <div class="section-title">Participants (${conversationDetails.participants.length})</div>
                    <div class="participants-list">
                        ${conversationDetails.participants.map(participant => `
                            <div class="guest-card" style=" display: flex; align-items: center; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
                                <div class="guest-avatar-container ${participant.isOnline ? 'online' : ''}">
                                   
                                    ${getGuestAvatarImage(participant) ? `
                                        <img src="${getGuestAvatarImage(participant)}" alt="${escapeHtml(participant.fullName)}" class="guest-avatar" onerror="this.style.display='none'">
                                    ` : `
                                        <div class="guest-avatar">
                                            ${(participant.name || participant.email || 'U').charAt(0).toUpperCase()}
                                        </div>
                                    `}

                                     <span class="participant-status-badge"></span>
                                </div>
                                <div class="guest-info">
                                    <div class="guest-name">
                                        ${escapeHtml(participant.name || participant.email || 'Utilisateur')}
                                        ${participant.userId === currentUser?.id ? ' <span class="badge bg-primary">Vous</span>' : ''}
                                    </div>
                                    ${participant.email ? `
                                        <div class="guest-email small">${escapeHtml(participant.email)}</div>
                                    ` : ''}
                                    ${participant.isOnline ? `
                                        <div class="participant-status text-success small">
                                            <i class="fas fa-circle me-1" style="font-size: 0.6em;"></i>
                                            En ligne
                                        </div>
                                    ` : `
                                        <div class="participant-status small">
                                            ${participant.lastReadAt ? 'Vu il y a ' + getTimeAgo(participant.lastReadAt) : 'Hors ligne'}
                                        </div>
                                    `}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        
        
        infoBody.innerHTML = infoHTML;
        
        // Ajouter les écouteurs d'événements pour les actions
        document.getElementById('addParticipantsBtn')?.addEventListener('click', () => {
            showAddParticipantsModal();
        });
        
        document.getElementById('changeNameBtn')?.addEventListener('click', () => {
            showChangeNameModal();
        });
        
        document.getElementById('leaveConversationBtn')?.addEventListener('click', () => {
            leaveConversation();
        });
        
        // Afficher le modal
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Erreur lors du chargement des infos:', error);
        const infoBody = document.getElementById('chatInfoBody');
        if (infoBody) {
            infoBody.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Erreur lors du chargement des informations
                </div>
            `;
        }
    }
}


async function showChangeNameModal() {
    const currentName = currentConversation?.name || '';
    
    const { value: newName } = await Swal.fire({
        title: 'Modifier le nom',
        input: 'text',
        inputLabel: 'Nouveau nom de la conversation',
        inputValue: currentName,
        showCancelButton: true,
        confirmButtonText: 'Modifier',
        cancelButtonText: 'Annuler',
        inputValidator: (value) => {
            if (!value) {
                return 'Le nom ne peut pas être vide';
            }
            if (value.length > 50) {
                return 'Le nom ne peut pas dépasser 50 caractères';
            }
        }
    });
    
    if (newName && newName !== currentName) {
        await updateConversationName(newName);
    }
}

async function updateConversationName(newName) {
    try {
        const response = await fetch(`${window.storage.API_URL}/chat/conversations/${currentConversationId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: newName
            })
        });
        
        if (!response.ok) throw new Error('Échec de la modification');
        
        // Mettre à jour localement
        currentConversation.name = newName;
        updateChatHeader();
        
        showToast('Nom modifié avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Impossible de modifier le nom', 'error');
    }
}

async function leaveConversation() {
    try {
        const result = await Swal.fire({
            title: 'Quitter la conversation ?',
            text: 'Vous ne recevrez plus de messages de cette conversation',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#6B7280',
            confirmButtonText: 'Quitter',
            cancelButtonText: 'Annuler'
        });
        
        if (!result.isConfirmed) return;
        
        const response = await fetch(`${window.storage.API_URL}/chat/conversations/${currentConversationId}/leave`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) throw new Error('Échec de la sortie');
        
        showToast('Vous avez quitté la conversation', 'success');
        
        // Recharger les conversations
        await loadConversations(true);
        
        // Désélectionner la conversation actuelle
        currentConversationId = null;
        currentConversation = null;
        
        // Masquer la zone de chat avec hideChatArea()
        hideChatArea();
        renderConversationsList(conversations);
        
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Impossible de quitter la conversation', 'error');
    }
}





function initializeConversationPanel() {
    const panel = document.getElementById('newConversationPanel');
    const overlay = document.getElementById('panelOverlay');
    const backBtn = document.getElementById('backToConversationsBtn');
    const cancelBtn = document.getElementById('cancelConversationBtn');
    const createBtn = document.getElementById('createConversationBtn');
    const typeRadios = document.querySelectorAll('input[name="conversationType"]');
    const panelTitle = document.querySelector('.panel-title h3');

    // Gérer le clic sur le bouton de création
    if (createBtn) {
        createBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isDirect = document.getElementById('typeDirect')?.checked;
            const isGroup = document.getElementById('typeGroup')?.checked;
            
            if (isDirect) {
                // Pour chat direct, créer directement
                createNewConversation();
            } else if (isGroup) {
                // Pour groupe, fermer le panel d'abord, puis ouvrir le modal
                closeConversationPanel();
                // Délai pour que le panel se ferme avant d'ouvrir le modal
                setTimeout(() => {
                    openGroupCreationModal();
                }, 300);
            }
        });
    }
    
    // Gérer le changement de type
    typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const searchInput = document.getElementById('newConversationSearch');
            
            // Réinitialiser complètement l'état
            if (e.target.id === 'typeGroup') {
                if (panelTitle) {
                    panelTitle.innerHTML = '<i class="fas fa-users me-2"></i>Nouveau groupe';
                }
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.placeholder = 'Ajouter des participants...';
                }
                // Décocher toutes les cartes sélectionnées
                document.querySelectorAll('.guest-card.selected').forEach(card => {
                    card.classList.remove('selected');
                });
            } else {
                if (panelTitle) {
                    panelTitle.innerHTML = '<i class="fas fa-user me-2"></i>Chat Direct';
                }
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.placeholder = 'Rechercher un contact...';
                }
                // Réinitialiser les checkboxes cochées
                document.querySelectorAll('.user-select-checkbox:checked').forEach(checkbox => {
                    checkbox.checked = false;
                });
            }
            // Recharger les invités quand le type change (pour afficher/masquer checkboxes)
            loadUsersForNewConversation();
            updateCreateButton();
        });
    });
    
    // Boutons de fermeture
    if (backBtn) backBtn.addEventListener('click', closeConversationPanel);
    if (cancelBtn) cancelBtn.addEventListener('click', closeConversationPanel);
    
    // Initialiser les listeners du modal de groupe
    initializeGroupCreationModal();
    
    // Fermeture par overlay click
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeConversationPanel();
            }
        });
    }
    
    // Empêcher la propagation des clicks sur le panel
    if (panel) {
        panel.addEventListener('click', (e) => e.stopPropagation());
    }
    
    // Ajouter le listener de recherche
    const searchInput = document.getElementById('newConversationSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            filterNewConversationUsers();
        }, 300));
    }
    
    // Charger les invités
    loadUsersForNewConversation();
}

function openConversationPanel() {
    const panel = document.getElementById('newConversationPanel');
    const overlay = document.getElementById('panelOverlay');
    if (panel) {
        // Réinitialiser l'état du panel
        const typeDirect = document.getElementById('typeDirect');
        if (typeDirect) typeDirect.checked = true; // Par défaut: chat direct
        
        const searchInput = document.getElementById('newConversationSearch');
        if (searchInput) searchInput.value = '';
        
        // Décocher toutes les checkboxes
        document.querySelectorAll('.user-select-checkbox:checked').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Retirer les sélections de cartes
        document.querySelectorAll('.guest-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        
        panel.classList.add('active');
        overlay.classList.add('active');
        
        // Recharger les utilisateurs
        loadUsersForNewConversation();
        updateCreateButton();
    }
}


function closeConversationPanel() {
    const panel = document.getElementById('newConversationPanel');
    const overlay = document.getElementById('panelOverlay');
    if (panel) {
        panel.classList.remove('active');
        overlay.classList.remove('active');
    }
}

// Obtenir l'avatar selon le sexe avec détection intelligente
function getGuestAvatarImage(guest) {
    const baseUrl = '../assets/images/';
    const validGenders = ['m', 'f', 'homme', 'femme', 'male', 'female', 'couple', 'maman', 'mother', 'autre'];
    
    // 1️⃣ Vérifier d'abord le champ gender/sexe
    const gender = (guest.gender?.toLowerCase() || guest.sexe?.toLowerCase() || '').trim();
    
    if (gender) {
        // Normaliser et checker les valeurs connues
        if (gender === 'f' || gender === 'femme' || gender === 'woman' || gender === 'female') {
            return `${baseUrl}femme.png`;
        } else if (gender === 'm' || gender === 'homme' || gender === 'man' || gender === 'male') {
            return `${baseUrl}homme.png`;
        } else if (gender === 'couple') {
            return `${baseUrl}couple.png`;
        } else if (gender === 'maman' || gender === 'mother') {
            return `${baseUrl}maman.png`;
        } else if (gender === 'autre') {
            return null; // Utiliser les initiales
        }
    }
    
    // 2️⃣ Détection intelligente basée sur les titres de civilité et notes
    const firstName = (guest.firstName || '').toLowerCase().trim();
    const lastName = (guest.lastName || '').toLowerCase().trim();
    const notes = (guest.notes || '').toLowerCase().trim();
    
    const maleIndicators = ['mr', 'monsieur', 'homme', 'male', 'son', 'père', 'fils', 'dad', 'boy'];
    const femaleIndicators = ['mme', 'mlle', 'madame', 'mademoiselle', 'femme', 'female', 'fille', 'maman', 'mother', 'mom', 'girl', 'daughter'];
    
    const fullName = `${firstName} ${lastName}`.toLowerCase();
    
    // Checker dans le nom complet
    for (let indicator of femaleIndicators) {
        if (fullName.includes(indicator) || notes.includes(indicator)) {
            return `${baseUrl}femme.png`;
        }
    }
    
    for (let indicator of maleIndicators) {
        if (fullName.includes(indicator) || notes.includes(indicator)) {
            return `${baseUrl}homme.png`;
        }
    }
    
    // 3️⃣ Si aucune détection, utiliser null (affichera les initiales)
    return null;
}

// Méthode générique pour obtenir l'avatar de n'importe quel utilisateur ou guest
function getAvatarImage(user) {
    if (!user) return null;
    
    return getGuestAvatarImage(user);
}

async function loadUsersForNewConversation() {
    try {
        const container = document.getElementById('newConversationUsersList');
        if (!container) return;
        
        // Récupérer les invités de l'événement
        const session = await window.storage.getCurrentSessionDetails();
        if (!session?.success) return;
        
        const eventId = session.data.event?.id;
        if (!eventId) return;
        
        // Utiliser la méthode du storage pour récupérer les invités
        const guests = window.storage.getGuestsByEventId(eventId);
        const users = guests || [];
        
        // Filtrer l'utilisateur courant
        const otherUsers = users.filter(user => user.id !== currentUser?.id);
        
        if (otherUsers.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-user-slash fa-2x text-muted mb-3"></i>
                    <p>Aucun autre utilisateur disponible</p>
                </div>
            `;
            return;
        }
        
        // Vérifier le type de conversation
        const isDirect = document.getElementById('typeDirect')?.checked;
        
        // Séparer les utilisateurs avec/sans conversation existante
        const usersWithConversation = [];
        const usersWithoutConversation = [];
        
        otherUsers.forEach(user => {
            // Chercher une conversation directe existante avec cet utilisateur
            const existingConversation = conversations.find(conv => 
                conv.type === 'direct' && 
                conv.participants.some(p => p.userId === user.id)
            );
            
            if (existingConversation) {
                usersWithConversation.push({ ...user, conversationId: existingConversation.id });
            } else {
                usersWithoutConversation.push(user);
            }
        });
        
        // Afficher les utilisateurs sans conversation d'abord
        let htmlContent = '';
        
        // Section: Utilisateurs disponibles pour nouvelle conversation
        if (usersWithoutConversation.length > 0) {
            htmlContent += usersWithoutConversation.map((user, index) => {
                const fullName = `${(user.firstName || '')} ${(user.lastName || '')}`.trim() || user.email || 'Invité';
                const initials = (user.firstName?.charAt(0) || '') + (user.lastName?.charAt(0) || '') || fullName.charAt(0);
                const avatarImage = getGuestAvatarImage(user);
                
                // Pour chat direct : pas de checkbox
                // Pour groupe : afficher checkbox (JAMAIS pré-coché!)
                const checkboxHTML = !isDirect ? `<input type="checkbox" class="guest-checkbox user-select-checkbox" value="${user.id}" id="guest-${user.id}" autocomplete="off">` : '';
                const checkboxLabelFor = !isDirect ? `for="guest-${user.id}"` : '';
                const indicatorHTML = !isDirect ? `<div class="guest-checkbox-indicator"><i class="fas fa-check-circle"></i></div>` : '';
                
                return `
                    <div class="guest-card" data-guest-id="${user.id}">
                        ${checkboxHTML}
                        
                        <label ${checkboxLabelFor} class="guest-card-label">
                            <div class="guest-avatar-container">
                                ${avatarImage ? `
                                    <img src="${avatarImage}" alt="${escapeHtml(fullName)}" class="guest-avatar" onerror="this.style.display='none'">
                                ` : `
                                    <div class="guest-avatar">
                                        ${initials.toUpperCase()}
                                    </div>
                                `}
                                <div class="guest-info">
                                    <div class="guest-name">${escapeHtml(fullName)}</div>
                                    <div class="guest-email">${escapeHtml(user.email || 'Sans email')}</div>
                                </div>
                            </div>
                            ${indicatorHTML}
                        </label>
                    </div>
                `;
            }).join('');
        }
        
        // Section: Utilisateurs avec conversation existante
        if (usersWithConversation.length > 0) {
            if (htmlContent) {
                htmlContent += `
                    <div class="conversation-divider" style="margin: 15px 0; padding: 10px 0; border-top: 1px solid var(--border-color); font-size: 12px; color: #999; text-align: center;">
                        Conversations existantes
                    </div>
                `;
            }
            
            htmlContent += usersWithConversation.map((user, index) => {
                const fullName = `${(user.firstName || '')} ${(user.lastName || '')}`.trim() || user.email || 'Invité';
                const initials = (user.firstName?.charAt(0) || '') + (user.lastName?.charAt(0) || '') || fullName.charAt(0);
                const avatarImage = getGuestAvatarImage(user);
                
                return `
                    <div onclick="selectConversationWithUser('${user.conversationId}')" class="guest-card existing-conversation" style="display: flex; !important" data-guest-id="${user.id}" data-conversation-id="${user.conversationId}">
                        <div class="guest-card-label">
                            <div class="guest-avatar-container">
                                ${avatarImage ? `
                                    <img src="${avatarImage}" alt="${escapeHtml(fullName)}" class="guest-avatar" onerror="this.style.display='none'">
                                ` : `
                                    <div class="guest-avatar">
                                        ${initials.toUpperCase()}
                                    </div>
                                `}
                                <div class="guest-info">
                                    <div class="guest-name">${escapeHtml(fullName)}</div>
                                    <div class="guest-email">${escapeHtml(user.email || 'Sans email')}</div>
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-sm chat-existing-btn" onclick="selectConversationWithUser('${user.conversationId}')" title="Aller au chat">
                            <i class="fas fa-comments"></i>
                        </button>
                    </div>
                `;
            }).join('');
        }
        
        // Si aucun utilisateur
        if (usersWithoutConversation.length === 0 && usersWithConversation.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-user-slash fa-2x text-muted mb-3"></i>
                    <p>Aucun autre utilisateur disponible</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = htmlContent;
        
        // Ajouter les événements aux cartes (SAUF les conversations existantes)
        document.querySelectorAll('.guest-card:not(.existing-conversation)').forEach(card => {
            card.addEventListener('click', (e) => {
                const isDirect = document.getElementById('typeDirect')?.checked;
                const checkbox = card.querySelector('.guest-checkbox');
                
                if (isDirect) {
                    // Pour chat direct: sélection exclusive
                    document.querySelectorAll('.guest-card:not(.existing-conversation)').forEach(c => c.classList.remove('selected'));
                    document.querySelectorAll('.guest-checkbox').forEach(cb => cb.checked = false);
                    card.classList.add('selected');
                    if (checkbox) checkbox.checked = true;
                    updateCreateButton();
                } else if (checkbox && e.target.type !== 'checkbox') {
                    // Pour groupe: empêcher l'action par défaut du label (qui togglerait
                    // le checkbox automatiquement) pour éviter un double-toggle.
                    e.preventDefault();

                    // Toggle checkbox avec limite de 5
                    const currentlyChecked = document.querySelectorAll('.user-select-checkbox:checked').length;

                    if (!checkbox.checked && currentlyChecked >= 5) {
                        showToast('Maximum 5 participants par groupe', 'warning');
                        return;
                    }

                    checkbox.checked = !checkbox.checked;
                    card.classList.toggle('selected', checkbox.checked);
                    // Déclencher manuellement l'événement change pour synchroniser
                    // les autres gestionnaires (et updateCreateButton).
                    checkbox.dispatchEvent(new Event('change'));
                    updateCreateButton();
                }
            });
            
            // Pour les checkboxes, gérer le changement
            const checkbox = card.querySelector('.guest-checkbox');
            if (checkbox) {
                // S'assurer que le checkbox n'est pas coché au départ
                checkbox.checked = false;
                
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    const isDirect = document.getElementById('typeDirect')?.checked;
                    
                    if (isDirect) {
                        // Pour chat direct: sélection exclusive
                        document.querySelectorAll('.guest-checkbox').forEach(cb => cb.checked = false);
                        document.querySelectorAll('.guest-card:not(.existing-conversation)').forEach(c => c.classList.remove('selected'));
                        checkbox.checked = true;
                        card.classList.add('selected');
                    } else {
                        // Pour groupe: vérifier la limite de 5
                        const currentlyChecked = document.querySelectorAll('.user-select-checkbox:checked').length;
                        
                        if (checkbox.checked && currentlyChecked > 5) {
                            checkbox.checked = false;
                            card.classList.remove('selected');
                            showToast('Maximum 5 participants par groupe', 'warning');
                            updateCreateButton();
                            return;
                        }
                        
                        // Marquer comme sélectionné
                        if (checkbox.checked) {
                            card.classList.add('selected');
                        } else {
                            card.classList.remove('selected');
                        }
                    }
                    updateCreateButton();
                });
            }
        });
        
        updateCreateButton();
        
    } catch (error) {
        console.error('Erreur:', error);
        const container = document.getElementById('newConversationUsersList');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Erreur lors du chargement des utilisateurs
                </div>
            `;
        }
    }
}

// Filtrer les utilisateurs dans la nouvelle conversation
function filterNewConversationUsers() {
    const searchInput = document.getElementById('newConversationSearch');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    const container = document.getElementById('newConversationUsersList');
    if (!container) return;
    
    // Récupérer toutes les cartes
    const cards = container.querySelectorAll('.guest-card');
    let visibleCount = 0;
    
    if (searchTerm.length === 0) {
        // Afficher tous les utilisateurs
        cards.forEach(card => {
            card.style.display = 'block';
            visibleCount++;
        });
        // Supprimer le message d'aucun résultat s'il existe
        const emptyMessage = container.querySelector('.empty-search-state');
        if (emptyMessage) emptyMessage.remove();
    } else {
        // Filtrer par nom ou email
        cards.forEach(card => {
            const name = card.querySelector('.guest-name')?.textContent.toLowerCase() || '';
            const email = card.querySelector('.guest-email')?.textContent.toLowerCase() || '';
            
            const match = name.includes(searchTerm) || email.includes(searchTerm);
            card.style.display = match ? 'flex' : 'none';
            if (match) visibleCount++;
        });
        
        // Afficher le message d'aucun résultat si aucune carte n'est visible
        if (visibleCount === 0) {
            // Vérifier si le message existe déjà
            let emptyMessage = container.querySelector('.empty-search-state');
            if (!emptyMessage) {
                emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-search-state';
                emptyMessage.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-muted, #999);">
                        <i class="fas fa-search fa-3x mb-3" style="display: block; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p style="margin: 0; font-size: 14px;">Aucun résultat trouvé</p>
                        <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.7;">Modifiez votre recherche et réessayez</p>
                    </div>
                `;
                container.appendChild(emptyMessage);
            }
        } else {
            // Supprimer le message d'aucun résultat s'il existe
            const emptyMessage = container.querySelector('.empty-search-state');
            if (emptyMessage) emptyMessage.remove();
        }
    }
}

function updateCreateButton() {
    const isDirect = document.getElementById('typeDirect')?.checked;
    const isGroup = document.getElementById('typeGroup')?.checked;
    
    const createBtn = document.getElementById('createConversationBtn');
    if (!createBtn) return;
    
    // Mise à jour du texte du bouton
    if (isDirect) {
        createBtn.innerHTML = '<i class="fas fa-comments me-1"></i> Créer Chat Direct';
        const selectedCard = document.querySelector('.guest-card.selected');
        createBtn.disabled = !selectedCard;
    } else if (isGroup) {
        const selectedUsers = Array.from(
            document.querySelectorAll('.user-select-checkbox:checked')
        ).map(input => input.value);
        
        const count = selectedUsers.length;
        
        // Afficher le nombre de participants sélectionnés
        if (count === 0) {
            createBtn.innerHTML = '<i class="fas fa-users me-1"></i> Sélectionnez 2-5 participants';
        } else if (count === 1) {
            createBtn.innerHTML = '<i class="fas fa-users me-1"></i> Ajoutez 1 plus (max 5)';
        } else {
            createBtn.innerHTML = `<i class="fas fa-users me-1"></i> Continuer (${count}/5)`;
        }
        
        // Désactiver si: moins de 2 participants ou plus de 5.
        // Le bouton s'active dès que 2 à 5 participants sont sélectionnés.
        createBtn.disabled = count < 2 || count > 5;
    }
}

function updateAddParticipantsButton() {
    const selectedUsers = Array.from(
        document.querySelectorAll('#addUsersList .user-select-checkbox:checked')
    ).map(input => input.value);
    
    const confirmBtn = document.getElementById('confirmAddParticipantsBtn');
    if (confirmBtn) {
        confirmBtn.disabled = selectedUsers.length === 0;
    }
}

// Initialiser les listeners du modal de création de groupe
function initializeGroupCreationModal() {
    const modal = document.getElementById('newGroupModal');
    const overlay = document.getElementById('groupModalOverlay');
    const closeBtn = document.getElementById('closeGroupModalBtn');
    const cancelBtn = document.getElementById('cancelGroupModalBtn');
    const nameInput = document.getElementById('groupNameModalInput');
    const confirmBtn = document.getElementById('confirmGroupCreationBtn');
    
    // Fermer le modal
    const closeModal = () => {
        modal.style.display = 'none';
        overlay.style.display = 'none';
    };
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);
    
    // Valider en écoutant la saisie du nom
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            const groupName = nameInput.value.trim();
            confirmBtn.disabled = groupName.length === 0;
        });
    }
    
    // Soumettre la création du groupe
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            const groupName = nameInput.value.trim();
            if (!groupName) {
                showToast('Entrez un nom pour le groupe', 'warning');
                return;
            }
            
            // Récupérer les participants sélectionnés
            const selectedUsers = Array.from(
                document.querySelectorAll('.user-select-checkbox:checked')
            ).map(input => input.value);
            
            if (selectedUsers.length < 2 || selectedUsers.length > 5) {
                showToast('Sélectionnez entre 2 et 5 participants', 'warning');
                return;
            }
            
            // Créer la conversation
            await createNewConversationWithGroupName(groupName, selectedUsers);
            closeModal();
        });
    }
}

// Ouvrir le modal de création de groupe
async function openGroupCreationModal() {
    const modal = document.getElementById('newGroupModal');
    const overlay = document.getElementById('groupModalOverlay');
    const nameInput = document.getElementById('groupNameModalInput');
    const participantsContainer = document.getElementById('groupModalParticipants');
    const participantCount = document.getElementById('participantCount');
    const confirmBtn = document.getElementById('confirmGroupCreationBtn');
    
    // Récupérer les participants sélectionnés
    const selectedCheckboxes = document.querySelectorAll('.user-select-checkbox:checked');
    const selectedUsers = Array.from(selectedCheckboxes).map(input => input.value);
    
    if (selectedUsers.length < 2 || selectedUsers.length > 5) {
        showToast('Sélectionnez entre 2 et 5 participants', 'warning');
        return;
    }
    
    // Mettre à jour le compteur
    participantCount.textContent = selectedUsers.length;
    
    // Afficher les participants sélectionnés
    try {
        const session = await window.storage.getCurrentSessionDetails();
        const eventId = session?.data?.event?.id;
        const guests = eventId ? window.storage.getGuestsByEventId(eventId) : [];
        
        participantsContainer.innerHTML = selectedUsers.map(userId => {
            const guest = guests.find(g => g.id === userId);
            
            if (!guest) return '';
            
            const fullName = `${(guest.firstName || '')} ${(guest.lastName || '')}`.trim() || guest.email || 'Invité';
            const initials = (guest.firstName?.charAt(0) || '') + (guest.lastName?.charAt(0) || '') || fullName.charAt(0);
            const avatarImage = getGuestAvatarImage(guest);
            
            return `
                <div style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--hover-bg); border-radius: 8px;">
                    ${avatarImage ? `
                        <img src="${avatarImage}" alt="${fullName}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.style.display='none'">
                    ` : `
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--secura-red) 0%, var(--secura-accent) 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 12px; flex-shrink: 0;">
                            ${initials.toUpperCase()}
                        </div>
                    `}
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 14px; font-weight: 500; color: var(--text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fullName}</div>
                        <div style="font-size: 12px; color: var(--secura-medium-gray); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${guest.email || 'Sans email'}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Erreur affichage participants:', error);
    }
    
    // Réinitialiser et afficher
    nameInput.value = '';
    nameInput.focus();
    confirmBtn.disabled = true;
    
    modal.style.display = 'flex';
    overlay.style.display = 'block';
}

async function createNewConversationWithGroupName(groupName, selectedUsers) {
    try {
        // Récupérer l'événement actuel
        const session = await window.storage.getCurrentSessionDetails();
        if (!session?.success) throw new Error('Session invalide');
        
        const eventId = session.data.event?.id;
        if (!eventId) throw new Error('Aucun événement actif');
        
        // Créer la conversation via la méthode du storage
        const result = await window.storage.createConversation(
            eventId,
            groupName,
            selectedUsers
        );
        
        // Récupérer les résultats
        if (!result) throw new Error('Échec création conversation');
        
        // Ajouter la conversation à notre liste locale AVANT le reload
        conversations.push(result);
        
        // 📡 IMPORTANT: Émettre via WebSocket pour notifier les autres participants
        const allParticipantIds = [currentUser?.id, ...selectedUsers];
        if (chatSocket && chatSocket.connected) {
            console.log('📡 Émission conversation:created (groupe) via WebSocket', {
                conversationId: result.id,
                groupName,
                participantIds: allParticipantIds
            });
            
            chatSocket.emit('conversation:created', {
                conversationId: result.id,
                conversationData: result,
                participantIds: allParticipantIds
            });
        }
        
        // Recharger les conversations
        await loadConversations(eventId, true);
        
        // Fermer le panel
        closeConversationPanel();
        
        // Sélectionner la nouvelle conversation
        if (result && result.id) {
            selectConversation(result.id);
        }
        
        showToast('Groupe créé avec succès!', 'success');
        
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Impossible de créer le groupe', 'error');
    }
}

async function createNewConversation() {
    try {
        const isDirect = document.getElementById('typeDirect')?.checked;
        
        // Récupérer les participants sélectionnés
        let selectedUsers = [];
        
        if (isDirect) {
            // Pour chat direct: récupérer la carte sélectionnée
            const selectedCard = document.querySelector('.guest-card.selected');
            if (selectedCard) {
                selectedUsers = [selectedCard.getAttribute('data-guest-id')];
            }
        }
        
        // Validation
        if (isDirect && selectedUsers.length !== 1) {
            showToast('Sélectionnez un contact pour le chat direct', 'warning');
            return;
        }
        
        // Récupérer l'événement actuel
        const session = await window.storage.getCurrentSessionDetails();
        if (!session?.success) throw new Error('Session invalide');
        
        const eventId = session.data.event?.id;
        if (!eventId) throw new Error('Aucun événement actif');
        
        // Créer la conversation via la méthode du storage (chat direct)
        const result = await window.storage.createConversation(
            eventId,
            `Chat with participant`,
            selectedUsers
        );
        
        // Récupérer les résultats
        if (!result) throw new Error('Échec création conversation');
        
        // Ajouter la conversation à notre liste locale AVANT le reload
        conversations.push(result);
        
        // 📡 IMPORTANT: Émettre via WebSocket pour notifier les autres participants
        if (chatSocket && chatSocket.connected) {
            
            
            chatSocket.emit('conversation:created', {
                conversationId: result.id,
                conversationData: result,
                participantIds: [currentUser?.id, ...selectedUsers]
            });
        }
        
        // Recharger les conversations
        await loadConversations(eventId, true);
        
        // Fermer le panel
        closeConversationPanel();
        
        // Sélectionner la nouvelle conversation
        if (result && result.id) {
            selectConversation(result.id);
        }
        
        showToast('Chat direct créé avec succès!', 'success');
        
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Impossible de créer la conversation', 'error');
    }
}

// ==========================================
// GESTION DU POLLING ET WEBSOCKETS
// ==========================================

// Système de listeners en temps réel avancé
const realtimeListeners = {
    conversations: null,
    currentConversation: null,
    stopListeners() {
        if (this.conversations) clearInterval(this.conversations);
        if (this.currentConversation) clearInterval(this.currentConversation);
    }
};

function startPolling() {
    // Arrêter les anciens listeners
    realtimeListeners.stopListeners();
    
    // Variables de suivi pour détecter les changements
    let lastConversationHash = null;
    let lastMessageHash = null;
    let conversationUpdateQueue = [];
    let isProcessingUpdates = false;
    
    // Listener granulaire pour les conversations (toutes les 5 secondes au lieu de 30)
    realtimeListeners.conversations = setInterval(async () => {
        if (document.visibilityState !== 'visible') return;
        
        try {
            // Récupérer les conversations de manière légère
            const result = await window.storage.getConversations();
            if (!result?.success || !result?.data) return;
            
            const newConversations = result.data;
            
            // Créer un hash pour détecter les changements
            const currentHash = JSON.stringify(
                newConversations.map(c => ({ 
                    id: c.id, 
                    updatedAt: c.updatedAt,
                    lastMessageId: c.lastMessage?.id 
                }))
            );
            
            // Si rien n'a changé, ne pas traiter
            if (currentHash === lastConversationHash) return;
            
            lastConversationHash = currentHash;
            
            // Détecter les changements spécifiques
            const changes = detectConversationChanges(conversations, newConversations);
            
            if (changes.length > 0) {
                // Ajouter à la file d'attente
                conversationUpdateQueue.push(...changes);
                
                // Traiter les mises à jour de manière granulaire
                if (!isProcessingUpdates) {
                    await processConversationUpdates(newConversations, changes);
                }
            }
            
            // Mettre à jour la liste globale
            conversations = newConversations;
            
        } catch (error) {
            console.error('Erreur listener conversations:', error);
        }
    }, 5000); // Plus rapide pour une meilleure UX
    
    // Listener granulaire pour les messages de la conversation actuelle (2 secondes)
    realtimeListeners.currentConversation = setInterval(async () => {
        if (!currentConversationId || document.visibilityState !== 'visible') return;
        
        try {
            // Récupérer uniquement les nouveaux messages depuis le dernier connu
            const lastMessage = messages[messages.length - 1];
            const lastMessageTimestamp = lastMessage?.createdAt || 0;
            
            const result = await window.storage.getMessages(currentConversationId, {
                limit: 50,
                since: lastMessageTimestamp
            });
            
            if (!result?.success || !result?.data) return;
            const newMessages = result.data;
            
            if (newMessages.length > 0) {
                // Filtrer pour éviter les doublons
                const messageIds = new Set(messages.map(m => m.id));
                const uniqueNewMessages = newMessages.filter(m => !messageIds.has(m.id));
                
                if (uniqueNewMessages.length > 0) {
                    // Ajouter les messages
                    messages.push(...uniqueNewMessages);
                    
                    // Render avec animation
                    renderMessages(messages);
                    
                    // Scroll vers le bas avec animation smooth
                    scrollToBottomSmooth();
                    
                    // Trigger notification pour les messages entrants
                    const incomingMessages = uniqueNewMessages.filter(m => m.senderId !== currentUser?.id);
                    if (incomingMessages.length > 0) {
                        playMessageNotificationSound();
                    }
                }
            }
            
        } catch (error) {
            console.error('Erreur listener messages:', error);
        }
    }, 2000); // Plus rapide pour les messages
}

// Détecter les changements dans les conversations
function detectConversationChanges(oldConversations, newConversations) {
    const changes = [];
    const oldMap = new Map(oldConversations.map(c => [c.id, c]));
    const newMap = new Map(newConversations.map(c => [c.id, c]));
    
    // Détecter les nouvelles conversations
    for (const [id, newConv] of newMap) {
        if (!oldMap.has(id)) {
            changes.push({ type: 'new', conversation: newConv });
        } else {
            // Détecter les mises à jour
            const oldConv = oldMap.get(id);
            if (oldConv.updatedAt !== newConv.updatedAt) {
                changes.push({ type: 'updated', conversation: newConv, old: oldConv });
            }
        }
    }
    
    // Détecter les conversations supprimées
    for (const [id] of oldMap) {
        if (!newMap.has(id)) {
            changes.push({ type: 'deleted', conversationId: id });
        }
    }
    
    return changes;
}

// Traiter les mises à jour de conversations de manière granulaire
async function processConversationUpdates(allConversations, changes) {
    isProcessingUpdates = true;
    
    try {
        for (const change of changes) {
            if (change.type === 'new') {
                // Nouvelle conversation - la rendre avec animation
                renderConversationsList(allConversations);
                
                // Attendre que le DOM soit mis à jour
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Appliquer l'animation à la nouvelle conversation
                const newConvElement = document.querySelector(`[data-conversation-id="${change.conversation.id}"]`);
                if (newConvElement) {
                    newConvElement.classList.add('conversation-list-update');
                }
            } else if (change.type === 'updated') {
                // Conversation mise à jour - l'amener en haut avec smooth animation
                // Re-render la liste complète pour retrier
                renderConversationsList(allConversations);
                
                // Attendre que le DOM soit mis à jour
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Appliquer l'animation à la conversation mise à jour
                const updatedConvElement = document.querySelector(`[data-conversation-id="${change.conversation.id}"]`);
                if (updatedConvElement) {
                    updatedConvElement.classList.add('conversation-message-received');
                    
                    // Ajouter un indicateur si nouveau message d'un autre utilisateur
                    const lastMessage = change.conversation.lastMessage;
                    if (lastMessage && lastMessage.senderId !== currentUser?.id) {
                        // Pulser le badge de message non lu
                        const unreadBadge = updatedConvElement.querySelector('.conversation-unread-badge');
                        if (unreadBadge) {
                            unreadBadge.classList.add('pulse-badge');
                        }
                    }
                }
            } else if (change.type === 'deleted') {
                // Conversation supprimée - l'enlever avec animation
                const conversationElement = document.querySelector(`[data-conversation-id="${change.conversationId}"]`);
                if (conversationElement) {
                    conversationElement.style.animation = 'slideOut 0.3s ease-out forwards';
                    
                    // Attendre l'animation avant de supprimer
                    await new Promise(resolve => setTimeout(resolve, 300));
                    conversationElement.remove();
                }
            }
        }
    } finally {
        isProcessingUpdates = false;
    }
}

// Scroll vers le bas avec animation smooth (sans loader)
function scrollToBottomSmooth() {
    const messagesWrapper = document.getElementById('messagesWrapper');
    if (!messagesWrapper) return;
    
    // Utiliser requestAnimationFrame pour une animation fluide
    requestAnimationFrame(() => {
        messagesWrapper.scrollTo({
            top: messagesWrapper.scrollHeight,
            behavior: 'smooth'
        });
    });
}

function playMessageNotificationSound() {
    try {
        // Si vous avez un fichier audio
        const audio = new Audio('../assets/sounds/message-notification.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    } catch (error) {
        console.error('Erreur de lecture du son de notification:', error);
    }
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// ==========================================
// GESTION DE LA CONNEXION RÉSEAU
// ==========================================

function setupNetworkHandling() {
    // Surveiller les changements de connexion
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
    
    // Vérifier la connexion initiale
    if (navigator.onLine) {
        handleOnlineStatus();
    } else {
        handleOfflineStatus();
    }
}

function handleOnlineStatus() {
    isOnline = true;
    updateConnectionStatus();
    
    // 🔌 Tenter de se reconnecter aux WebSockets si nécessaire
    if (!chatSocket || !chatSocket.connected) {
        console.log('🔌 Reconnexion WebSocket...');
        initWebSocket();
    }
    
    // Synchroniser les données
    if (currentConversationId) {
        loadMessages(currentConversationId);
    }
    
    loadConversations(true);
}

function handleOfflineStatus() {
    isOnline = false;
    updateConnectionStatus();
    showToast('Vous êtes hors ligne', 'warning');
}

function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;
    
    if (isOnline) {
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Connecté';
        statusElement.className = 'connection-status connected';
    } else {
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Hors ligne';
        statusElement.className = 'connection-status disconnected';
    }
    
    // Afficher l'indicateur
    statusElement.classList.remove('hidden');
    
    // Masquer après 3 secondes si connecté
    if (isOnline) {
        setTimeout(() => {
            statusElement.classList.add('hidden');
        }, 3000);
    }
}


// ==========================================
// UTILITAIRES
// ==========================================

// Ouvrir le panel profil
function openProfilePanel() {
    if (!currentUser) {
        showToast('Utilisateur non connecté', 'error');
        return;
    }

    const panel = document.getElementById('profilePanel');
    const overlay = document.getElementById('profileSettingsOverlay');
    
    if (!panel || !overlay) return;

    // Remplir les infos du profil
    const fullName = `${(currentUser.firstName || '')} ${(currentUser.lastName || '')}`.trim() || currentUser.name || 'Utilisateur';
    const initials = (currentUser.firstName?.charAt(0) || '') + (currentUser.lastName?.charAt(0) || '') || 'U';
    const avatarImage = getAvatarImage(currentUser);
    
    // Mettre à jour l'avatar
    const profileAvatarLarge = document.getElementById('profileAvatarLarge');
    if (profileAvatarLarge) {
        if (avatarImage) {
            profileAvatarLarge.innerHTML = `<img src="${avatarImage}" alt="${escapeHtml(fullName)}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            profileAvatarLarge.innerHTML = initials.toUpperCase();
        }
    }

    // Mettre à jour les infos
    document.getElementById('profileName').textContent = fullName;
    document.getElementById('profileEmail').textContent = currentUser.email || 'Sans email';
    document.getElementById('detailName').textContent = fullName;
    document.getElementById('detailEmail').textContent = currentUser.email || '-';
    document.getElementById('detailPhone').textContent = currentUser.phone || '-';
    
    if (currentUser.createdAt) {
        const joinDate = new Date(currentUser.createdAt);
        document.getElementById('detailJoinDate').textContent = joinDate.toLocaleDateString('fr-FR');
    } else {
        document.getElementById('detailJoinDate').textContent = '-';
    }

    // Afficher le panel
    panel.classList.add('active');
    overlay.classList.add('active');

    // Event listeners pour le panel profil
    setupProfilePanelListeners();
}

// Ouvrir le panel paramètres
function openSettingsPanel() {
    const panel = document.getElementById('settingsPanel');
    const overlay = document.getElementById('profileSettingsOverlay');
    
    if (!panel || !overlay) return;

    // Afficher le panel
    panel.classList.add('active');
    overlay.classList.add('active');

    // Event listeners pour le panel paramètres
    setupSettingsPanelListeners();
}

// Event listeners pour le panel profil
function setupProfilePanelListeners() {
    // Fermer le panel
    document.getElementById('closeProfileBtn')?.addEventListener('click', closeProfilePanel);
    document.getElementById('backProfileBtn')?.addEventListener('click', closeProfilePanel);

    // Status selector
    document.querySelectorAll('.status-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const status = option.getAttribute('data-status');
            
            // Retirer la classe active de tous les options
            document.querySelectorAll('.status-option').forEach(opt => {
                opt.classList.remove('active');
            });
            
            // Ajouter la classe active à l'option sélectionnée
            option.classList.add('active');
            
            // Mettre à jour l'indicator et le texte
            const indicator = document.getElementById('profileStatusIndicator');
            const statusText = document.getElementById('profileStatusText');
            
            indicator.className = `status-indicator ${status}`;
            
            if (status === 'online') {
                statusText.textContent = 'En ligne';
            } else if (status === 'busy') {
                statusText.textContent = 'Occupé';
            } else if (status === 'away') {
                statusText.textContent = 'Absent';
            }
            
            showToast(`Statut: ${statusText.textContent}`, 'success');
        });
    });

    // Actions buttons
    document.getElementById('editProfileBtn')?.addEventListener('click', () => {
        showToast('Édition du profil bientôt disponible', 'info');
    });

    document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
        showToast('Changement du mot de passe bientôt disponible', 'info');
    });

    // Fermer en cliquant sur l'overlay
    document.getElementById('profileSettingsOverlay')?.addEventListener('click', closeProfilePanel);
}

// Mettre à jour le profil dans le menu mobile
function updateMobileMenuProfile() {
    if (!currentUser) return;

    const fullName = `${(currentUser.firstName || '')} ${(currentUser.lastName || '')}`.trim() || currentUser.name || 'Utilisateur';
    const initials = (currentUser.firstName?.charAt(0) || '') + (currentUser.lastName?.charAt(0) || '') || 'U';
    const avatarImage = getAvatarImage(currentUser);

    // Mettre à jour l'avatar
    const mobileMenuProfileAvatar = document.getElementById('mobileMenuProfileAvatar');
    if (mobileMenuProfileAvatar) {
        if (avatarImage) {
            mobileMenuProfileAvatar.innerHTML = `<img src="${avatarImage}" alt="${escapeHtml(fullName)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            mobileMenuProfileAvatar.textContent = initials.toUpperCase();
        }
    }
    const MenuProfileAvatar = document.getElementById('MenuProfileAvatar');
    if (MenuProfileAvatar) {
        if (avatarImage) {
            MenuProfileAvatar.innerHTML = `<img src="${avatarImage}" alt="${escapeHtml(fullName)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            MenuProfileAvatar.textContent = initials.toUpperCase();
        }
    }

    // Mettre à jour le nom
    const MenuProfileName = document.getElementById('MenuProfileName');
    if (MenuProfileName) {
        MenuProfileName.textContent = fullName;
    }
    const mobileMenuProfileName = document.getElementById('mobileMenuProfileName');
    if (mobileMenuProfileName) {
        mobileMenuProfileName.textContent = fullName;
    }
}

// Mettre à jour le bouton profil dans le footer
function updateProfileButton() {
    if (!currentUser) return;

    const fullName = `${(currentUser.firstName || '')} ${(currentUser.lastName || '')}`.trim() || currentUser.name || 'Utilisateur';
    const initials = (currentUser.firstName?.charAt(0) || '') + (currentUser.lastName?.charAt(0) || '') || 'U';
    const avatarImage = getAvatarImage(currentUser);
    const userStatus = currentUser.status || 'online'; // online, busy, away

    // Mettre à jour l'avatar
    const profileBtnAvatar = document.getElementById('profileBtnAvatar');
    if (profileBtnAvatar) {
        if (avatarImage) {
            profileBtnAvatar.innerHTML = `<img src="${avatarImage}" alt="${escapeHtml(fullName)}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            profileBtnAvatar.textContent = initials.toUpperCase();
        }
    }

    // Mettre à jour le nom
    const profileBtnName = document.getElementById('profileBtnName');
    if (profileBtnName) {
        profileBtnName.textContent = fullName;
    }

    // Mettre à jour le statut
    const profileBtnStatus = document.getElementById('profileBtnStatus');
    const statusDot = document.querySelector('.profile-btn-status .status-dot');
    
    if (profileBtnStatus) {
        if (userStatus === 'online') {
            profileBtnStatus.textContent = 'En ligne';
        } else if (userStatus === 'busy') {
            profileBtnStatus.textContent = 'Occupé';
        } else if (userStatus === 'away') {
            profileBtnStatus.textContent = 'Absent';
        } else {
            profileBtnStatus.textContent = 'En ligne';
        }
    }

    // Mettre à jour le point de couleur du statut
    if (statusDot) {
        statusDot.className = `status-dot ${userStatus}`;
    }
}

// Fermer le panel profil
function closeProfilePanel() {
    const panel = document.getElementById('profilePanel');
    const overlay = document.getElementById('profileSettingsOverlay');
    
    if (panel) panel.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

// Event listeners pour le panel paramètres
function setupSettingsPanelListeners() {
    // Fermer le panel
    document.getElementById('closeSettingsBtn')?.addEventListener('click', closeSettingsPanel);
    document.getElementById('backSettingsBtn')?.addEventListener('click', closeSettingsPanel);

    // Toggle switches
    document.querySelectorAll('.toggle-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const id = e.target.id;
            const isChecked = e.target.checked;
            
            // Stocker les préférences en localStorage
            localStorage.setItem(`setting_${id}`, isChecked);
            
            // Log pour debug
            console.log(`Paramètre ${id}: ${isChecked}`);
        });
    });

    // Theme selector
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            localStorage.setItem('theme', theme);
            
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else if (theme === 'light') {
                document.documentElement.setAttribute('data-theme', 'light');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            
            showToast(`Thème: ${theme}`, 'success');
        });
    }

    // Font size range
    const fontSizeRange = document.getElementById('fontSizeRange');
    const fontSizeValue = document.getElementById('fontSizeValue');
    
    if (fontSizeRange) {
        fontSizeRange.addEventListener('input', (e) => {
            const size = e.target.value;
            fontSizeValue.textContent = size + 'px';
            document.documentElement.style.fontSize = size + 'px';
            localStorage.setItem('fontSize', size);
        });
    }

    // Action buttons
    document.getElementById('clearCacheBtn')?.addEventListener('click', () => {
        if (confirm('Êtes-vous sûr de vouloir vider le cache?')) {
            localStorage.clear();
            showToast('Cache vidé avec succès', 'success');
        }
    });

    document.getElementById('downloadDataBtn')?.addEventListener('click', () => {
        showToast('Téléchargement des données bientôt disponible', 'info');
    });

    document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
        if (confirm('Êtes-vous ABSOLUMENT sûr? Cette action est irréversible!')) {
            showToast('Suppression du compte bientôt disponible', 'info');
        }
    });

    // Fermer en cliquant sur l'overlay
    document.getElementById('profileSettingsOverlay')?.addEventListener('click', closeSettingsPanel);
}

// Fermer le panel paramètres
function closeSettingsPanel() {
    const panel = document.getElementById('settingsPanel');
    const overlay = document.getElementById('profileSettingsOverlay');
    
    if (panel) panel.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

// ========================================
// GESTION DES ACTIONS SUR LES MESSAGES
// ========================================

function toggleMessageActions(event, messageId) {
    event.stopPropagation();
    
    // Assurer que messageId est bien une string
    if (typeof messageId !== 'string' || !messageId.trim()) {
        console.error('toggleMessageActions: invalid messageId', messageId);
        return;
    }
    
    const menu = document.getElementById(`actions-${messageId}`);
    const chevronBtn = event.target.closest('.btn-message-actions');
    if (!menu) {
        console.warn('Menu not found with ID:', `actions-${messageId}`);
        return;
    }
    
    const messageWrapper = menu.closest('.message-wrapper');
    const wasShown = menu.classList.contains('show');
    
    // Fermer tous les autres menus
    document.querySelectorAll('.message-actions-menu').forEach(m => {
        m.classList.remove('show');
        const btn = m.closest('.message-actions-dropdown')?.querySelector('.btn-message-actions');
        if (btn) {
            btn.classList.remove('open');
        }
        const wrapper = m.closest('.message-wrapper');
        if (wrapper) {
            wrapper.style.zIndex = 'auto';
        }
    });
    
    // Fermer les pickers emoji
    document.querySelectorAll('.emoji-reactions-picker').forEach(p => {
        p.classList.remove('show');
    });
    
    if (!wasShown) {
        menu.classList.add('show');
        if (chevronBtn) {
            chevronBtn.classList.add('open');
        }
        // Augmenter z-index du message-wrapper pour sortir du stacking context
        if (messageWrapper) {
            messageWrapper.style.zIndex = '9999';
        }
    } else {
        if (chevronBtn) {
            chevronBtn.classList.remove('open');
        }
    }
}

function editMessage(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.value = message.content;
        messageInput.focus();
        
        // Marquer qu'on est en édition
        messageInput.dataset.editingMessageId = messageId;
        
        // Ajouter un badge "Édition..."
        const inputContainer = messageInput.parentElement;
        if (!inputContainer.querySelector('.editing-badge')) {
            const badge = document.createElement('span');
            badge.className = 'editing-badge';
            badge.textContent = `Édition du message...`;
            inputContainer.appendChild(badge);
        }
    }
    
    // Fermer le menu
    const menu = document.getElementById(`actions-${messageId}`);
    if (menu) {
        menu.classList.remove('show');
        const wrapper = menu.closest('.message-wrapper');
        if (wrapper) wrapper.style.zIndex = 'auto';
    }
}



function replyToMessage(message) {
    if (!message) return;
    if (typeof message === 'string') {
        message = messages.find(m => m.id === message);
        if (!message) return;
    }
    
    // D'abord, enlever le marquage de tous les autres messages
    document.querySelectorAll('.message-being-replied').forEach(el => {
        el.classList.remove('message-being-replied');
    });
    
    // Marquer le nouveau message à répondre
    const messageWrapper = document.querySelector(`[data-message-id="${message.id}"]`);
    if (messageWrapper) {
        messageWrapper.classList.add('message-being-replied');
    }
    
    // Afficher la section de réponse dans le message-input-container
    const replyPreview = document.getElementById('replyPreview');
    if (replyPreview) {
        const sender = currentConversation?.participants?.find(p => p.userId === message.senderId);
        const senderName = sender?.name || sender?.email || 'Utilisateur';
        
        // Créer le contenu du preview
        let replyContent = message.content || '';
        if (message.type === 'image') {
            replyContent = '📷 Image';
            if (message.caption) replyContent += ` - ${message.caption}`;
        } else if (message.type === 'file') {
            replyContent = `📎 ${message.fileName || 'Fichier'}`;
        }
        
        replyPreview.innerHTML = `
            <div class="reply-preview-content">
                <div class="reply-info">
                    <span class="reply-sender">↳ ${escapeHtml(senderName)}</span>
                    <button onclick="cancelReply()" class="btn-cancel-reply" title="Annuler la réponse">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="reply-text">${escapeHtml(replyContent)}</div>
            </div>
        `;
        replyPreview.style.display = 'flex';
    }
    
    // Stocker le messageId à répondre
    document.getElementById('messageInput').dataset.replyToId = message.id;
    document.getElementById('messageInput').focus();
    
    console.log('📝 Reply to message:', message.id);
}

function cancelReply() {
    // Enlever le marquage du message
    document.querySelectorAll('.message-being-replied').forEach(el => {
        el.classList.remove('message-being-replied');
    });
    
    // Masquer le preview
    const replyPreview = document.getElementById('replyPreview');
    if (replyPreview) {
        replyPreview.style.display = 'none';
        replyPreview.innerHTML = '';
    }
    
    // Réinitialiser les données
    document.getElementById('messageInput').dataset.replyToId = '';
    
    console.log('❌ Reply cancelled');
}

// Wrapper pour copier le message par messageId
function copyMessageContent(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const textToCopy = message.content || '';
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            showToast('Message copié', 'success');
        })
        .catch(err => {
            console.error('Erreur copie:', err);
            showToast('Impossible de copier', 'error');
        });
    
    // Fermer le menu
    const menu = document.getElementById(`actions-${messageId}`);
    if (menu) menu.classList.remove('show');
}

// Wrapper pour transférer le message par messageId
function forwardMessageContent(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    // Ouvrir modal de transfert si la fonction existe
    if (typeof showForwardMessageModal === 'function') {
        showForwardMessageModal(message);
    } else {
        showToast('Fonction de transfert non disponible', 'info');
    }
    
    // Fermer le menu
    const menu = document.getElementById(`actions-${messageId}`);
    if (menu) menu.classList.remove('show');
}

// ========================================
// GESTION DES RÉACTIONS EMOJI
// ========================================
function toggleMessageEmojiPicker() {
    const container = document.getElementById('emojiPickerContainer');
    if (container) {
        container.classList.toggle('show');
    }
}

function toggleEmojiPicker(messageId) {
    const picker = document.getElementById(`emoji-picker-${messageId}`);
    
    if (!picker) {
        return;
    }
    
    picker.classList.toggle('show');
    
    // Fermer les autres pickers
    document.querySelectorAll('.emoji-reactions-picker').forEach(p => {
        if (p.id !== `emoji-picker-${messageId}`) {
            p.classList.remove('show');
        }
    });
    
    // Fermer les menus actions aussi
    document.querySelectorAll('.message-actions-menu').forEach(m => {
        m.classList.remove('show');
    });
}

// ⚠️ DUPLICATE REMOVED - See unified version above at line 7898

function cancelReply() {
    const replyPreview = document.getElementById('replyPreview');
    if (replyPreview) {
        replyPreview.style.display = 'none';
        replyPreview.innerHTML = '';
    }
    
    document.getElementById('messageInput').dataset.replyToId = '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ✅ Appliquer le filtre rapide sur les conversations
function applyConversationFilter(filterType) {
    const searchInput = document.getElementById('conversationsSearch');
    const searchTerm = searchInput?.value.toLowerCase().trim() || '';
    
    let filtered = conversations;
    
    // Appliquer le filtre rapide
    switch(filterType) {
        case 'all':
            // Afficher toutes les conversations
            filtered = conversations;
            break;
        case 'online':
            // Afficher uniquement les conversations avec des utilisateurs en ligne
            filtered = conversations.filter(conv => {
                if (!conv.participants || conv.participants.length === 0) return false;
                // Au moins un participant autre que l'utilisateur actuel est en ligne
                return conv.participants.some(p => 
                    p.userId !== currentUser?.id && p.isOnline === true
                );
            });
            break;
        case 'unread':
            // Afficher uniquement les conversations non lues
            filtered = conversations.filter(conv => (conv.unreadCount || 0) > 0);
            break;
        case 'direct':
            // Afficher uniquement les conversations directes
            filtered = conversations.filter(conv => conv.type === 'direct');
            break;
        case 'group':
            // Afficher uniquement les conversations de groupe
            filtered = conversations.filter(conv => conv.type === 'group');
            break;
        case 'archived':
            // Afficher uniquement les conversations archivées
            filtered = conversations.filter(conv => conv.archived === true);
            break;
        default:
            filtered = conversations;
    }
    
    // Appliquer aussi la recherche si elle existe
    if (searchTerm.length > 0) {
        filtered = filtered.filter(conversation => {
            let conversationName = conversation.name || '';
            if (conversation.type === 'direct' && conversation.participants) {
                const otherParticipants = conversation.participants.filter(p => p.userId !== currentUser?.id);
                if (otherParticipants.length > 0) {
                    const firstParticipant = otherParticipants[0];
                    conversationName = firstParticipant.name || firstParticipant.email || 'Utilisateur';
                }
            }
            
            const lastMessage = conversation.lastMessage || conversation.messages?.[conversation.messages?.length - 1];
            const lastMessageContent = lastMessage?.content || '';
            
            const participantsText = conversation.participants?.map(p => 
                p.name || p.email
            ).join(' ') || '';
            
            const searchText = (
                conversationName + ' ' + 
                lastMessageContent + ' ' + 
                participantsText
            ).toLowerCase();
            
            return searchText.includes(searchTerm);
        });
    }
    
    renderConversationsList(filtered);
}

function filterConversations() {
    const searchInput = document.getElementById('conversationsSearch');
    if (!searchInput) return;
    
    // Obtenir le filtre actuellement actif
    const activeFilter = document.querySelector('.filter-btn.active');
    const filterType = activeFilter?.dataset.filter || 'all';
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (searchTerm.length === 0) {
        applyConversationFilter(filterType);
        return;
    }
    
    // Appliquer le filtre courant et la recherche
    applyConversationFilter(filterType);
}

function closeEmojiPickerOutside(e) {
    const pickerContainer = document.getElementById('emojiPickerContainer');
    const emojiBtn = document.getElementById('emojiBtn');
    
    if (pickerContainer && 
        !pickerContainer.contains(e.target) && 
        !emojiBtn.contains(e.target)) {
        pickerContainer.classList.remove('show');
    }
}

// Afficher le skeleton loader pour conversations
function showSkeletonConversations() {
    const container = document.getElementById('conversationsList');
    if (!container) return;
    
    const skeletons = Array(6).fill(0).map(() => `
        <div class="skeleton-conversation">
            <div class="skeleton-conversation-avatar"></div>
            <div class="skeleton-conversation-content" style="flex: 1; width: 100%;">
                <div class="skeleton-conversation-name"></div>
                <div class="skeleton-conversation-preview"></div>
            </div>
            <div class="skeleton-conversation-time"></div>
        </div>
    `).join('');
    
    container.innerHTML = `<div class="skeleton-loader-container">${skeletons}</div>`;
}

// Afficher le skeleton loader pour messages
function showSkeletonMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    // Créer le wrapper des messages s'il n'existe pas
    let messagesWrapper = document.getElementById('messagesWrapper');
    if (!messagesWrapper) {
        messagesWrapper = document.createElement('div');
        messagesWrapper.id = 'messagesWrapper';
        messagesWrapper.style.display = 'flex';
        messagesWrapper.style.flexDirection = 'column';
        messagesWrapper.style.flex = '1';
        messagesWrapper.style.overflowY = 'auto';
        messagesWrapper.style.paddingBottom = '20px';
        container.appendChild(messagesWrapper);
    }
    
    // Générer les skeletons avec alternance incoming/outgoing
    const skeletons = Array(8).fill(0).map((_, i) => {
        const isOutgoing = i % 2 === 0;
        return `
            <div class="skeleton-message ${isOutgoing ? 'outgoing' : 'incoming'}">
                <div class="skeleton-message-avatar"></div>
                <div class="skeleton-message-content">
                    <div class="skeleton-message-bubble"></div>
                    <div class="skeleton-message-time"></div>
                </div>
            </div>
        `;
    }).join('');
    
    messagesWrapper.innerHTML = `<div class="skeleton-loader-container">${skeletons}</div>`;
}

// Version legacy pour compatibilité
function showLoader(type) {
    switch (type) {
        case 'conversations':
            showSkeletonConversations();
            break;
        case 'messages':
            showSkeletonMessages();
            break;
    }
}

function hideLoader(type) {
    // Les skeletons sont remplacés par le contenu réel, rien à faire
    // Cette fonction reste pour la compatibilité avec le code existant
}

function showToast(message, type = 'info') {
    const colors = {
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6'
    };
    
    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: colors[type] || colors.info,
        stopOnFocus: true,
    }).showToast();
}

function handleOutsideClick(e) {
    // Fermer le menu contextuel des messages
    const contextMenu = document.getElementById('messageContextMenu');
    if (contextMenu && contextMenu.style.display === 'block' && !contextMenu.contains(e.target)) {
        hideMessageContextMenu();
    }
    
    // Fermer le menu de réactions
    const reactionMenu = document.getElementById('reactionModal');
    if (reactionMenu && reactionMenu.style.display === 'flex' && !reactionMenu.contains(e.target)) {
        hideReactionMenu();
    }
    
    // Fermer le picker emoji
    const emojiPicker = document.getElementById('emojiPickerContainer');
    const emojiBtn = document.getElementById('emojiBtn');
    if (emojiPicker && emojiPicker.classList.contains('show') && 
        !emojiPicker.contains(e.target) && 
        (!emojiBtn || !emojiBtn.contains(e.target))) {
        emojiPicker.classList.remove('show');
    }
}

// ==========================================
// GESTION DU DÉFILEMENT INFINI
// ==========================================

function setupInfiniteScroll() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    messagesContainer.addEventListener('scroll', () => {
        // Ne charger que si on est en mode chat (pas en appel)
        if (currentCallState !== null) return;
        
        // Charger plus de messages quand l'utilisateur atteint le haut
        if (messagesContainer.scrollTop < 100 && messages.length > 0) {
            loadMoreMessages();
        }
    });
}

async function loadMoreMessages() {
    // Éviter les chargements multiples simultanés
    if (uploadInProgress || !currentConversationId) return;
    
    uploadInProgress = true;
    messagePage++;
    
    try {
        await loadMessages(currentConversationId, true);
    } catch (error) {
        console.error('Erreur lors du chargement des anciens messages:', error);
        messagePage--; // Revenir à la page précédente en cas d'erreur
    } finally {
        uploadInProgress = false;
    }
}

// ==========================================
// INITIALISATION FINALE
// ==========================================

// Ajouter les écouteurs d'événements finaux
document.addEventListener('DOMContentLoaded', () => {
    // Initialiser le défilement infini
    setupInfiniteScroll();
    
    // Bouton pour démarrer une nouvelle conversation
    document.getElementById('startNewConversationBtn')?.addEventListener('click', openConversationPanel);
    
    // Gestion de la visibilité de la page
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && currentConversationId) {
            // Marquer les messages comme lus quand l'utilisateur revient sur la page
            markConversationAsRead(currentConversationId);
        }
    });
    
    window.addEventListener('beforeunload', () => {
        emitStopTypingEvent();
    });
});

// ==========================================
// STYLES SUPPLEMENTAIRES
// ==========================================

const additionalStyles = `
    <style>
        /* Styles pour les avatars */
        .conversation-avatar-small {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        .user-avatar-small {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: var(--gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 0.8rem;
        }
        
        .chat-avatar-large {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: var(--gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 1.5rem;
        }
        
    </style>
`;

// Ajouter les styles supplémentaires au document
document.head.insertAdjacentHTML('beforeend', additionalStyles);

// ==========================================
// GESTION DE L'ÉTAT DE CONNEXION
// ==========================================

// Mettre à jour le statut de connexion
function updateConnectionStatus() {
    const indicator = document.getElementById('connectionIndicator');

    
    if (!indicator) return;
    
    if (isServerOnline) {
        indicator.classList.remove('offline');
        indicator.classList.add('online');
        indicator.textContent = ' En ligne';
        indicator.title = 'Serveur en ligne';
    } else {
        indicator.classList.remove('online');
        indicator.classList.add('offline');
        indicator.textContent = 'Hors ligne';
        indicator.title = 'Serveur indisponible';
    }
}

// Gestion de la fenêtre quand elle redevient active
window.addEventListener('focus', async () => {
    console.log('🔄 Page redevenue active - Tentative de synchronisation');
    if (!isServerOnline) {
        connectionRetryCount = 0;
        try {
            const sessionResult = await window.storage.getCurrentSessionDetails();
            if (sessionResult?.success) {
                isServerOnline = true;
                connectionRetryCount = 0;
                clearInterval(connectionRetryInterval);
                showConnectionStatus(true);
                await loadConversations(true);
                showToast('Serveur restauré - Données synchronisées', 'success');
            }
        } catch (error) {
            console.log('❌ Serveur toujours hors ligne');
        }
    }
});

// ==========================================
// GESTION DES PANNEAUX RESPONSIFS (Mobile)
// ==========================================

// Initialiser le panel conversations avec la bonne classe au chargement
function initializePanelStates() {
    const conversationsPanel = document.getElementById('conversationsPanel');
    const chatMain = document.getElementById('chatMain');
    
    if (window.innerWidth <= 768) {
        // Sur mobile: le panel conversations est visible par défaut
        if (conversationsPanel) {
            conversationsPanel.classList.add('visible');
            conversationsPanel.classList.remove('hidden');
        }
        
        // Le chat est caché par défaut
        if (chatMain) {
            chatMain.classList.remove('active', 'hidden');
        }
    }
}

// Ajouter un écouteur pour le resize window
window.addEventListener('resize', () => {
    const conversationsPanel = document.getElementById('conversationsPanel');
    const chatMain = document.getElementById('chatMain');
    
    if (window.innerWidth > 768) {
        // Sur grand écran: TOUJOURS montrer les deux (jamais fermer le panel)
        if (conversationsPanel) {
            conversationsPanel.classList.remove('visible', 'hidden');
            conversationsPanel.style.display = 'flex'; // S'assurer qu'il est visible
        }
        if (chatMain) {
            chatMain.classList.remove('active', 'hidden');
            chatMain.style.display = 'flex'; // S'assurer qu'il est visible
        }
    } else {
        // Sur mobile: adapter selon l'état (aucune action automatique, laisser le toggle décider)
        // Ne rien faire - laisser les classes visible/hidden décider
    }
});

// Gérer le clic sur le bouton toggle
const toggleConversationsBtn = document.getElementById('toggleConversationsBtn');
if (toggleConversationsBtn) {
    toggleConversationsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const conversationsPanel = document.getElementById('conversationsPanel');
        const chatMain = document.getElementById('chatMain');
        
        if (conversationsPanel && chatMain) {
            // Afficher le panel et masquer le chat
            conversationsPanel.classList.add('visible');
            conversationsPanel.classList.remove('hidden');
            
            chatMain.classList.remove('active');
            chatMain.classList.add('hidden');
        }
    });
}

// Initialiser les états des panneaux quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
    initializePanelStates();
});

// ==========================================
// 🎤 FONCTIONS D'APPELS (PLACEHOLDERS)
// ==========================================

/**
 * Système de gestion des états de vue
 * Gère les transitions fluides entre: conversation -> audio/vidéo -> conversation
 */

// Variables globales pour l'état des appels
let currentCallState = null; // 'audio' | 'video' | null
let callStartTime = null;

/**
 * Obtenir l'état actuel de la vue
 */
function getCurrentViewState() {
    const audioCallState = document.getElementById('audioCallState');
    const videoCallState = document.getElementById('videoCallState');
    const messagesWrapper = document.getElementById('messagesWrapper');
    
    if (audioCallState?.style.display !== 'none') return 'audio';
    if (videoCallState?.style.display !== 'none') return 'video';
    if (messagesWrapper?.style.display !== 'none') return 'chat';
    return null;
}

/**
 * Afficher une vue spécifique et masquer les autres
 */
function switchViewState(newState) {
    const audioCallState = document.getElementById('audioCallState');
    const videoCallState = document.getElementById('videoCallState');
    const messagesWrapper = document.getElementById('messagesWrapper');
    const noMessagesState = document.getElementById('noMessagesState');
    const noConversationSelected = document.getElementById('noConversationSelected');
    const chatInputArea = document.getElementById('chatInputArea');
    const messagesContainer = document.getElementById('messagesContainer');
    
    // D'abord masquer tout
    if (audioCallState) audioCallState.style.display = 'none';
    if (videoCallState) videoCallState.style.display = 'none';
    if (messagesWrapper) messagesWrapper.style.display = 'none';
    if (noMessagesState) noMessagesState.style.display = 'none';
    if (noConversationSelected) noConversationSelected.style.display = 'none';
    
    // Puis afficher l'état souhaité
    switch (newState) {
        case 'audio':
            if (audioCallState) {
                audioCallState.style.display = 'flex';
                currentCallState = 'audio';
            }
            // Désactiver le scroll (pas pointer-events, le container est parent!)
            if (messagesContainer) {
                messagesContainer.style.overflowY = 'hidden';
                messagesContainer.style.overflowX = 'hidden';
            }
            if (chatInputArea) chatInputArea.style.display = 'none';
            break;
            
        case 'video':
            if (videoCallState) {
                videoCallState.style.display = 'flex';
                currentCallState = 'video';
            }
            // Désactiver le scroll (pas pointer-events, le container est parent!)
            if (messagesContainer) {
                messagesContainer.style.overflowY = 'hidden';
                messagesContainer.style.overflowX = 'hidden';
            }
            if (chatInputArea) chatInputArea.style.display = 'none';
            break;
            
        case 'chat':
            // Réactiver le scroll
            if (messagesContainer) {
                messagesContainer.style.overflowY = 'auto';
                messagesContainer.style.overflowX = 'hidden';
            }
            // Afficher les messages ou le placeholder
            if (messagesWrapper) {
                messagesWrapper.style.display = 'flex';
                // Afficher le bon placeholder selon le contexte
                if (messages && messages.length === 0) {
                    if (noMessagesState) noMessagesState.style.display = 'flex';
                } else if (messagesWrapper.innerHTML.trim() === '') {
                    if (noMessagesState) noMessagesState.style.display = 'flex';
                }
            }
            if (chatInputArea) chatInputArea.style.display = 'flex';
            currentCallState = null;
            break;
            
        case 'empty':
            if (noConversationSelected) {
                noConversationSelected.style.display = 'flex';
            }
            if (chatInputArea) chatInputArea.style.display = 'none';
            if (messagesContainer) {
                messagesContainer.style.overflowY = 'auto';
                messagesContainer.style.overflowX = 'hidden';
            }
            currentCallState = null;
            break;
    }
}

/**
 * Démarrer un appel audio
 * Affiche l'interface d'appel audio et change l'état
 */
function startAudioCall() {
    if (!currentConversationId) return;

    const audioCallState = document.getElementById('audioCallState');
    
    switchViewState('audio');
    
    callStartTime = Date.now();
    
    if (audioCallState && currentConversation?.type === 'direct' && currentConversation?.participants) {
       
        const otherParticipant = currentConversation.participants.find(p => p.userId !== currentUser?.id);
    
        if (otherParticipant) {
            const callName = document.getElementById('callName');
            const callAvatar = document.getElementById('callAvatar');
            if (callName) callName.textContent = otherParticipant.name || otherParticipant.email;
            if (callAvatar) {
                const avatarUrl = getGuestAvatarImage(otherParticipant);
                callAvatar.innerHTML = avatarUrl 
                    ? `<img src="${avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
                    : `<i class="fas fa-user"></i>`;
            }
        }
    }
    
}

/**
 * Terminer l'appel audio et retourner à la conversation
 */
function endAudioCall() {
    currentCallState = null;
    callStartTime = null;
    switchViewState('chat');
    renderMessages(messages);
}

/**
 * Démarrer un appel vidéo
 */
function startVideoCall() {
    if (!currentConversationId) return;
    
    const videoCallState = document.getElementById('videoCallState');
    
    // Utiliser le nouveau système d'états
    switchViewState('video');
    
    // Initialiser l'appel
    callStartTime = Date.now();
    
    if (videoCallState && currentConversation?.type === 'direct' && currentConversation?.participants) {
        
        
        
        if (otherParticipant) {
            const callName = document.getElementById('videoCallName');
            const callAvatar = document.getElementById('videoCallAvatar');
            if (callName) callName.textContent = otherParticipant.name || otherParticipant.email;
            if (callAvatar) {
                const avatarUrl = getGuestAvatarImage(otherParticipant);
                callAvatar.innerHTML = avatarUrl 
                    ? `<img src="${avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
                    : `<i class="fas fa-user"></i>`;
            }
        }
    }
    
}

/**
 * Terminer l'appel vidéo et retourner à la conversation
 */
function endVideoCall() {
    currentCallState = null;
    callStartTime = null;
    switchViewState('chat');
    renderMessages(messages);
}

/**
 * Basculer le microphone en appel audio
 */
function toggleMute() {
    const btn = document.getElementById('muteBtn');
    if (!btn) return;
    
    btn.classList.toggle('active');
    const isMuted = btn.classList.contains('active');
    btn.innerHTML = isMuted 
        ? '<i class="fas fa-microphone-slash"></i>'
        : '<i class="fas fa-microphone"></i>';
    
    showToast(isMuted ? 'Microphone désactivé' : 'Microphone activé', 'info');
}

/**
 * Basculer le haut-parleur en appel audio
 */
function toggleSpeaker() {
    const btn = document.getElementById('speakerBtn');
    if (!btn) return;
    
    btn.classList.toggle('active');
    const isSpeaker = btn.classList.contains('active');
    btn.innerHTML = isSpeaker 
        ? '<i class="fas fa-volume-up"></i>'
        : '<i class="fas fa-volume-down"></i>';
    
    showToast(isSpeaker ? 'Haut-parleur activé' : 'Haut-parleur désactivé', 'info');
}

/**
 * Basculer le microphone en appel vidéo
 */
function toggleVideoMute() {
    const btn = document.getElementById('videoMuteBtn');
    if (!btn) return;
    
    btn.classList.toggle('active');
    const isMuted = btn.classList.contains('active');
    btn.innerHTML = isMuted 
        ? '<i class="fas fa-microphone-slash"></i>'
        : '<i class="fas fa-microphone"></i>';
    
    showToast(isMuted ? 'Microphone désactivé' : 'Microphone activé', 'info');
}

/**
 * Basculer la caméra en appel vidéo
 */
function toggleCamera() {
    const btn = document.getElementById('cameraBtn');
    if (!btn) return;
    
    btn.classList.toggle('active');
    const isCameraOff = btn.classList.contains('active');
    btn.innerHTML = isCameraOff 
        ? '<i class="fas fa-video-slash"></i>'
        : '<i class="fas fa-video"></i>';
    
    showToast(isCameraOff ? 'Caméra désactivée' : 'Caméra activée', 'info');
}

/**
 * Basculer le haut-parleur en appel vidéo
 */
function toggleVideoSpeaker() {
    const btn = document.getElementById('videoSpeakerBtn');
    if (!btn) return;
    
    btn.classList.toggle('active');
    const isSpeaker = btn.classList.contains('active');
    btn.innerHTML = isSpeaker 
        ? '<i class="fas fa-volume-up"></i>'
        : '<i class="fas fa-volume-down"></i>';
    
    showToast(isSpeaker ? 'Haut-parleur activé' : 'Haut-parleur désactivé', 'info');
}

/**
 * Fermer la conversation courante
 */
function closeConversation() {
    // Émettre l'événement leave si une conversation est active
    if (currentConversationId && chatSocket) {
        chatSocket.emit('conversation:leave', {
            conversationId: currentConversationId
        });
    }
    
    // Réinitialiser les données
    currentConversationId = null;
    currentConversation = null;
    messages = [];
    messagePage = 1;
    
    // Masquer le header et la zone de chat
    hideChatArea();
    
    // Re-appliquer le filtre actif
    filterConversations();
    renderConversationsList(conversations);
    
}

/**
 * Supprimer la conversation courante
 */
function showDeleteConversationDialog(conversationId) {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    
    // Déterminer le nom de la conversation
    let conversationName = conversation.name || 'Chat';
    if (conversation.type === 'direct' && conversation.participants) {
        const otherParticipants = conversation.participants.filter(p => p.userId !== currentUser?.id);
        if (otherParticipants.length > 0) {
            conversationName = otherParticipants[0].name || otherParticipants[0].email || 'Utilisateur';
        }
    }
    
    // Afficher la confirmation avec SweetAlert2
    Swal.fire({
        title: 'Supprimer cette conversation ?',
        html: `<p>Êtes-vous sûr de vouloir supprimer la conversation avec <strong>${escapeHtml(conversationName)}</strong> ?</p>
               <p style="margin-top: 12px; font-size: 0.9rem; color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Cette action est irréversible.</p>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Oui, supprimer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        didOpen: (modal) => {
            // Appliquer les styles du thème sombre
            modal.style.backgroundColor = 'var(--card-bg)';
            const title = modal.querySelector('.swal2-title');
            const content = modal.querySelector('.swal2-html-container');
            if (title) title.style.color = 'var(--text-color)';
            if (content) content.style.color = 'var(--text-color)';
        }
    }).then((result) => {
        if (result.isConfirmed) {
            deleteConversation(conversationId);
        }
    });
}

// Supprimer une conversation
async function deleteConversation(conversationId) {
    try {
        // Afficher le spinner
        Swal.fire({
            title: 'Suppression en cours...',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: async (modal) => {
                Swal.showLoading();
                
                try {
                    // Appeler l'API pour supprimer
                    const response = await fetch(
                        `${window.storage.API_URL}/chat/conversations/${conversationId}`,
                        {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${getAuthToken()}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    
                    if (!response.ok) {
                        throw new Error('Échec de la suppression');
                    }
                    
                    const result = await response.json();
                    
                    // ✅ Émettre l'événement WebSocket pour notifier tous les utilisateurs
                    if (chatSocket && chatSocket.connected) {
                        console.log('📡 WebSocket: Émission de la suppression de conversation...');
                        chatSocket.emit('conversation:deleted', {
                            conversationId,
                            deletedBy: currentUser?.id || 'anonymous',
                            timestamp: new Date()
                        });
                    }
                    
                    // Fermer la conversation localement
                    currentConversationId = null;
                    currentConversation = null;
                    messages = [];
                    messagePage = 1;
                    
                    // Recharger les conversations
                    await loadConversations(true);
                    
                    hideChatArea();
                    renderConversationsList(conversations);
                    
                    // Fermer le modal de confirmation
                    Swal.close();
                    
                } catch (error) {
                    console.error('❌ Erreur suppression conversation:', error);
                    Swal.close();
                    showToast('Impossible de supprimer la conversation', 'error');
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur suppression conversation:', error);
    }
}

// ==========================================
// EXPORT DES FONCTIONS PRINCIPALES
// ==========================================

// Exposer les fonctions principales pour le débogage
window.chatManager = {
    loadConversations,
    selectConversation,
    sendMessage,
    uploadFile,
    replyToMessage,
    addReaction,
    openConversationPanel,
    getCurrentConversation: () => currentConversation,
    getCurrentUser: () => currentUser,
    getMessages: () => messages,
    startAudioCall,
    startVideoCall,
    endAudioCall,
    endVideoCall,
    closeConversation,
    deleteConversation
};

console.log('Chat System Initialized Successfully!');
