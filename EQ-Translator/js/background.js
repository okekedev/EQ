// EQ Translator - Background Script

console.log('EQ Translator background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('EQ Translator installed:', details);
  
  if (details.reason === 'install') {
    console.log('First time installation');
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.action) {
    case 'captureStarted':
      console.log('Capture started for tab:', message.tabId);
      // Could update icon or badge here
      chrome.action.setBadgeText({
        text: '🎯',
        tabId: message.tabId
      });
      break;
      
    case 'captureStopped':
      console.log('Capture stopped');
      // Clear badge
      chrome.action.setBadgeText({
        text: ''
      });
      break;
      
    case 'getTabInfo':
      // Get current tab info
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          sendResponse({
            tabId: tabs[0].id,
            url: tabs[0].url,
            title: tabs[0].title
          });
        }
      });
      return true; // Keep message channel open for async response
      
    default:
      console.log('Unknown message action:', message.action);
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Tab finished loading - could notify popup if needed
    console.log('Tab updated:', tabId, tab.url);
  }
});

// Handle errors
chrome.runtime.onSuspend.addListener(() => {
  console.log('Background script suspending');
});

// Keep service worker alive if needed
const keepAlive = () => {
  console.log('Keep alive ping');
};

// Ping every 20 seconds to keep service worker active
setInterval(keepAlive, 20000);