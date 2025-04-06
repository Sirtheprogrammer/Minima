// commands/menu.js
export default {
    name: 'menu',
    description: 'Displays all commands with premium ASCII presentation',
    execute: async (sock, msg, args) => {
        const sender = msg.key.remoteJid;
        const menuText = `
╔════════════════════════════════════════════════════════════════════════════╗
║                           MINIMA BOT v0.0.1                                 ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  ╔══════════════════════════════════════════════════════════════════════╗  ║
║  ║                         ✨ STATUS FEATURES                            ║  ║
║  ╠══════════════════════════════════════════════════════════════════════╣  ║
║  ║  • !togglestatus  - Toggle auto status viewing/liking                 ║  ║
║  ║  • !setemoji      - Set reaction emoji for status liking              ║  ║
║  ║  • !statusinfo    - Show current status settings                      ║  ║
║  ║  • !statusdebug   - Toggle debug mode                                 ║  ║
║  ║  • !checkstatus   - Manually check statuses                           ║  ║
║  ╚══════════════════════════════════════════════════════════════════════╝  ║
║                                                                             ║
║  ╔══════════════════════════════════════════════════════════════════════╗  ║
║  ║                         ⚙️ BOT UTILITIES                              ║  ║
║  ╠══════════════════════════════════════════════════════════════════════╣  ║
║  ║  • !antidelete    - Toggle anti-delete feature                        ║  ║
║  ║  • !broadcast     - Admin broadcast tool                              ║  ║
║  ║  • !ping          - Check bot latency                                 ║  ║
║  ║  • !help          - Show detailed help                                ║  ║
║  ╚══════════════════════════════════════════════════════════════════════╝  ║
║                                                                             ║
║  ╔══════════════════════════════════════════════════════════════════════╗  ║
║  ║                         👥 GROUP COMMANDS                             ║  ║
║  ╠══════════════════════════════════════════════════════════════════════╣  ║
║  ║  • !tagall        - Tag all members in group                          ║  ║
║  ║  • !tagadmins     - Tag all admins in group                           ║  ║
║  ║  • !tagonline     - Tag all online members                            ║  ║
║  ╚══════════════════════════════════════════════════════════════════════╝  ║
║                      @sirtheprogrammer                                     ║
╚════════════════════════════════════════════════════════════════════════════╝
`;

        // Send to WhatsApp
        await sock.sendMessage(sender, { text: menuText });

        // Web interface update
        if (sock.io) {
            sock.io.emit('menu-render', { 
                categories: [],
                rendered: menuText,
                meta: { 
                    version: '2.4.1',
                    updatedAt: new Date().toLocaleString()
                }
            });
        }
    }
};