export default {
    name: 'ban',
    description: 'Ban a user from the group',
    usage: '@user [reason]',
    async execute(sock, msg, args) {
        try {
            // Check if it's a group chat
            const chat = await msg.getChat();
            if (!chat.isGroup) {
                return '❌ This command can only be used in groups!';
            }

            // Check if sender is admin
            const participant = await chat.participants.find(p => p.id._serialized === msg.author);
            if (!participant.isAdmin && !participant.isSuperAdmin) {
                return '❌ This command can only be used by group admins!';
            }

            // Check if user is mentioned
            if (!msg.mentionedIds.length) {
                return '❌ Please mention the user you want to ban!\nUsage: .ban @user [reason]';
            }

            const userToBan = msg.mentionedIds[0];
            const reason = args.slice(1).join(' ') || 'No reason provided';

            // Check if user is admin
            const targetUser = await chat.participants.find(p => p.id._serialized === userToBan);
            if (targetUser.isAdmin || targetUser.isSuperAdmin) {
                return '❌ Cannot ban an admin!';
            }

            // Ban user
            await chat.removeParticipants([userToBan]);

            const replyText = `
╭━━━━━━━━━━━━━━━╮
┃    *USER BANNED*    
╰━━━━━━━━━━━━━━━╯

*👤 User*
▢ @${userToBan.split('@')[0]}

*📝 Reason*
▢ ${reason}

*👮 Banned by*
▢ @${msg.author.split('@')[0]}

╭━━━━━━━━━━━━━━━╮
┃ Group moderation by Minima Bot
╰━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(msg.key.remoteJid, {
                text: replyText,
                mentions: [userToBan, msg.author]
            });
        } catch (error) {
            console.error('Error in ban command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while banning the user. Please try again later.' 
            });
        }
    },
}; 