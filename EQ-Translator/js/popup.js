// EQ-Translator/js/popup.js
// Simplified Global-Only Audio Equalizer

class GlobalAudioEqualizer {
  constructor() {
    this.components = {};
    this.visualizer = null;
    this.state = {
      globalEQActive: false,
      currentTabId: null,
      lastKnownSettings: null
    };
    this.globalStatusInterval = null;
  }

  async init() {
    try {
      console.log('🌍 GLOBAL POPUP: Initializing global audio equalizer...');
      this.updateStatus('Initializing...', 'pending');
      
      // Initialize minimal components needed
      this.components.storage = new Storage();
      this.visualizer = new AudioVisualizer('visualizer-canvas');
      
      // Initialize storage
      await this.components.storage.init();
      
      // Get current tab info
      await this.getCurrentTabInfo();
      
      // CRITICAL: Check global EQ state BEFORE setting up UI
      await this.checkGlobalEQState();
      
      // Load settings and sync with running state
      await this.loadAndSyncSettings();
      
      // Setup event listeners AFTER state is known
      this.setupEventListeners();
      
      // Start monitoring
      this.startGlobalStatusMonitoring();
      
      this.updateStatus('Ready', 'active');
      console.log('✅ GLOBAL POPUP: Initialization complete');
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Initialization error:', error);
      this.updateStatus('Initialization failed', 'error');
      this.showNotification('Error', error.message, 'error');
    }
  }

