import ai from './ai.js';

export default {
    name: 'aireset',
    description: 'Reset AI chat history',
    async execute(sock, msg) {
        try {
            const chatId = msg.key.remoteJid;
            ai.resetChat(chatId);

            const replyText = `
╭━━━━━━━━━━━━━━━╮
┃    *AI CHAT RESET*    
╰━━━━━━━━━━━━━━━╯

✅ AI chat history has been reset.
You can start a fresh conversation with .ai

╭━━━━━━━━━━━━━━━╮
┃ Powered by Gemini Pro
╰━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(msg.key.remoteJid, {
                image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                caption: replyText
            });
        } catch (error) {
            console.error('Error in aireset command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while resetting the chat. Please try again later.' 
            });
        }
    },
}; 