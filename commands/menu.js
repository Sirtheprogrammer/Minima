// commands/menu.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    name: 'menu',
    description: 'Shows the bot menu with all available commands',
    async execute(sock, msg, args) {
        try {
            const menuText = `
╭━━━━━━━━━━━━━━━╮
┃    *MINIMA BOT MENU*    
┃    Version: 0.0.1
╰━━━━━━━━━━━━━━━╯

*🛡️ MODERATION*
▢ .ban
▢ .kick
▢ .mute
▢ .warn

*⚙️ SETTINGS*
▢ .prefix
▢ .language
▢ .welcome

*🎮 FUN*
▢ .8ball
▢ .roll
▢ .coinflip
▢ .rps

*ℹ️ INFO*
▢ .help
▢ .ping
▢ .info
▢ .uptime

*🛠️ UTILITY*
▢ .clear
▢ .poll
▢ .remind
▢ .translate

*🎵 MUSIC*
▢ .play
▢ .skip
▢ .queue
▢ .nowplaying

╭━━━━━━━━━━━━━━━╮
┃ Made with ❤️ by @sirtheprogrammer
╰━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(msg.key.remoteJid, {
                image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                caption: menuText,
                mentions: ['sirtheprogrammer@s.whatsapp.net']
            });
        } catch (error) {
            console.error('Error in menu command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while displaying the menu. Please try again later.' 
            });
        }
    },
};