  async getCurrentTabInfo() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        this.state.currentTabId = tabs[0].id;
        console.log('📍 GLOBAL POPUP: Current tab ID:', this.state.currentTabId);
      }
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Error getting current tab:', error);
    }
  }

  async checkGlobalEQState() {
    try {
      console.log('🔍 GLOBAL POPUP: Checking global EQ state...');
      
      // Check background script state
      const backgroundResponse = await chrome.runtime.sendMessage({ action: 'getGlobalEQState' });
      console.log('🔍 GLOBAL POPUP: Background response:', backgroundResponse);
      
      // Also check current tab's content script state
      let contentScriptResponse = null;
      if (this.state.currentTabId) {
        try {
          contentScriptResponse = await chrome.tabs.sendMessage(this.state.currentTabId, {
            action: 'getGlobalEQStatus'
          });
          console.log('🔍 GLOBAL POPUP: Content script response:', contentScriptResponse);
        } catch (error) {
          console.log('🔍 GLOBAL POPUP: Content script not responding (may be loading):', error);
        }
      }
      
      // Determine actual state from both sources
      const isBackgroundActive = backgroundResponse?.isActive || false;
      const activeTabs = backgroundResponse?.activeTabs || [];
      
      console.log('🔍 GLOBAL POPUP: State analysis:', {
        backgroundActive: isBackgroundActive,
        activeTabs: activeTabs,
        currentTabInActiveTabs: activeTabs.includes(this.state.currentTabId)
      });
      
      // Global EQ is considered active if background says it's active
      if (isBackgroundActive) {
        console.log('🌍 GLOBAL POPUP: Global EQ is ACTIVE');
        this.state.globalEQActive = true;
        this.state.lastKnownSettings = backgroundResponse.settings;
        
        this.updateStatus(`🌍 Global EQ Active (${activeTabs.length} tabs)`, 'active');
      } else {
        console.log('🔍 GLOBAL POPUP: Global EQ is not active');
        this.state.globalEQActive = false;
        this.updateStatus('Ready - Global EQ Disabled', 'active');
      }
      
      return this.state.globalEQActive;
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Error checking global EQ state:', error);
      this.state.globalEQActive = false;
      return false;
    }
  }

  async loadAndSyncSettings() {
    try {
      console.log('⚙️ GLOBAL POPUP: Loading and syncing settings...');
      
      // Load settings from storage
      const storageSettings = await this.components.storage.getCurrentSettings();
      console.log('⚙️ GLOBAL POPUP: Storage settings:', storageSettings);
      
      // Use running EQ settings if available, otherwise use storage
      const settingsToUse = this.state.lastKnownSettings || storageSettings;
      console.log('⚙️ GLOBAL POPUP: Settings to use:', settingsToUse);
      
      // Update UI with the correct settings
      const sliders = document.querySelectorAll('.eq-band input');
      sliders.forEach((slider, index) => {
        if (settingsToUse.eqBands && settingsToUse.eqBands[index] !== undefined) {
          slider.value = settingsToUse.eqBands[index];
          this.updateEQBandUI(index, settingsToUse.eqBands[index]);
        }
      });
      
      // Update the main EQ toggle to match the actual state
      const eqToggle = document.getElementById('eq-enabled');
      if (eqToggle) {
        eqToggle.checked = this.state.globalEQActive;
        console.log('⚙️ GLOBAL POPUP: Set EQ toggle to:', this.state.globalEQActive);
      }
      
      // Update UI to match actual state
      this.updateEQUI(this.state.globalEQActive);
      
      console.log('✅ GLOBAL POPUP: Settings sync complete');
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Error loading/syncing settings:', error);
    }
  }

  setupEventListeners() {
    console.log('🔧 GLOBAL POPUP: Setting up event listeners...');
    
    // EQ Power Switch - GLOBAL ONLY
    const eqToggle = document.getElementById('eq-enabled');
    if (eqToggle) {
      console.log('✅ GLOBAL POPUP: Found EQ toggle, current state:', eqToggle.checked);
      eqToggle.addEventListener('change', (e) => this.toggleGlobalEQ(e.target.checked));
    } else {
      console.error('❌ GLOBAL POPUP: EQ toggle not found!');
    }
    
    // EQ band controls
    const eqBands = document.querySelectorAll('.eq-band input');
    console.log('🔧 GLOBAL POPUP: Found', eqBands.length, 'EQ band sliders');
    eqBands.forEach((slider, index) => {
      slider.addEventListener('input', (e) => this.updateEQBand(index, e.target.value));
    });
    
    // Preset buttons
    const presetButtons = document.querySelectorAll('.presets button');
    console.log('🔧 GLOBAL POPUP: Found', presetButtons.length, 'preset buttons');
    presetButtons.forEach(btn => {
      btn.addEventListener('click', () => this.applyEQPreset(btn.dataset.preset));
    });
  }

  // GLOBAL EQ ONLY
  async toggleGlobalEQ(enabled) {
    try {
      console.log('🌍 GLOBAL POPUP: Toggling global EQ to:', enabled);
      console.log('🌍 GLOBAL POPUP: Current state was:', this.state.globalEQActive);
      
      // Don't do anything if the state hasn't actually changed
      if (enabled === this.state.globalEQActive) {
        console.log('🌍 GLOBAL POPUP: State unchanged, skipping toggle');
        return;
      }
      
      // Save state to storage
      await this.components.storage.save('eqEnabled', enabled);
      
      // Update UI immediately
      this.updateEQUI(enabled);
      
      if (enabled) {
        console.log('🌍 GLOBAL POPUP: Starting global EQ...');
        await this.startGlobalEQ();
      } else {
        console.log('🛑 GLOBAL POPUP: Stopping global EQ...');
        await this.stopGlobalEQ();
      }
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Error toggling EQ:', error);
      this.showNotification('EQ Error', error.message, 'error');
      
      // Revert UI on error
      const checkbox = document.getElementById('eq-enabled');
      if (checkbox) checkbox.checked = !enabled;
      this.updateEQUI(!enabled);
    }
  }

  async startGlobalEQ() {
    try {
      console.log('🌍 GLOBAL POPUP: === STARTING GLOBAL EQ ===');
      
      const settings = await this.components.storage.getCurrentSettings();
      settings.eqBands = this.getCurrentEQValues();
      
      console.log('🌍 GLOBAL POPUP: Settings to send:', settings);
      
      const response = await chrome.runtime.sendMessage({
        action: 'startGlobalEQ',
        settings: settings
      });
      
      console.log('🌍 GLOBAL POPUP: Background response:', response);
      
      if (response?.success) {
        this.state.globalEQActive = true;
        this.state.lastKnownSettings = settings;
        this.updateStatus('🌍 Global EQ Active', 'active');
        
        return true;
      } else {
        throw new Error(`Background returned unsuccessful: ${JSON.stringify(response)}`);
      }
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Failed to start global EQ:', error);
      this.state.globalEQActive = false;
      this.showNotification('Global EQ Failed', error.message, 'error');
      return false;
    }
  }

  async stopGlobalEQ() {
    try {
      console.log('🛑 GLOBAL POPUP: === STOPPING GLOBAL EQ ===');
      
      const response = await chrome.runtime.sendMessage({
        action: 'stopGlobalEQ'
      });
      
      console.log('🛑 GLOBAL POPUP: Stop response:', response);
      
      if (response?.success) {
        this.state.globalEQActive = false;
        this.state.lastKnownSettings = null;
        this.updateStatus('Ready - Global EQ Disabled', 'active');
        
        return true;
      }
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Error stopping global EQ:', error);
    }
    
    return false;
  }

  updateEQBand(index, value) {
    console.log(`🎛️ GLOBAL POPUP: Updating EQ band ${index} to ${value}dB`);
    
    // Update UI
    this.updateEQBandUI(index, value);
    
    // Update global EQ if active
    if (this.state.globalEQActive) {
      this.updateGlobalEQSettings();
    }
  }

  updateEQBandUI(index, value) {
    const band = document.querySelectorAll('.eq-band')[index];
    const valueDisplay = band?.querySelector('.eq-value');
    
    if (valueDisplay) {
      valueDisplay.textContent = `${value}dB`;
    }
  }

  async updateGlobalEQSettings() {
    if (!this.state.globalEQActive) return;
    
    try {
      const settings = await this.components.storage.getCurrentSettings();
      settings.eqBands = this.getCurrentEQValues();
      
      console.log('⚙️ GLOBAL POPUP: Updating global EQ settings:', settings);
      
      await chrome.runtime.sendMessage({
        action: 'updateGlobalEQSettings',
        settings: settings
      });
      
      // Update our known settings
      this.state.lastKnownSettings = settings;
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Failed to update global EQ settings:', error);
    }
  }

  async applyEQPreset(preset) {
    console.log('🎨 GLOBAL POPUP: Applying preset:', preset);
    
    const presets = {
      flat: [0, 0, 0, 0, 0, 0, 0, 0],
      bass: [8, 6, 4, 2, 0, -1, -2, -3],
      vocal: [-2, -1, 0, 2, 4, 3, 1, -1],
      treble: [-3, -2, -1, 0, 1, 3, 6, 8]
    };
    
    const values = presets[preset] || presets.flat;
    const sliders = document.querySelectorAll('.eq-band input');
    
    // Update UI
    sliders.forEach((slider, index) => {
      if (values[index] !== undefined) {
        slider.value = values[index];
        this.updateEQBandUI(index, values[index]);
      }
    });
    
    // Save to storage
    await this.components.storage.save('eq', values);
    
    // Update global EQ if active
    if (this.state.globalEQActive) {
      await this.updateGlobalEQSettings();
    }
    
    // Highlight active preset
    document.querySelectorAll('.presets .btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-preset="${preset}"]`)?.classList.add('active');
    
    const statusMessage = this.state.globalEQActive ? 'applied to all tabs' : 'saved (will apply when EQ is enabled)';
    this.showNotification(
      'Preset Applied', 
      `${preset.charAt(0).toUpperCase() + preset.slice(1)} EQ preset ${statusMessage}`,
      'success'
    );
  }

  startGlobalStatusMonitoring() {
    console.log('📡 GLOBAL POPUP: Starting global status monitoring...');
    
    this.globalStatusInterval = setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getGlobalEQState' });
        
        // Check if state has changed
        if (response?.isActive !== this.state.globalEQActive) {
          console.log('📡 GLOBAL POPUP: State change detected:', {
            was: this.state.globalEQActive,
            now: response?.isActive
          });
          
          this.state.globalEQActive = response?.isActive || false;
          
          if (this.state.globalEQActive) {
            this.updateStatus(`🌍 Global EQ Active (${response.activeTabs?.length || 0} tabs)`, 'active');
          } else {
            this.updateStatus('Ready - Global EQ Disabled', 'active');
          }
          
          // Update toggle to match actual state
          const checkbox = document.getElementById('eq-enabled');
          if (checkbox && checkbox.checked !== this.state.globalEQActive) {
            checkbox.checked = this.state.globalEQActive;
            this.updateEQUI(this.state.globalEQActive);
          }
        }
      } catch (error) {
        // Extension might be reloading
      }
    }, 2000); // Check every 2 seconds for more responsive UI
  }

  getCurrentEQValues() {
    const sliders = document.querySelectorAll('.eq-band input');
    const values = Array.from(sliders).map(slider => parseFloat(slider.value));
    return values;
  }

  // UI Update Methods
  updateEQUI(enabled) {
    console.log('🎨 GLOBAL POPUP: Updating EQ UI, enabled:', enabled);
    
    const checkbox = document.getElementById('eq-enabled');
    const powerSection = document.querySelector('.eq-power-section');
    const status = document.getElementById('eq-status');
    const container = document.querySelector('.eq-container');
    
    if (checkbox && checkbox.checked !== enabled) {
      // Only update if different to avoid triggering change event
      checkbox.checked = enabled;
    }
    
    if (powerSection) {
      powerSection.classList.toggle('active', enabled);
    }
    
    if (status) {
      status.textContent = enabled ? 'ON' : 'OFF';
      status.classList.toggle('active', enabled);
    }
    
    if (container) {
      container.classList.toggle('disabled', !enabled);
    }
  }

  updateStatus(text, type) {
    console.log('🎨 GLOBAL POPUP: Updating status:', text, type);
    const statusText = document.getElementById('status-text');
    const statusIcon = document.getElementById('status-icon');
    
    if (statusText) statusText.textContent = text;
    if (statusIcon) statusIcon.className = `status-icon ${type}`;
  }

  showNotification(title, message, type = 'info') {
    console.log(`📢 GLOBAL POPUP: Notification [${type}]: ${title} - ${message}`);
    
    const container = document.getElementById('notifications');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="title">${title}</div>
      <div class="message">${message}</div>
      <button class="close">×</button>
    `;
    
    notification.querySelector('.close').addEventListener('click', () => {
      notification.remove();
    });
    
    container.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 7000);
  }

  cleanup() {
    console.log('🧹 GLOBAL POPUP: Cleaning up...');
    
    // Stop monitoring
    if (this.globalStatusInterval) {
      clearInterval(this.globalStatusInterval);
    }
    
    // Global EQ continues running in background - don't stop it
    if (this.state.globalEQActive) {
      console.log('🌍 GLOBAL POPUP: Popup closing - Global EQ will continue on all tabs');
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 GLOBAL POPUP: DOM loaded, initializing Global Audio Equalizer...');
  window.globalAudioEqualizer = new GlobalAudioEqualizer();
  window.globalAudioEqualizer.init();
});

// Handle popup closing
window.addEventListener('beforeunload', () => {
  console.log('👋 GLOBAL POPUP: Popup closing...');
  if (window.globalAudioEqualizer) {
    window.globalAudioEqualizer.cleanup();
  }
});