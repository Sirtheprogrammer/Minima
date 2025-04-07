export default {
    name: 'coinflip',
    description: 'Flip a coin',
    usage: '[number of flips]',
    async execute(sock, msg, args) {
        try {
            let flips = 1;
            if (args.length > 0) {
                flips = parseInt(args[0]);
                if (isNaN(flips) || flips < 1) {
                    return '❌ Please provide a valid number of flips!';
                }
                if (flips > 100) {
                    return '❌ Maximum 100 flips allowed!';
                }
            }

            const results = [];
            let heads = 0;
            let tails = 0;

            for (let i = 0; i < flips; i++) {
                const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
                results.push(result);
                if (result === 'Heads') heads++;
                else tails++;
            }

            const replyText = `
╭━━━━━━━━━━━━━━━╮
┃    *COIN FLIP*    
╰━━━━━━━━━━━━━━━╯

*🎲 Flip Results*
${flips === 1 ? `▢ Result: ${results[0]}` : `▢ Results: ${results.join(', ')}`}

${flips > 1 ? `*📊 Statistics*
▢ Total Flips: ${flips}
▢ Heads: ${heads} (${((heads/flips)*100).toFixed(1)}%)
▢ Tails: ${tails} (${((tails/flips)*100).toFixed(1)}%)` : ''}

╭━━━━━━━━━━━━━━━╮
┃ Flip again with .coinflip [number]
╰━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(msg.key.remoteJid, {
                image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                caption: replyText
            });
        } catch (error) {
            console.error('Error in coinflip command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while flipping the coin. Please try again later.' 
            });
        }
    },
}; 