// EQ-Translator/js/popup.js
// Clean Global-Only Audio Equalizer - NO LEGACY FALLBACK

class GlobalOnlyAudioEqualizer {
  constructor() {
    this.components = {};
    this.visualizer = null;
    this.state = {
      globalEQActive: false,
      currentTabId: null
    };
    this.globalStatusInterval = null;
  }

  async init() {
    try {
      console.log('🌍 GLOBAL POPUP: Initializing global-only equalizer...');
      this.updateStatus('Initializing...', 'pending');
      
      // Initialize minimal components needed
      this.components.storage = new Storage();
      this.visualizer = new AudioVisualizer('visualizer-canvas');
      
      // Initialize storage
      await this.components.storage.init();
      
      // Get current tab info
      await this.getCurrentTabInfo();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Check global EQ state
      await this.checkGlobalEQState();
      
      // Load settings
      await this.loadSettings();
      
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
      
      const response = await chrome.runtime.sendMessage({ action: 'getGlobalEQState' });
      console.log('🔍 GLOBAL POPUP: Background response:', response);
      
      if (response?.isActive) {
        console.log('🌍 GLOBAL POPUP: Global EQ is already active');
        this.state.globalEQActive = true;
        this.updateGlobalEQUI(true);
        this.updateStatus('🌍 Global EQ Active', 'active');
        
        this.showNotification(
          'Global EQ Active',
          `EQ is running on ${response.activeTabs?.length || 'all'} tabs`,
          'success'
        );
      } else {
        console.log('🔍 GLOBAL POPUP: Global EQ is not active');
        this.state.globalEQActive = false;
        this.updateGlobalEQUI(false);
      }
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Error checking global EQ state:', error);
    }
  }

  setupEventListeners() {
    console.log('🔧 GLOBAL POPUP: Setting up event listeners...');
    
    // EQ Power Switch - GLOBAL ONLY
    const eqToggle = document.getElementById('eq-enabled');
    if (eqToggle) {
      console.log('✅ GLOBAL POPUP: Found EQ toggle');
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

  // GLOBAL EQ ONLY - NO LEGACY FALLBACK
  async toggleGlobalEQ(enabled) {
    try {
      console.log('🌍 GLOBAL POPUP: Toggling global EQ to:', enabled);
      
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
        this.updateStatus('🌍 Global EQ Active', 'active');
        this.updateGlobalEQUI(true);
        
        this.showNotification(
          'Global EQ Started',
          'EQ is now active on ALL tabs in your browser!',
          'success'
        );
        
        return true;
      } else {
        throw new Error(`Background returned unsuccessful: ${JSON.stringify(response)}`);
      }
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Failed to start global EQ:', error);
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
        this.updateStatus('Ready', 'active');
        this.updateGlobalEQUI(false);
        
        this.showNotification('Global EQ Stopped', 'EQ stopped on all tabs', 'info');
        return true;
      }
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Error stopping global EQ:', error);
    }
    
    return false;
  }

  updateEQBand(index, value) {
    console.log(`🎛️ GLOBAL POPUP: Updating EQ band ${index} to ${value}dB`);
    
    const band = document.querySelectorAll('.eq-band')[index];
    const valueDisplay = band.querySelector('.eq-value');
    
    if (valueDisplay) {
      valueDisplay.textContent = `${value}dB`;
    }
    
    // Update global EQ if active - NO LOCAL PROCESSING
    if (this.state.globalEQActive) {
      this.updateGlobalEQSettings();
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
        this.updateEQBand(index, values[index]);
      }
    });
    
    // Save to storage
    await this.components.storage.save('eq', values);
    
    // Highlight active preset
    document.querySelectorAll('.presets .btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-preset="${preset}"]`)?.classList.add('active');
    
    this.showNotification(
      'Preset Applied', 
      `${preset.charAt(0).toUpperCase() + preset.slice(1)} EQ preset applied to all tabs`,
      'success'
    );
  }

  startGlobalStatusMonitoring() {
    console.log('📡 GLOBAL POPUP: Starting global status monitoring...');
    
    this.globalStatusInterval = setInterval(async () => {
      if (this.state.globalEQActive) {
        try {
          const response = await chrome.runtime.sendMessage({ action: 'getGlobalEQState' });
          
          if (!response?.isActive) {
            console.log('🌍 GLOBAL POPUP: Global EQ appears to have stopped');
            this.state.globalEQActive = false;
            this.updateStatus('Ready', 'active');
            this.updateGlobalEQUI(false);
            
            // Update UI
            const checkbox = document.getElementById('eq-enabled');
            if (checkbox) checkbox.checked = false;
            this.updateEQUI(false);
          }
        } catch (error) {
          // Extension might be reloading
        }
      }
    }, 5000);
  }

  getCurrentEQValues() {
    const sliders = document.querySelectorAll('.eq-band input');
    const values = Array.from(sliders).map(slider => parseFloat(slider.value));
    console.log('🔍 GLOBAL POPUP: Current EQ values:', values);
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

  updateGlobalEQUI(enabled) {
    console.log('🎨 GLOBAL POPUP: Updating global EQ UI, enabled:', enabled);
    
    const container = document.querySelector('.eq-container');
    
    if (container) {
      container.classList.toggle('global-active', enabled);
      
      // Add global indicator
      if (enabled && !container.querySelector('.global-indicator')) {
        const indicator = document.createElement('div');
        indicator.className = 'global-indicator';
        indicator.innerHTML = '🌍 GLOBAL MODE ACTIVE';
        indicator.style.cssText = `
          position: absolute;
          top: -15px;
          left: 50%;
          transform: translateX(-50%);
          background: #007aff;
          color: white;
          font-size: 10px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
          z-index: 10;
        `;
        container.style.position = 'relative';
        container.appendChild(indicator);
      } else if (!enabled) {
        const indicator = container.querySelector('.global-indicator');
        if (indicator) indicator.remove();
      }
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

  async loadSettings() {
    try {
      console.log('⚙️ GLOBAL POPUP: Loading settings...');
      const settings = await this.components.storage.getCurrentSettings();
      console.log('⚙️ GLOBAL POPUP: Settings loaded:', settings);
      
      // Set EQ values in UI
      const sliders = document.querySelectorAll('.eq-band input');
      sliders.forEach((slider, index) => {
        if (settings.eqBands[index] !== undefined) {
          slider.value = settings.eqBands[index];
          this.updateEQBand(index, settings.eqBands[index]);
        }
      });
      
      // Update UI based on global EQ state only
      this.updateEQUI(this.state.globalEQActive);
      
      console.log('✅ GLOBAL POPUP: Settings loading complete');
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Error loading settings:', error);
    }
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
  console.log('🚀 GLOBAL POPUP: DOM loaded, initializing Global-Only Audio Equalizer...');
  window.globalAudioEqualizer = new GlobalOnlyAudioEqualizer();
  window.globalAudioEqualizer.init();
});

// Handle popup closing
window.addEventListener('beforeunload', () => {
  console.log('👋 GLOBAL POPUP: Popup closing...');
  if (window.globalAudioEqualizer) {
    window.globalAudioEqualizer.cleanup();
  }
});