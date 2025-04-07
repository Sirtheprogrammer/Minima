import express from 'express';
import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import QRCode from 'qrcode';
import { setupAntiDeleteListeners } from './commands/antidelete.js';
import os from 'os';
import http from 'http';
import fsPromises from 'fs/promises';
import { config } from 'dotenv';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

config();

// System Information
const systemInfo = {
    startTime: Date.now(),
    platform: os.platform(),
    architecture: os.arch(),
    nodeVersion: process.version,
    messagesHandled: 0,
    commandsHandled: 0,
    version: process.env.BOT_VERSION || '0.0.1',
    getUptime: function() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;
        
        let uptimeStr = '';
        if (days > 0) uptimeStr += `${days}d `;
        if (hours > 0) uptimeStr += `${hours}h `;
        if (minutes > 0) uptimeStr += `${minutes}m `;
        uptimeStr += `${seconds}s`;
        
        return uptimeStr;
    },
    getMemoryUsage: function() {
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        return `${Math.round(used)}MB`;
    },
    getCpuUsage: function() {
        const loadAvg = os.loadavg()[0];
        return `${Math.round(loadAvg * 100)}%`;
    }
};

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

// Add global settings at the top after imports
global.settings = {
    prefix: process.env.PREFIX || '.',
    typingDuration: parseInt(process.env.TYPING_DURATION) || 1000,
    autoTyping: process.env.AUTO_TYPING === 'true',
    autoRecording: process.env.AUTO_RECORDING === 'true',
    statusAutoReply: process.env.STATUS_AUTO_REPLY === 'true'
};

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process'
        ],
        executablePath: process.env.CHROME_BIN || null
    }
});

// Command handler
global.commands = new Map();

// Load commands
async function loadCommands() {
    try {
        const { loadCommands: loadCommandsFromIndex } = await import('./commands/index.js');
        await loadCommandsFromIndex();
        console.log('All commands loaded successfully');
    } catch (error) {
        console.error('Error loading commands:', error);
    }
}

