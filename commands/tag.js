export default {
    name: 'tag',
    description: 'Tag multiple users with a message',
    usage: '.tag [message]',
    category: 'GROUP',
    async execute(client, msg, args) {
        try {
            // Get the chat
            const chat = await msg.getChat();
            
            // Get all participants in the group
            const participants = chat.participants || [];
            
            // Create the ASCII art style message
            let tagMessage = `╭═══〘 📢 Tag All 〙═══⊷❍\n┃\n`;
            
            // Add each participant with emoji and formatting
            participants.forEach((participant) => {
                const number = participant.id.split('@')[0];
                tagMessage += `┃ 😊 @${number}\n`;
            });
            
            // Add message if provided
            if (args.length > 0) {
                tagMessage += `┃\n┃ 💬 Message: ${args.join(' ')}\n`;
            }
            
            // Close the ASCII box
            tagMessage += `┃\n╰═══════════════════⊷❍`;

            // Send the message with mentions
            await client.sendMessage(msg.from, {
                text: tagMessage,
                mentions: participants.map(p => p.id)
            });

        } catch (error) {
            console.error('Error in tag command:', error);
            await client.sendMessage(msg.from, {
                text: '❌ Error executing tag command. Make sure this is a group chat.'
            });
        }
    }
}; 