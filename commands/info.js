const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Shows system information about the bot'),
    async execute(interaction) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🤖 Bot System Information')
                .setThumbnail('https://i.imgur.com/8QZQZQZ.png')
                .addFields(
                    { name: '🖥️ Platform', value: systemInfo.platform, inline: true },
                    { name: '⚙️ Architecture', value: systemInfo.arch, inline: true },
                    { name: '📦 Node.js', value: systemInfo.nodeVersion, inline: true },
                    { name: '⏱️ Uptime', value: systemInfo.uptime(), inline: true },
                    { name: '💾 Memory Usage', value: `${Math.round(systemInfo.memoryUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(systemInfo.memoryUsage.heapTotal / 1024 / 1024)}MB`, inline: true },
                    { name: '🔧 CPU Usage', value: `${Math.round(systemInfo.cpuUsage.user / 1000000)}s / ${Math.round(systemInfo.cpuUsage.system / 1000000)}s`, inline: true }
                )
                .setFooter({ text: 'Minima Bot v0.0.1' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in info command:', error);
            await interaction.reply({ 
                content: 'There was an error while fetching system information. Please try again later.',
                ephemeral: true 
            });
        }
    },
}; 