// Update the message handler section
client.on('message', async (msg) => {
    try {
        if (!msg.body.startsWith(global.settings.prefix)) return;

        const args = msg.body.slice(global.settings.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = global.commands.get(commandName);

        if (!command) return;

        // Track message handling
        systemInfo.messagesHandled++;

        // Show typing indicator briefly
        if (global.settings.autoTyping) {
            const chat = await msg.getChat();
            chat.sendStateTyping();
            
            // Execute command immediately without waiting for typing
            executeCommand(command, msg, args);
            
            // Clear typing state after brief duration
            setTimeout(() => {
                chat.clearState();
            }, global.settings.typingDuration);
        } else {
            // Execute command immediately if typing is disabled
            executeCommand(command, msg, args);
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
});

// Execute command with error handling
async function executeCommand(command, msg, args) {
    try {
        systemInfo.commandsHandled++;
        const result = await command.execute(client, msg, args);
        
        // If command was executed from web interface, send result to owner's WhatsApp
        if (msg.fromWeb) {
            const ownerNumber = process.env.OWNER_NUMBER + '@s.whatsapp.net';
            await client.sendMessage(ownerNumber, {
                text: `🤖 *Command Executed from Web*\n\n` +
                      `📝 Command: ${command.name}\n` +
                      `📌 Args: ${args.join(' ') || 'none'}\n` +
                      `⏰ Time: ${new Date().toLocaleString()}\n` +
                      `✨ Status: Success`
            });
        }
        
        return result;
    } catch (error) {
        console.error(`Error executing command ${command.name}:`, error);
        const errorMsg = 'An error occurred while executing the command. Please try again.';
        
        if (msg.fromWeb) {
            const ownerNumber = process.env.OWNER_NUMBER + '@s.whatsapp.net';
            await client.sendMessage(ownerNumber, {
                text: `🤖 *Command Execution Failed*\n\n` +
                      `📝 Command: ${command.name}\n` +
                      `📌 Args: ${args.join(' ') || 'none'}\n` +
                      `⏰ Time: ${new Date().toLocaleString()}\n` +
                      `❌ Error: ${error.message}`
            });
        }
        
        await client.sendMessage(msg.from, { text: errorMsg });
    }
}

// Add this near the top with other global variables
let isAuthenticated = false;

// Update the socket.io connection handler
io.on('connection', (socket) => {
    console.log('Frontend connected');
    
    // Send initial connection status based on actual authentication
    socket.emit('connection-status', isAuthenticated ? 'connected' : 'disconnected');
    
    // Send initial system info
    socket.emit('system-info', {
        uptime: systemInfo.getUptime(),
        memoryUsage: systemInfo.getMemoryUsage(),
        cpuUsage: systemInfo.getCpuUsage(),
        messagesHandled: systemInfo.messagesHandled,
        commandsHandled: systemInfo.commandsHandled,
        version: systemInfo.version
    });
    
    // Send available commands
    const commandList = Array.from(global.commands.values()).map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        usage: cmd.usage,
        category: cmd.category || 'MISC'
    }));
    socket.emit('commands', commandList);

    socket.on('getSystemInfo', () => {
        socket.emit('system-info', {
            uptime: systemInfo.getUptime(),
            memoryUsage: systemInfo.getMemoryUsage(),
            cpuUsage: systemInfo.getCpuUsage(),
            messagesHandled: systemInfo.messagesHandled,
            commandsHandled: systemInfo.commandsHandled,
            version: systemInfo.version
        });
    });

    socket.on('getCommands', () => {
        const commandList = Array.from(global.commands.values()).map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            usage: cmd.usage,
            category: cmd.category || 'MISC'
        }));
        socket.emit('commands', commandList);
    });

    socket.on('executeCommand', async (data) => {
        try {
            const { command, args } = data;
            const cmd = global.commands.get(command);
            
            if (!cmd) {
                socket.emit('command-result', `Command '${command}' not found`);
                return;
            }
            
            // Create a mock message object for the command
            const mockMsg = {
                from: process.env.OWNER_NUMBER + '@s.whatsapp.net',
                author: process.env.OWNER_NUMBER + '@s.whatsapp.net',
                body: `${global.settings.prefix}${command} ${args}`,
                key: {
                    remoteJid: process.env.OWNER_NUMBER + '@s.whatsapp.net'
                },
                getChat: async () => ({
                    sendStateTyping: async () => {},
                    clearState: async () => {}
                }),
                fromWeb: true // Flag to indicate command was executed from web interface
            };
            
            // Execute the command
            await executeCommand(cmd, mockMsg, args.split(' '));
            socket.emit('command-result', `Command '${command}' executed successfully`);
        } catch (error) {
            console.error('Error executing command from frontend:', error);
            socket.emit('command-result', `Error executing command: ${error.message}`);
        }
    });

    socket.on('setAutoTyping', (value) => {
        global.settings.autoTyping = value;
    });

    socket.on('setAutoRecording', (value) => {
        global.settings.autoRecording = value;
    });

    socket.on('setTypingDuration', (duration) => {
        global.settings.typingDuration = Math.max(500, Math.min(duration, 3000)); // Limit between 500ms and 3s
    });

    socket.on('setPrefix', (prefix) => {
        if (prefix && prefix.length === 1) {
            global.settings.prefix = prefix;
        }
    });

    socket.on('toggleStatusFeature', (value) => {
        autoStatusConfig.enabled = value;
    });

    socket.on('connectWithQR', () => {
        if (isConnecting) {
            socket.emit('error', 'Already attempting to connect');
            return;
        }
        
        isConnecting = true;
        isAuthenticated = false;
        connectionAttempts = 0;
        
        // Clear any existing QR code first
        socket.emit('qr', null);
        
        // Notify frontend of connecting status
        socket.emit('connection-status', 'connecting');
        
        // Start WhatsApp client
        client.initialize().catch(err => {
            console.error('Failed to initialize client:', err);
            socket.emit('error', 'Failed to initialize WhatsApp client');
            isConnecting = false;
            isAuthenticated = false;
            socket.emit('connection-status', 'disconnected');
        });
    });

    socket.on('connectWithPairingCode', (phoneNumber) => {
        if (isConnecting) {
            socket.emit('error', 'Already attempting to connect');
            return;
        }
        
        isConnecting = true;
        connectionAttempts = 0;
        
        // Notify frontend of connecting status
        socket.emit('connection-status', 'connecting');
        
        // Generate pairing code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Send pairing code to frontend
        socket.emit('pairingCode', code);
        
        // In a real implementation, you would use this code to pair with WhatsApp
        // For now, we'll just simulate a successful connection after a delay
        setTimeout(() => {
            isConnecting = false;
            socket.emit('connection-status', 'connected');
        }, 3000);
    });
});

// Update WhatsApp client events
client.on('qr', (qr) => {
    console.log('QR Code received');
    isAuthenticated = false;
    
    // Generate QR code as data URL
    QRCode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('Error generating QR code:', err);
            return;
        }
        
        // Send QR code and update connection status
        io.emit('connection-status', 'awaiting_qr');
        io.emit('qr', url);
    });
});

client.on('ready', () => {
    console.log('Client is ready!');
    isConnecting = false;
    isAuthenticated = true;
    io.emit('connection-status', 'connected');
});

client.on('authenticated', () => {
    console.log('Client is authenticated!');
    isAuthenticated = true;
    io.emit('connection-status', 'connected');
});

client.on('auth_failure', (err) => {
    console.error('Authentication failure:', err);
    isAuthenticated = false;
    isConnecting = false;
    io.emit('error', 'Authentication failed');
    io.emit('connection-status', 'disconnected');
});

client.on('disconnected', (reason) => {
    console.log('Client was disconnected:', reason);
    isAuthenticated = false;
    isConnecting = false;
    io.emit('connection-status', 'disconnected');
    
    // Clear any existing QR code
    io.emit('qr', null);
});

// Initialize bot
async function initialize() {
    try {
        await loadCommands();
        await client.initialize();
        
        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    try {
        await client.destroy();
        server.close();
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

initialize();