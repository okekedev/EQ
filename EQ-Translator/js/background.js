// Background service worker for EQ Translator extension

// State tracking
let isCapturing = false;
let activeTabId = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'captureStarted':
      // Popup has started capture successfully
      isCapturing = true;
      activeTabId = message.tabId;
      sendResponse({ success: true });
      break;
      
    case 'captureStopped':
      // Popup has stopped capture
      isCapturing = false;
      activeTabId = null;
      sendResponse({ success: true });
      break;
      
    case 'getStatus':
      sendResponse({
        isCapturing: isCapturing,
        activeTabId: activeTabId
      });
      break;
  }
});

// Listen for tab close events
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    // Notify any open popups that the tab was closed
    chrome.runtime.sendMessage({ 
      action: 'tabClosed', 
      tabId: tabId 
    });
    
    isCapturing = false;
    activeTabId = null;
  }
});