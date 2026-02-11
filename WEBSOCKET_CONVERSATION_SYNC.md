# 🔄 Synchronisation des Conversations en Temps Réel via WebSocket

## Vue d'ensemble

Le système WebSocket met à jour automatiquement les listes de conversations de TOUS les utilisateurs concernés quand:
1. Une nouvelle conversation est créée
2. Un nouveau message est envoyé
3. Une conversation est supprimée

---

## 🚀 Architecture de Synchronisation

### Côté Serveur (backend/server.js)

#### 1. **Événement: `conversation:created`**

Quand une conversation est créée:

```javascript
// Frontend émet
chatSocket.emit('conversation:created', {
    conversationId,
    conversationData,
    participantIds: [userId1, userId2, ...] // ✅ IDs des participants
});

// Serveur reçoit et redistribue
socket.on('conversation:created', (data) => {
    // ... validation ...
    
    // Émettre à TOUS les utilisateurs du namespace /chat
    chatNamespace.emit('conversation:created', {
        conversationId,
        conversation,
        participantIds,
        createdBy: userId,
        createdAt: new Date()
    });
});
```

**Important:** Le serveur émet à TOUT le namespace, mais le frontend vérifie que l'utilisateur fait partie des `participantIds`.

#### 2. **Événement: `message:send`** (Amélioré)

Quand un message est envoyé:

```javascript
socket.on('message:send', (data) => {
    // ... traiter le message ...
    
    // Obtenir les IDs des participants de la conversation
    const participantIds = conversation.participants?.map(p => p.userId);
    
    // 1️⃣ Émettre aux utilisateurs DANS la conversation
    chatNamespace.to(`conv:${conversationId}`).emit('message:new', {...});
    
    // 2️⃣ Émettre à TOUS les participants pour mettre à jour la liste
    // (y compris ceux qui ne sont pas dans la conversation)
    chatNamespace.emit('conversation:message-received', {
        conversationId,
        senderId: userId,
        messagePreview,
        timestamp,
        participantIds,        // ✅ NEW
        lastMessage: messageObj // ✅ NEW - Message complet
    });
});
```

---

### Côté Frontend (welcome/event-chat.html)

#### 1. **Écouteur: `conversation:created`**

```javascript
chatSocket.on('conversation:created', (data) => {
    const { conversationId, conversation, participantIds, createdBy } = data;
    
    // ✅ Vérifier que JE suis un participant
    if (!participantIds?.includes(currentUser?.id) && createdBy !== currentUser?.id) {
        return; // Ignorer si ce n'est pas pour moi
    }
    
    // ✅ Ajouter la conversation à ma liste
    if (!conversations.find(c => c.id === conversationId)) {
        conversations.push(conversation);
        renderConversationsList(conversations);
        
        // Si c'est MOI qui l'ai créée, la sélectionner
        if (createdBy === currentUser?.id) {
            selectConversation(conversationId);
        }
    }
});
```

#### 2. **Écouteur: `conversation:updated`**

```javascript
chatSocket.on('conversation:updated', (data) => {
    const { conversationId, conversation, participantIds } = data;
    
    // ✅ Vérifier que JE suis un participant
    if (!participantIds?.includes(currentUser?.id)) {
        return;
    }
    
    // ✅ Mettre à jour la conversation dans ma liste
    const convIndex = conversations.findIndex(c => c.id === conversationId);
    if (convIndex !== -1) {
        conversations[convIndex] = {
            ...conversations[convIndex],
            ...conversation
        };
        renderConversationsList(conversations);
    }
});
```

#### 3. **Écouteur: `conversation:message-received`** (Amélioré)

```javascript
chatSocket.on('conversation:message-received', (data) => {
    const { conversationId, participantIds, lastMessage, timestamp } = data;
    
    // ✅ Vérifier que JE suis un participant
    if (participantIds && !participantIds.includes(currentUser?.id)) {
        return; // Ignorer si ce n'est pas pour moi
    }
    
    // ✅ Mettre à jour la conversation
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
        conv.lastMessage = lastMessage;
        conv.updatedAt = timestamp;
        
        // Réordonner et re-afficher
        conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        renderConversationsList(conversations);
    }
});
```

#### 4. **Fonction: `createNewConversation()`** (Améliorée)

```javascript
async function createNewConversation() {
    // ... créer la conversation ...
    
    const result = await window.storage.createConversation(...);
    
    // ✅ Ajouter à la liste locale AVANT le reload
    conversations.push(result);
    
    // 📡 Émettre via WebSocket AVANT le reload
    if (chatSocket && chatSocket.connected) {
        chatSocket.emit('conversation:created', {
            conversationId: result.id,
            conversationData: result,
            participantIds: [currentUser?.id, ...selectedUsers] // ✅ Inclure MOI
        });
    }
    
    // Recharger et sélectionner
    await loadConversations(eventId, true);
    selectConversation(result.id);
}
```

---

## 🔄 Flux de Synchronisation Complet

### Scénario 1: Joël crée une conversation avec Gervais

