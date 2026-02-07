// Grok content script - Scrapes messages from Grok (grok.com)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'exportChat') {
    try {
      const messages = extractGrokMessages();
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

function extractGrokMessages() {
  const messages = [];
  const containers = document.querySelectorAll('[class*="message"], [class*="Message"], [data-role]');
  if (containers.length === 0) {
    const byRole = document.querySelectorAll('[class*="user"], [class*="assistant"], [class*="human"]');
    byRole.forEach((el) => {
      const content = (el.textContent || '').trim();
      const attachments = extractAttachmentsFromContainer(el);
      if (content.length < 2 && attachments.length === 0) return;
      const isUser = el.classList.contains('user') || el.classList.contains('human') ||
        (el.getAttribute('data-role') === 'user');
      messages.push({
        role: isUser ? 'user' : 'assistant',
        content: content || '(attachment)',
        timestamp: new Date().toISOString(),
        ...(attachments.length ? { attachments } : {})
      });
    });
  } else {
    containers.forEach((container) => {
      const content = (container.textContent || '').trim();
      const attachments = extractAttachmentsFromContainer(container);
      if (!content && attachments.length === 0) return;
      const isUser = container.getAttribute('data-role') === 'user' ||
        container.classList.contains('user') || container.classList.contains('human');
      messages.push({
        role: isUser ? 'user' : 'assistant',
        content: content || '(attachment)',
        timestamp: new Date().toISOString(),
        ...(attachments.length ? { attachments } : {})
      });
    });
  }
  if (messages.length === 0) {
    const main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main) {
      const paragraphs = main.querySelectorAll('p, [class*="content"], [class*="text"]');
      let role = 'user';
      paragraphs.forEach((p) => {
        const t = (p.textContent || '').trim();
        if (t.length > 5) {
          const attachments = extractAttachmentsFromContainer(p.parentElement);
          messages.push({
            role,
            content: t || '(attachment)',
            timestamp: new Date().toISOString(),
            ...(attachments.length ? { attachments } : {})
          });
          role = role === 'user' ? 'assistant' : 'user';
        }
      });
    }
  }
  if (messages.length === 0) throw new Error('No messages found. Make sure you have an active Grok conversation.');
  return messages;
}

async function injectConversation(messages, condensedPrompt) {
  const contextText = condensedPrompt != null && condensedPrompt !== '' ? condensedPrompt : buildFullContextText(messages);
  const inputBox = document.querySelector('textarea') || document.querySelector('[contenteditable="true"]') || document.querySelector('[role="textbox"]') || document.querySelector('input[type="text"]');
  if (!inputBox) throw new Error('Could not find chat input box. Make sure you\'re on the Grok chat page.');

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
  notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10a37f; color: white; padding: 16px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-width: 320px;';
  notification.textContent = clipboardHint
    ? `✓ Imported ${messageCount} messages! If the text didn't appear, click the input and press Ctrl+V to paste.`
    : `✓ Imported ${messageCount} messages! Review and send.`;
  document.body.appendChild(notification);
  setTimeout(() => { notification.style.opacity = '0'; notification.style.transition = 'opacity 0.3s'; setTimeout(() => notification.remove(), 300); }, 6000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {});
} else {
  // no indicator needed
}
