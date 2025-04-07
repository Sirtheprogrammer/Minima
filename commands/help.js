export default {
    name: 'help',
    description: 'Shows information about commands',
    async execute(sock, msg, args) {
        try {
            // If a specific command is specified, show detailed help for that command
            if (args.length > 0) {
                const commandName = args[0].toLowerCase();
                const command = global.commands?.get(commandName);
                
                if (!command) {
                    return `❌ Command "${commandName}" not found. Use .help to see all available commands.`;
                }

                const helpText = `
╭━━━━━━━━━━━━━━━╮
┃    *COMMAND HELP*    
╰━━━━━━━━━━━━━━━╯

*📝 Command Details*
▢ Name: ${command.name}
▢ Description: ${command.description || 'No description available'}
▢ Usage: .${command.name} ${command.usage || ''}
${command.aliases ? `▢ Aliases: ${command.aliases.join(', ')}` : ''}
${command.cooldown ? `▢ Cooldown: ${command.cooldown} seconds` : ''}

*ℹ️ Additional Info*
${command.additionalInfo || 'No additional information available.'}`;

                await sock.sendMessage(msg.key.remoteJid, {
                    image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                    caption: helpText
                });
                return;
            }

            // Show general help menu
            const helpText = `
╭━━━━━━━━━━━━━━━╮
┃    *HELP MENU*    
╰━━━━━━━━━━━━━━━╯

Welcome to Minima Bot Help!
Use .help <command> for detailed info.

*🛡️ MODERATION*
▢ .ban - Ban a user
▢ .kick - Kick a user
▢ .mute - Mute a user
▢ .warn - Warn a user

*⚙️ SETTINGS*
▢ .prefix - Change command prefix
▢ .language - Set bot language
▢ .welcome - Set welcome message

*🎮 FUN*
▢ .8ball - Ask the magic 8ball
▢ .roll - Roll a dice
▢ .coinflip - Flip a coin
▢ .rps - Play rock, paper, scissors

*ℹ️ INFO*
▢ .help - Show this help menu
▢ .ping - Check bot response time
▢ .info - Show bot information
▢ .uptime - Show bot uptime

*🛠️ UTILITY*
▢ .clear - Clear chat messages
▢ .poll - Create a poll
▢ .remind - Set a reminder
▢ .translate - Translate text

*🎵 MUSIC*
▢ .play - Play a song
▢ .skip - Skip current song
▢ .queue - Show music queue
▢ .nowplaying - Show current song

╭━━━━━━━━━━━━━━━╮
┃ Type .help <command> for more info
╰━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(msg.key.remoteJid, {
                image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                caption: helpText
            });
        } catch (error) {
            console.error('Error in help command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while showing help. Please try again later.' 
            });
        }
    },
}; 