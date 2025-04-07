import { config } from 'dotenv';
config();

export const isOwner = (number) => {
    const cleanNumber = number.split('@')[0];
    return cleanNumber === process.env.OWNER_NUMBER;
};

export const requireOwner = async (sock, msg, callback) => {
    try {
        if (!isOwner(msg.author)) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ This command can only be used by the bot owner!'
            });
            return false;
        }
        return await callback();
    } catch (error) {
        console.error('Error in owner check:', error);
        return false;
    }
};

export const isAdmin = async (sock, msg) => {
    try {
        const chat = await msg.getChat();
        if (!chat.isGroup) return false;
        
        const participant = await chat.participants.find(p => p.id._serialized === msg.author);
        return participant?.isAdmin || participant?.isSuperAdmin || isOwner(msg.author);
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
};

export const requireAdmin = async (sock, msg, callback) => {
    try {
        if (!await isAdmin(sock, msg)) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ This command can only be used by group admins!'
            });
            return false;
        }
        return await callback();
    } catch (error) {
        console.error('Error in admin check:', error);
        return false;
    }
}; 