export const name = 'togglestatus';
export const description = 'Toggles automatic status viewing and liking on or off. Usage: !togglestatus on/off [emoji]';

let autoStatusEnabled = false;
let likeEmoji = '👍';

export function execute(sock, msg, args) {
    const groupJid = msg.key.remoteJid;
    const userCommand = args[0]?.toLowerCase();
    const newEmoji = args[1];

    if (userCommand === 'on') {
        autoStatusEnabled = true;
        if (newEmoji) likeEmoji = newEmoji;
        sock.sendMessage(groupJid, { text: `Automatic status viewing and liking is now ON. Using emoji: ${likeEmoji}` });
    } else if (userCommand === 'off') {
        autoStatusEnabled = false;
        sock.sendMessage(groupJid, { text: 'Automatic status viewing and liking is now OFF.' });
    } else {
        sock.sendMessage(groupJid, { text: 'Usage: !togglestatus on/off [emoji]' });
    }
}

export function isAutoStatusEnabled() {
    return autoStatusEnabled;
}

export function getLikeEmoji() {
    return likeEmoji;
}