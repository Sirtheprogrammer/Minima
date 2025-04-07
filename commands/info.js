export default {
    name: 'info',
    description: 'Shows bot and system information',
    async execute(sock, msg) {
        try {
            const os = await import('os');
            const startTime = process.uptime();
            const uptime = (() => {
                const seconds = Math.floor(startTime);
                const days = Math.floor(seconds / (24 * 60 * 60));
                const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
                const minutes = Math.floor((seconds % (60 * 60)) / 60);
                const secs = Math.floor(seconds % 60);
                return `${days}d ${hours}h ${minutes}m ${secs}s`;
            })();

            const infoText = `
╭━━━━━━━━━━━━━━━╮
┃    *SYSTEM INFO*    
╰━━━━━━━━━━━━━━━╯

*🤖 Bot Info*
▢ Name: Minima Bot
▢ Version: 0.0.1
▢ Uptime: ${uptime}

*💻 System Info*
▢ Platform: ${os.platform()}
▢ Architecture: ${os.arch()}
▢ Node.js: ${process.version}
▢ Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
▢ CPU Cores: ${os.cpus().length}

*📊 Statistics*
▢ Commands: ${global.commands?.size || 'N/A'}
▢ Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB
▢ CPU Usage: ${(os.loadavg()[0] * 100).toFixed(2)}%

╭━━━━━━━━━━━━━━━╮
┃ Made with ❤️ by @sirtheprogrammer
╰━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(msg.key.remoteJid, {
                image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                caption: infoText,
                mentions: ['sirtheprogrammer@s.whatsapp.net']
            });
        } catch (error) {
            console.error('Error in info command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while fetching system information. Please try again later.' 
            });
        }
    },
}; 