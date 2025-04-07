import { readdirSync } from 'fs';
import { join } from 'path';

const commands = new Map();

// Load all command files
const commandFiles = readdirSync(__dirname)
    .filter(file => file.endsWith('.js') && file !== 'index.js');

for (const file of commandFiles) {
    try {
        const command = await import(join(__dirname, file));
        if (command.default?.name) {
            commands.set(command.default.name, command.default);
            console.log(`Loaded command: ${command.default.name}`);
        }
    } catch (error) {
        console.error(`Error loading command ${file}:`, error);
    }
}

// Command categories
export const categories = {
    MODERATION: ['ban', 'kick', 'mute', 'warn'],
    SETTINGS: ['prefix', 'language', 'welcome'],
    FUN: ['8ball', 'roll', 'coinflip', 'rps'],
    INFO: ['help', 'ping', 'info', 'uptime'],
    UTILITY: ['clear', 'poll', 'remind', 'translate'],
    MUSIC: ['play', 'skip', 'queue', 'nowplaying']
};

// Get commands by category
export function getCommandsByCategory(category) {
    return categories[category]?.map(cmdName => commands.get(cmdName)).filter(Boolean) || [];
}

// Get all commands
export function getAllCommands() {
    return Array.from(commands.values());
}

// Get a specific command
export function getCommand(name) {
    return commands.get(name);
}

// Check if a command exists
export function hasCommand(name) {
    return commands.has(name);
}

export default commands; 