# Minima Bot

A lightweight WhatsApp automation bot with a modern web control panel.

## Features

- Modern web control panel
- QR code and pairing code connection methods
- System information monitoring
- Auto-typing and auto-recording features
- Activity logging
- Command system with multiple categories
- Anti-delete message functionality

## Installation

1. Make sure you have Node.js version 16 or higher installed
2. Clone this repository:
```bash
git clone https://github.com/Sirtheprogrammer/Minima.git
cd Minima
```

3. Install dependencies:
```bash
npm install
```

4. Set up environment variables (optional):
```bash
# For receiving command responses to your personal number
export PERSONAL_NUMBER="your_number_with_country_code"  # e.g., "+1234567890"
```

## Usage

1. Start the bot:
```bash
npm start
```

2. Open your web browser and navigate to:
```
http://localhost:3000
```

3. Connect to WhatsApp using either:
   - QR Code scanning
   - Pairing code with your phone number

## Available Commands

### Moderation
- `.ban` - Ban a user from the group
- `.kick` - Kick a user from the group
- `.mute` - Mute a user in the group
- `.warn` - Warn a user

### Settings
- `.prefix` - Change command prefix
- `.language` - Change bot language
- `.welcome` - Set welcome message

### Fun
- `.8ball` - Ask the magic 8-ball
- `.roll` - Roll a dice
- `.coinflip` - Flip a coin
- `.rps` - Play rock, paper, scissors

### Info
- `.help` - Show help for a command
- `.ping` - Check bot latency
- `.info` - Show system information
- `.uptime` - Show bot uptime

### Utility
- `.clear` - Clear chat messages
- `.poll` - Create a poll
- `.remind` - Set a reminder
- `.translate` - Translate text

### Music
- `.play` - Play a song
- `.skip` - Skip current song
- `.queue` - Show song queue
- `.nowplaying` - Show current song

## Contributing

Feel free to submit issues and pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
