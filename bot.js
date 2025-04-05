import express from 'express';
import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import { Server as socketIOServer } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import QRCode from 'qrcode';
import { setupAntiDeleteListeners } from './commands/antidelete.js';

// Initialize Express and Socket.IO
const app = express();
const server = app.listen(3000, () => console.log('Server running on http://localhost:3000'));
const io = new socketIOServer(server);

// Serve static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// Session handling
const sessionDir = './session';
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir);
}
const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

// Load commands
const commands = new Map();
const loadCommands = async () => {
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
    console.log('Loading command files:', commandFiles);

    for (const file of commandFiles) {
        try {
            const commandModule = await import(`./commands/${file}`);
            const command = commandModule.default;
            if (command && command.name) {
                commands.set(command.name, command);
                console.log(`Loaded command: ${command.name} from ${file}`);
            } else {
                console.error(`Error: No valid default export with 'name' property in ${file}`);
            }
        } catch (error) {
            console.error(`Failed to load command from ${file}:`, error);
        }
    }
};

// WhatsApp Socket
let sock = null;

// Status handling configuration
let autoStatusConfig = {
    enabled: true,
    likeEmoji: '👍',
    viewedStatuses: new Set(),
    debug: true,
    lastCheck: 0,
    checkInterval: 30000
};

