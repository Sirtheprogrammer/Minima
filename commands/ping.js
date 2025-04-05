export const name = 'ping';
export const description = 'Replies with Pong!';

export function execute(sock, msg) {
    const groupJid = msg.key.remoteJid;
    sock.sendMessage(groupJid, { text: 'Pong! 🏓' });
}