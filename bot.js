import express from 'express';
import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import { Server as SocketIOServer } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import QRCode from 'qrcode';

const app = express();
const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
});
const io = new SocketIOServer(server);

// Serve static files (frontend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Session handling
const sessionDir = './session';
if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

// WhatsApp Socket and State
let sock = null;
let isConnecting = false;
const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

// Status Configuration
const autoStatusConfig = {
    enabled: true,
    likeEmoji: '👍',
    viewedStatuses: new Set(),
    debug: false,
    lastCheck: 0,
    checkInterval: 30000 // 30 seconds
};

// Load Commands
const commands = new Map();
const loadCommands = async () => {
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        try {
            const commandModule = await import(`./commands/${file}`);
            const command = commandModule.default;
            if (command?.name) {
                commands.set(command.name, command);
                console.log(`Loaded command: ${command.name}`);
            }
        } catch (error) {
            console.error(`Failed to load command ${file}:`, error);
        }
    }

    // Define inline commands (only once)
    commands.set('togglestatus', {
        name: 'togglestatus',
        execute: async (sock, msg, args) => {
            autoStatusConfig.enabled = !autoStatusConfig.enabled;
            io.emit('statusFeatureUpdate', { enabled: autoStatusConfig.enabled });
            return `Auto status viewing and liking is now ${autoStatusConfig.enabled ? 'enabled ✅' : 'disabled ❌'}`;
        }
    });

    commands.set('setemoji', {
        name: 'setemoji',
        execute: async (sock, msg, args) => {
            if (args.length > 0) {
                autoStatusConfig.likeEmoji = args[0];
                io.emit('statusEmojiUpdate', { emoji: autoStatusConfig.likeEmoji });
                return `Status like emoji set to ${autoStatusConfig.likeEmoji}`;
            }
            return `Current status like emoji is ${autoStatusConfig.likeEmoji}. Send an emoji to change it.`;
        }
    });

    commands.set('statusinfo', {
        name: 'statusinfo',
        execute: async () => {
            return `Status feature: ${autoStatusConfig.enabled ? 'Enabled ✅' : 'Disabled ❌'}\n` +
                   `Reaction emoji: ${autoStatusConfig.likeEmoji}\n` +
                   `Statuses viewed: ${autoStatusConfig.viewedStatuses.size}\n` +
                   `Debug mode: ${autoStatusConfig.debug ? 'On' : 'Off'}`;
        }
    });

    commands.set('statusdebug', {
        name: 'statusdebug',
        execute: async () => {
            autoStatusConfig.debug = !autoStatusConfig.debug;
            return `Status debug mode is now ${autoStatusConfig.debug ? 'enabled' : 'disabled'}`;
        }
    });

    commands.set('checkstatus', {
        name: 'checkstatus',
        execute: async (sock) => {
            await sock.sendPresenceUpdate('available', 'status@broadcast');
            return 'Checking for statuses now... Check logs for details.';
        }
    });
};

