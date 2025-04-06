// commands/antidelete.js
const antiDeleteEnabled = new Set(); // Tracks chats where anti-delete is enabled
const messageStore = new Map(); // Stores messages for retrieval
const config = {
    maxStorageTime: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    maxMessagesPerChat: 1000, // Maximum number of messages to store per chat
    notifyAdmins: true, // Whether to notify admins in groups
    includeMetadata: true, // Whether to include message metadata
    debug: false // Debug mode for logging
};

// Helper function to log debug messages
function debugLog(message) {
    if (config.debug) {
        console.log(`[AntiDelete Debug] ${message}`);
    }
}

// Helper function to get message type
function getMessageType(message) {
    if (message.conversation) return 'text';
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.audioMessage) return 'audio';
    if (message.documentMessage) return 'document';
    if (message.stickerMessage) return 'sticker';
    if (message.contactMessage) return 'contact';
    if (message.locationMessage) return 'location';
    if (message.extendedTextMessage) return 'extendedText';
    if (message.buttonsMessage) return 'buttons';
    if (message.templateMessage) return 'template';
    if (message.listMessage) return 'list';
    if (message.reactionMessage) return 'reaction';
    return 'unknown';
}

// Helper function to format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
}

// Helper function to clean up old messages
function cleanupOldMessages() {
    const now = Date.now();
    let deletedCount = 0;
    
    for (const [id, data] of messageStore.entries()) {
        if (now - data.timestamp > config.maxStorageTime) {
            messageStore.delete(id);
            deletedCount++;
        }
    }
    
    if (deletedCount > 0) {
        debugLog(`Cleaned up ${deletedCount} expired messages`);
    }
}

// Run cleanup every hour
setInterval(cleanupOldMessages, 60 * 60 * 1000);

export default {
    name: 'antidelete',
    description: 'Toggles anti-delete feature for the current chat',
    execute: async (sock, msg, args) => {
        const chatId = msg.key.remoteJid;
        const sender = msg.key.remoteJid;
        
        // Handle command arguments
        if (args.length > 0) {
            const subCommand = args[0].toLowerCase();
            
            if (subCommand === 'status') {
                const isEnabled = antiDeleteEnabled.has(chatId);
                const messageCount = Array.from(messageStore.values())
                    .filter(m => m.from === chatId).length;
                
                return `🔍 *Anti-Delete Status*\n\n` +
                       `• Enabled: ${isEnabled ? '✅ Yes' : '❌ No'}\n` +
                       `• Messages stored: ${messageCount}\n` +
                       `• Storage time: ${config.maxStorageTime / (60 * 60 * 1000)} hours\n` +
                       `• Max messages: ${config.maxMessagesPerChat}\n` +
                       `• Notify admins: ${config.notifyAdmins ? 'Yes' : 'No'}`;
            }
            
            if (subCommand === 'clear') {
                // Clear stored messages for this chat
                let deletedCount = 0;
                for (const [id, data] of messageStore.entries()) {
                    if (data.from === chatId) {
                        messageStore.delete(id);
                        deletedCount++;
                    }
                }
                
                return `🧹 Cleared ${deletedCount} stored messages for this chat.`;
            }
            
            if (subCommand === 'debug') {
                config.debug = !config.debug;
                return `Debug mode ${config.debug ? 'enabled' : 'disabled'}.`;
            }
        }

        // Toggle anti-delete for this chat
        if (antiDeleteEnabled.has(chatId)) {
            antiDeleteEnabled.delete(chatId);
            await sock.sendMessage(sender, { text: '✅ Anti-delete disabled for this chat.' });
            console.log(`Anti-delete disabled for ${chatId}`);
        } else {
            antiDeleteEnabled.add(chatId);
            await sock.sendMessage(sender, { text: '🔒 Anti-delete enabled for this chat. Deleted messages will be reposted.' });
            console.log(`Anti-delete enabled for ${chatId}`);
        }
    }
};

