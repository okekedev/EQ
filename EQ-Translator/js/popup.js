// Fixed Popup with No Autostart - Complete Updated Version

class GlobalAudioEqualizer {
  constructor() {
    this.components = {};
    this.visualizer = null;
    this.state = {
      globalEQActive: false,
      currentTabId: null,
      lastKnownSettings: null,
      visualizerConnected: false,
      lastVisualizerData: null
    };
    this.globalStatusInterval = null;
    this.visualizerUpdateInterval = null;
    this.debugMode = true; // Enable debug logging
    this.demoMode = false; // Track if we're in demo mode
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
      
      // FIXED: Just check state without auto-starting
      await this.checkGlobalEQStateOnly();
      
      // Load settings and sync with actual running state (no auto-start)
      await this.loadAndSyncSettings();
      
      // Setup event listeners AFTER state is known
      this.setupEventListeners();
      
      // Start monitoring
      this.startGlobalStatusMonitoring();
      
      // Always start with demo visualizer - only connect to real audio when user enables EQ
      this.startDemoVisualizer();
      
      this.updateStatus('Ready', 'active');
      console.log('✅ GLOBAL POPUP: Initialization complete');
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Initialization error:', error);
      this.updateStatus('Initialization failed', 'error');
      this.showNotification('Error', error.message, 'error');
    }
  }

  startDemoVisualizer() {
    console.log('🎨 GLOBAL POPUP: Starting demo visualizer...');
    this.demoMode = true;
    
    // Just show the static display with the text box - no animation
    if (this.visualizer) {
      this.visualizer.stop(); // Stop any running animation
      this.visualizer.drawEmpty(); // Show static bars with text
      console.log('✅ GLOBAL POPUP: Demo visualizer showing static display');
    }
  }

  stopDemoVisualizer() {
    if (this.demoMode) {
      console.log('🛑 GLOBAL POPUP: Stopping demo visualizer...');
      this.demoMode = false;
    }
  }

  async getCurrentTabInfo() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        this.state.currentTabId = tabs[0].id;
        console.log('📍 GLOBAL POPUP: Current tab ID:', this.state.currentTabId);
        console.log('📍 GLOBAL POPUP: Current tab URL:', tabs[0].url);
      }
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Error getting current tab:', error);
    }
  }

  // FIXED: Only check state, don't auto-start or update toggle
  async checkGlobalEQStateOnly() {
    try {
      console.log('🔍 GLOBAL POPUP: Checking global EQ state (no auto-start)...');
      
      // First, ping the background script to make sure it's alive
      try {
        const pingResponse = await chrome.runtime.sendMessage({ action: 'ping' });
        console.log('🏓 GLOBAL POPUP: Background ping response:', pingResponse);
      } catch (error) {
        console.error('❌ GLOBAL POPUP: Background script not responding:', error);
        return false;
      }
      
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
        currentTabInActiveTabs: activeTabs.includes(this.state.currentTabId),
        hasVisualizerAnalyser: contentScriptResponse?.hasVisualizerAnalyser,
        connectedSources: contentScriptResponse?.connectedSources
      });
      
      // FIXED: Just update internal state for monitoring, don't change UI toggle
      if (isBackgroundActive) {
        console.log('🌍 GLOBAL POPUP: Global EQ is already running in background (toggle stays as user set it)');
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
      
      // FIXED: Restore the toggle to match the user's last intended state
      const eqToggle = document.getElementById('eq-enabled');
      if (eqToggle) {
        // Check if there's a saved user toggle state, otherwise use the EQ enabled state
        const lastUserToggleState = await this.getUserToggleState();
        const toggleState = lastUserToggleState !== null ? lastUserToggleState : (settingsToUse.eqEnabled || false);
        
        eqToggle.checked = toggleState;
        console.log('⚙️ GLOBAL POPUP: Restored toggle to user\'s last state:', toggleState);
        
        // Update UI to match the toggle state
        this.updateEQUI(toggleState);
        
        // If toggle is ON but background is not active, we need to start it
        if (toggleState && !this.state.globalEQActive) {
          console.log('⚙️ GLOBAL POPUP: Toggle was ON when closed, restarting EQ...');
          // Don't trigger the change event, just start the EQ
          await this.startGlobalEQ();
        }
        // If toggle is OFF but background is active, we need to show bypassed state
        else if (!toggleState && this.state.globalEQActive) {
          console.log('⚙️ GLOBAL POPUP: Toggle was OFF when closed, showing bypassed state...');
          this.updateStatus('EQ Bypassed', 'bypassed');
        }
      }
      
      console.log('✅ GLOBAL POPUP: Settings sync complete - restored user\'s last state');
      
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

  // UPDATED: Save user toggle state and more efficient EQ toggle
  async toggleGlobalEQ(enabled) {
    try {
      console.log('🌍 GLOBAL POPUP: Toggling global EQ to:', enabled);
      console.log('🌍 GLOBAL POPUP: Current state was:', this.state.globalEQActive);
      
      // FIXED: Save the user's toggle preference
      await this.saveUserToggleState(enabled);
      
      // Update UI immediately to show the change is happening
      this.updateEQUI(enabled);
      this.updateStatus(enabled ? 'Starting Global EQ...' : 'Disabling EQ effects...', 'pending');
      
      // Get current settings
      const settings = await this.components.storage.getCurrentSettings();
      settings.eqEnabled = enabled;
      settings.eqBands = this.getCurrentEQValues();
      
      // Save to storage
      await this.components.storage.save('eqEnabled', enabled);
      
      if (enabled) {
        console.log('🌍 GLOBAL POPUP: Starting/enabling global EQ...');
        await this.startGlobalEQ();
      } else {
        if (this.state.globalEQActive) {
          console.log('🛑 GLOBAL POPUP: Disabling EQ effects (keeping audio interception)...');
          
          // Just disable EQ effects, don't stop interception
          await chrome.runtime.sendMessage({
            action: 'updateGlobalEQSettings',
            settings: settings
          });
          
          // Update local state - interception stays active, just EQ disabled
          this.state.lastKnownSettings = settings;
          // FIXED: Use 'bypassed' status type for bypassed state (red dot)
          this.updateStatus('EQ Bypassed', 'bypassed');
        } else {
          this.updateStatus('Ready - Global EQ Disabled', 'active');
        }
      }
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Error toggling EQ:', error);
      this.showNotification('EQ Error', error.message, 'error');
      
      // Revert UI on error
      const checkbox = document.getElementById('eq-enabled');
      if (checkbox) checkbox.checked = !enabled;
      this.updateEQUI(!enabled);
      this.updateStatus('EQ toggle failed', 'error');
    }
  }

  async startGlobalEQ() {
    try {
      console.log('🌍 GLOBAL POPUP: === STARTING GLOBAL EQ ===');
      
      const settings = await this.components.storage.getCurrentSettings();
      settings.eqBands = this.getCurrentEQValues();
      
      console.log('🌍 GLOBAL POPUP: Settings to send:', settings);
      
      // Test background script communication first
      try {
        const pingResponse = await chrome.runtime.sendMessage({ action: 'ping' });
        console.log('🏓 GLOBAL POPUP: Background ping before start:', pingResponse);
      } catch (error) {
        throw new Error('Background script not responding: ' + error.message);
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'startGlobalEQ',
        settings: settings
      });
      
      console.log('🌍 GLOBAL POPUP: Background response:', response);
      
      if (response?.success) {
        this.state.globalEQActive = true;
        this.state.lastKnownSettings = settings;
        this.updateStatus('EQ Active', 'active');
        
        // Stop demo mode and connect to real audio
        this.stopDemoVisualizer();
        await this.connectVisualizerToAudio();
        
        return true;
      } else {
        throw new Error(`Background returned error: ${JSON.stringify(response)}`);
      }
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Failed to start global EQ:', error);
      this.state.globalEQActive = false;
      this.showNotification('Global EQ Failed', error.message, 'error');
      
      // Fallback to demo mode
      this.startDemoVisualizer();
      return false;
    }
  }

  async connectVisualizerToAudio() {
    try {
      if (this.state.visualizerConnected || !this.state.currentTabId) {
        console.log('🎨 GLOBAL POPUP: Visualizer already connected or no tab ID');
        return;
      }
      
      console.log('🎨 GLOBAL POPUP: Connecting visualizer to audio stream...');
      
      // Test content script communication first
      await this.testContentScriptCommunication();
      
      // Start polling for audio data from content script
      this.startVisualizerDataPolling();
      
      this.state.visualizerConnected = true;
      console.log('✅ GLOBAL POPUP: Visualizer connected to audio stream');
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Failed to connect visualizer:', error);
      // Fallback to demo mode
      this.startDemoVisualizer();
    }
  }

  async testContentScriptCommunication() {
    try {
      console.log('🧪 GLOBAL POPUP: Testing content script communication...');
      
      const response = await chrome.tabs.sendMessage(this.state.currentTabId, {
        action: 'getGlobalEQStatus'
      });
      
      console.log('🧪 GLOBAL POPUP: Content script test response:', response);
      
      if (response) {
        console.log('✅ GLOBAL POPUP: Content script is responsive');
        console.log('🎨 GLOBAL POPUP: Has visualizer analyser:', response.hasVisualizerAnalyser);
        console.log('🎨 GLOBAL POPUP: Connected sources:', response.connectedSources);
      } else {
        console.warn('⚠️ GLOBAL POPUP: Content script not responding');
      }
      
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Content script communication test failed:', error);
      throw error;
    }
  }

  disconnectVisualizerFromAudio() {
    console.log('🎨 GLOBAL POPUP: Disconnecting visualizer from audio...');
    
    this.stopVisualizerDataPolling();
    
    this.state.visualizerConnected = false;
    this.state.lastVisualizerData = null;
    
    console.log('✅ GLOBAL POPUP: Visualizer disconnected');
  }

  startVisualizerDataPolling() {
    if (this.visualizerUpdateInterval) {
      console.log('🎨 GLOBAL POPUP: Visualizer polling already running');
      return;
    }
    
    console.log('🎨 GLOBAL POPUP: Starting visualizer data polling...');
    
    // Create a proper mock analyser that will be replaced with real data
    const realDataAnalyser = {
      frequencyBinCount: 1024,
      fftSize: 2048,
      smoothingTimeConstant: 0.3,
      context: { sampleRate: 44100 },
      getByteFrequencyData: function(array) {
        // This will be replaced by real data injection
        for (let i = 0; i < array.length; i++) {
          array[i] = 0;
        }
      }
    };
    
    let consecutiveFailures = 0;
    let lastUpdateTime = 0;
    const updateInterval = 1000 / 60; // 60 FPS
    
    // Start the visualizer with real data analyser
    this.visualizer.start(realDataAnalyser);
    
    // Poll for real audio data from content script
    this.visualizerUpdateInterval = setInterval(async () => {
      const now = Date.now();
      if (now - lastUpdateTime < updateInterval) return;
      lastUpdateTime = now;
      
      try {
        if (!this.state.currentTabId || !this.state.globalEQActive) return;
        
        const response = await chrome.tabs.sendMessage(this.state.currentTabId, {
          action: 'getVisualizerAnalyser'
        });
        
        if (this.debugMode && now % 2000 < 50) { // Log every 2 seconds
          console.log('🎨 GLOBAL POPUP: Visualizer poll response:', response?.hasAnalyser ? 'HAS DATA' : 'NO DATA');
        }
        
        if (response?.hasAnalyser && response.analyserData) {
          // Inject real audio data into visualizer
          this.injectAudioDataIntoVisualizer(response.analyserData);
          this.state.lastVisualizerData = response.analyserData;
          consecutiveFailures = 0;
        } else {
          consecutiveFailures++;
          if (consecutiveFailures > 60) { // 60 failures = ~1 second
            console.warn('⚠️ GLOBAL POPUP: Too many visualizer data failures, using fallback');
            this.useFallbackVisualizerData();
          }
        }
        
      } catch (error) {
        consecutiveFailures++;
        if (this.debugMode && consecutiveFailures % 60 === 0) {
          console.log('🎨 GLOBAL POPUP: Content script communication error (attempt', consecutiveFailures, '):', error.message);
        }
        
        // Use fallback after many failures
        if (consecutiveFailures > 120) { // 120 failures = ~2 seconds
          this.useFallbackVisualizerData();
        }
      }
    }, 16); // ~60 FPS polling
    
    console.log('🎨 GLOBAL POPUP: Visualizer data polling started');
  }

  useFallbackVisualizerData() {
    if (!this.visualizer || !this.visualizer.analyser) return;
    
    // Use last known data or generate low-level random data
    const fallbackData = this.state.lastVisualizerData || {
      frequencyData: new Array(1024).fill(0).map(() => Math.random() * 20), // Low random values
      bufferLength: 1024,
      sampleRate: 44100
    };
    
    this.injectAudioDataIntoVisualizer(fallbackData);
  }

  injectAudioDataIntoVisualizer(analyserData) {
    if (!this.visualizer || !this.visualizer.analyser) return;
    
    // Replace the getByteFrequencyData method with real data
    this.visualizer.analyser.getByteFrequencyData = function(array) {
      const sourceData = analyserData.frequencyData;
      const targetLength = array.length;
      const sourceLength = sourceData.length;
      
      // Resample the data to match the expected array length
      for (let i = 0; i < targetLength; i++) {
        const sourceIndex = Math.floor((i / targetLength) * sourceLength);
        array[i] = sourceData[sourceIndex] || 0;
      }
    };
    
    // Update other analyser properties with real data
    this.visualizer.analyser.frequencyBinCount = analyserData.bufferLength;
    if (this.visualizer.audioContext) {
      this.visualizer.audioContext.sampleRate = analyserData.sampleRate;
    }
  }

  stopVisualizerDataPolling() {
    if (this.visualizerUpdateInterval) {
      clearInterval(this.visualizerUpdateInterval);
      this.visualizerUpdateInterval = null;
      console.log('🎨 GLOBAL POPUP: Stopped visualizer data polling');
    }
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

  // UPDATED: Removed popup notification
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
    
    // REMOVED: The showNotification call that was causing the popup
    console.log(`✅ GLOBAL POPUP: ${preset} preset applied ${this.state.globalEQActive ? 'to all tabs' : '(saved for when EQ is enabled)'}`);
  }

  startGlobalStatusMonitoring() {
    console.log('📡 GLOBAL POPUP: Starting global status monitoring...');
    
    this.globalStatusInterval = setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getGlobalEQState' });
        
        // FIXED: Only update status text, never change the toggle automatically
        const newBackgroundState = response?.isActive || false;
        
        if (newBackgroundState !== this.state.globalEQActive) {
          console.log('📡 GLOBAL POPUP: Background state changed:', {
            was: this.state.globalEQActive,
            now: newBackgroundState
          });
          
          // Update internal state
          this.state.globalEQActive = newBackgroundState;
          
          // Update status text with appropriate dot color
          if (this.state.globalEQActive) {
            // Check if EQ effects are actually enabled
            const eqEnabled = response.settings?.eqEnabled;
            if (eqEnabled) {
              this.updateStatus(`🌍 Global EQ Active (${response.activeTabs?.length || 0} tabs)`, 'active');
            } else {
              this.updateStatus('EQ Bypassed', 'bypassed');
            }
          } else {
            this.updateStatus('Ready - Global EQ Disabled', 'active');
          }
          
          // REMOVED: Automatic toggle state changes
          // The toggle now only changes when the user manually clicks it
        }
        
        // Handle visualizer connection based on both toggle state AND background state
        const eqToggle = document.getElementById('eq-enabled');
        const userWantsEQOn = eqToggle ? eqToggle.checked : false;
        
        if (userWantsEQOn && this.state.globalEQActive && !this.state.visualizerConnected) {
          // User wants EQ on AND background is active AND visualizer not connected
          this.stopDemoVisualizer();
          await this.connectVisualizerToAudio();
        } else if ((!userWantsEQOn || !this.state.globalEQActive) && this.state.visualizerConnected) {
          // User turned EQ off OR background stopped AND visualizer is connected
          this.disconnectVisualizerFromAudio();
          this.startDemoVisualizer();
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

  // ADDED: Methods to save/restore user toggle state
  async saveUserToggleState(enabled) {
    try {
      await this.components.storage.save('userToggleState', enabled);
      console.log('💾 GLOBAL POPUP: Saved user toggle state:', enabled);
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Failed to save user toggle state:', error);
    }
  }

  async getUserToggleState() {
    try {
      const state = await this.components.storage.get('userToggleState');
      console.log('📖 GLOBAL POPUP: Retrieved user toggle state:', state);
      return state;
    } catch (error) {
      console.error('❌ GLOBAL POPUP: Failed to get user toggle state:', error);
      return null;
    }
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
    
    // ADDED: Save current toggle state before closing
    const eqToggle = document.getElementById('eq-enabled');
    if (eqToggle) {
      this.saveUserToggleState(eqToggle.checked);
      console.log('💾 GLOBAL POPUP: Saved toggle state on close:', eqToggle.checked);
    }
    
    // Stop monitoring
    if (this.globalStatusInterval) {
      clearInterval(this.globalStatusInterval);
      this.globalStatusInterval = null;
    }
    
    // Stop visualizer polling
    this.stopVisualizerDataPolling();
    
    // Disconnect visualizer
    this.disconnectVisualizerFromAudio();
    
    // Stop demo mode
    this.stopDemoVisualizer();
    
    // Stop visualizer properly
    if (this.visualizer) {
      this.visualizer.stop();
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