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

function extractClaudeMessages() {
  const messages = [];
  
  // Claude uses specific DOM structure for messages
  // This selector targets the message containers
  const messageContainers = document.querySelectorAll('[data-test-render-count]');
  
  if (messageContainers.length === 0) {
    // Try alternative selector
    const alternativeContainers = document.querySelectorAll('.font-claude-message');
    
    if (alternativeContainers.length === 0) {
      throw new Error('No messages found. Make sure you have an active conversation.');
    }
    
    alternativeContainers.forEach((container) => {
      const role = container.closest('[data-is-user-message="true"]') ? 'user' : 'assistant';
      const content = container.textContent.trim();
      
      if (content) {
        messages.push({
          role,
          content,
          timestamp: new Date().toISOString()
        });
      }
    });
  } else {
    messageContainers.forEach((container) => {
      // Determine if user or assistant message
      const isUserMessage = container.getAttribute('data-is-user-message') === 'true' ||
                           container.querySelector('[data-is-user-message="true"]') !== null;
      
      const role = isUserMessage ? 'user' : 'assistant';
      
      // Extract text content
      const messageContent = container.querySelector('.font-claude-message') ||
                            container.querySelector('[class*="prose"]') ||
                            container;
      
      const content = messageContent.textContent.trim();
      
      if (content) {
        messages.push({
          role,
          content,
          timestamp: new Date().toISOString()
        });
      }
    });
  }
  
  // If still no messages found, try a more generic approach
  if (messages.length === 0) {
    // Look for any text in the main content area
    const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
    if (mainContent) {
      const allText = mainContent.innerText;
      if (allText.trim()) {
        // This is a fallback - we'll try to parse the conversation
        throw new Error('Could not automatically detect message structure. Claude may have updated their interface.');
      }
    }
    throw new Error('No messages found in the current conversation.');
  }
  
  return messages;
}

// Inject conversation into Claude (full messages or pre-built condensed prompt)
async function injectConversation(messages, condensedPrompt) {
  const inputBox = document.querySelector('div[contenteditable="true"]') ||
                   document.querySelector('textarea') ||
                   document.querySelector('[role="textbox"]');

  if (!inputBox) {
    throw new Error('Could not find chat input box. Make sure you\'re on the chat page.');
  }

  const contextText = condensedPrompt != null && condensedPrompt !== ''
    ? condensedPrompt
    : buildFullContextText(messages);

  inputBox.focus();
  if (inputBox.contentEditable === 'true') {
    inputBox.textContent = contextText;
    inputBox.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    inputBox.value = contextText;
    inputBox.dispatchEvent(new Event('input', { bubbles: true }));
  }

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

// Show import success message
function showImportSuccess(messageCount) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
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
