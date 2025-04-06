export default {
    name: 'help',
    description: 'Shows help information for commands',
    async execute(sock, msg, args) {
        try {
            const commandName = args[0]?.toLowerCase();
            
            if (!commandName) {
                const asciiArt = `
╭━━━╮╱╱╱╱╱╱╱╱╱╭━━━╮
┃╭━╮┃╱╱╱╱╱╱╱╱╱┃╭━╮┃
┃┃╱┃┣━┳━━┳┳━╮╱┃╰━━┳━━┳━┳━━┳━╮
┃╰━╯┃╭┫┃━╋┫╭╮╮╰━━╮┃╭╮┃╭┫┃━┫╭╯
┃╭━╮┃┃┃┃━┫┃┃┃┃┃╰━╯┃╰╯┃┃┃┃━┫┃
╰╯╱╰┻╯╰━━┻┻╯╰╯╰━━━┻━━┻╯╰━━┻╯
`;

                const helpText = `${asciiArt}

*🤖 Minima Bot Help Menu*

Type \`.help <command>\` for detailed info about a specific command.

*Available Commands:*

*🛡️ Moderation*
\`.ban\` \`.kick\` \`.mute\` \`.warn\`

*⚙️ Settings*
\`.prefix\` \`.language\` \`.welcome\`

*🎮 Fun*
\`.8ball\` \`.roll\` \`.coinflip\` \`.rps\`

*ℹ️ Info*
\`.help\` \`.ping\` \`.info\` \`.uptime\`

*🛠️ Utility*
\`.clear\` \`.poll\` \`.remind\` \`.translate\`

*🎵 Music*
\`.play\` \`.skip\` \`.queue\` \`.nowplaying\`

*Made with ❤️ by @sirtheprogrammer*`;

                await sock.sendMessage(msg.key.remoteJid, {
                    image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                    caption: helpText,
                    mentions: ['sirtheprogrammer@s.whatsapp.net']
                });
                return;
            }

            // Handle specific command help
            const commands = await import('../commands/index.js');
            const command = commands[commandName];

            if (!command) {
                return `Command \`${commandName}\` not found. Use \`.help\` to see all available commands.`;
            }

            return `*Command:* ${command.name}\n*Description:* ${command.description}\n*Usage:* \`.${command.name} ${command.usage || ''}\``;
        } catch (error) {
            console.error('Error in help command:', error);
            return 'Failed to display help. Please try again.';
        }
    }
}; 