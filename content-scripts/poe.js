// Poe (poe.com) - generic chat export/import
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'exportChat') {
    try {
      sendResponse({ messages: extractMessages() });
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
    if (src) attachments.push({ type: 'image', url: src.startsWith('data:') ? '[inline image]' : src });
  });
  container.querySelectorAll('a[href*="blob"], a[href*="download"], a[download]').forEach((a) => {
    const href = (a.getAttribute('href') || '').trim();
    if (href) attachments.push({ type: 'file', url: href, name: (a.getAttribute('download') || a.textContent || 'file').trim().slice(0, 80) });
  });
  return attachments;
}

function extractMessages() {
  const messages = [];
  const containers = document.querySelectorAll('[class*="message"], [class*="Message"], [class*="chat"], [data-role], [class*="bot"], [class*="human"], article');
  if (containers.length > 0) {
    containers.forEach((container) => {
      const content = (container.textContent || '').trim();
      const attachments = extractAttachmentsFromContainer(container);
      if (!content && attachments.length === 0) return;
      const isUser = container.classList.contains('human') || container.classList.contains('user') || container.getAttribute('data-role') === 'user' ||
        (container.querySelector('[class*="human"], [class*="user"]') !== null);
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
      const blocks = main.querySelectorAll('[class*="message"], [class*="bubble"], p, [class*="content"]');
      let role = 'user';
      blocks.forEach((el) => {
        const t = (el.textContent || '').trim();
        if (t.length > 5) {
          const attachments = extractAttachmentsFromContainer(el.closest('div') || el);
          messages.push({ role, content: t || '(attachment)', timestamp: new Date().toISOString(), ...(attachments.length ? { attachments } : {}) });
          role = role === 'user' ? 'assistant' : 'user';
        }
      });
    }
  }
  if (messages.length === 0) throw new Error('No messages found. Make sure you have an active Poe conversation.');
  return messages;
}

async function injectConversation(messages, condensedPrompt) {
  const text = condensedPrompt != null && condensedPrompt !== '' ? condensedPrompt : buildFullContextText(messages);
  const inputBox = document.querySelector('textarea') || document.querySelector('[contenteditable="true"]') || document.querySelector('[role="textbox"]') || document.querySelector('input[type="text"]');
  if (!inputBox) throw new Error('Could not find chat input. Make sure you\'re on a Poe chat page.');
  inputBox.focus();
  try { await navigator.clipboard.writeText(text); } catch (_) {}
  try {
    const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() });
    pasteEvent.clipboardData.setData('text/plain', text);
    inputBox.dispatchEvent(pasteEvent);
  } catch (_) {}
  if (inputBox.contentEditable === 'true') { inputBox.textContent = text; inputBox.innerText = text; } else inputBox.value = text;
  inputBox.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
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
  let out = "Here's my previous conversation that I want to continue:\n\n---\n\n";
  (messages || []).forEach((msg) => {
    const speaker = msg.role === 'user' ? 'Me' : 'Assistant';
    const attRef = (msg.attachments && msg.attachments.length) ? '\n[Attachments: ' + msg.attachments.map(a => a.url || a.name || '').filter(Boolean).join(', ') + ']' : '';
    out += `${speaker}: ${msg.content}${attRef}\n\n`;
  });
  return out + "---\n\nPlease continue from where we left off.";
}

function showImportSuccess(n, clipboardHint) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:20px;right:20px;background:#10a37f;color:white;padding:16px 24px;border-radius:8px;font-size:14px;font-weight:600;z-index:10000;max-width:320px;';
  el.textContent = clipboardHint ? `✓ Imported ${n} messages! If the text didn't appear, click the input and press Ctrl+V to paste.` : `✓ Imported ${n} messages! Review and send.`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 6000);
}
