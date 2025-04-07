export default {
    name: 'mute',
    description: 'Mute a user in the group',
    usage: '@user <duration> [reason]',
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
            if (!msg.mentionedIds.length || !args[1]) {
                return '❌ Please mention the user and specify duration!\nUsage: .mute @user <duration> [reason]\nExample: .mute @user 1h spam';
            }

            const userToMute = msg.mentionedIds[0];
            const duration = args[1].toLowerCase();
            const reason = args.slice(2).join(' ') || 'No reason provided';

            // Parse duration
            let muteTime = 0;
            if (duration.endsWith('s')) muteTime = parseInt(duration) * 1000;
            else if (duration.endsWith('m')) muteTime = parseInt(duration) * 60 * 1000;
            else if (duration.endsWith('h')) muteTime = parseInt(duration) * 60 * 60 * 1000;
            else if (duration.endsWith('d')) muteTime = parseInt(duration) * 24 * 60 * 60 * 1000;
            else return '❌ Invalid duration format! Use s/m/h/d (seconds/minutes/hours/days)';

            if (isNaN(muteTime) || muteTime <= 0) {
                return '❌ Invalid duration! Please provide a valid number.';
            }

            // Check if user is admin
            const targetUser = await chat.participants.find(p => p.id._serialized === userToMute);
            if (targetUser.isAdmin || targetUser.isSuperAdmin) {
                return '❌ Cannot mute an admin!';
            }

            // Mute user
            await chat.setMessagesAdminsOnly(true);
            
            const replyText = `
╭━━━━━━━━━━━━━━━╮
┃    *USER MUTED*    
╰━━━━━━━━━━━━━━━╯

*👤 User*
▢ @${userToMute.split('@')[0]}

*⏱️ Duration*
▢ ${duration}

*📝 Reason*
▢ ${reason}

*👮 Muted by*
▢ @${msg.author.split('@')[0]}

╭━━━━━━━━━━━━━━━╮
┃ Group moderation by Minima Bot
╰━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(msg.key.remoteJid, {
                text: replyText,
                mentions: [userToMute, msg.author]
            });

            // Unmute after duration
            setTimeout(async () => {
                try {
                    await chat.setMessagesAdminsOnly(false);
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `@${userToMute.split('@')[0]} has been unmuted.`,
                        mentions: [userToMute]
                    });
                } catch (error) {
                    console.error('Error unmuting user:', error);
                }
            }, muteTime);
        } catch (error) {
            console.error('Error in mute command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while muting the user. Please try again later.' 
            });
        }
    },
}; 