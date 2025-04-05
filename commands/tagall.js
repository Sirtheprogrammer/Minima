export const name = 'tagall';
export const description = 'Tags all members in the group with a custom message.';

export async function execute(sock, msg, args) {
    const groupJid = msg.key.remoteJid;
    if (groupJid?.endsWith('@g.us')) {
        const groupInfo = await sock.groupMetadata(groupJid);
        const mentions = groupInfo.participants.map(p => p.id);
        const userMessage = args.join(' ') || "Attention!";
        const asciiArt = `
  ▄■▄■▄■▄■▄■▄■▄■▄■▄■▄■▄■▄
▌  ╔═╗┌─┐┬ ┬┌┬┐┌─┐╔═╗    ▐
▌  ╠═╝├─┤│ │ │ │ │║╣         ▐
▌  ╩  ┴ ┴└─┘ ┴ └─┘╚═╝        ▐
▌  ≡≡≡ ◆ 🎮 [TAG-ALL] ◆ ≡≡≡  ▐
▌  ░▒▓█►*SIR_THE_PROGRAMMER* ◄█ ▐
▌  ▄︻デ═══*BOT v1.0.0*═══︻▄    ▐
▌  [̲̅✧̲̅]̲̅✧̲̅[̲̅✧̲̅]̲̅✧̲̅[̲̅✧̲̅]̲̅✧̲̅          ▐
▀■▀■▀■▀■▀■▀■▀■▀■▀■▀■▀■▀
        `;
        const header = '🔔🔔🔔 TAG-ALL 🔔🔔🔔\n';
        const footer = '\n🔔🔔 █@sirtheprogrammer◄█ 🔔🔔';
        const message = `${header}${asciiArt}\n📢 *${userMessage}*\n👥 Members:\n${mentions.map((m, i) => `${i + 1}. @${m.split('@')[0]}`).join('\n')}${footer}`;
        await sock.sendMessage(groupJid, {
            text: message,
            mentions
        });
    }
}