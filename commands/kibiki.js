export default {
    name: 'kibiki',
    description: 'Tag multiple users with no limits',
    async execute(sock, msg, args) {
        try {
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const text = args.join(' ');
            
            if (mentions.length === 0) {
                return 'Please mention at least one user to tag.';
            }

            const mentionedUsers = mentions.map(jid => {
                const number = jid.split('@')[0];
                return `@${number}`;
            }).join(' ');

            await sock.sendMessage(msg.key.remoteJid, {
                text: `${text}\n\n${mentionedUsers}`,
                mentions: mentions
            });
        } catch (error) {
            console.error('Error in kibiki command:', error);
            return 'Failed to tag users. Please try again.';
        }
    }
};