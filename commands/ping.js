export default {
    name: 'ping',
    description: 'Check bot response time',
    async execute(sock, msg, args) {
        try {
            const start = Date.now();
            
            // Send initial message
            const pingMsg = await sock.sendMessage(msg.key.remoteJid, { text: '🏓 Pinging...' });
            
            // Calculate response time
            const end = Date.now();
            const responseTime = end - start;
            
            // Send final message with response time
            await sock.sendMessage(msg.key.remoteJid, {
                text: `*🏓 Pong!*\n\n*Response Time:* ${responseTime}ms\n*Status:* Online✨`,
                edit: pingMsg.key
            });
        } catch (error) {
            console.error('Error in ping command:', error);
            return 'Failed to measure ping. Please try again.';
        }
    }
};