import { requireOwner } from '../utils/permissions.js';

export default {
    name: 'broadcast',
    description: 'Broadcast a message to all chats (Owner only)',
    usage: '.broadcast <message>',
    category: 'OWNER',
    async execute(sock, msg, args) {
        return requireOwner(sock, msg, async () => {
            try {
                if (!args.length) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: '❌ Please provide a message to broadcast!'
                    });
                    return;
                }

                const message = args.join(' ');
                const chats = await sock.getChats();
                let successCount = 0;
                let failCount = 0;

                for (const chat of chats) {
                    try {
                        await sock.sendMessage(chat.id._serialized, {
                            text: `📢 *Broadcast Message*\n\n${message}\n\n_- Bot Owner_`
                        });
                        successCount++;
                    } catch (error) {
                        console.error(`Failed to send broadcast to ${chat.id._serialized}:`, error);
                        failCount++;
                    }
                }

                await sock.sendMessage(msg.key.remoteJid, {
                    text: `✅ Broadcast completed!\n\n📨 Sent to: ${successCount} chats\n❌ Failed: ${failCount} chats`
                });
            } catch (error) {
                console.error('Error in broadcast command:', error);
                await sock.sendMessage(msg.key.remoteJid, {
                    text: '❌ An error occurred while broadcasting the message.'
                });
            }
        });
    }
}; 