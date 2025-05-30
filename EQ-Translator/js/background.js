// EQ-Translator/js/background.js
// DEBUG VERSION - Working Background Script with Global EQ Support

console.log('🌍 DEBUG: EQ Translator background script loaded (Working Global Edition)');

// Enhanced state management
let globalEQState = {
  isActive: false,
  settings: {
    eqEnabled: false,
    eqBands: [0, 0, 0, 0, 0, 0, 0, 0]
  },
  activeTabs: new Set(),
  lastKeepAlive: Date.now()
};

// Legacy single-tab EQ state (for backward compatibility)
let legacyEQState = {
  isActive: false,
  activeTabId: null,
  settings: null
};

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('🌍 DEBUG: EQ Translator installed:', details);
  
  if (details.reason === 'install') {
    console.log('🆕 DEBUG: First time installation - setting up global EQ');
    chrome.storage.local.set({
      audioEqualizerSettings: {
        eqEnabled: false,
        eq: [0, 0, 0, 0, 0, 0, 0, 0],
        globalMode: false
      }
    });
  }
});

// Enhanced message handling for global EQ
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 DEBUG: Background received message:', message.action);
  console.log('📨 DEBUG: Message sender:', sender.tab?.id || 'popup');
  console.log('📨 DEBUG: Full message:', message);
  
  try {
    switch (message.action) {
      // Test ping
      case 'ping':
        console.log('🏓 DEBUG: Ping received, responding...');
        sendResponse({ status: 'alive', timestamp: Date.now() });
        break;
        
      // Global EQ Actions
      case 'startGlobalEQ':
        console.log('🌍 DEBUG: Handling startGlobalEQ request...');
        handleStartGlobalEQ(message, sender).then(result => {
          console.log('🌍 DEBUG: startGlobalEQ result:', result);
          sendResponse({ success: result });
        }).catch(error => {
          console.error('❌ DEBUG: startGlobalEQ error:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true;
        
      case 'stopGlobalEQ':
        console.log('🛑 DEBUG: Handling stopGlobalEQ request...');
        handleStopGlobalEQ(message, sender).then(result => {
          console.log('🛑 DEBUG: stopGlobalEQ result:', result);
          sendResponse({ success: result });
        }).catch(error => {
          console.error('❌ DEBUG: stopGlobalEQ error:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true;
        
      case 'updateGlobalEQSettings':
        console.log('⚙️ DEBUG: Handling updateGlobalEQSettings request...');
        handleUpdateGlobalEQSettings(message, sender);
        sendResponse({ success: true });
        break;
        
      case 'getGlobalEQState':
        console.log('🔍 DEBUG: Handling getGlobalEQState request...');
        const globalState = {
          isActive: globalEQState.isActive,
          settings: globalEQState.settings,
          activeTabs: Array.from(globalEQState.activeTabs)
        };
        console.log('🔍 DEBUG: Returning global state:', globalState);
        sendResponse(globalState);
        break;
        
      case 'globalEQStartedOnTab':
        console.log('✅ DEBUG: Handling globalEQStartedOnTab notification...');
        handleGlobalEQStartedOnTab(message, sender);
        break;
        
      case 'globalEQStoppedOnTab':
        console.log('🛑 DEBUG: Handling globalEQStoppedOnTab notification...');
        handleGlobalEQStoppedOnTab(message, sender);
        break;
        
      case 'keepAliveGlobalEQ':
        console.log('💓 DEBUG: Handling keepAliveGlobalEQ...');
        globalEQState.lastKeepAlive = Date.now();
        sendResponse({ received: true });
        break;
        
      // Legacy single-tab EQ actions (for backward compatibility)
      case 'captureStarted':
        console.log('🎯 DEBUG: Handling legacy captureStarted...');
        handleLegacyCaptureStarted(message, sender);
        break;
        
      case 'captureStopped':
        console.log('🛑 DEBUG: Handling legacy captureStopped...');
        handleLegacyCapturesStopped(message, sender);
        break;
        
      case 'getEQState':
        console.log('🔍 DEBUG: Handling getEQState request...');
        const eqState = {
          isActive: legacyEQState.isActive,
          activeTabId: legacyEQState.activeTabId,
          settings: legacyEQState.settings,
          globalEQ: {
            isActive: globalEQState.isActive,
            settings: globalEQState.settings,
            activeTabs: Array.from(globalEQState.activeTabs)
          }
        };
        console.log('🔍 DEBUG: Returning EQ state:', eqState);
        sendResponse(eqState);
        return true;
        
      case 'getCurrentTabId':
        console.log('🔍 DEBUG: Handling getCurrentTabId request...');
        if (sender.tab) {
          console.log('🔍 DEBUG: Returning tab ID:', sender.tab.id);
          sendResponse({ tabId: sender.tab.id });
        } else {
          console.warn('⚠️ DEBUG: No sender tab found!');
          sendResponse({ tabId: null });
        }
        return true;
        
      default:
        console.log('❓ DEBUG: Unknown message action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('❌ DEBUG: Error in message handler:', error);
    sendResponse({ success: false, error: error.message });
  }
});

// Global EQ Handlers
async function handleStartGlobalEQ(message, sender) {
  try {
    console.log('🌍 DEBUG: === STARTING GLOBAL EQ HANDLER ===');
    console.log('🌍 DEBUG: Message settings:', message.settings);
    console.log('🌍 DEBUG: Current global state:', globalEQState);
    
    // Store global settings
    console.log('🌍 DEBUG: Storing global settings...');
    globalEQState.settings = { ...globalEQState.settings, ...message.settings };
    globalEQState.isActive = true;
    console.log('🌍 DEBUG: Updated global state:', globalEQState);
    
    // Save to storage
    console.log('🌍 DEBUG: Saving to storage...');
    await saveGlobalEQSettings();
    console.log('✅ DEBUG: Settings saved to storage');
    
    // Get all eligible tabs
    console.log('🌍 DEBUG: Querying all tabs...');
    const tabs = await chrome.tabs.query({});
    console.log('🌍 DEBUG: Found', tabs.length, 'total tabs');
    
    const eligibleTabs = tabs.filter(tab => {
      const isEligible = tab.url && 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('moz-extension://') &&
        !tab.url.startsWith('about:') &&
        (tab.url.startsWith('http://') || tab.url.startsWith('https://'));
      
      console.log(`🔍 DEBUG: Tab ${tab.id} (${tab.url}) eligible:`, isEligible);
      return isEligible;
    });
    
    console.log(`🎯 DEBUG: Found ${eligibleTabs.length} eligible tabs for global EQ`);
    eligibleTabs.forEach(tab => {
      console.log(`  📄 DEBUG: Tab ${tab.id}: ${tab.title} (${tab.url})`);
    });
    
    // Start EQ on all eligible tabs
    let successCount = 0;
    let failCount = 0;
    
    console.log('🌍 DEBUG: Starting to send messages to tabs...');
    
    for (const tab of eligibleTabs) {
      try {
        console.log(`📤 DEBUG: Sending startGlobalEQ to tab ${tab.id}...`);
        
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'startGlobalEQ',
          settings: globalEQState.settings
        });
        
        console.log(`📥 DEBUG: Response from tab ${tab.id}:`, response);
        
        if (response?.success) {
          globalEQState.activeTabs.add(tab.id);
          successCount++;
          console.log(`✅ DEBUG: Global EQ started on tab ${tab.id}: ${tab.title}`);
        } else {
          failCount++;
          console.log(`❌ DEBUG: Global EQ failed on tab ${tab.id}: ${tab.title}, response:`, response);
        }
        
      } catch (error) {
        failCount++;
        console.log(`❌ DEBUG: Could not start EQ on tab ${tab.id} (${tab.title}): ${error.message}`);
        console.log(`❌ DEBUG: Error details:`, error);
      }
    }
    
    console.log(`📊 DEBUG: Global EQ results: ${successCount} success, ${failCount} failed out of ${eligibleTabs.length} tabs`);
    console.log(`📊 DEBUG: Active tabs:`, Array.from(globalEQState.activeTabs));
    
    // Update badge to show global EQ is active
    console.log('🏷️ DEBUG: Updating badge...');
    updateGlobalBadge(true);
    console.log('✅ DEBUG: Badge updated');
    
    const success = successCount > 0;
    console.log('🌍 DEBUG: === GLOBAL EQ HANDLER COMPLETE ===');
    console.log('🌍 DEBUG: Final result:', success);
    
    return success;
    
  } catch (error) {
    console.error('❌ DEBUG: === GLOBAL EQ HANDLER FAILED ===');
    console.error('❌ DEBUG: Error:', error);
    console.error('❌ DEBUG: Error stack:', error.stack);
    return false;
  }
}

async function handleStopGlobalEQ(message, sender) {
  try {
    console.log('🛑 DEBUG: === STOPPING GLOBAL EQ HANDLER ===');
    
    globalEQState.isActive = false;
    
    // Save to storage
    await saveGlobalEQSettings();
    
    // Stop EQ on all active tabs
    let stopCount = 0;
    const activeTabs = Array.from(globalEQState.activeTabs);
    console.log('🛑 DEBUG: Stopping EQ on', activeTabs.length, 'active tabs');
    
    for (const tabId of activeTabs) {
      try {
        console.log(`📤 DEBUG: Sending stopGlobalEQ to tab ${tabId}...`);
        
        const response = await chrome.tabs.sendMessage(tabId, {
          action: 'stopGlobalEQ'
        });
        
        console.log(`📥 DEBUG: Stop response from tab ${tabId}:`, response);
        
        if (response?.success) {
          stopCount++;
          console.log(`✅ DEBUG: Global EQ stopped on tab ${tabId}`);
        }
        
      } catch (error) {
        console.log(`❌ DEBUG: Could not stop EQ on tab ${tabId}: ${error.message}`);
      }
    }
    
    globalEQState.activeTabs.clear();
    
    console.log(`✅ DEBUG: Global EQ stopped on ${stopCount} tabs`);
    
    // Clear badge
    updateGlobalBadge(false);
    
    console.log('🛑 DEBUG: === STOP GLOBAL EQ HANDLER COMPLETE ===');
    return true;
    
  } catch (error) {
    console.error('❌ DEBUG: Failed to stop global EQ:', error);
    return false;
  }
}

async function handleUpdateGlobalEQSettings(message, sender) {
  try {
    console.log('⚙️ DEBUG: === UPDATING GLOBAL EQ SETTINGS ===');
    console.log('⚙️ DEBUG: New settings:', message.settings);
    
    globalEQState.settings = { ...globalEQState.settings, ...message.settings };
    
    // Save to storage
    await saveGlobalEQSettings();
    
    // Update all active tabs
    let updateCount = 0;
    const activeTabs = Array.from(globalEQState.activeTabs);
    
    for (const tabId of activeTabs) {
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: 'updateGlobalEQSettings',
          settings: globalEQState.settings
        });
        updateCount++;
        
      } catch (error) {
        console.log(`⚠️ DEBUG: Could not update EQ on tab ${tabId}: ${error.message}`);
        // Remove tab from active list if it's no longer responding
        globalEQState.activeTabs.delete(tabId);
      }
    }
    
    console.log(`✅ DEBUG: Updated global EQ settings on ${updateCount} tabs`);
    
  } catch (error) {
    console.error('❌ DEBUG: Failed to update global EQ settings:', error);
  }
}

function handleGlobalEQStartedOnTab(message, sender) {
  if (sender.tab) {
    globalEQState.activeTabs.add(sender.tab.id);
    console.log(`🎛️ DEBUG: Global EQ confirmed active on tab ${sender.tab.id}: ${message.url}`);
  }
}

function handleGlobalEQStoppedOnTab(message, sender) {
  if (sender.tab) {
    globalEQState.activeTabs.delete(sender.tab.id);
    console.log(`🛑 DEBUG: Global EQ stopped on tab ${sender.tab.id}: ${message.url}`);
  }
}

// Legacy EQ Handlers (for backward compatibility)
function handleLegacyCaptureStarted(message, sender) {
  console.log('🎯 DEBUG: Legacy EQ started for tab:', message.tabId);
  legacyEQState.isActive = true;
  legacyEQState.activeTabId = message.tabId;
  
  updateLegacyBadge(message.tabId, true);
}

function handleLegacyCapturesStopped(message, sender) {
  console.log('🛑 DEBUG: Legacy EQ stopped');
  legacyEQState.isActive = false;
  legacyEQState.activeTabId = null;
  
  clearLegacyBadge();
}

// Badge Management
function updateGlobalBadge(isActive) {
  console.log('🏷️ DEBUG: Updating global badge, active:', isActive);
  
  chrome.action.setBadgeText({
    text: isActive ? '🌍' : ''
  });
  
  chrome.action.setBadgeBackgroundColor({
    color: isActive ? '#007aff' : '#ff3b30'
  });
}

function updateLegacyBadge(tabId, isActive) {
  console.log('🏷️ DEBUG: Updating legacy badge for tab', tabId, 'active:', isActive);
  
  chrome.action.setBadgeText({
    text: isActive ? '🎛️' : '',
    tabId: tabId
  });
  
  chrome.action.setBadgeBackgroundColor({
    color: isActive ? '#34c759' : '#ff3b30'
  });
}

function clearLegacyBadge() {
  console.log('🏷️ DEBUG: Clearing legacy badge');
  chrome.action.setBadgeText({ text: '' });
}

// Storage Management
async function saveGlobalEQSettings() {
  try {
    console.log('💾 DEBUG: Saving global EQ settings...');
    
    const currentSettings = await new Promise((resolve) => {
      chrome.storage.local.get('audioEqualizerSettings', (data) => {
        resolve(data.audioEqualizerSettings || {});
      });
    });
    
    console.log('💾 DEBUG: Current storage settings:', currentSettings);
    
    currentSettings.globalEQEnabled = globalEQState.isActive;
    currentSettings.globalEQSettings = globalEQState.settings;
    
    console.log('💾 DEBUG: Updated storage settings:', currentSettings);
    
    await new Promise((resolve) => {
      chrome.storage.local.set({ audioEqualizerSettings: currentSettings }, resolve);
    });
    
    console.log('✅ DEBUG: Global EQ settings saved to storage');
    
  } catch (error) {
    console.error('❌ DEBUG: Failed to save global EQ settings:', error);
  }
}

// Tab Management
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (globalEQState.isActive && changeInfo.status === 'complete') {
    // Try to start EQ on newly loaded/navigated tabs
    if (tab.url && 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('about:') &&
        (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
      
      console.log(`🆕 DEBUG: New eligible tab loaded: ${tabId} (${tab.url})`);
      
      setTimeout(async () => {
        try {
          console.log(`📤 DEBUG: Attempting to start EQ on newly loaded tab ${tabId}...`);
          
          const response = await chrome.tabs.sendMessage(tabId, {
            action: 'startGlobalEQ',
            settings: globalEQState.settings
          });
          
          if (response?.success) {
            globalEQState.activeTabs.add(tabId);
            console.log(`🎛️ DEBUG: Global EQ started on newly loaded tab ${tabId}`);
          } else {
            console.log(`❌ DEBUG: Failed to start EQ on newly loaded tab ${tabId}:`, response);
          }
          
        } catch (error) {
          console.log(`⚠️ DEBUG: Could not start EQ on tab ${tabId} yet: ${error.message}`);
        }
      }, 2000); // Wait for content script to load
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Remove from global EQ active tabs
  if (globalEQState.activeTabs.has(tabId)) {
    globalEQState.activeTabs.delete(tabId);
    console.log(`🗑️ DEBUG: Removed closed tab ${tabId} from global EQ`);
  }
  
  // Legacy EQ cleanup
  if (tabId === legacyEQState.activeTabId) {
    console.log('🗑️ DEBUG: Legacy EQ tab closed');
    legacyEQState.isActive = false;
    legacyEQState.activeTabId = null;
    clearLegacyBadge();
  }
});

console.log('✅ DEBUG: Background script setup complete!');