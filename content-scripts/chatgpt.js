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

function extractChatGPTMessages() {
  const messages = [];
  
  // ChatGPT uses article tags for messages
  const messageContainers = document.querySelectorAll('article[data-testid^="conversation-turn"]');
  
  if (messageContainers.length === 0) {
    // Try alternative approach
    const allArticles = document.querySelectorAll('article');
    
    if (allArticles.length === 0) {
      throw new Error('No messages found. Make sure you have an active conversation.');
    }
    
    allArticles.forEach((article) => {
      const content = article.textContent.trim();
      
      // Try to determine role based on structure
      const hasUserIndicator = article.querySelector('[data-message-author-role="user"]') !== null;
      const role = hasUserIndicator ? 'user' : 'assistant';
      
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
      // Check data attribute for role
      const testId = container.getAttribute('data-testid');
      const isUserMessage = testId && testId.includes('user');
      
      // Also check for role attribute
      const authorRole = container.querySelector('[data-message-author-role]');
      const role = authorRole ? 
        (authorRole.getAttribute('data-message-author-role') === 'user' ? 'user' : 'assistant') :
        (isUserMessage ? 'user' : 'assistant');
      
      // Extract content - ChatGPT uses markdown-style content
      const contentDiv = container.querySelector('.markdown') || 
                        container.querySelector('[class*="prose"]') ||
                        container;
      
      const content = contentDiv.textContent.trim();
      
      if (content) {
        messages.push({
          role,
          content,
          timestamp: new Date().toISOString()
        });
      }
    });
  }
  
  if (messages.length === 0) {
    throw new Error('No messages found in the current conversation.');
  }
  
  return messages;
}

// Inject conversation into ChatGPT (full messages or pre-built condensed prompt)
async function injectConversation(messages, condensedPrompt) {
  const inputBox = document.querySelector('textarea[data-id]') ||
                   document.querySelector('textarea') ||
                   document.querySelector('[contenteditable="true"]');

  if (!inputBox) {
    throw new Error('Could not find chat input box. Make sure you\'re on the chat page.');
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

// Show import success message
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
