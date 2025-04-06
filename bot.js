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
import os from 'os';

// System Information
const systemInfo = {
    startTime: Date.now(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    uptime: () => {
        const uptime = Date.now() - systemInfo.startTime;
        const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
};

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
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds
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

// Function to connect to WhatsApp
async function connectToWhatsApp(method, phoneNumber) {
    if (isConnecting) {
        console.log('Connection already in progress, skipping...');
        return;
    }
    
    isConnecting = true;
    connectionAttempts++;
    
    try {
        console.log(`Connecting to WhatsApp (attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})...`);
        io.emit('status', { status: 'connecting' });
        
        // Create a new socket with proper error handling
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['Minima Bot', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            retryRequestDelayMs: 2000,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            defaultQueryTimeoutMs: 60000
        });
        
        // Set up event handlers
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 405;
                
                console.log(`Connection closed. Status: ${statusCode || 'unknown'}. Reconnecting: ${shouldReconnect}`);
                io.emit('status', { status: 'disconnected' });
                io.emit('message', { text: `Disconnected. ${shouldReconnect ? 'Reconnecting...' : 'Please reconnect manually.'}` });
                
                if (shouldReconnect && connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
                    setTimeout(() => {
                        isConnecting = false;
                        connectToWhatsApp(method, phoneNumber);
                    }, RECONNECT_DELAY);
                } else {
                    isConnecting = false;
                }
            } else if (connection === 'open') {
                console.log('Connected to WhatsApp successfully!');
                io.emit('status', { status: 'connected' });
                io.emit('message', { text: 'Connected to WhatsApp successfully!' });
                io.emit('connectionSuccess'); // New event to hide connection panel
                isConnecting = false;
                connectionAttempts = 0;
                
                // Set up anti-delete listeners
                try {
                    const { setupAntiDeleteListeners } = await import('./commands/antidelete.js');
                    setupAntiDeleteListeners(sock);
                    console.log('Anti-delete listeners set up successfully');
                } catch (error) {
                    console.error('Failed to set up anti-delete listeners:', error);
                }
            }
            
            // Handle QR code
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
        
        // Handle pairing code
        if (method === 'pairingCode' && phoneNumber) {
            try {
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
        
        // Set up message handler with auto typing
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg?.message) return;
            
            try {
                const text = msg.message.conversation || "";
                const args = text.trim().split(/ +/);
                const commandName = args.shift().toLowerCase();
                
                // Start typing indicator for 10 seconds
                if (commandName.startsWith('.')) {
                    await sock.sendPresenceUpdate('composing', msg.key.remoteJid);
                    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
                    
                    const actualCommand = commandName.substring(1);
                    
                    if (commands.has(actualCommand)) {
                        try {
                            console.log(`Executing command: ${actualCommand} with args:`, args);
                            const response = await commands.get(actualCommand).execute(sock, msg, args);
                            if (response) {
                                await sock.sendMessage(msg.key.remoteJid, { text: response });
                                if (msg.key.remoteJid === 'web-panel') {
                                    await sendToPersonalNumber(sock, `Command '${actualCommand}' executed: ${response}`);
                                }
                            }
                        } catch (error) {
                            console.error(`Command execution error for ${actualCommand}:`, error);
                            const errorMessage = `Command '${actualCommand}' failed: ${error.message}`;
                            await sock.sendMessage(msg.key.remoteJid, { text: errorMessage });
                            if (msg.key.remoteJid === 'web-panel') {
                                await sendToPersonalNumber(sock, errorMessage);
                            }
                        }
                    } else {
                        const notFoundMessage = `Command not found: ${actualCommand}. Use .help to see available commands.`;
                        await sock.sendMessage(msg.key.remoteJid, { text: notFoundMessage });
                        if (msg.key.remoteJid === 'web-panel') {
                            await sendToPersonalNumber(sock, notFoundMessage);
                        }
                    }
                    
                    // Stop typing indicator
                    await sock.sendPresenceUpdate('paused', msg.key.remoteJid);
                }
            } catch (error) {
                console.error('Message processing error:', error);
                await sock.sendPresenceUpdate('paused', msg.key.remoteJid);
            }
        });
        
        sock.ev.on('creds.update', saveCreds);

        // Handle deleted messages
        sock.ev.on('message.delete', async (message) => {
            try {
                const deletedMessage = await getMessageFromStore(message);
                if (deletedMessage) {
                    const personalNumber = process.env.PERSONAL_NUMBER;
                    if (personalNumber) {
                        const sender = deletedMessage.key.participant || deletedMessage.key.remoteJid;
                        const senderNumber = sender.split('@')[0];
                        const chatName = deletedMessage.key.remoteJid.includes('@g.us') ? 
                            (await sock.groupMetadata(deletedMessage.key.remoteJid)).subject : 
                            'Private Chat';

                        const notificationText = `*Message Deleted*\n\n` +
                            `*From:* @${senderNumber}\n` +
                            `*Chat:* ${chatName}\n` +
                            `*Time:* ${new Date().toLocaleString()}\n\n` +
                            `*Deleted Message:*\n${deletedMessage.message.conversation || 
                            deletedMessage.message.extendedTextMessage?.text || 
                            'Media Message'}`;

                        await sock.sendMessage(`${personalNumber}@s.whatsapp.net`, {
                            text: notificationText,
                            mentions: [sender]
                        });

                        // If the deleted message contains media, forward it
                        if (deletedMessage.message.imageMessage || 
                            deletedMessage.message.videoMessage || 
                            deletedMessage.message.audioMessage || 
                            deletedMessage.message.stickerMessage) {
                            await sock.forwardMessage(`${personalNumber}@s.whatsapp.net`, deletedMessage);
                        }
                    }
                }
            } catch (error) {
                console.error('Error handling deleted message:', error);
            }
        });
    } catch (error) {
        console.error('Connection error:', error);
        io.emit('error', `Connection failed: ${error.message}`);
        isConnecting = false;
        
        if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
            setTimeout(() => {
                connectToWhatsApp(method, phoneNumber);
            }, RECONNECT_DELAY);
        }
    }
}

