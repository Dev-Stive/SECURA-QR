# Guide de Débogage du Problème de Typing Indicator

## Problème Identifié
Le typing indicator affiche le mauvais nom. Par exemple, quand M. Gervais écrit à M. Joël, cela affiche "M. Joël est en train d'écrire" au lieu de "M. Gervais est en train d'écrire".

## Causes Possibles

1. **WebSocket envoie le mauvais userId**
   - Vérifier que le serveur envoie bien l'ID du participant qui tape
   - Pas l'ID du destinataire (receiver)

2. **Mismatch entre userId du participant et celui envoyé par WebSocket**
   - Les participants peuvent avoir des IDs différents
   - Vérifier que le format des IDs correspond (UUID, numérique, string)

3. **La recherche du participant échoue**
   - Le participant n'est pas présent dans les arrays cherchés
   - L'ID n'existe dans aucune des 3 sources de recherche

## Comment Déboguer

### Étape 1: Ouvrir la console du navigateur (F12)
Aller dans l'onglet "Console" et activer les logs en direct

### Étape 2: Reproductif
Quand M. Gervais écrit à M. Joël, vous verrez plusieurs logs:

```
🔊 WebSocket typing event: {
    typingUserId: "...",
    conversationId: "...",
    isTyping: true,
    currentUserId: "...",
    currentConversationId: "..."
}

📝 Typing - Found: "..." (...) {
    searchLocations: [...],
    foundUser: {...},
    conversationId: "...",
    currentUserId: "..."
}
```

### Étape 3: Analyser les logs

Cherchez les propriétés suivantes:

**Dans le premier log (WebSocket):**
- `typingUserId`: L'ID du participant qui tape SELON LE SERVEUR
  - **SI C'EST L'ID DE JOËL** → Le serveur envoie le mauvais ID ❌
  - **SI C'EST L'ID DE GERVAIS** → Correct ✅

**Dans le deuxième log (Found):**
- `searchLocations`: Où nous avons trouvé le participant
  - `currentConversation` = Trouvé dans la conversation actuelle
  - `targetConversation(...)` = Trouvé dans la conversation ciblée
  - `allConversations(...)` = Trouvé en cherchant partout
- `foundUser.userId`: Doit correspondre à `typingUserId` du log précédent

### Étape 4: Identifier le Problème

| Symptôme | Cause Probable | Solution |
|----------|---|---|
| `typingUserId` = ID de Joël mais log dit "Gervais" | WebSocket envoie ID du destinataire | Corriger le serveur |
| `searchLocations` est vide (pas trouvé) | Participant n'existe pas dans notre liste | Vérifier données du participant |
| `foundUser.userId` ≠ `typingUserId` | Mismatch d'ID (format différent) | Normaliser les formats d'ID |
| Correct dans les logs mais mauvais affiché | Bug d'affichage en DOM | Vérifier le sélecteur `#typingText` |

## Code de Vérification du Serveur

Dans votre backend, cherchez où vous envoyez l'événement `message:typing`:

```javascript
// ❌ MAUVAIS - envoie l'ID du destinataire
socket.emit('message:typing', {
    userId: message.receiverId,  // ← ERREUR
    conversationId,
    isTyping: true
});

// ✅ BON - envoie l'ID de celui qui tape
socket.emit('message:typing', {
    userId: socket.userId,  // ou message.senderId
    conversationId,
    isTyping: true
});
```

## Test Rapide

Pour vérifier que l'affichage fonctionne, dans la console:

```javascript
// Simuler un typing indicator pour tester l'affichage
showTypingIndicator('conversationId', 'userId');
// Devrait afficher le nom du participant avec cet userId
```

## Variables de Débogage en Direct

Dans la console, vous pouvez aussi vérifier:

```javascript
// Voir l'utilisateur actuel
console.log('currentUser:', currentUser);

// Voir les conversations chargées
console.log('conversations:', conversations);

// Vérifier un participant spécifique
const foundParticipant = conversations
    .flatMap(c => c.participants || [])
    .find(p => p.userId === 'USERID_A_TESTER');
console.log('Found participant:', foundParticipant);
```

## Fichiers Modifiés

- [welcome/event-chat.html](welcome/event-chat.html#L5845) - WebSocket handler avec console.log
- [welcome/event-chat.html](welcome/event-chat.html#L5993) - showTypingIndicator() avec debug détaillé
- [welcome/event-chat.html](welcome/event-chat.html#L6960) - Affichage de l'icône de statut dans le preview
