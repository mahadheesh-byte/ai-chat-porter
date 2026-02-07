// Popup.js - Main logic for the extension popup

let selectedFileData = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Export button
  document.getElementById('exportBtn').addEventListener('click', exportChat);
  
  // File selection
  document.getElementById('selectFileBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  
  document.getElementById('fileInput').addEventListener('change', handleFileSelect);
  
  // Import button
  document.getElementById('importBtn').addEventListener('click', importChat);
});

// Export current chat
async function exportChat() {
  const statusEl = document.getElementById('exportStatus');
  statusEl.textContent = 'Exporting...';
  statusEl.className = 'status';
  
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Determine platform
    const platform = getPlatformFromURL(tab.url);
    if (!platform) {
      throw new Error('Not on a supported AI chat. Open Claude, ChatGPT, Gemini, Grok, Perplexity, Copilot, Poe, Meta AI, or You.com.');
    }
    
    // Send message to content script with error handling
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'exportChat' });
    } catch (error) {
      // Content script not loaded - try to inject it
      statusEl.textContent = 'Loading extension on page...';
      const scriptFile = `content-scripts/${platform}.js`;
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [scriptFile]
      });
      
      // Wait a bit for script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try again
      response = await chrome.tabs.sendMessage(tab.id, { action: 'exportChat' });
    }
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    // Create JSON file
    const exportData = {
      platform: platform,
      export_date: new Date().toISOString(),
      messages: response.messages,
      metadata: {
        total_messages: response.messages.length,
        url: tab.url
      }
    };
    
    // Download file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${platform}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    statusEl.textContent = `✓ Exported ${response.messages.length} messages`;
    statusEl.className = 'status success';
    
  } catch (error) {
    statusEl.textContent = `✗ Error: ${error.message}`;
    statusEl.className = 'status error';
  }
}

// Handle file selection
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      selectedFileData = JSON.parse(e.target.result);
      
      // Validate format
      if (!selectedFileData.messages || !Array.isArray(selectedFileData.messages)) {
        throw new Error('Invalid chat export file (missing messages array)');
      }
      
      document.getElementById('selectedFile').textContent = `✓ ${file.name} (${selectedFileData.messages.length} messages)`;
      
      // Show API key section
      showApiKeySection();
      
    } catch (error) {
      document.getElementById('selectedFile').textContent = '✗ Invalid JSON file';
      document.getElementById('selectedFile').style.color = '#f44336';
    }
  };
  reader.readAsText(file);
}

// Show import section
async function showApiKeySection() {
  document.getElementById('importSection').style.display = 'block';
}

// Import chat
async function importChat() {
  const statusEl = document.getElementById('importStatus');
  
  if (!selectedFileData) {
    statusEl.textContent = '✗ Please select a file first';
    statusEl.className = 'status error';
    return;
  }
  
  statusEl.textContent = 'Injecting conversation...';
  statusEl.className = 'status';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentPlatform = getPlatformFromURL(tab.url);
    
    if (!currentPlatform) {
      throw new Error('Open a supported AI chat (e.g. Claude, ChatGPT, Gemini, Grok, Perplexity, Copilot, Poe, Meta AI, You.com) to import.');
    }
    
    const useCondensed = document.getElementById('useCondensed').checked;
    const condensedPrompt = useCondensed ? condenseConversation(selectedFileData.messages) : null;
    const textToPaste = condensedPrompt != null ? condensedPrompt : buildFullContextText(selectedFileData.messages);
    try {
      await navigator.clipboard.writeText(textToPaste);
    } catch (_) {}
    const payload = {
      action: 'importChat',
      messages: selectedFileData.messages,
      platform: currentPlatform
    };
    if (useCondensed) payload.condensedPrompt = condensedPrompt;

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, payload);
    } catch (e) {
      statusEl.textContent = 'Loading extension on page...';
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [`content-scripts/${currentPlatform}.js`]
      });
      await new Promise(r => setTimeout(r, 500));
      response = await chrome.tabs.sendMessage(tab.id, payload);
    }
    if (response && response.error) throw new Error(response.error);

    statusEl.textContent = useCondensed
      ? `✓ Done! Text is on your clipboard. Click inside the chat box, then press Ctrl+V (Cmd+V on Mac) if it didn't paste automatically.`
      : `✓ Done! Text is on your clipboard. Click inside the chat box, then press Ctrl+V (Cmd+V on Mac) if it didn't paste automatically.`;
    statusEl.className = 'status success';

  } catch (error) {
    statusEl.textContent = `✗ Error: ${error.message}`;
    statusEl.className = 'status error';
  }
}

