export default {
    name: '8ball',
    description: 'Ask the magic 8-ball a question',
    usage: '<question>',
    async execute(sock, msg, args) {
        try {
            if (args.length === 0) {
                return '❌ Please ask a question! Usage: .8ball <question>';
            }

            const responses = [
                '🎱 It is certain.',
                '🎱 It is decidedly so.',
                '🎱 Without a doubt.',
                '🎱 Yes definitely.',
                '🎱 You may rely on it.',
                '🎱 As I see it, yes.',
                '🎱 Most likely.',
                '🎱 Outlook good.',
                '🎱 Yes.',
                '🎱 Signs point to yes.',
                '🎱 Reply hazy, try again.',
                '🎱 Ask again later.',
                '🎱 Better not tell you now.',
                '🎱 Cannot predict now.',
                '🎱 Concentrate and ask again.',
                '🎱 Don\'t count on it.',
                '🎱 My reply is no.',
                '🎱 My sources say no.',
                '🎱 Outlook not so good.',
                '🎱 Very doubtful.'
            ];

            const question = args.join(' ');
            const response = responses[Math.floor(Math.random() * responses.length)];

            const replyText = `
╭━━━━━━━━━━━━━━━╮
┃    *MAGIC 8 BALL*    
╰━━━━━━━━━━━━━━━╯

*❓ Question*
${question}

*🎱 Answer*
${response}

╭━━━━━━━━━━━━━━━╮
┃ Ask another question!
╰━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(msg.key.remoteJid, {
                image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                caption: replyText
            });
        } catch (error) {
            console.error('Error in 8ball command:', error);
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while consulting the magic 8-ball. Please try again later.' 
            });
        }
    },
}; 