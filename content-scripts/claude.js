// Claude content script - Scrapes messages from Claude.ai

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'exportChat') {
    try {
      const messages = extractClaudeMessages();
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
  return true; // Keep message channel open for async response
});

function extractAttachmentsFromContainer(container) {
  const attachments = [];
  if (!container) return attachments;
  container.querySelectorAll('img[src]').forEach((img) => {
    const src = (img.getAttribute('src') || '').trim();
    if (!src) return;
    attachments.push({ type: 'image', url: src.startsWith('data:') ? '[inline image]' : src });
  });
  container.querySelectorAll('a[href*="blob"], a[href*="download"], a[download]').forEach((a) => {
    const href = (a.getAttribute('href') || '').trim();
    if (href) attachments.push({ type: 'file', url: href, name: (a.getAttribute('download') || a.textContent || 'file').trim().slice(0, 80) });
  });
  return attachments;
}

function extractClaudeMessages() {
  const messages = [];
  const messageContainers = document.querySelectorAll('[data-test-render-count]');

  if (messageContainers.length === 0) {
    const alternativeContainers = document.querySelectorAll('.font-claude-message');
    if (alternativeContainers.length === 0) {
      throw new Error('No messages found. Make sure you have an active conversation.');
    }
    alternativeContainers.forEach((container) => {
      const role = container.closest('[data-is-user-message="true"]') ? 'user' : 'assistant';
      const content = container.textContent.trim();
      const attachments = extractAttachmentsFromContainer(container.closest('div') || container);
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
      const isUserMessage = container.getAttribute('data-is-user-message') === 'true' ||
        container.querySelector('[data-is-user-message="true"]') !== null;
      const role = isUserMessage ? 'user' : 'assistant';
      const messageContent = container.querySelector('.font-claude-message') ||
        container.querySelector('[class*="prose"]') || container;
      const content = messageContent ? messageContent.textContent.trim() : '';
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
    const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
    if (mainContent && mainContent.innerText.trim()) {
      throw new Error('Could not automatically detect message structure. Claude may have updated their interface.');
    }
    throw new Error('No messages found in the current conversation.');
  }
  return messages;
}

function findClaudeInput() {
  const selectors = ['div[contenteditable="true"]', 'textarea', '[role="textbox"]'];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (!el) continue;
    if (el.shadowRoot) {
      const inner = el.shadowRoot.querySelector('[contenteditable="true"]') || el.shadowRoot.querySelector('textarea') || el.shadowRoot.querySelector('[role="textbox"]');
      if (inner) return inner;
    }
    if (el.contentEditable === 'true' || el.tagName === 'TEXTAREA' || el.getAttribute('role') === 'textbox') return el;
  }
  return null;
}

// Inject conversation into Claude (full messages or pre-built condensed prompt)
async function injectConversation(messages, condensedPrompt) {
  const contextText = condensedPrompt != null && condensedPrompt !== '' ? condensedPrompt : buildFullContextText(messages);
  const inputBox = findClaudeInput();
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
  const opts = { key: 'v', code: 'KeyV', keyCode: 86, bubbles: true, cancelable: true };
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
  notification.style.cssText = `position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 16px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-width: 320px;`;
  notification.textContent = clipboardHint
    ? `✓ Imported ${messageCount} messages! If the text didn't appear, click the input and press Ctrl+V to paste.`
    : `✓ Imported ${messageCount} messages! Review and send.`;
  document.body.appendChild(notification);
  setTimeout(() => { notification.style.opacity = '0'; notification.style.transition = 'opacity 0.3s'; setTimeout(() => notification.remove(), 300); }, 6000);
}

// Inject a visual indicator when extension is active
function injectIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'chat-exporter-indicator';
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #4CAF50;
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
  
  // Show briefly when page loads
  setTimeout(() => {
    indicator.style.display = 'block';
    setTimeout(() => {
      indicator.style.display = 'none';
    }, 2000);
  }, 1000);
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectIndicator);
} else {
  injectIndicator();
}