```
1. Joël crée conversation → LOCAL: conversations.push(newConv)
2. Joël émet: conversation:created {
     conversationId: "chat_xxx",
     participantIds: ["joël_id", "gervais_id"]
   }
3. SERVEUR reçoit et redistribue à TOUS les clients
4. Gervais reçoit l'événement
   ✅ Vérifie: "suis-je dans participantIds?" OUI
   ✅ Ajoute à sa liste: conversations.push(newConv)
   ✅ Affiche immédiatement: renderConversationsList()
```

### Scénario 2: Joël envoie un message à une conversation fermée

```
1. Joël envoie message → SERVEUR sauvegarde
2. SERVEUR charge la conversation et récupère participants
3. SERVEUR émet: conversation:message-received {
     conversationId: "chat_xxx",
     lastMessage: {...completo...},
     participantIds: ["joël_id", "gervais_id"]
   }
4. Gervais (conversation fermée) reçoit l'événement
   ✅ Vérifie: "suis-je dans participantIds?" OUI
   ✅ Trouve sa conversation et met à jour: conv.lastMessage = {...}
   ✅ Réaffiche sa liste: conversations.sort(...); renderConversationsList()
```

---

## 📊 Comparaison Avant/Après

| Aspect | Avant | Après |
|--------|--------|---------|
| **Création de conversation** | ❌ Reload nécessaire | ✅ Immédiat pour les participants |
| **Envoi de message** | ❌ Hors conversation = pas MAJ | ✅ MAJ même si conversation fermée |
| **Listes des utilisateurs** | ❌ Incohérent entre clients | ✅ Synchronisé en temps réel |
| **Participants sensibles** | ❌ Notifs pour tous | ✅ Filtrés par participantIds |
| **Performance** | Moyenne | ✅ Optimisée (no reload inutile) |

---

## 🔐 Sécurité

### Filtrage des Participants

✅ **Frontend vérifie:**
```javascript
if (!participantIds?.includes(currentUser?.id)) {
    return; // Ignorer les mises à jour pour d'autres
}
```

⚠️ **À ajouter côté serveur:** (Validation supplémentaire)
```javascript
// Vérifier que l'utilisateur qui reçoit l'événement est dans participantIds
// (prévient les abus si le frontend est compromis)
```

---

## 📋 Événements WebSocket

### Émis par le Frontend

1. **`conversation:created`** - Nouvelle conversation créée
2. **`conversation:updated`** - Conversation mise à jour
3. **`message:send`** - Nouveau message (existant, amélioré)

### Émis par le Serveur

1. **`conversation:created`** - Notification de création (BROADCAST)
2. **`conversation:updated`** - Notification de MAJ (BROADCAST)
3. **`conversation:message-received`** - Message reçu pour notification (BROADCAST)
4. **`message:new`** - Message reçu dans room (ROOM-specific)

---

## 🧪 Tests Manuels

### Test 1: Création de conversation
```
1. Ouvrir 2 onglets: Joël et Gervais
2. Joël crée conversation avec Gervais
3. ✅ Gervais voit immédiatement la conversation
4. ✅ Console log: "✨ WebSocket: Nouvelle conversation créée"
```

### Test 2: Message hors conversation
```
1. Ouvrir 2 onglets: Joël et Gervais
2. Gervais va dans une AUTRE conversation
3. Joël envoie un message dans conversation avec Gervais
4. ✅ La liste de Gervais se met à jour immédiatement
5. ✅ Le message s'affiche dans le preview
```

### Test 3: Filtrage des participants
```
1. Ouvrir 3 onglets: Joël, Gervais, Tiers
2. Joël crée conversation avec Gervais SEULEMENT
3. ✅ Joël voit la conversation
4. ✅ Gervais voit la conversation
5. ✅ Tiers ne voit PAS la conversation
```

---

## 🐛 Dépannage

| Problème | Solution |
|----------|----------|
| Conversation n'apparaît pas chez l'autre | Vérifier `participantIds` inclut l'utilisateur |
| Message n'update pas la liste | Vérifier `conversation:message-received` est reçu |
| Doublon de conversation | Vérifier `!conversations.find()` dans les écouteurs |
| WebSocket non connecté | Vérifier `chatSocket.connected` avant d'émettre |

---

## 📝 Notes Importantes

1. **`participantIds`** doit TOUJOURS inclure `currentUser?.id` pour les écouteurs frontendne pas filtrer accidentellement
2. **Reload** est toujours appelé après pour synchroniser les données serveur
3. **`lastMessage`** est maintenant le message COMPLET (inclut reactions, readBy, etc.)
4. **Ordre de tri** utilise `updatedAt` pour faire remonter les conversations actives

---

## 🚀 Améliorations Futures

- [ ] Ajouter validation côté serveur pour participantIds
- [ ] Implémenter room-specific updates (éviter broadcast global)
- [ ] Ajouter confirmation de réception côté frontend
- [ ] Optimiser pour conversations de groupe (plusieurs participants)

