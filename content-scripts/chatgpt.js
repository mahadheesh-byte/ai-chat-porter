// ChatGPT content script - Scrapes messages from ChatGPT

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'exportChat') {
    try {
      const messages = extractChatGPTMessages();
      sendResponse({ messages });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  } else if (request.action === 'importChat') {
    try {
      injectConversation(request.messages || [], request.condensedPrompt);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }
  return true;
});

function extractAttachmentsFromContainer(container) {
  const attachments = [];
  if (!container) return attachments;
  const imgs = container.querySelectorAll('img[src]');
  imgs.forEach((img) => {
    const src = (img.getAttribute('src') || '').trim();
    if (!src) return;
    if (src.startsWith('data:')) {
      attachments.push({ type: 'image', url: '[inline image]' });
    } else {
      attachments.push({ type: 'image', url: src });
    }
  });
  const fileLinks = container.querySelectorAll('a[href*="blob"], a[href*="download"], a[download]');
  fileLinks.forEach((a) => {
    const href = (a.getAttribute('href') || '').trim();
    const name = (a.getAttribute('download') || a.textContent || 'file').trim().slice(0, 80);
    if (href) attachments.push({ type: 'file', url: href, name });
  });
  return attachments;
}

function extractChatGPTMessages() {
  const messages = [];
  const messageContainers = document.querySelectorAll('article[data-testid^="conversation-turn"]');

  if (messageContainers.length === 0) {
    const allArticles = document.querySelectorAll('article');
    if (allArticles.length === 0) {
      throw new Error('No messages found. Make sure you have an active conversation.');
    }
    allArticles.forEach((article) => {
      const content = article.textContent.trim();
      const hasUserIndicator = article.querySelector('[data-message-author-role="user"]') !== null;
      const role = hasUserIndicator ? 'user' : 'assistant';
      const attachments = extractAttachmentsFromContainer(article);
      if (content || attachments.length > 0) {
        messages.push({
          role,
          content: content || '(attachment)',
          timestamp: new Date().toISOString(),
          ...(attachments.length ? { attachments } : {})
        });
      }
    });
  } else {
    messageContainers.forEach((container) => {
      const testId = container.getAttribute('data-testid');
      const isUserMessage = testId && testId.includes('user');
      const authorRole = container.querySelector('[data-message-author-role]');
      const role = authorRole ?
        (authorRole.getAttribute('data-message-author-role') === 'user' ? 'user' : 'assistant') :
        (isUserMessage ? 'user' : 'assistant');
      const contentDiv = container.querySelector('.markdown') ||
        container.querySelector('[class*="prose"]') ||
        container;
      const content = contentDiv ? contentDiv.textContent.trim() : '';
      const attachments = extractAttachmentsFromContainer(container);
      if (content || attachments.length > 0) {
        messages.push({
          role,
          content: content || '(attachment)',
          timestamp: new Date().toISOString(),
          ...(attachments.length ? { attachments } : {})
        });
      }
    });
  }

  if (messages.length === 0) {
    throw new Error('No messages found in the current conversation.');
  }
  return messages;
}

function findChatGPTInput() {
  const selectors = [
    'textarea[data-id]',
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'form textarea',
    'form [contenteditable="true"]',
    '[placeholder*="Ask"]',
    '[placeholder*="Message"]',
    '[id*="prompt"]',
    '[data-id*="input"]'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (!el) continue;
    if (el.shadowRoot) {
      const inner = el.shadowRoot.querySelector('textarea') || el.shadowRoot.querySelector('[contenteditable="true"]') || el.shadowRoot.querySelector('[role="textbox"]');
      if (inner) return inner;
    }
    if (el.tagName === 'TEXTAREA' || el.contentEditable === 'true' || el.getAttribute('role') === 'textbox') return el;
  }
  const byPlaceholder = document.querySelector('textarea[placeholder], [contenteditable="true"][data-placeholder]');
  if (byPlaceholder) return byPlaceholder;
  return null;
}

// Inject conversation into ChatGPT (full messages or pre-built condensed prompt)
async function injectConversation(messages, condensedPrompt) {
  const contextText = condensedPrompt != null && condensedPrompt !== '' ? condensedPrompt : buildFullContextText(messages);
  const inputBox = findChatGPTInput();
  if (!inputBox) throw new Error('Could not find chat input box. Make sure you\'re on the chat page.');

  inputBox.focus();
  try { await navigator.clipboard.writeText(contextText); } catch (_) {}
  try {
    const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() });
    pasteEvent.clipboardData.setData('text/plain', contextText);
    inputBox.dispatchEvent(pasteEvent);
  } catch (_) {}
  if (inputBox.contentEditable === 'true') {
    inputBox.textContent = contextText;
    inputBox.innerText = contextText;
  } else {
    inputBox.value = contextText;
  }
  inputBox.dispatchEvent(new InputEvent('input', { bubbles: true, data: contextText, inputType: 'insertText' }));
  inputBox.dispatchEvent(new Event('input', { bubbles: true }));
  inputBox.dispatchEvent(new Event('change', { bubbles: true }));
  simulateCtrlV(inputBox);
  showImportSuccess(messages ? messages.length : 1, true);
}

function simulateCtrlV(target) {
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const key = 'v';
  const keyCode = 86;
  const opts = { key, code: 'KeyV', keyCode, bubbles: true, cancelable: true };
  target.dispatchEvent(new KeyboardEvent('keydown', { ...opts, ctrlKey: !isMac, metaKey: isMac }));
  target.dispatchEvent(new KeyboardEvent('keypress', { ...opts, ctrlKey: !isMac, metaKey: isMac }));
  target.dispatchEvent(new KeyboardEvent('keyup', { ...opts, ctrlKey: !isMac, metaKey: isMac }));
}

function buildFullContextText(messages) {
  let text = "Here's my previous conversation that I want to continue:\n\n---\n\n";
  (messages || []).forEach((msg) => {
    const speaker = msg.role === 'user' ? 'Me' : 'Assistant';
    const attRef = (msg.attachments && msg.attachments.length)
      ? '\n[Attachments: ' + msg.attachments.map(a => a.url || a.name || '').filter(Boolean).join(', ') + ']'
      : '';
    text += `${speaker}: ${msg.content}${attRef}\n\n`;
  });
  text += "---\n\nPlease continue from where we left off.";
  return text;
}

function showImportSuccess(messageCount, clipboardHint) {
  const notification = document.createElement('div');
  notification.style.cssText = `position: fixed; top: 20px; right: 20px; background: #10a37f; color: white; padding: 16px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-width: 320px;`;
  notification.textContent = clipboardHint
    ? `✓ Imported ${messageCount} messages! If the text didn't appear, click the input and press Ctrl+V to paste.`
    : `✓ Imported ${messageCount} messages! Review and send.`;
  document.body.appendChild(notification);
  setTimeout(() => { notification.style.opacity = '0'; notification.style.transition = 'opacity 0.3s'; setTimeout(() => notification.remove(), 300); }, 6000);
}

// Inject indicator
function injectIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'chat-exporter-indicator';
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #10a37f;
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    display: none;
  `;
  indicator.textContent = '✓ Chat Exporter Ready';
  document.body.appendChild(indicator);
  
  setTimeout(() => {
    indicator.style.display = 'block';
    setTimeout(() => {
      indicator.style.display = 'none';
    }, 2000);
  }, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectIndicator);
} else {
  injectIndicator();
}
