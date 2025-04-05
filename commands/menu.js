// commands/menu.js
export default {
    name: 'menu',
    description: 'Displays all commands with premium ASCII presentation',
    execute: async (sock, msg, args) => {
        const sender = msg.key.remoteJid;
        const commandCategories = [
            {
                name: '✨ Status Features',
                icon: '📊',
                commands: [
                    { name: 'togglestatus', desc: 'Toggle auto status viewing/liking', usage: '/togglestatus', aliases: ['ts'] },
                    { name: 'setemoji', desc: 'Set reaction emoji for status liking', usage: '/setemoji [emoji]', aliases: ['se'] },
                    { name: 'statusinfo', desc: 'Show current status settings', usage: '/statusinfo', aliases: ['si'] },
                    { name: 'statusdebug', desc: 'Toggle debug mode', usage: '/statusdebug', aliases: ['sd'] },
                    { name: 'checkstatus', desc: 'Manually check statuses', usage: '/checkstatus', aliases: ['cs'] }
                ]
            },
            {
                name: '⚙️ Bot Utilities',
                icon: '🔧',
                commands: [
                    { name: 'antidelete', desc: 'Toggle anti-delete feature', usage: '/antidelete', aliases: ['ad'] },
                    { name: 'broadcast', desc: 'Admin broadcast tool', usage: '/broadcast [message]', aliases: ['bc'] },
                    { name: 'ping', desc: 'Check bot latency', usage: '/ping', aliases: [] }
                ]
            }
        ];

        const menuHeader = `
╔═══╗╔╗──╔╗╔════╗╔══╗╔══╗╔╗──╔╗
║╔═╗║║║──║║║╔╗╔╗║║╔╗║║╔╗║║║──║║
║║─╚╝║╚╗╔╝║╚╝║║╚╝║╚╝╚╝║║║║╚╗╔╝║
║║─╔╗║╔╗╔╗║──║║──║╔═╗─║║║║╔╗╔╗║
║╚═╝║║║╚╝║║──║║──║╚═╝╔╝╚╝║║╚╝║║
╚═══╝╚╝──╚╝──╚╝──╚═══╝╚══╝╚╝──╚╝
        `.trim();

        const categoryTemplate = (category) => `
╔${'═'.repeat(38)}╗
║  ${category.icon} ${category.name.padEnd(32)}║
╠${'═'.repeat(38)}╣
${category.commands.map(cmd => commandTemplate(cmd)).join('\n')}
╚${'═'.repeat(38)}╝
        `.trim();

        const commandTemplate = (cmd) => `
║ ✦ ${cmd.name.padEnd(12)} ${aliasesTemplate(cmd.aliases)}║
║   ${cmd.desc.padEnd(35)}║
║   ⚡ ${`Usage: ${cmd.usage}`.padEnd(35)}║
╟${'─'.repeat(38)}╢
        `.trim();

        const aliasesTemplate = (aliases) => {
            return aliases.length > 0 
                ? `(Also: ${aliases.map(a => `/${a}`).join(', ')})`.padEnd(22)
                : ''.padEnd(22);
        };

        const menuFooter = `
╔${'═'.repeat(38)}╗
║ 📜 *Command Guide*                     ║
╠${'═'.repeat(38)}╣
║ • Use / before commands               ║
║ • [optional] <required> parameters    ║
║ • Aliases work for all commands       ║
║ • Bot version: 2.4.1                  ║
╚${'═'.repeat(38)}╝
        `.trim();

        let menuText = `${menuHeader}\n\n`;

        commandCategories.forEach(category => {
            menuText += `${categoryTemplate(category)}\n\n`;
        });

        menuText += menuFooter;

        // Send to WhatsApp
        await sock.sendMessage(sender, { text: menuText });

        // Web interface update
        if (sock.io) {
            sock.io.emit('menu-render', { 
                categories: commandCategories,
                rendered: menuText,
                meta: { 
                    version: '2.4.1',
                    updatedAt: new Date().toLocaleString()
                }
            });
        }
    }
};