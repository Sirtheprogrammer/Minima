export default {
    name: 'help',
    description: 'Shows help information about available commands',
    execute: async (sock, msg, args) => {
        const helpText = `*📱 Minima Bot Help*

*General Commands:*
• \`help\` - Show this help message
• \`ping\` - Check if the bot is responsive
• \`menu\` - Show command menu with ASCII art

*Status Commands:*
• \`togglestatus\` - Enable/disable auto status viewing and liking
• \`setemoji [emoji]\` - Set the emoji used for status reactions
• \`statusinfo\` - Show status feature information
• \`statusdebug\` - Toggle debug mode for status feature
• \`checkstatus\` - Manually check for new statuses

*Status Features:*
• Auto-viewing and liking of statuses
• Support for text, image, video, and audio statuses
• Rate limiting (50 reactions per hour)
• Cooldown between reactions (2 seconds)
• Retry mechanism for failed reactions
• Detailed status tracking and statistics

*Group Commands:*
• \`tagall [message] [options]\` - Tag members in group
  Options:
  - \`--admins\` or \`-a\` - Tag only admins
  - \`--online\` or \`-o\` - Tag online members
  - \`--limit <number>\` or \`-l <number>\` - Limit mentions (max 100)
  - \`--exclude <ids>\` or \`-e <ids>\` - Exclude specific members
• \`tagadmins [message]\` - Tag all admins (shorthand)
• \`tagonline [message]\` - Tag online members (shorthand)

*Anti-Delete Commands:*
• \`antidelete\` - Toggle anti-delete feature for the current chat
• \`antidelete status\` - Show anti-delete status and statistics
• \`antidelete clear\` - Clear stored messages for the current chat
• \`antidelete debug\` - Toggle debug mode for anti-delete feature

*Note:* 
• Commands are case-insensitive
• Use ! before commands (e.g., !help)
• Group commands require admin privileges in admin-only groups
• Tagging is limited to 100 members per message`;

        return helpText;
    }
}; 