// Socket.IO Integration
io.on('connection', (socket) => {
    console.log('Client connected');
    
    socket.on('getSystemInfo', () => {
        const info = {
            uptime: systemInfo.uptime(),
            platform: systemInfo.platform,
            nodeVersion: process.version,
            memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            cpuUsage: `${Math.round(os.loadavg()[0] * 100)}%`
        };
        socket.emit('systemInfo', info);
    });
    
    socket.on('connectWithQR', () => {
        connectToWhatsApp('qr');
    });
    
    socket.on('connectWithPairingCode', (phoneNumber) => {
        connectToWhatsApp('pairingCode', phoneNumber);
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
            // Check if the connection is active before attempting status check
            if (sock.user && sock.user.id) {
                await sock.sendPresenceUpdate('available', 'status@broadcast');
                statusDebugLog('Performed periodic status check');
            } else {
                statusDebugLog('Skipping status check - connection not fully established');
            }
        } catch (error) {
            console.error('Periodic status check failed:', error);
            // Don't emit error to frontend for every failed check to avoid flooding
            if (error.message.includes('Cannot read properties of undefined')) {
                statusDebugLog('Connection not ready for status check');
            } else {
                io.emit('error', `Status check failed: ${error.message}`);
            }
        }
    }
}, 15000);

// Initialize
await loadCommands().then(() => {
    connectToWhatsApp('qr', null).catch(err => {
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

// Function to send response to user's personal number
async function sendToPersonalNumber(sock, response) {
    try {
        const personalNumber = process.env.PERSONAL_NUMBER;
        if (personalNumber) {
            await sock.sendMessage(`${personalNumber}@s.whatsapp.net`, { text: response });
            console.log('Response sent to personal number');
        }
    } catch (error) {
        console.error('Failed to send response to personal number:', error);
    }
}