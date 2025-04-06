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
import { setupAntiDeleteListeners } from './commands/antidelete.js';

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
    checkInterval: 30000, // 30 seconds
    rateLimit: {
        maxReactions: 50, // Maximum reactions per hour
        reactionsThisHour: 0,
        lastReset: Date.now(),
        cooldown: 2000 // 2 seconds between reactions
    },
    statusTypes: {
        text: true,
        image: true,
        video: true,
        audio: true
    },
    retryAttempts: 3,
    retryDelay: 1000
};

// Helper function for status debug logging
function statusDebugLog(message) {
    if (autoStatusConfig.debug) {
        console.log(`[Status Debug] ${message}`);
    }
}

// Helper function to check rate limits
function checkRateLimit() {
    const now = Date.now();
    if (now - autoStatusConfig.rateLimit.lastReset >= 3600000) { // Reset every hour
        autoStatusConfig.rateLimit.reactionsThisHour = 0;
        autoStatusConfig.rateLimit.lastReset = now;
        return true;
    }
    return autoStatusConfig.rateLimit.reactionsThisHour < autoStatusConfig.rateLimit.maxReactions;
}

// Helper function to get status type
function getStatusType(msg) {
    if (msg.message?.conversation) return 'text';
    if (msg.message?.imageMessage) return 'image';
    if (msg.message?.videoMessage) return 'video';
    if (msg.message?.audioMessage) return 'audio';
    return 'unknown';
}

// Helper function to handle status reaction with retries
async function handleStatusReaction(sock, msg, statusId) {
    let attempts = 0;
    while (attempts < autoStatusConfig.retryAttempts) {
        try {
            if (!checkRateLimit()) {
                statusDebugLog('Rate limit reached, skipping status reaction');
                return false;
            }

            // Mark as read first
            await sock.readMessages([msg.key]);
            
            // Add delay between read and reaction
            await new Promise(resolve => setTimeout(resolve, autoStatusConfig.rateLimit.cooldown));
            
            // Send reaction
            await sock.sendMessage(msg.key.remoteJid, {
                react: { text: autoStatusConfig.likeEmoji, key: msg.key }
            });

            autoStatusConfig.rateLimit.reactionsThisHour++;
            autoStatusConfig.viewedStatuses.add(statusId);
            
            statusDebugLog(`Successfully reacted to status ${statusId} (attempt ${attempts + 1})`);
            return true;
        } catch (error) {
            attempts++;
            statusDebugLog(`Failed to react to status ${statusId} (attempt ${attempts}): ${error.message}`);
            if (attempts < autoStatusConfig.retryAttempts) {
                await new Promise(resolve => setTimeout(resolve, autoStatusConfig.retryDelay));
            }
        }
    }
    return false;
}

// Load Commands
const commands = new Map();
const loadCommands = async () => {
    try {
        const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js') && file !== 'commands.js');
        console.log('Loading commands from files:', commandFiles);
        
        for (const file of commandFiles) {
            try {
                const commandModule = await import(`./commands/${file}`);
                const command = commandModule.default;
                if (command?.name) {
                    commands.set(command.name, command);
                    console.log(`Successfully loaded command: ${command.name}`);
                } else {
                    console.warn(`Command in ${file} is missing name property`);
                }
            } catch (error) {
                console.error(`Failed to load command ${file}:`, error);
            }
        }
        
        // Define inline commands
        const inlineCommands = {
            togglestatus: {
                name: 'togglestatus',
                execute: async (sock, msg, args) => {
                    autoStatusConfig.enabled = !autoStatusConfig.enabled;
                    io.emit('statusFeatureUpdate', { enabled: autoStatusConfig.enabled });
                    return `Auto status viewing and liking is now ${autoStatusConfig.enabled ? 'enabled ✅' : 'disabled ❌'}`;
                }
            },
            setemoji: {
                name: 'setemoji',
                execute: async (sock, msg, args) => {
                    if (args.length > 0) {
                        autoStatusConfig.likeEmoji = args[0];
                        io.emit('statusEmojiUpdate', { emoji: autoStatusConfig.likeEmoji });
                        return `Status like emoji set to ${autoStatusConfig.likeEmoji}`;
                    }
                    return `Current status like emoji is ${autoStatusConfig.likeEmoji}. Send an emoji to change it.`;
                }
            },
            statusinfo: {
                name: 'statusinfo',
                execute: async () => {
                    return `Status feature: ${autoStatusConfig.enabled ? 'Enabled ✅' : 'Disabled ❌'}\n` +
                           `Reaction emoji: ${autoStatusConfig.likeEmoji}\n` +
                           `Statuses viewed: ${autoStatusConfig.viewedStatuses.size}\n` +
                           `Debug mode: ${autoStatusConfig.debug ? 'On' : 'Off'}`;
                }
            },
            statusdebug: {
                name: 'statusdebug',
                execute: async () => {
                    autoStatusConfig.debug = !autoStatusConfig.debug;
                    return `Status debug mode is now ${autoStatusConfig.debug ? 'enabled' : 'disabled'}`;
                }
            },
            checkstatus: {
                name: 'checkstatus',
                execute: async (sock) => {
                    await sock.sendPresenceUpdate('available', 'status@broadcast');
                    return 'Checking for statuses now... Check logs for details.';
                }
            }
        };

        // Add inline commands to the commands map
        Object.entries(inlineCommands).forEach(([name, command]) => {
            commands.set(name, command);
            console.log(`Added inline command: ${name}`);
        });

        console.log(`Total commands loaded: ${commands.size}`);
    } catch (error) {
        console.error('Error loading commands:', error);
    }
};

