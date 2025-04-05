// commands/antidelete.js
const antiDeleteEnabled = new Set(); // Tracks chats where anti-delete is enabled
const messageStore = new Map(); // Stores messages for retrieval

export default {
    name: 'antidelete',
    description: 'Toggles anti-delete feature for the current chat',
    execute: async (sock, msg, args) => {
        const chatId = msg.key.remoteJid;
        const sender = msg.key.remoteJid;

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

        // Store the message
        messageStore.set(message.key.id, {
            message: message.message,
            from: chatId,
            participant: message.key.participant || message.key.remoteJid,
            type: chatId.endsWith('@g.us') ? 'group' : 'private',
            timestamp: message.messageTimestamp || Date.now()
        });

        console.log(`Stored message ${message.key.id} from ${chatId}`);

        // Remove after 1 hour to manage memory
        setTimeout(() => {
            messageStore.delete(message.key.id);
            console.log(`Expired message ${message.key.id} removed from store`);
        }, 60 * 60 * 1000);
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
            let caption = `⚠️ *Anti-Delete Detection*\n\n`;
            if (isGroup) {
                caption += `• From: @${sender.split('@')[0]}\n`;
                caption += `• Chat: Group\n`;
            } else {
                caption += `• Chat: Private\n`;
            }
            caption += `• Action: Message Deleted\n`;
            caption += `• Time: ${new Date(deletedMessage.timestamp * 1000).toLocaleString()}\n\n`;
            caption += `*Original Message:*`;

            try {
                // Prepare the message to forward
                const forwardedMessage = { ...deletedMessage.message };

                // Send the deleted message back with context
                await sock.sendMessage(deletedMessage.from, {
                    text: caption,
                    mentions: isGroup ? [sender] : []
                });

                // Send the actual message content
                if (forwardedMessage.conversation) {
                    await sock.sendMessage(deletedMessage.from, { text: forwardedMessage.conversation });
                } else if (forwardedMessage.imageMessage) {
                    await sock.sendMessage(deletedMessage.from, {
                        image: forwardedMessage.imageMessage,
                        caption: forwardedMessage.imageMessage.caption || ''
                    });
                } else if (forwardedMessage.videoMessage) {
                    await sock.sendMessage(deletedMessage.from, {
                        video: forwardedMessage.videoMessage,
                        caption: forwardedMessage.videoMessage.caption || ''
                    });
                } else {
                    await sock.sendMessage(deletedMessage.from, { text: '[Unsupported message type]' });
                }

                console.log(`Reposted deleted message ${key.id} in ${deletedMessage.from}`);
                messageStore.delete(key.id);
            } catch (error) {
                console.error(`Error resending deleted message ${key.id}:`, error);
                await sock.sendMessage(deletedMessage.from, { text: `⚠️ Error reposting deleted message: ${error.message}` });
            }
        }
    });
}