export function setupAntiDeleteListeners(sock) {
    // Listener for new messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        const chatId = message.key.remoteJid;

        if (!message?.message || !antiDeleteEnabled.has(chatId)) return;

        // Count messages for this chat
        const chatMessageCount = Array.from(messageStore.values())
            .filter(m => m.from === chatId).length;
            
        // If we've reached the limit, remove the oldest message for this chat
        if (chatMessageCount >= config.maxMessagesPerChat) {
            const oldestMessage = Array.from(messageStore.values())
                .filter(m => m.from === chatId)
                .sort((a, b) => a.timestamp - b.timestamp)[0];
                
            if (oldestMessage) {
                messageStore.delete(oldestMessage.id);
                debugLog(`Removed oldest message for ${chatId} due to storage limit`);
            }
        }

        // Store the message
        messageStore.set(message.key.id, {
            id: message.key.id,
            message: message.message,
            from: chatId,
            participant: message.key.participant || message.key.remoteJid,
            type: chatId.endsWith('@g.us') ? 'group' : 'private',
            timestamp: message.messageTimestamp || Date.now(),
            messageType: getMessageType(message.message)
        });

        debugLog(`Stored ${message.key.id} (${getMessageType(message.message)}) from ${chatId}`);

        // Remove after max storage time
        setTimeout(() => {
            if (messageStore.has(message.key.id)) {
                messageStore.delete(message.key.id);
                debugLog(`Expired message ${message.key.id} removed from store`);
            }
        }, config.maxStorageTime);
    });

    // Listener for message deletions
    sock.ev.on('messages.delete', async (update) => {
        const { keys } = update;
        if (!keys || keys.length === 0) return;

        for (const key of keys) {
            const deletedMessage = messageStore.get(key.id);
            if (!deletedMessage || !antiDeleteEnabled.has(deletedMessage.from)) continue;

            const isGroup = deletedMessage.type === 'group';
            const sender = deletedMessage.participant;
            const messageType = deletedMessage.messageType;
            
            let caption = `⚠️ *Anti-Delete Detection*\n\n`;
            if (isGroup) {
                caption += `• From: @${sender.split('@')[0]}\n`;
                caption += `• Chat: Group\n`;
            } else {
                caption += `• Chat: Private\n`;
            }
            caption += `• Type: ${messageType}\n`;
            caption += `• Time: ${formatTimestamp(deletedMessage.timestamp)}\n\n`;
            caption += `*Original Message:*`;

            try {
                // Prepare the message to forward
                const forwardedMessage = { ...deletedMessage.message };

                // Send the deleted message back with context
                await sock.sendMessage(deletedMessage.from, {
                    text: caption,
                    mentions: isGroup ? [sender] : []
                });

                // Send the actual message content based on type
                switch (messageType) {
                    case 'text':
                        await sock.sendMessage(deletedMessage.from, { text: forwardedMessage.conversation });
                        break;
                    case 'extendedText':
                        await sock.sendMessage(deletedMessage.from, { text: forwardedMessage.extendedTextMessage.text });
                        break;
                    case 'image':
                        await sock.sendMessage(deletedMessage.from, {
                            image: forwardedMessage.imageMessage,
                            caption: forwardedMessage.imageMessage.caption || ''
                        });
                        break;
                    case 'video':
                        await sock.sendMessage(deletedMessage.from, {
                            video: forwardedMessage.videoMessage,
                            caption: forwardedMessage.videoMessage.caption || ''
                        });
                        break;
                    case 'audio':
                        await sock.sendMessage(deletedMessage.from, {
                            audio: forwardedMessage.audioMessage
                        });
                        break;
                    case 'document':
                        await sock.sendMessage(deletedMessage.from, {
                            document: forwardedMessage.documentMessage
                        });
                        break;
                    case 'sticker':
                        await sock.sendMessage(deletedMessage.from, {
                            sticker: forwardedMessage.stickerMessage
                        });
                        break;
                    case 'contact':
                        await sock.sendMessage(deletedMessage.from, {
                            contacts: [forwardedMessage.contactMessage]
                        });
                        break;
                    case 'location':
                        await sock.sendMessage(deletedMessage.from, {
                            location: forwardedMessage.locationMessage
                        });
                        break;
                    case 'buttons':
                    case 'template':
                    case 'list':
                        // These message types can't be directly resent, so we'll send a text representation
                        await sock.sendMessage(deletedMessage.from, { 
                            text: `[${messageType.toUpperCase()} message that was deleted]` 
                        });
                        break;
                    case 'reaction':
                        await sock.sendMessage(deletedMessage.from, { 
                            text: `[Reaction: ${forwardedMessage.reactionMessage?.text || 'unknown'}]` 
                        });
                        break;
                    default:
                        await sock.sendMessage(deletedMessage.from, { text: '[Unsupported message type]' });
                }

                console.log(`Reposted deleted ${messageType} message ${key.id} in ${deletedMessage.from}`);
                messageStore.delete(key.id);
            } catch (error) {
                console.error(`Error resending deleted message ${key.id}:`, error);
                await sock.sendMessage(deletedMessage.from, { text: `⚠️ Error reposting deleted message: ${error.message}` });
            }
        }
    });
}