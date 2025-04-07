import translate from '@vitalets/google-translate-api';

export default {
    name: 'translate',
    description: 'Translate text to another language',
    usage: '<target_language> <text>',
    async execute(sock, msg, args) {
        try {
            if (args.length < 2) {
                return '❌ Please provide a target language and text to translate!\nUsage: .translate <language> <text>';
            }

            const targetLang = args[0].toLowerCase();
            const text = args.slice(1).join(' ');

            const result = await translate(text, { to: targetLang });

            const replyText = `
╭━━━━━━━━━━━━━━━╮
┃    *TRANSLATION*    
╰━━━━━━━━━━━━━━━╯

*📝 Original Text*
▢ ${text}

*🌐 Translation (${targetLang})*
▢ ${result.text}

${result.from.language.iso !== targetLang ? `*🔍 Detected Language*
▢ ${result.from.language.iso}` : ''}

╭━━━━━━━━━━━━━━━╮
┃ Translate again with .translate <lang> <text>
╰━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(msg.key.remoteJid, {
                image: { url: 'https://i.ibb.co/DP8NJcMN/Whats-App-Image-2025-04-02-at-12-17-28-PM.webp' },
                caption: replyText
            });
        } catch (error) {
            console.error('Error in translate command:', error);
            if (error.message.includes('language is not supported')) {
                return '❌ Invalid language code. Please use a valid ISO language code (e.g., en, es, fr, de).';
            }
            await sock.sendMessage(msg.key.remoteJid, { 
                text: 'There was an error while translating. Please try again later.' 
            });
        }
    },
}; 