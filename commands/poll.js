export default {
    name: 'poll',
    description: 'Create a poll in the group',
    usage: '<question> | <option1> | <option2> | [option3] ...',
    async execute(sock, msg, args) {
        try {
            // Check if it's a group chat
            const chat = await msg.getChat();
            if (!chat.isGroup) {
                return '❌ This command can only be used in groups!';
            }

            // Get poll data
            const pollData = args.join(' ').split('|').map(item => item.trim());
            
            if (pollData.length < 3) {
                return '❌ Please provide a question and at least 2 options!\nUsage: .poll Question | Option1 | Option2 | [Option3]';
            }

            const question = pollData[0];
            const options = pollData.slice(1);

            if (options.length > 12) {
                return '❌ Maximum 12 options allowed!';
            }

            // Create poll message
            const replyText = `
╭━━━━━━━━━━━━━━━╮
┃    *POLL CREATED*    
╰━━━━━━━━━━━━━━━╯

*📊 Question*
▢ ${question}

*🔍 Options*
${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

*👤 Created by*
▢ @${msg.author.split('@')[0]}

╭━━━━━━━━━━━━━━━╮
┃ React with numbers to vote!
╰━━━━━━━━━━━━━━━╯`;

            // Send poll message
            const pollMessage = await sock.sendMessage(msg.key.remoteJid, {
                text: replyText,
                mentions: [msg.author]
            });

            // Add number reactions for voting
            const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '⓫', '⓬'];
            for (let i = 0; i < options.length; i++) {
                await sock.sendMessage(msg.key.remoteJid, {
                    react: {
                        text: numbers[i],
                        key: pollMessage.key
                    }
                });
                // Add small delay between reactions
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.error('Error in poll command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while creating the poll. Please try again later.' 
            });
        }
    },
}; 