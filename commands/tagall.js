export default {
    name: 'tagall',
    description: 'Tag members in the group with various options',
    execute: async (sock, msg, args) => {
        try {
            const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
            const participants = groupMetadata.participants;
            const groupMembers = participants.map(p => p.id);
            
            // Get group settings
            const groupSettings = await sock.groupMetadata(msg.key.remoteJid);
            const isAdminOnly = groupSettings.announce === 'announcement';
            
            // Check if sender is admin for admin-only groups
            if (isAdminOnly) {
                const senderIsAdmin = participants.find(p => p.id === msg.key.participant)?.admin;
                if (!senderIsAdmin) {
                    return '❌ This command can only be used by admins in this group.';
                }
            }

            // Parse command arguments
            const options = {
                type: 'all', // all, admins, online
                message: args.join(' ') || 'Hey everyone! 👋',
                exclude: [], // Members to exclude
                limit: 50 // Maximum number of mentions
            };

            // Process arguments
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
                }
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
                    // Note: This is an approximation as we can't reliably get online status
                    membersToTag = groupMembers;
                    break;
                default:
                    membersToTag = groupMembers;
            }

            // Apply exclusions
            membersToTag = membersToTag.filter(id => !options.exclude.includes(id));

            // Apply limit
            membersToTag = membersToTag.slice(0, options.limit);

            // Format the message with mentions
            const mentions = membersToTag.map(id => ({
                tag: `@${id.split('@')[0]}`,
                id: id
            }));

            // Create the message with mentions
            const message = {
                text: options.message,
                mentions: mentions
            };

            // Send the message
            await sock.sendMessage(msg.key.remoteJid, message);

            // Return success message
            return `✅ Tagged ${membersToTag.length} members${options.type !== 'all' ? ` (${options.type})` : ''}`;

        } catch (error) {
            console.error('Tag command error:', error);
            return '❌ Failed to tag members. Please try again later.';
        }
    }
};