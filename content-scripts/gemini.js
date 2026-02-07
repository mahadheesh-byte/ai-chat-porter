// Gemini content script - Scrapes messages from Gemini

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'exportChat') {
    try {
      const messages = extractGeminiMessages();
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

function extractGeminiMessages() {
  const messages = [];
  const messageContainers = document.querySelectorAll('.message-content, [class*="message"]');

  if (messageContainers.length === 0) {
    throw new Error('No messages found. Make sure you have an active conversation.');
  }

  messageContainers.forEach((container) => {
    const parent = container.closest('[class*="user"]') || container.closest('[data-test-id*="user"]');
    const isUserMessage = parent !== null ||
      container.classList.contains('user-message') ||
      container.querySelector('[class*="user"]') !== null;
    const role = isUserMessage ? 'user' : 'assistant';
    const content = container.textContent.trim();
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

  if (messages.length === 0) {
    const conversationArea = document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('.conversation');
    if (conversationArea) {
      const allDivs = conversationArea.querySelectorAll('div[class*="message"], div[class*="response"]');
      allDivs.forEach((div, index) => {
        const content = div.textContent.trim();
        if (content && content.length > 10) {
          const role = index % 2 === 0 ? 'user' : 'assistant';
          const attachments = extractAttachmentsFromContainer(div);
          messages.push({
            role,
            content: content || '(attachment)',
            timestamp: new Date().toISOString(),
            ...(attachments.length ? { attachments } : {})
          });
        }
      });
    }
  }

  if (messages.length === 0) {
    throw new Error('No messages found. Gemini interface may have changed.');
  }
  return messages;
}

// Find the real editable element (Gemini often uses custom elements / shadow DOM)
function findGeminiInput() {
  const selectors = [
    'rich-textarea',
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '.ql-editor',
    '[data-placeholder]'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (!el) continue;
    if (el.shadowRoot) {
      const inner = el.shadowRoot.querySelector('[contenteditable="true"]') ||
        el.shadowRoot.querySelector('textarea') ||
        el.shadowRoot.querySelector('[role="textbox"]') ||
        el.shadowRoot.querySelector('.ql-editor');
      if (inner) return inner;
    }
    if (el.contentEditable === 'true' || el.tagName === 'TEXTAREA' || el.getAttribute('role') === 'textbox') return el;
  }
  return null;
}

// Inject conversation into Gemini (full messages or pre-built condensed prompt)
async function injectConversation(messages, condensedPrompt) {
  const contextText = condensedPrompt != null && condensedPrompt !== ''
    ? condensedPrompt
    : buildFullContextText(messages);

  const inputBox = findGeminiInput();
  if (!inputBox) {
    throw new Error('Could not find chat input box. Make sure you\'re on the chat page.');
  }

  inputBox.focus();

  // Copy to clipboard so user can Ctrl+V if injection doesn't show (Gemini uses custom input)
  try {
    await navigator.clipboard.writeText(contextText);
  } catch (_) {}

  // Try programmatic paste so Gemini's input updates
  try {
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer()
    });
    pasteEvent.clipboardData.setData('text/plain', contextText);
    inputBox.dispatchEvent(pasteEvent);
  } catch (_) {}

  // Also set value/textContent and fire events (works when input is a plain textarea/editable)
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

// Show import success message (clipboardHint: if true, mention Ctrl+V for Gemini)
function showImportSuccess(messageCount, clipboardHint) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4285f4;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 320px;
  `;
  notification.textContent = clipboardHint
    ? `✓ Imported ${messageCount} messages! If the text didn't appear, click the input and press Ctrl+V to paste.`
    : `✓ Imported ${messageCount} messages! Review and send.`;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 6000);
}

// Inject indicator
function injectIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'chat-exporter-indicator';
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #4285f4;
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