// Connect to WhatsApp
async function connectToWhatsApp(method = 'qr', phoneNumber = null) {
    if (isConnecting) {
        io.emit('error', 'Connection already in progress. Please wait.');
        return;
    }

    // Only attempt to close if sock exists and is connected
    if (sock && sock.ws && sock.ws.readyState !== WebSocket.CLOSED) {
        console.log('Closing existing connection...');
        sock.end();
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    isConnecting = true;
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: autoStatusConfig.debug ? 'debug' : 'info' }),
        browser: ['WhatsApp Bot', 'Chrome', '1.0'],
        syncFullHistory: true,
        markOnlineOnConnect: true
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'connecting') {
            io.emit('message', { text: 'Connecting to WhatsApp...' });
        } else if (connection === 'open') {
            isConnecting = false;
            io.emit('connected', { message: 'Successfully paired with WhatsApp!' });
            console.log('WhatsApp Connected!');
        } else if (connection === 'close') {
            isConnecting = false;
            const error = lastDisconnect?.error;
            const statusCode = error instanceof Boom ? error.output.statusCode : null;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 405;
            console.log(`Connection closed. Status: ${statusCode || 'unknown'}. Reconnecting: ${shouldReconnect}`);
            io.emit('message', { text: `Disconnected. ${shouldReconnect ? 'Reconnecting...' : 'Please reconnect manually.'}` });
            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(method, phoneNumber), 5000);
            }
        }

        if (method === 'qr' && qr) {
            QRCode.toDataURL(qr, (err, url) => {
                if (err) io.emit('error', 'Failed to generate QR code');
                else io.emit('qr', url);
            });
        }
    });

    if (method === 'pairingCode' && phoneNumber) {
        try {
            const pairingCode = await sock.requestPairingCode(phoneNumber);
            io.emit('pairingCode', pairingCode);
            console.log(`Pairing code for ${phoneNumber}: ${pairingCode}`);
        } catch (err) {
            io.emit('error', `Failed to generate pairing code: ${err.message}`);
        }
    }

    // Message Handling
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg?.message) return;
        const text = msg.message.conversation || "";
        const args = text.trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        if (commands.has(commandName)) {
            try {
                const response = await commands.get(commandName).execute(sock, msg, args);
                if (response) {
                    await sock.sendMessage(msg.key.remoteJid, { text: response });
                    io.emit('message', { text: `Command '${commandName}' executed: ${response}` });
                }
            } catch (error) {
                io.emit('error', `Command '${commandName}' failed: ${error.message}`);
            }
        }

        // Status Handling
        if (autoStatusConfig.enabled && msg.key.remoteJid?.endsWith('@broadcast')) {
            const statusId = `${msg.key.remoteJid}_${msg.key.id}`;
            if (!autoStatusConfig.viewedStatuses.has(statusId)) {
                try {
                    await sock.readMessages([msg.key]);
                    await sock.sendMessage(msg.key.remoteJid, { react: { text: autoStatusConfig.likeEmoji, key: msg.key } });
                    autoStatusConfig.viewedStatuses.add(statusId);
                    io.emit('message', { text: `Viewed and reacted to status ${statusId}` });
                } catch (error) {
                    io.emit('error', `Status processing failed: ${error.message}`);
                }
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Socket.IO Integration
io.on('connection', (socket) => {
    console.log('Frontend connected');
    socket.emit('statusSettings', {
        enabled: autoStatusConfig.enabled,
        emoji: autoStatusConfig.likeEmoji
    });

    socket.on('generatePairing', async ({ method, phoneNumber }) => {
        if (method === 'pairingCode' && !phoneNumber) {
            socket.emit('error', 'Phone number required for pairing code');
            return;
        }
        await connectToWhatsApp(method, phoneNumber);
    });

    socket.on('toggleStatusFeature', (enabled) => {
        autoStatusConfig.enabled = enabled;
        socket.emit('statusFeatureUpdate', { enabled });
    });

    socket.on('setStatusEmoji', (emoji) => {
        if (emoji && typeof emoji === 'string') {
            autoStatusConfig.likeEmoji = emoji;
            socket.emit('statusEmojiUpdate', { emoji });
        }
    });

    socket.on('sendCommand', async (command) => {
        if (sock && commands.has(command)) {
            const msg = { key: { remoteJid: 'status@broadcast' }, message: { conversation: command } };
            const response = await commands.get(command).execute(sock, msg, []);
            socket.emit('message', { text: `Command '${command}' executed: ${response}` });
        } else {
            socket.emit('error', `Command '${command}' not found or WhatsApp not connected`);
        }
    });

    socket.on('disconnect', () => console.log('Frontend disconnected'));
});

// Periodic Status Check
setInterval(async () => {
    if (sock && autoStatusConfig.enabled && Date.now() - autoStatusConfig.lastCheck > autoStatusConfig.checkInterval) {
        autoStatusConfig.lastCheck = Date.now();
        try {
            await sock.sendPresenceUpdate('available', 'status@broadcast');
            io.emit('message', { text: 'Performed periodic status check' });
        } catch (error) {
            io.emit('error', `Periodic status check failed: ${error.message}`);
        }
    }
}, 15000);

// Initialize
loadCommands().then(() => {
    connectToWhatsApp().catch(err => {
        console.error('Initial connection error:', err);
        io.emit('error', `Initial connection failed: ${err.message}`);
    });
});

// Graceful Shutdown
process.on('SIGINT', () => {
    console.log('Shutting down...');
    if (sock) sock.end();
    server.close(() => process.exit(0));
});