async function connectToWhatsApp(method = 'qr', phoneNumber = null) {
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'debug' }),
        browser: ['SirTheProgrammer Bot', 'Chrome', '1.0'],
        getMessage: async () => ({ conversation: "Fallback message" }),
        syncFullHistory: true,
        markOnlineOnConnect: true,
        shouldSyncHistoryMessage: () => true,
    });

    sock.io = io;

    let isSocketReady = false;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'connecting') {
            console.log('Socket is connecting...');
            isSocketReady = true;
        }

        if (method === 'qr' && qr) {
            QRCode.toDataURL(qr, (err, url) => {
                if (err) {
                    console.error('Failed to generate QR code:', err);
                    return;
                }
                io.emit('qr', url);
            });
        }

        if (connection === 'close') {
            const error = lastDisconnect?.error;
            const statusCode = error instanceof Boom ? error.output.statusCode : null;
            const shouldReconnect = statusCode && statusCode !== DisconnectReason.loggedOut && statusCode !== 405;
            console.log(`Connection closed. Status: ${statusCode || 'unknown'}. Reconnecting: ${shouldReconnect}`, error?.message || error);
            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(method, phoneNumber), 15000);
            } else {
                io.emit('error', `Connection failed with status ${statusCode || 'unknown'}. Please try again later.`);
            }
        } else if (connection === 'open') {
            console.log('WhatsApp Connected!');
            io.emit('connected', { message: 'Successfully paired with WhatsApp!' });
        }
    });

    if (method === 'pairingCode' && phoneNumber) {
        await new Promise((resolve) => {
            const checkReady = setInterval(() => {
                if (isSocketReady) {
                    clearInterval(checkReady);
                    resolve();
                }
            }, 500);
        });

        try {
            console.log(`Requesting pairing code for ${phoneNumber}...`);
            const pairingCode = await sock.requestPairingCode(phoneNumber);
            console.log('Generated Pairing Code:', pairingCode);
            io.emit('pairingCode', pairingCode);
        } catch (err) {
            console.error('Pairing code generation failed:', err);
            io.emit('error', 'Failed to generate pairing code: ' + err.message);
        }
    }

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg?.message) return;
        const text = msg.message.conversation || "";
        const groupJid = msg.key.remoteJid;

        await sock.sendPresenceUpdate('composing', groupJid);

        const args = text.trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        if (commands.has(commandName)) {
            const command = commands.get(commandName);
            try {
                await command.execute(sock, msg, args);
                io.emit('message', { text: `Command '${commandName}' executed: ${text}` });
            } catch (error) {
                console.error(`Error executing command: ${commandName}`, error);
                io.emit('message', { text: `Error executing '${commandName}': ${error.message}` });
            }
        }
    });

    // Status handling (unchanged for brevity)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        if (!autoStatusConfig.enabled) return;
        for (const message of messages) {
            const jid = message.key?.remoteJid;
            if (jid && jid.endsWith('@broadcast')) {
                const statusId = `${jid}_${message.key.id}`;
                if (autoStatusConfig.viewedStatuses.has(statusId)) continue;
                console.log(`Status detected from ${jid} with ID ${message.key.id}`);
                try {
                    await sock.readMessages([{ remoteJid: jid, id: message.key.id, participant: message.key.participant }]);
                    console.log(`✓ Marked status as viewed: ${statusId}`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await sock.sendMessage(jid, { react: { text: autoStatusConfig.likeEmoji, key: message.key } });
                    console.log(`✓ Reacted to status with ${autoStatusConfig.likeEmoji}`);
                    autoStatusConfig.viewedStatuses.add(statusId);
                } catch (error) {
                    console.error(`Error processing status ${statusId}:`, error);
                }
            }
        }
    });

    sock.ev.on('presence.update', async (update) => {
        if (!autoStatusConfig.enabled) return;
        const { id, presences } = update;
        if (id && id.endsWith('@broadcast')) {
            console.log(`Status presence update from ${id}:`, presences);
            for (const [participant, presence] of Object.entries(presences)) {
                if (presence.lastKnownPresence !== 'available') continue;
                const contactJid = `${participant.split('@')[0]}@s.whatsapp.net`;
                try {
                    const status = await sock.getStatus(contactJid);
                    console.log(`Retrieved status for ${contactJid}:`, status);
                    await sock.sendPresenceUpdate('available', id);
                    console.log(`Updated presence for status from ${contactJid}`);
                    try {
                        const statusMessages = await sock.fetchStatus(participant);
                        console.log(`Status messages for ${participant}:`, statusMessages);
                        if (statusMessages && Array.isArray(statusMessages.status)) {
                            for (const statusMsg of statusMessages.status) {
                                const msgId = `${id}_${statusMsg.key.id}`;
                                if (autoStatusConfig.viewedStatuses.has(msgId)) continue;
                                await sock.sendMessage(id, { react: { text: autoStatusConfig.likeEmoji, key: statusMsg.key } });
                                console.log(`Reacted to status from ${participant}`);
                                autoStatusConfig.viewedStatuses.add(msgId);
                            }
                        }
                    } catch (statusFetchError) {
                        console.log(`Could not fetch detailed status: ${statusFetchError.message}`);
                    }
                } catch (error) {
                    console.error(`Error processing status presence for ${participant}:`, error);
                }
            }
        }
    });

    sock.ev.process(async (events) => {
        if (events['messages.update'] && autoStatusConfig.enabled) {
            for (const { key, update } of events['messages.update']) {
                if (key.remoteJid?.endsWith('@broadcast')) {
                    console.log('Status update event detected:', key);
                    try {
                        const msg = await sock.loadMessage(key.remoteJid, key.id);
                        if (msg) {
                            const statusId = `${key.remoteJid}_${key.id}`;
                            if (autoStatusConfig.viewedStatuses.has(statusId)) continue;
                            await sock.readMessages([key]);
                            console.log(`Marked status as read: ${statusId}`);
                            await sock.sendMessage(key.remoteJid, { react: { text: autoStatusConfig.likeEmoji, key: key } });
                            console.log(`Reacted to status update: ${statusId}`);
                            autoStatusConfig.viewedStatuses.add(statusId);
                        }
                    } catch (error) {
                        console.error(`Error processing status update:`, error);
                    }
                }
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Define inline commands (for fallback or if not in commands directory)
    commands.set('togglestatus', {
        name: 'togglestatus',
        execute: (sock, msg, args) => {
            const sender = msg.key.remoteJid;
            autoStatusConfig.enabled = !autoStatusConfig.enabled;
            sock.sendMessage(sender, { text: `Auto status viewing and liking is now ${autoStatusConfig.enabled ? 'enabled ✅' : 'disabled ❌'}` });
            console.log(`Status feature ${autoStatusConfig.enabled ? 'enabled' : 'disabled'} by user command`);
        }
    });

    commands.set('setemoji', {
        name: 'setemoji',
        execute: (sock, msg, args) => {
            const sender = msg.key.remoteJid;
            if (args.length > 0) {
                autoStatusConfig.likeEmoji = args[0];
                sock.sendMessage(sender, { text: `Status like emoji set to ${autoStatusConfig.likeEmoji}` });
                console.log(`Status emoji changed to ${autoStatusConfig.likeEmoji}`);
            } else {
                sock.sendMessage(sender, { text: `Current status like emoji is ${autoStatusConfig.likeEmoji}. Send an emoji to change it.` });
            }
        }
    });

    commands.set('statusinfo', {
        name: 'statusinfo',
        execute: (sock, msg, args) => {
            const sender = msg.key.remoteJid;
            sock.sendMessage(sender, { 
                text: `Status feature: ${autoStatusConfig.enabled ? 'Enabled ✅' : 'Disabled ❌'}\n` +
                      `Reaction emoji: ${autoStatusConfig.likeEmoji}\n` +
                      `Statuses viewed: ${autoStatusConfig.viewedStatuses.size}\n` +
                      `Debug mode: ${autoStatusConfig.debug ? 'On' : 'Off'}`
            });
        }
    });

    commands.set('statusdebug', {
        name: 'statusdebug',
        execute: (sock, msg, args) => {
            const sender = msg.key.remoteJid;
            autoStatusConfig.debug = !autoStatusConfig.debug;
            sock.sendMessage(sender, { text: `Status debug mode is now ${autoStatusConfig.debug ? 'enabled' : 'disabled'}` });
            console.log(`Status debug mode ${autoStatusConfig.debug ? 'enabled' : 'disabled'}`);
        }
    });

    commands.set('checkstatus', {
        name: 'checkstatus',
        execute: async (sock, msg, args) => {
            const sender = msg.key.remoteJid;
            sock.sendMessage(sender, { text: `Checking for statuses now...` });
            try {
                await sock.sendPresenceUpdate('available', 'status@broadcast');
                console.log('Sent presence update to status@broadcast');
                const statusContacts = await sock.fetchStatus();
                console.log('Status contacts:', statusContacts);
                sock.sendMessage(sender, { text: `Status check complete. Check logs for details.` });
            } catch (error) {
                console.error('Error in manual status check:', error);
                sock.sendMessage(sender, { text: `Status check failed: ${error.message}` });
            }
        }
    });
}

// Load commands and start bot
loadCommands().then(() => {
    connectToWhatsApp().catch(err => console.error('Initial connection error:', err));
    
    setInterval(() => {
        if (sock && autoStatusConfig.enabled) {
            const now = Date.now();
            if (now - autoStatusConfig.lastCheck > autoStatusConfig.checkInterval) {
                console.log('Performing periodic status check...');
                autoStatusConfig.lastCheck = now;
                try {
                    sock.sendPresenceUpdate('available', 'status@broadcast');
                    console.log('Sent presence update to status@broadcast');
                } catch (error) {
                    console.error('Error in periodic status check:', error);
                }
            }
        }
    }, 15000);
});

// Socket.IO connection
io.on('connection', (socket) => {
    socket.on('generatePairing', async (data) => {
        const { method, phoneNumber } = data;
        if (method === 'pairingCode' && !phoneNumber) {
            socket.emit('error', 'Please provide a phone number for pairing code method');
            return;
        }
        if (sock && sock.ws && sock.ws.readyState !== sock.ws.CLOSED) {
            try {
                console.log('Closing existing socket...');
                sock.end();
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (err) {
                console.error('Error closing socket:', err);
            }
        }
        try {
            console.log(`Starting new connection with method: ${method}`);
            await connectToWhatsApp(method, phoneNumber);
        } catch (err) {
            console.error('Connection attempt failed:', err);
            socket.emit('error', 'Connection failed: ' + err.message);
        }
    });

    socket.on('toggleStatusFeature', (enabled) => {
        autoStatusConfig.enabled = Boolean(enabled);
        socket.emit('statusFeatureUpdate', { enabled: autoStatusConfig.enabled });
        console.log(`Auto status feature ${autoStatusConfig.enabled ? 'enabled' : 'disabled'}`);
    });

    socket.on('setStatusEmoji', (emoji) => {
        if (emoji && typeof emoji === 'string') {
            autoStatusConfig.likeEmoji = emoji;
            socket.emit('statusEmojiUpdate', { emoji: autoStatusConfig.likeEmoji });
            console.log(`Status reaction emoji set to ${autoStatusConfig.likeEmoji}`);
        }
    });

    socket.on('sendCommand', async (command) => {
        if (sock && commands.has(command)) {
            const msg = {
                key: { remoteJid: 'status@broadcast' },
                message: { conversation: command }
            };
            await commands.get(command).execute(sock, msg, []);
        }
    });

    socket.emit('statusSettings', {
        enabled: autoStatusConfig.enabled,
        emoji: autoStatusConfig.likeEmoji
    });
});

// Serve HTML UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log("Shutting down gracefully...");
    if (sock && sock.ws && sock.ws.readyState !== sock.ws.CLOSED) {
        sock.end();
    }
    process.exit(0);
});