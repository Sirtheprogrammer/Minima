export default {
    name: 'ping',
    description: 'Check bot\'s response time',
    async execute(sock, msg) {
        try {
            const start = Date.now();
            
            // Send initial message
            const sentMsg = await sock.sendMessage(msg.key.remoteJid, { text: '🏓 Pinging...' });
            
            // Calculate response time
            const responseTime = Date.now() - start;
            
            // Get system info
            const memoryUsage = process.memoryUsage();
            const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            const heapTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
            
            const pingText = `
╭━━━━━━━━━━━━━━━╮
┃    *PING INFO*    
╰━━━━━━━━━━━━━━━╯

*🏓 Response Time*
▢ Latency: ${responseTime}ms
▢ API Latency: ${Math.round(sock.ws.ping || 0)}ms

*📊 System Status*
▢ Memory: ${heapUsed}MB / ${heapTotal}MB
▢ Uptime: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m

*📡 Connection*
▢ Status: Connected
▢ Mode: ${sock.type || 'Unknown'}`;

            // Update the message with ping results
            await sock.sendMessage(msg.key.remoteJid, {
                image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                caption: pingText
            });
        } catch (error) {
            console.error('Error in ping command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while checking ping. Please try again later.' 
            });
        }
    },
};