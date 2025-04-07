export default {
    name: 'rps',
    description: 'Play rock, paper, scissors',
    usage: '<rock/paper/scissors>',
    async execute(sock, msg, args) {
        try {
            if (args.length === 0) {
                return '❌ Please choose rock, paper, or scissors!';
            }

            const choices = ['rock', 'paper', 'scissors'];
            const playerChoice = args[0].toLowerCase();
            
            if (!choices.includes(playerChoice)) {
                return '❌ Invalid choice! Please choose rock, paper, or scissors.';
            }

            const botChoice = choices[Math.floor(Math.random() * choices.length)];
            
            // Determine winner
            let result;
            if (playerChoice === botChoice) {
                result = "It's a tie! 🤝";
            } else if (
                (playerChoice === 'rock' && botChoice === 'scissors') ||
                (playerChoice === 'paper' && botChoice === 'rock') ||
                (playerChoice === 'scissors' && botChoice === 'paper')
            ) {
                result = "You win! 🎉";
            } else {
                result = "I win! 🤖";
            }

            // Get emojis for choices
            const getEmoji = (choice) => {
                switch (choice) {
                    case 'rock': return '🪨';
                    case 'paper': return '📄';
                    case 'scissors': return '✂️';
                }
            };

            const replyText = `
╭━━━━━━━━━━━━━━━╮
┃    *ROCK PAPER SCISSORS*    
╰━━━━━━━━━━━━━━━╯

*🎮 Game Results*
▢ Your Choice: ${getEmoji(playerChoice)} ${playerChoice}
▢ My Choice: ${getEmoji(botChoice)} ${botChoice}

*🏆 Outcome*
▢ ${result}

╭━━━━━━━━━━━━━━━╮
┃ Play again with .rps <choice>
╰━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(msg.key.remoteJid, {
                image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                caption: replyText
            });
        } catch (error) {
            console.error('Error in rps command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while playing rock, paper, scissors. Please try again later.' 
            });
        }
    },
}; 