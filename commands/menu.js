// commands/menu.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    name: 'menu',
    description: 'Shows the bot menu with all available commands',
    async execute(sock, msg, args) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🤖 Minima Bot Menu')
                .setDescription('Welcome to Minima Bot! Here are all available commands:')
                .setThumbnail('https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp')
                .addFields(
                    { name: '🛡️ Moderation', value: '`.ban`, `.kick`, `.mute`, `.warn`', inline: true },
                    { name: '⚙️ Settings', value: '`.prefix`, `.language`, `.welcome`', inline: true },
                    { name: '🎮 Fun', value: '`.8ball`, `.roll`, `.coinflip`, `.rps`', inline: true },
                    { name: 'ℹ️ Info', value: '`.help`, `.ping`, `.info`, `.uptime`', inline: true },
                    { name: '🛠️ Utility', value: '`.clear`, `.poll`, `.remind`, `.translate`', inline: true },
                    { name: '🎵 Music', value: '`.play`, `.skip`, `.queue`, `.nowplaying`', inline: true }
                )
                .setFooter({ text: 'Use .help <command> for detailed information about a specific command' })
                .setTimestamp();

            await sock.sendMessage(msg.key.remoteJid, { text: embed.toJSON() });
        } catch (error) {
            console.error('Error in menu command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while displaying the menu. Please try again later.' 
            });
        }
    },
};