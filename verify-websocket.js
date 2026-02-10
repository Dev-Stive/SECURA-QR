#!/usr/bin/env node

/**
 * WebSocket Implementation Verification Script
 * Checks that all components are properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 SECURA-QR WebSocket Implementation Verification\n');
console.log('═'.repeat(60));

const checks = [];

// 1. Check backend/package.json for socket.io
console.log('\n[1] Checking backend dependencies...');
try {
    const packageJsonPath = path.join(__dirname, 'backend/package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (packageJson.dependencies['socket.io']) {
        checks.push({
            name: 'socket.io dependency',
            status: '✅ PASS',
            version: packageJson.dependencies['socket.io']
        });
    } else {
        checks.push({
            name: 'socket.io dependency',
            status: '❌ FAIL',
            message: 'socket.io not found in package.json'
        });
    }
} catch (err) {
    checks.push({
        name: 'socket.io dependency',
        status: '❌ ERROR',
        message: err.message
    });
}

// 2. Check backend/server.js for WebSocket setup
console.log('[2] Checking backend server configuration...');
try {
    const serverPath = path.join(__dirname, 'backend/server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    
    const wsChecks = {
        'require socket.io': serverContent.includes('require(\'socket.io\')'),
        'create http server': serverContent.includes('http.createServer(app)'),
        'chat namespace': serverContent.includes('io.of(\'/chat\')'),
        'connection handler': serverContent.includes('chatNamespace.on(\'connection\''),
        'message:send event': serverContent.includes('socket.on(\'message:send\''),
        'user sessions map': serverContent.includes('const userSessions = new Map'),
        'server.listen': serverContent.includes('server.listen(CONFIG.PORT')
    };
    
    const passCount = Object.values(wsChecks).filter(v => v).length;
    const totalCount = Object.keys(wsChecks).length;
    
    Object.entries(wsChecks).forEach(([check, passed]) => {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    });
    
    checks.push({
        name: 'Backend WebSocket configuration',
        status: passCount === totalCount ? '✅ PASS' : '⚠️  PARTIAL',
        details: `${passCount}/${totalCount} checks passed`
    });
    
} catch (err) {
    checks.push({
        name: 'Backend WebSocket configuration',
        status: '❌ ERROR',
        message: err.message
    });
}

// 3. Check frontend HTML for socket.io script
console.log('\n[3] Checking frontend dependencies...');
try {
    const htmlPath = path.join(__dirname, 'welcome/event-chat.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    const frontendChecks = {
        'socket.io CDN': htmlContent.includes('cdn.socket.io'),
        'chatSocket variable': htmlContent.includes('let chatSocket = null'),
        'initWebSocket function': htmlContent.includes('async function initWebSocket()'),
        'setupWebSocketListeners': htmlContent.includes('function setupWebSocketListeners()'),
        'message:new listener': htmlContent.includes('chatSocket.on(\'message:new\''),
        'connection listener': htmlContent.includes('chatSocket.on(\'connect\''),
        'sendMessageViaWebSocket': htmlContent.includes('function sendMessageViaWebSocket'),
        'notifyTyping': htmlContent.includes('function notifyTyping'),
        'joinConversationViaWebSocket': htmlContent.includes('function joinConversationViaWebSocket')
    };
    
    const passCount = Object.values(frontendChecks).filter(v => v).length;
    const totalCount = Object.keys(frontendChecks).length;
    
    Object.entries(frontendChecks).forEach(([check, passed]) => {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    });
    
    checks.push({
        name: 'Frontend WebSocket implementation',
        status: passCount === totalCount ? '✅ PASS' : '⚠️  PARTIAL',
        details: `${passCount}/${totalCount} checks passed`
    });
    
} catch (err) {
    checks.push({
        name: 'Frontend WebSocket implementation',
        status: '❌ ERROR',
        message: err.message
    });
}

// 4. Check storage.js for chat API methods
console.log('\n[4] Checking storage.js chat APIs...');
try {
    const storagePath = path.join(__dirname, 'js/storage.js');
    const storageContent = fs.readFileSync(storagePath, 'utf8');
    
    const storageChecks = {
        'getConversations': storageContent.includes('async getConversations('),
        'sendMessage': storageContent.includes('async sendMessage('),
        'getMessages': storageContent.includes('async getMessages('),
        'editMessage': storageContent.includes('async editMessage('),
        'deleteMessage': storageContent.includes('async deleteMessage('),
        'addReaction': storageContent.includes('async addReaction('),
        'markAsRead': storageContent.includes('async markAsRead(')
    };
    
    const passCount = Object.values(storageChecks).filter(v => v).length;
    const totalCount = Object.keys(storageChecks).length;
    
    Object.entries(storageChecks).forEach(([check, passed]) => {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    });
    
    checks.push({
        name: 'Storage.js chat APIs',
        status: passCount === totalCount ? '✅ PASS' : '⚠️  PARTIAL',
        details: `${passCount}/${totalCount} methods implemented`
    });
    
} catch (err) {
    checks.push({
        name: 'Storage.js chat APIs',
        status: '❌ ERROR',
        message: err.message
    });
}

// 5. Check backend REST endpoints
console.log('\n[5] Checking backend REST endpoints...');
try {
    const serverPath = path.join(__dirname, 'backend/server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    
    const endpointChecks = {
        'GET /api/chat/conversations': serverContent.includes('app.get(\'/api/chat/conversations\''),
        'POST /api/chat/conversations': serverContent.includes('app.post(\'/api/chat/conversations\''),
        'POST messages': serverContent.includes('/api/chat/conversations/:conversationId/messages'),
        'GET messages': serverContent.includes('GET /api/chat/conversations/:conversationId/messages'),
        'PUT message': serverContent.includes('PUT /api/chat/conversations/:conversationId/messages/:messageId'),
        'DELETE message': serverContent.includes('DELETE /api/chat/conversations/:conversationId/messages/:messageId'),
        'Reactions': serverContent.includes('/reaction')
    };
    
    const passCount = Object.values(endpointChecks).filter(v => v).length;
    const totalCount = Object.keys(endpointChecks).length;
    
    Object.entries(endpointChecks).forEach(([endpoint, implemented]) => {
        console.log(`   ${implemented ? '✅' : '❌'} ${endpoint}`);
    });
    
    checks.push({
        name: 'REST API endpoints',
        status: passCount === totalCount ? '✅ PASS' : '⚠️  PARTIAL',
        details: `${passCount}/${totalCount} endpoints implemented`
    });
    
} catch (err) {
    checks.push({
        name: 'REST API endpoints',
        status: '❌ ERROR',
        message: err.message
    });
}

// Summary
console.log('\n' + '═'.repeat(60));
console.log('\n📋 VERIFICATION SUMMARY\n');

const passedChecks = checks.filter(c => c.status.includes('PASS')).length;
const totalChecks = checks.length;

checks.forEach((check, index) => {
    console.log(`${index + 1}. ${check.name}`);
    console.log(`   Status: ${check.status}`);
    if (check.details) {
        console.log(`   Details: ${check.details}`);
    }
    if (check.message) {
        console.log(`   Message: ${check.message}`);
    }
    console.log('');
});

console.log('═'.repeat(60));
console.log(`\n✅ OVERALL: ${passedChecks}/${totalChecks} checks passed\n`);

if (passedChecks === totalChecks) {
    console.log('🎉 WebSocket implementation is complete and ready!\n');
    process.exit(0);
} else {
    console.log('⚠️  Some checks failed. Review the output above.\n');
    process.exit(1);
}
