export default {
    name: 'tagall',
    description: 'Tag members in the group with various options',
    usage: '.tagall [message] [--admins/-a] [--online/-o] [--limit/-l number] [--exclude/-e id1,id2]',
    category: 'GROUP',
    execute: async (sock, msg, args) => {
        try {
            const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
            const participants = groupMetadata.participants;
            
            // Check if sender is admin for admin-only groups
            const isAdminOnly = groupMetadata.announce === 'announcement';
            if (isAdminOnly) {
                const senderIsAdmin = participants.find(p => p.id === msg.key.participant)?.admin;
                if (!senderIsAdmin) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: '❌ This command can only be used by admins in this group.'
                    });
                    return;
                }
            }

            // Parse command arguments
            const options = {
                type: 'all', // all, admins, online
                message: 'Hey everyone! 👋', // Default message
                exclude: [], // Members to exclude
                limit: 50 // Maximum number of mentions
            };

            // Process arguments
            let messageArgs = [];
            for (let i = 0; i < args.length; i++) {
                const arg = args[i].toLowerCase();
                if (arg === '--admins' || arg === '-a') {
                    options.type = 'admins';
                } else if (arg === '--online' || arg === '-o') {
                    options.type = 'online';
                } else if (arg === '--limit' || arg === '-l') {
                    const limit = parseInt(args[i + 1]);
                    if (!isNaN(limit) && limit > 0) {
                        options.limit = Math.min(limit, 100); // Cap at 100 mentions
                        i++;
                    }
                } else if (arg === '--exclude' || arg === '-e') {
                    const excludeList = args[i + 1]?.split(',') || [];
                    options.exclude = excludeList.map(id => id.trim());
                    i++;
                } else {
                    messageArgs.push(args[i]);
                }
            }

            // Set message if provided
            if (messageArgs.length > 0) {
                options.message = messageArgs.join(' ');
            }

            // Filter members based on options
            let membersToTag = [];
            switch (options.type) {
                case 'admins':
                    membersToTag = participants
                        .filter(p => p.admin)
                        .map(p => p.id);
                    break;
                case 'online':
                    membersToTag = participants.map(p => p.id);
                    break;
                default:
                    membersToTag = participants.map(p => p.id);
            }

            // Apply exclusions
            membersToTag = membersToTag.filter(id => !options.exclude.includes(id));

            // Apply limit
            membersToTag = membersToTag.slice(0, options.limit);

            // Create ASCII art style message
            let tagMessage = `╭═══〘 💬 Message 〙═══⊷❍\n`;
            tagMessage += `┃ ${options.message}\n`;
            tagMessage += `╰═══════════════════⊷❍\n\n`;
            
            tagMessage += `╭═══〘 📱 Tagged Members 〙═══⊷❍\n┃\n`;
            
            // Add each member with appropriate emoji
            membersToTag.forEach((id) => {
                const member = participants.find(p => p.id === id);
                const contact = id.split('@')[0];
                if (member?.admin === 'superadmin') {
                    tagMessage += `┃ 🌟 @${contact}\n`;
                } else if (member?.admin) {
                    tagMessage += `┃ 👑 @${contact}\n`;
                } else {
                    tagMessage += `┃ 😊 @${contact}\n`;
                }
            });
            
            tagMessage += `┃\n┃ Total: ${membersToTag.length} members`;
            if (options.type !== 'all') {
                tagMessage += ` (${options.type})`;
            }
            tagMessage += `\n╰═══════════════════⊷❍`;

            // Send the message with mentions
            await sock.sendMessage(msg.key.remoteJid, {
                text: tagMessage,
                mentions: membersToTag
            });

            return `✅ Tagged ${membersToTag.length} members${options.type !== 'all' ? ` (${options.type})` : ''}`;

        } catch (error) {
            console.error('Tag command error:', error);
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Failed to tag members. Please try again later.'
            });
        }
    }
};