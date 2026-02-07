# 🔄 AI Chat Exporter

<<<<<<< HEAD
The easiest way to move, backup, and manage your AI conversations. Export and import between Claude, ChatGPT, and Gemini—supports bulk exports, cross-platform imports, and simple clipboard transfer.
=======
Export and import conversations across **Claude, ChatGPT, Gemini, Grok, Perplexity, Copilot, Poe, Meta AI, and You.com**.
>>>>>>> f671ed0 (Update extension files with latest changes)

## Features

- ✅ **Export** conversations from all supported AI chats to JSON
- ✅ **Import** conversations by copying formatted context to clipboard
- ✅ **Universal JSON format** for easy data portability
- ✅ **Simple** - No API keys needed, just copy and paste!
- ✅ **Easy to use** - Simple browser extension interface

## Installation

### Step 1: Load the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `chat-exporter-extension` folder
5. The extension icon should appear in your toolbar!

That's it! No API keys needed.

## Usage

### Exporting a Conversation

1. Open a conversation on Claude, ChatGPT, or Gemini
2. Click the **AI Chat Exporter** extension icon
3. Click **Export Current Chat**
4. A JSON file will be downloaded with your conversation

### Importing a Conversation

1. Open any AI platform (Claude, ChatGPT, or Gemini)
2. Click the **AI Chat Exporter** extension icon
3. Click **Select JSON File** and choose your exported file
4. Click **Copy & Prepare Import**
5. The conversation will be copied to your clipboard in a formatted way
6. **Paste it into the chat** and send it
7. The AI will have full context and can continue the conversation!

## How It Works

### Export Process
The extension uses content scripts to scrape the visible conversation from each platform's web interface. It extracts:
- User messages
- Assistant responses
- Timestamps
- Platform metadata

Everything is saved in a universal JSON format. Messages may include optional `attachments` (images and file links):

```json
{
  "platform": "claude",
  "export_date": "2026-02-05T10:30:00.000Z",
  "messages": [
    {
      "role": "user",
      "content": "Hello!",
      "timestamp": "2026-02-05T10:30:00.000Z"
    },
    {
      "role": "assistant",
      "content": "Hi! How can I help you?",
      "timestamp": "2026-02-05T10:30:05.000Z"
    },
    {
      "role": "user",
      "content": "What's in this image?",
      "attachments": [{ "type": "image", "url": "https://..." }],
      "timestamp": "2026-02-05T10:31:00.000Z"
    }
  ],
  "metadata": {
    "total_messages": 3,
    "url": "https://claude.ai/chat/..."
  }
}
```

### Import Process
The extension makes importing simple:

1. Reads your exported JSON file
2. Formats the conversation in a readable way
3. Copies it to your clipboard
4. You paste it into any AI chat to provide context

The AI will read the entire conversation history and continue from where you left off!

## Privacy

- ✅ All data stays **on your device**
- ✅ No external servers or APIs involved
- ✅ Simple clipboard-based transfer
- ✅ You control what gets shared

## Supported Platforms

| Platform | Export | Import |
|----------|--------|--------|
| Claude | ✅ | ✅ |
| ChatGPT | ✅ | ✅ |
| Gemini | ✅ | ✅ |
| Grok | ✅ | ✅ |
| Perplexity | ✅ | ✅ |
| Microsoft Copilot (Bing) | ✅ | ✅ |
| Poe | ✅ | ✅ |
| Meta AI | ✅ | ✅ |
| You.com | ✅ | ✅ |

## Troubleshooting

### "No messages found"
- Make sure you're on an active conversation page
- Try scrolling through the conversation to load all messages
- The platform may have updated their interface - content scripts may need updating

### Extension not appearing
- Make sure you've loaded it in Developer mode
- Check that all files are in the correct locations
- Look for errors in `chrome://extensions/` under the extension details

## Development

### File Structure
```
chat-exporter-extension/
├── manifest.json           # Extension configuration
├── popup.html             # Extension popup interface
├── popup.css              # Popup styling
├── popup.js               # Main popup logic
├── content-scripts/
│   ├── claude.js          # Claude scraper
│   ├── chatgpt.js         # ChatGPT scraper
│   └── gemini.js          # Gemini scraper
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Adding Support for New Platforms

1. Add a new content script in `content-scripts/your-platform.js`
2. Add the script to `manifest.json` under `content_scripts`
3. Implement the message extraction logic
4. Add API endpoint details to `popup.js`
5. Test thoroughly!

## Known Limitations

- Exports visible conversation text plus **image and file references** (URLs/links). Inline images are noted as `[inline image]`; re-uploading files into the target chat is not done automatically—import pastes attachment references so the AI knows they existed.
- Platform-specific features (e.g. Claude artifacts) may not transfer fully.
- Very long conversations may hit context limits of the target AI.

## Future Improvements

- [ ] Optional re-upload of images/files on import (where the target platform allows)
- [ ] Batch export for multiple conversations
- [ ] Support for more platforms (Perplexity, etc.)
- [ ] Better formatting options
- [ ] Export to other formats (Markdown, PDF, etc.)
- [ ] Direct API integration (optional for advanced users)

## Contributing

This is an open-source project! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

## License

MIT License - feel free to use and modify!

## Disclaimer

This extension is not affiliated with Anthropic, OpenAI, or Google. Use at your own risk. Always review exported data before importing to ensure accuracy.

---

Built with ❤️ for the AI community
