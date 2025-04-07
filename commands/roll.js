export default {
    name: 'roll',
    description: 'Roll one or more dice',
    usage: '[number]d[sides] (e.g., 2d6 for two six-sided dice)',
    async execute(sock, msg, args) {
        try {
            let rolls = [];
            let total = 0;
            let diceCount = 1;
            let diceSides = 6;

            // Parse dice notation if provided
            if (args.length > 0) {
                const diceNotation = args[0].toLowerCase();
                const match = diceNotation.match(/^(\d+)?d(\d+)$/);
                
                if (match) {
                    diceCount = parseInt(match[1]) || 1;
                    diceSides = parseInt(match[2]);
                    
                    // Validate input
                    if (diceCount > 100) return '❌ Maximum 100 dice allowed!';
                    if (diceSides > 1000) return '❌ Maximum 1000 sides per die allowed!';
                    if (diceSides < 2) return '❌ Dice must have at least 2 sides!';
                } else {
                    return '❌ Invalid dice notation! Use format: [number]d[sides] (e.g., 2d6)';
                }
            }

            // Roll the dice
            for (let i = 0; i < diceCount; i++) {
                const roll = Math.floor(Math.random() * diceSides) + 1;
                rolls.push(roll);
                total += roll;
            }

            const replyText = `
╭━━━━━━━━━━━━━━━╮
┃    *DICE ROLL*    
╰━━━━━━━━━━━━━━━╯

*🎲 Roll Details*
▢ Dice: ${diceCount}d${diceSides}
▢ Results: ${rolls.join(', ')}
▢ Total: ${total}

*📊 Statistics*
▢ Average: ${(total / diceCount).toFixed(2)}
▢ Highest: ${Math.max(...rolls)}
▢ Lowest: ${Math.min(...rolls)}

╭━━━━━━━━━━━━━━━╮
┃ Roll again with .roll [dice]
╰━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(msg.key.remoteJid, {
                image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                caption: replyText
            });
        } catch (error) {
            console.error('Error in roll command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while rolling the dice. Please try again later.' 
            });
        }
    },
}; 