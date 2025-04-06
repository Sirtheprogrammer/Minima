// commands/menu.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    name: 'menu',
    description: 'Shows the bot menu with all available commands',
    async execute(sock, msg, args) {
        try {
            const menuText = `🤖 *Minima Bot Menu*
Welcome to Minima Bot! Here are all available commands:

🛡️ *Moderation*
\`.ban\`, \`.kick\`, \`.mute\`, \`.warn\`

⚙️ *Settings*
\`.prefix\`, \`.language\`, \`.welcome\`

🎮 *Fun*
\`.8ball\`, \`.roll\`, \`.coinflip\`, \`.rps\`

ℹ️ *Info*
\`.help\`, \`.ping\`, \`.info\`, \`.uptime\`

🛠️ *Utility*
\`.clear\`, \`.poll\`, \`.remind\`, \`.translate\`

🎵 *Music*
\`.play\`, \`.skip\`, \`.queue\`, \`.nowplaying\`

Use .help <command> for detailed information about a specific command`;

            await sock.sendMessage(msg.key.remoteJid, { 
                image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                caption: menuText
            });
        } catch (error) {
            console.error('Error in menu command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while displaying the menu. Please try again later.' 
            });
        }
    },
};