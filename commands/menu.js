// commands/menu.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    name: 'menu',
    description: 'Display bot menu and information',
    usage: '.menu',
    category: 'INFO',
    async execute(client, msg) {
        const botStatus = `
╭═══〘 🤖 SirTheProgrammer-V1 〙═══⊷❍
┃
┃ ⌬ Owner : SirTheProgrammer
┃ ⌬ Prefix : [${global.settings.prefix}]
┃ ⌬ Mode : public
┃ ⌬ Time : ${new Date().toLocaleTimeString()}
┃ ⌬ Ram : ${process.memoryUsage().heapUsed / 1024 / 1024} MB
┃ ⌬ Date : ${new Date().toLocaleDateString()}
┃ ⌬ Uptime : ${global.systemInfo.getUptime()}
┃ ⌬ Commands : ${global.commands.size}
╰═══════════════════⊷❍

╭═══〘 🤖 AI FEATURES 〙═══⊷❍
┃ ⌬ .gemini [your question]
┃ ⌬ .ytsearch [query]
╰═══════════════════⊷❍

╭═══〘 📥 DOWNLOADER 〙═══⊷❍
┃ ⌬ .play [song name]
┃ ⌬ .spotify [song name]
╰═══════════════════⊷❍

╭═══〘 🎮 FUN & GAMES 〙═══⊷❍
┃ ⌬ .quote
┃ ⌬ .joke
┃ ⌬ .meme
┃ ⌬ .fact
┃ ⌬ .truth
┃ ⌬ .dare
╰═══════════════════⊷❍

╭═══〘 ⚙️ SETTINGS 〙═══⊷❍
┃ ⌬ .setprefix [new prefix]
┃ ⌬ .setwelcome [message]
┃ ⌬ .setgoodbye [message]
╰═══════════════════⊷❍

╭═══〘 👥 GROUP 〙═══⊷❍
┃ ⌬ .kick @user
┃ ⌬ .add @user
┃ ⌬ .promote @user
┃ ⌬ .demote @user
┃ ⌬ .groupinfo
╰═══════════════════⊷❍

╭═══〘 🛠️ UTILITY 〙═══⊷❍
┃ ⌬ .sticker
┃ ⌬ .toimg
┃ ⌬ .tts [text]
┃ ⌬ .translate [text]
╰═══════════════════⊷❍

╭═══〘 ℹ️ INFO 〙═══⊷❍
┃ ⌬ .ping
┃ ⌬ .runtime
┃ ⌬ .info
┃ ⌬ .help
╰═══════════════════⊷❍`;

        await client.sendMessage(msg.from, { text: botStatus });
    }
};