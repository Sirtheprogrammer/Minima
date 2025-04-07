export default {
    name: 'prefix',
    description: 'Change the bot command prefix',
    usage: '<new_prefix>',
    async execute(sock, msg, args) {
        try {
            // Check if user is admin
            const chat = await msg.getChat();
            if (chat.isGroup) {
                const participant = await chat.participants.find(p => p.id._serialized === msg.author);
                if (!participant.isAdmin && !participant.isSuperAdmin) {
                    return '❌ This command can only be used by group admins!';
                }
            }

            if (!args.length) {
                return '❌ Please provide a new prefix!\nUsage: .prefix <new_prefix>';
            }

            const newPrefix = args[0];
            if (newPrefix.length > 2) {
                return '❌ Prefix must be 1-2 characters long!';
            }

            // Update prefix in bot settings
            global.prefix = newPrefix;

            const replyText = `
╭━━━━━━━━━━━━━━━╮
┃    *PREFIX UPDATED*    
╰━━━━━━━━━━━━━━━╯

*🔧 New Prefix*
▢ ${newPrefix}

*📝 Example*
▢ ${newPrefix}help
▢ ${newPrefix}ping
▢ ${newPrefix}info

*👤 Changed by*
▢ @${msg.author.split('@')[0]}

╭━━━━━━━━━━━━━━━╮
┃ Use ${newPrefix}help to see commands
╰━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(msg.key.remoteJid, {
                text: replyText,
                mentions: [msg.author]
            });
        } catch (error) {
            console.error('Error in prefix command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while changing the prefix. Please try again later.' 
            });
        }
    },
}; 