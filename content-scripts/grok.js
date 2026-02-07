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

function extractGrokMessages() {
  const messages = [];
  const containers = document.querySelectorAll('[class*="message"], [class*="Message"], [data-role]');
  if (containers.length === 0) {
    const byRole = document.querySelectorAll('[class*="user"], [class*="assistant"], [class*="human"]');
    byRole.forEach((el) => {
      const content = (el.textContent || '').trim();
      if (content.length < 2) return;
      const isUser = el.classList.contains('user') || el.classList.contains('human') ||
        (el.getAttribute('data-role') === 'user');
      messages.push({
        role: isUser ? 'user' : 'assistant',
        content,
        timestamp: new Date().toISOString()
      });
    });
  } else {
    containers.forEach((container) => {
      const content = (container.textContent || '').trim();
      if (!content) return;
      const isUser = container.getAttribute('data-role') === 'user' ||
        container.classList.contains('user') || container.classList.contains('human');
      messages.push({
        role: isUser ? 'user' : 'assistant',
        content,
        timestamp: new Date().toISOString()
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
          messages.push({ role, content: t, timestamp: new Date().toISOString() });
          role = role === 'user' ? 'assistant' : 'user';
        }
      });
    }
  }
  if (messages.length === 0) throw new Error('No messages found. Make sure you have an active Grok conversation.');
  return messages;
}

async function injectConversation(messages, condensedPrompt) {
  const inputBox = document.querySelector('textarea') ||
    document.querySelector('[contenteditable="true"]') ||
    document.querySelector('[role="textbox"]') ||
    document.querySelector('input[type="text"]');

  if (!inputBox) {
    throw new Error('Could not find chat input box. Make sure you\'re on the Grok chat page.');
  }

  const contextText = condensedPrompt != null && condensedPrompt !== ''
    ? condensedPrompt
    : buildFullContextText(messages);

  inputBox.focus();
  if (inputBox.contentEditable === 'true') {
    inputBox.textContent = contextText;
  } else {
    inputBox.value = contextText;
  }
  inputBox.dispatchEvent(new Event('input', { bubbles: true }));
  inputBox.dispatchEvent(new Event('change', { bubbles: true }));
  showImportSuccess(messages ? messages.length : 1);
}

function buildFullContextText(messages) {
  let text = "Here's my previous conversation that I want to continue:\n\n---\n\n";
  (messages || []).forEach((msg) => {
    const speaker = msg.role === 'user' ? 'Me' : 'Assistant';
    text += `${speaker}: ${msg.content}\n\n`;
  });
  text += "---\n\nPlease continue from where we left off.";
  return text;
}

function showImportSuccess(messageCount) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10a37f;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  notification.textContent = `✓ Imported ${messageCount} messages! Review and send.`;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {});
} else {
  // no indicator needed
}
