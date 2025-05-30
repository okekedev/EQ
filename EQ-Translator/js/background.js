// EQ Translator - Background Script with Persistent Audio Support

console.log('EQ Translator background script loaded');

// State management
let isEQActive = false;
let activeTabId = null;

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
      isEQActive = true;
      activeTabId = message.tabId;
      
      // Update icon to show active state
      chrome.action.setBadgeText({
        text: '🎯',
        tabId: message.tabId
      });
      chrome.action.setBadgeBackgroundColor({
        color: '#34c759'
      });
      break;
      
    case 'captureStopped':
      console.log('Capture stopped');
      isEQActive = false;
      activeTabId = null;
      
      // Clear badge
      chrome.action.setBadgeText({
        text: ''
      });
      break;
      
    case 'getEQState':
      // Return current EQ state to popup
      sendResponse({
        isActive: isEQActive,
        activeTabId: activeTabId
      });
      return true;
      
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

// Handle tab updates - stop EQ if active tab is closed/navigated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.status === 'loading') {
    // Tab is navigating - EQ will be interrupted
    console.log('Active tab navigating, EQ may be interrupted');
  }
});

// Handle tab removal - stop EQ if active tab is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (tabId === activeTabId) {
    console.log('Active EQ tab closed, stopping EQ');
    isEQActive = false;
    activeTabId = null;
    
    // Clear badge
    chrome.action.setBadgeText({
      text: ''
    });
  }
});

// Handle action button clicks - open popup or show state
chrome.action.onClicked.addListener((tab) => {
  // This is handled by the popup, but we can add additional logic here
  console.log('Extension icon clicked on tab:', tab.id);
});

// Keep service worker alive for persistent EQ
const keepAlive = () => {
  // Send a ping to keep the service worker active
  console.log('Keep alive ping - EQ Active:', isEQActive);
  
  // If EQ is active, we want to ensure service worker stays alive
  if (isEQActive) {
    // Check if the active tab still exists
    if (activeTabId) {
      chrome.tabs.get(activeTabId, (tab) => {
        if (chrome.runtime.lastError) {
          // Tab no longer exists
          console.log('Active EQ tab no longer exists');
          isEQActive = false;
          activeTabId = null;
          chrome.action.setBadgeText({ text: '' });
        }
      });
    }
  }
};

// Ping every 20 seconds to keep service worker active when EQ is running
setInterval(keepAlive, 20000);

// Handle service worker suspend
chrome.runtime.onSuspend.addListener(() => {
  console.log('Background script suspending - EQ Active:', isEQActive);
  if (isEQActive) {
    console.log('Warning: EQ may stop when service worker suspends');
  }
});

// Startup - check for existing EQ state
chrome.storage.local.get(['audioEqualizerSettings'], (data) => {
  const settings = data.audioEqualizerSettings || {};
  if (settings.eqEnabled) {
    console.log('EQ was enabled - user may need to restart it after browser restart');
  }
});