// Connect to WhatsApp
async function connectToWhatsApp(method = 'qr', phoneNumber = null) {
    if (isConnecting) {
        io.emit('error', 'Connection already in progress. Please wait.');
        return;
    }

    try {
        // Only attempt to close if sock exists and is connected
        if (sock && sock.ws && sock.ws.readyState !== WebSocket.CLOSED) {
            console.log('Closing existing connection...');
            sock.end();
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        isConnecting = true;
        io.emit('message', { text: 'Initializing WhatsApp connection...' });

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: autoStatusConfig.debug ? 'debug' : 'info' }),
            browser: ['WhatsApp Bot', 'Chrome', '1.0'],
            syncFullHistory: true,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000, // 60 seconds timeout
            retryRequestDelayMs: 2000 // 2 seconds delay between retries
        });

        // Setup anti-delete listeners
        setupAntiDeleteListeners(sock);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'connecting') {
                io.emit('message', { text: 'Connecting to WhatsApp...' });
                io.emit('status', { status: 'connecting' });
            } else if (connection === 'open') {
                isConnecting = false;
                io.emit('connected', { message: 'Successfully paired with WhatsApp!' });
                io.emit('status', { status: 'connected' });
                console.log('WhatsApp Connected!');
            } else if (connection === 'close') {
                isConnecting = false;
                const error = lastDisconnect?.error;
                const statusCode = error instanceof Boom ? error.output.statusCode : null;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 405;
                
                console.log(`Connection closed. Status: ${statusCode || 'unknown'}. Reconnecting: ${shouldReconnect}`);
                io.emit('status', { status: 'disconnected' });
                io.emit('message', { text: `Disconnected. ${shouldReconnect ? 'Reconnecting...' : 'Please reconnect manually.'}` });
                
                if (shouldReconnect) {
                    setTimeout(() => connectToWhatsApp(method, phoneNumber), 5000);
                }
            }

            if (method === 'qr' && qr) {
                try {
                    const qrUrl = await QRCode.toDataURL(qr);
                    io.emit('qr', qrUrl);
                    io.emit('message', { text: 'QR Code generated. Please scan with WhatsApp.' });
                } catch (err) {
                    console.error('Failed to generate QR code:', err);
                    io.emit('error', 'Failed to generate QR code');
                }
            }
        });

        if (method === 'pairingCode' && phoneNumber) {
            try {
                // Validate phone number format
                if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
                    throw new Error('Invalid phone number format. Please include country code (e.g., +1234567890)');
                }
                
                const pairingCode = await sock.requestPairingCode(phoneNumber);
                io.emit('pairingCode', pairingCode);
                io.emit('message', { text: `Pairing code generated for ${phoneNumber}. Please enter this code in WhatsApp.` });
                console.log(`Pairing code for ${phoneNumber}: ${pairingCode}`);
            } catch (err) {
                console.error('Failed to generate pairing code:', err);
                io.emit('error', `Failed to generate pairing code: ${err.message}`);
                isConnecting = false;
            }
        }

        // Message Handling with improved error handling
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg?.message) return;
            
            try {
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
                        console.error(`Command execution error for ${commandName}:`, error);
                        io.emit('error', `Command '${commandName}' failed: ${error.message}`);
                        await sock.sendMessage(msg.key.remoteJid, { 
                            text: `Error executing command: ${error.message}` 
                        });
                    }
                }

                // Status Handling with improved error handling
                if (autoStatusConfig.enabled && msg.key.remoteJid?.endsWith('@broadcast')) {
                    const statusId = `${msg.key.remoteJid}_${msg.key.id}`;
                    const statusType = getStatusType(msg);
                    
                    if (!autoStatusConfig.viewedStatuses.has(statusId) && autoStatusConfig.statusTypes[statusType]) {
                        try {
                            const success = await handleStatusReaction(sock, msg, statusId);
                            if (success) {
                                io.emit('message', { 
                                    text: `Viewed and reacted to ${statusType} status from ${msg.key.remoteJid.split('@')[0]}` 
                                });
                                io.emit('statusUpdate', { 
                                    type: 'reaction',
                                    statusId,
                                    statusType,
                                    timestamp: Date.now()
                                });
                            }
                        } catch (error) {
                            console.error('Status processing error:', error);
                            io.emit('error', `Status processing failed: ${error.message}`);
                        }
                    }
                }
            } catch (error) {
                console.error('Message processing error:', error);
                io.emit('error', `Message processing failed: ${error.message}`);
            }
        });

        sock.ev.on('creds.update', saveCreds);
    } catch (error) {
        console.error('Connection error:', error);
        io.emit('error', `Connection error: ${error.message}`);
        isConnecting = false;
    }
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

// Add periodic status check with improved error handling
setInterval(async () => {
    if (sock && autoStatusConfig.enabled && Date.now() - autoStatusConfig.lastCheck > autoStatusConfig.checkInterval) {
        autoStatusConfig.lastCheck = Date.now();
        try {
            await sock.sendPresenceUpdate('available', 'status@broadcast');
            statusDebugLog('Performed periodic status check');
        } catch (error) {
            console.error('Periodic status check failed:', error);
            io.emit('error', `Status check failed: ${error.message}`);
        }
    }
}, 15000);

// Initialize
await loadCommands().then(() => {
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