function buildFullContextText(messages) {
  let out = "Here's my previous conversation that I want to continue:\n\n---\n\n";
  (messages || []).forEach((msg) => {
    const speaker = msg.role === 'user' ? 'Me' : 'Assistant';
    const attRef = (msg.attachments && msg.attachments.length) ? '\n[Attachments: ' + msg.attachments.map(a => a.url || a.name || '').filter(Boolean).join(', ') + ']' : '';
    out += `${speaker}: ${msg.content}${attRef}\n\n`;
  });
  return out + "---\n\nPlease continue from where we left off.";
}

// Condense conversation into a short prompt (same logic as context/context.py)
function truncateText(text, maxLen, suffix = '...') {
  const t = (text || '').trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - suffix.length).trimEnd() + suffix;
}

function attachmentRefs(msg) {
  if (!msg || !msg.attachments || msg.attachments.length === 0) return '';
  return ' [Attachments: ' + msg.attachments.map(a => a.url || a.name || '').filter(Boolean).join(', ') + ']';
}

function condenseConversation(messages, maxChars = 4000) {
  if (!messages || messages.length === 0) return 'No conversation to condense.';
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  const firstUser = messages.find(m => m.role === 'user');
  const firstContent = (firstUser && firstUser.content || '').trim();
  const lastUserContent = (lastUser && lastUser.content || '').trim();
  const lastAssistantContent = (lastAssistant && lastAssistant.content || '').trim();
  const hasAttachments = messages.some(m => m.attachments && m.attachments.length > 0);

  const middle = [];
  const n = messages.length;
  if (n > 4) {
    for (let i = 1; i < Math.max(1, n - 2); i++) {
      const c = (messages[i].content || '').trim();
      if (c.length >= 10) middle.push(truncateText(c, 100));
    }
  }

  let parts = ['Context from a previous conversation (continue from here):\n'];
  if (firstContent) parts.push('Topic / goal: ' + truncateText(firstContent, 300) + '\n');
  if (hasAttachments) parts.push('(Conversation included images or file attachments.)\n');
  if (middle.length > 0) {
    parts.push('Key points from the middle of the conversation:');
    middle.slice(0, 5).forEach(b => parts.push('  • ' + b));
    parts.push('');
  }
  parts.push('Last exchange:');
  if (lastUserContent || (lastUser && lastUser.attachments && lastUser.attachments.length)) {
    parts.push('  Me: ' + truncateText(lastUserContent, 800) + attachmentRefs(lastUser));
  }
  if (lastAssistantContent || (lastAssistant && lastAssistant.attachments && lastAssistant.attachments.length)) {
    parts.push('  Assistant: ' + truncateText(lastAssistantContent, 800) + attachmentRefs(lastAssistant));
  }
  parts.push('');
  parts.push('---\nPlease continue from where we left off.');

  let result = parts.join('\n').trim();
  if (result.length <= maxChars) return result;

  parts = [
    'Context from a previous conversation (continue from here):\n',
    firstContent ? 'Topic / goal: ' + truncateText(firstContent, 250) + '\n' : '',
    hasAttachments ? '(Conversation included images or file attachments.)\n' : '',
    'Last exchange:',
    lastUserContent || lastUser ? '  Me: ' + truncateText(lastUserContent, 500) + attachmentRefs(lastUser) : '',
    lastAssistantContent || lastAssistant ? '  Assistant: ' + truncateText(lastAssistantContent, 500) + attachmentRefs(lastAssistant) : '',
    '\n---\nPlease continue from where we left off.'
  ];
  result = parts.filter(Boolean).join('\n');
  if (result.length > maxChars) result = result.slice(0, maxChars - 25).trimEnd() + '\n\nPlease continue from here.';
  return result;
}

// Helper functions
function getPlatformFromURL(url) {
  if (!url) return null;
  if (url.includes('claude.ai')) return 'claude';
  if (url.includes('chatgpt.com')) return 'chatgpt';
  if (url.includes('gemini.google.com')) return 'gemini';
  if (url.includes('grok.com')) return 'grok';
  if (url.includes('perplexity.ai')) return 'perplexity';
  if (url.includes('copilot.microsoft.com')) return 'copilot';
  if (url.includes('bing.com')) return 'copilot';
  if (url.includes('poe.com')) return 'poe';
  if (url.includes('meta.ai')) return 'meta';
  if (url.includes('you.com')) return 'you';
  return null;
}

function getPlatformName(platform) {
  const names = {
    claude: 'Claude',
    chatgpt: 'ChatGPT',
    gemini: 'Gemini',
    grok: 'Grok',
    perplexity: 'Perplexity',
    copilot: 'Copilot',
    poe: 'Poe',
    meta: 'Meta AI',
    you: 'You.com'
  };
  return names[platform] || platform;
}
