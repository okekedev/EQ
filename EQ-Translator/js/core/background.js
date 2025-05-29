// EQ Translator - Background Script
// Handles extension lifecycle and tab capture permissions

class BackgroundManager {
  constructor() {
    this.activeCaptures = new Map();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Handle messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Handle tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // Handle tab removal
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      this.handleTabRemoved(tabId);
    });

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      console.log('🎯 EQ Translator background started');
    });

    // Handle extension install
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details);
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'captureStarted':
          await this.handleCaptureStarted(message.tabId);
          sendResponse({ success: true });
          break;

        case 'captureStopped':
          await this.handleCaptureStopped(message.tabId);
          sendResponse({ success: true });
          break;

        case 'checkPermissions':
          const hasPermissions = await this.checkTabCapturePermissions();
          sendResponse({ hasPermissions });
          break;

        case 'requestPermissions':
          const granted = await this.requestTabCapturePermissions();
          sendResponse({ granted });
          break;

        default:
          console.warn('Unknown message action:', message.action);
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background message handling error:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleCaptureStarted(tabId) {
    console.log(`🎯 Capture started for tab ${tabId}`);
    
    // Store active capture
    this.activeCaptures.set(tabId, {
      startTime: Date.now(),
      status: 'active'
    });

    // Update extension badge
    try {
      await chrome.action.setBadgeText({
        text: '🎯',
        tabId: tabId
      });
      
      await chrome.action.setBadgeBackgroundColor({
        color: '#ff6b35'
      });
    } catch (error) {
      console.warn('Could not update badge:', error);
    }
  }

  async handleCaptureStopped(tabId) {
    console.log(`🛑 Capture stopped for tab ${tabId}`);
    
    // Remove from active captures
    this.activeCaptures.delete(tabId);

    // Clear extension badge
    try {
      await chrome.action.setBadgeText({
        text: '',
        tabId: tabId
      });
    } catch (error) {
      console.warn('Could not clear badge:', error);
    }
  }

  handleTabUpdate(tabId, changeInfo, tab) {
    // If tab URL changes and we're capturing, notify popup
    if (changeInfo.url && this.activeCaptures.has(tabId)) {
      console.log(`📍 Tab ${tabId} navigated, capture may be affected`);
      
      // Try to notify popup about navigation
      chrome.runtime.sendMessage({
        action: 'tabNavigated',
        tabId: tabId,
        newUrl: changeInfo.url
      }).catch(() => {
        // Popup might not be open, ignore error
      });
    }
  }

  handleTabRemoved(tabId) {
    // Clean up if tab was being captured
    if (this.activeCaptures.has(tabId)) {
      console.log(`🗑️ Captured tab ${tabId} was closed`);
      this.activeCaptures.delete(tabId);
    }
  }

  async handleInstalled(details) {
    console.log('🎯 EQ Translator installed/updated:', details.reason);
    
    if (details.reason === 'install') {
      // First install - could show welcome page
      console.log('🎉 Welcome to EQ Translator!');
    } else if (details.reason === 'update') {
      console.log('📦 EQ Translator updated to version:', chrome.runtime.getManifest().version);
    }
  }

  async checkTabCapturePermissions() {
    try {
      // Check if we have tabCapture permission
      const permissions = await chrome.permissions.getAll();
      return permissions.permissions.includes('tabCapture');
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }

  async requestTabCapturePermissions() {
    try {
      const granted = await chrome.permissions.request({
        permissions: ['tabCapture']
      });
      
      console.log('Permission request result:', granted);
      return granted;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  // Utility method to get active captures
  getActiveCaptures() {
    return Array.from(this.activeCaptures.entries()).map(([tabId, info]) => ({
      tabId,
      ...info
    }));
  }

  // Clean up method
  cleanup() {
    this.activeCaptures.clear();
  }
}

// Initialize background manager
const backgroundManager = new BackgroundManager();

// Export for debugging
self.backgroundManager = backgroundManager;