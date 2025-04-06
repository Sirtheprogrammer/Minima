import os from 'os';

export default {
    name: 'info',
    description: 'Shows system information about the bot',
    async execute(sock, msg, args) {
        try {
            const uptime = () => {
                const seconds = Math.floor(process.uptime());
                const days = Math.floor(seconds / (3600 * 24));
                const hours = Math.floor((seconds % (3600 * 24)) / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                const secs = seconds % 60;
                return `${days}d ${hours}h ${minutes}m ${secs}s`;
            };

            const infoText = `🤖 *Bot System Information*

🖥️ *Platform:* ${os.platform()}
⚙️ *Architecture:* ${os.arch()}
📦 *Node.js:* ${process.version}
⏱️ *Uptime:* ${uptime()}
💾 *Memory Usage:* ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB
🔧 *CPU Usage:* ${Math.round(os.loadavg()[0] * 100)}%

_Minima Bot v0.0.1_`;

            await sock.sendMessage(msg.key.remoteJid, { 
                image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                caption: infoText
            });
        } catch (error) {
            console.error('Error in info command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while fetching system information. Please try again later.' 
            });
        }
    },
}; 