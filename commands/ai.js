import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini Pro
const genAI = new GoogleGenerativeAI('AIzaSyDwsSu3DsBS-UVjGL9q8pXEj6-RAoAnIjc');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Chat history for context
const chatHistory = new Map();

export default {
    name: 'ai',
    description: 'Chat with Gemini AI',
    usage: '<message>',
    async execute(sock, msg, args) {
        try {
            if (!args.length) {
                return '❌ Please provide a message!\nUsage: .ai <your message>';
            }

            const userMessage = args.join(' ');
            const chatId = msg.key.remoteJid;

            // Get or create chat history
            if (!chatHistory.has(chatId)) {
                chatHistory.set(chatId, model.startChat({
                    history: [],
                    generationConfig: {
                        maxOutputTokens: 1000,
                        temperature: 0.9,
                        topP: 0.8,
                        topK: 40,
                    },
                }));
            }

            const chat = chatHistory.get(chatId);

            // Show typing indicator
            const chatObj = await msg.getChat();
            await chatObj.sendStateTyping();

            // Get AI response
            const result = await chat.sendMessage(userMessage);
            const response = result.response.text();

            // Format the response
            const replyText = `
╭━━━━━━━━━━━━━━━╮
┃    *AI RESPONSE*    
╰━━━━━━━━━━━━━━━╯

*💭 Your Message*
▢ ${userMessage}

*🤖 AI Response*
${response}

╭━━━━━━━━━━━━━━━╮
┃ Powered by Gemini Pro
╰━━━━━━━━━━━━━━━╯`;

            // Clear typing state
            await chatObj.clearState();

            // Send response
            await sock.sendMessage(msg.key.remoteJid, {
                image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                caption: replyText
            });

            // Clear chat history if it gets too long (prevent token limit issues)
            if (chat.history.length > 10) {
                chatHistory.delete(chatId);
            }
        } catch (error) {
            console.error('Error in AI command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while processing your request. Please try again later.' 
            });
        }
    },

    // Helper function to reset chat history
    resetChat(chatId) {
        chatHistory.delete(chatId);
    }
}; 