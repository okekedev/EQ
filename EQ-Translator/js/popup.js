// Audio Equalizer - Enhanced with Background Persistence

class AudioEqualizer {
  constructor() {
    this.components = {};
    this.visualizer = null;
    this.state = {
      isCapturing: false,
      shouldBeCapturing: false,
      backgroundActive: false
    };
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async init() {
    try {
      this.updateStatus('Initializing...', 'pending');
      
      // Initialize components
      this.components.storage = new Storage();
      this.components.audioProcessor = new AudioProcessor();
      this.components.captureManager = new CaptureManager();
      
      // Initialize capture manager with audio processor
      this.components.captureManager.initialize(this.components.audioProcessor);
      
      this.visualizer = new AudioVisualizer('visualizer-canvas');
      
      // Initialize storage
      await this.components.storage.init();
      
      // Setup everything
      this.setupEventListeners();
      this.setupCallbacks();
      
      // Check background state first - IMPORTANT for persistence
      await this.checkBackgroundState();
      
      // Load settings and apply them
      await this.loadSettings();
      
      this.updateStatus('Ready', 'active');
      
    } catch (error) {
      console.error('Initialization error:', error);
      this.updateStatus('Initialization failed', 'error');
      this.showNotification('Error', error.message, 'error');
    }
  }

  // Check background EQ state for persistence
  async checkBackgroundState() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getEQState' });
      if (response && response.isActive) {
        console.log('🎛️ EQ is already active in background on tab:', response.activeTabId);
        this.state.backgroundActive = true;
        this.state.isCapturing = true; // UI state
        this.updateStatus('🎛️ EQ Active (Background)', 'active');
        
        // Show notification about background state
        this.showNotification(
          'EQ Active', 
          'EQ is running in background. Toggle off/on to restart audio processing.', 
          'info'
        );
        
        // Update badge to show EQ is active
        chrome.runtime.sendMessage({ 
          action: 'captureStarted', 
          tabId: response.activeTabId 
        });
      } else {
        this.state.backgroundActive = false;
      }
    } catch (error) {
      console.log('Could not check background state:', error);
      this.state.backgroundActive = false;
    }
  }

  setupEventListeners() {
    // EQ Power Switch - Now controls everything with background persistence
    const eqToggle = document.getElementById('eq-enabled');
    if (eqToggle) {
      eqToggle.addEventListener('change', (e) => this.toggleEQPower(e.target.checked));
    }
    
    // EQ controls
    document.querySelectorAll('.eq-band input').forEach((slider, index) => {
      slider.addEventListener('input', (e) => this.updateEQBand(index, e.target.value));
    });
    
    document.querySelectorAll('.presets button').forEach(btn => {
      btn.addEventListener('click', () => this.applyEQPreset(btn.dataset.preset));
    });
  }

  setupCallbacks() {
    // Capture manager callbacks
    if (this.components.captureManager) {
      this.components.captureManager.onStart = () => {
        this.state.isCapturing = true;
        this.state.backgroundActive = true;
        this.updateStatus('🎛️ EQ Active', 'active');
        
        // Start visualizer if audio processor is ready
        if (this.components.audioProcessor && this.components.audioProcessor.isInitialized) {
          console.log('🎯 Audio processor ready, starting visualizer');
          this.startVisualizer();
        }
        
        // Show persistence info
        this.showNotification(
          'EQ Started', 
          'EQ is now active. You can close this popup and EQ will continue running.', 
          'success'
        );
      };
      
      this.components.captureManager.onStop = () => {
        this.state.isCapturing = false;
        this.state.backgroundActive = false;
        this.stopVisualizer();
        this.updateStatus('Ready', 'active');
        
        // Notify background that EQ stopped
        chrome.runtime.sendMessage({ action: 'captureStopped' });
      };
      
      this.components.captureManager.onError = (error) => {
        console.error('Capture manager error:', error);
        
        // Provide helpful error messages based on error type
        let userMessage = error.message;
        if (error.message.includes('Invalid state')) {
          userMessage = 'Tab must be playing audio to start EQ. Try starting music/video first.';
        } else if (error.message.includes('Extension has not been invoked')) {
          userMessage = 'Please click the extension icon again to activate EQ.';
        }
        
        this.showNotification('Capture Error', userMessage, 'error');
        this.updateStatus('Error', 'error');
        this.stopVisualizer();
        this.state.isCapturing = false;
        this.state.backgroundActive = false;
      };
    }
  }

  // Visualizer Methods
  startVisualizer() {
    if (this.components.audioProcessor && this.components.audioProcessor.isInitialized) {
      const analyser = this.components.audioProcessor.getAnalyser();
      if (analyser && this.visualizer) {
        this.visualizer.start(analyser);
        console.log('🎨 Visualizer started with analyser');
      } else {
        console.warn('⚠️ No analyser available for visualizer');
      }
    } else {
      console.warn('⚠️ Audio processor not ready for visualizer');
    }
  }

  stopVisualizer() {
    if (this.visualizer) {
      this.visualizer.stop();
      console.log('🎨 Visualizer stopped');
    }
  }

  // EQ Power Switch Methods - Enhanced with background persistence
  async toggleEQPower(enabled) {
    try {
      // Reset retry count when manually toggling
      this.retryCount = 0;
      
      // Save state to storage for persistence
      this.state.shouldBeCapturing = enabled;
      await this.components.storage.save('eqEnabled', enabled);
      
      // Update audio processor state
      if (this.components.audioProcessor) {
        if (this.components.audioProcessor.isInitialized) {
          await this.components.audioProcessor.toggleEQ(enabled);
        } else {
          this.components.audioProcessor.eqEnabled = enabled;
        }
      }
      
      // Update UI
      this.updateEQUI(enabled);
      
      // Start or stop capture based on EQ state
      if (enabled) {
        if (this.state.backgroundActive) {
          // EQ was active in background, restart fresh session
          console.log('🔄 Restarting EQ session...');
          await this.stopCapture(); // Stop any existing session
          await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause
        }
        
        await this.ensureCapture();
        console.log('🎛️ EQ enabled and capture started');
        
      } else {
        await this.stopCapture();
        this.showNotification('EQ Disabled', 'Audio processing stopped', 'info');
        console.log('🎛️ EQ disabled');
      }
      
    } catch (error) {
      console.error('Error toggling EQ:', error);
      this.showNotification('EQ Error', 'Failed to toggle equalizer: ' + error.message, 'error');
      
      // Revert UI on error
      const checkbox = document.getElementById('eq-enabled');
      if (checkbox) checkbox.checked = !enabled;
    }
  }

  // Ensure capture is active when needed - Enhanced error handling
  async ensureCapture() {
    if (this.state.shouldBeCapturing && !this.state.isCapturing) {
      if (this.retryCount >= this.maxRetries) {
        console.error('🚫 Max retry attempts reached, stopping capture attempts');
        this.showNotification(
          'Capture Failed', 
          'Unable to start EQ after multiple attempts. Make sure the tab is playing audio.', 
          'error'
        );
        return;
      }
      
      try {
        this.retryCount++;
        
        // Get current active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
          throw new Error('No active tab found');
        }
        
        const currentTab = tabs[0];
        console.log('🎯 Attempting to start EQ on tab:', {
          id: currentTab.id,
          url: currentTab.url,
          title: currentTab.title
        });
        
        // Start capture
        await this.components.captureManager.start(currentTab.id, true);
        
        // Reset retry count on success
        this.retryCount = 0;
        
        // Verify we have audio context and stream
        const stream = this.components.captureManager.getActiveStream();
        const audioContext = this.components.captureManager.getAudioContext();
        
        if (stream && audioContext) {
          console.log('🎯 Audio capture successful:', {
            streamTracks: stream.getAudioTracks().length,
            audioContextState: audioContext.state
          });
        } else {
          console.warn('⚠️ Audio capture incomplete - missing stream or context');
        }
        
      } catch (error) {
        console.error(`Failed to ensure capture (attempt ${this.retryCount}/${this.maxRetries}):`, error);
        
        let userMessage = `Attempt ${this.retryCount}: ${error.message}`;
        if (error.message.includes('Tab must be playing audio')) {
          userMessage = 'Please start playing audio in this tab first, then try again.';
        }
        
        this.showNotification('Capture Failed', userMessage, 'error');
        
        if (this.retryCount < this.maxRetries) {
          // Wait before retry, with exponential backoff
          const delay = Math.pow(2, this.retryCount) * 1000;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          
          setTimeout(() => {
            if (this.state.shouldBeCapturing && !this.state.isCapturing) {
              this.ensureCapture();
            }
          }, delay);
        } else {
          // Max retries reached, revert UI
          const checkbox = document.getElementById('eq-enabled');
          if (checkbox) checkbox.checked = false;
          this.updateEQUI(false);
        }
      }
    }
  }

  // Stop capture
  async stopCapture() {
    if (this.state.isCapturing || this.state.backgroundActive) {
      try {
        await this.components.captureManager.stop();
        this.state.backgroundActive = false;
      } catch (error) {
        console.error('Failed to stop capture:', error);
      }
    }
  }

  updateEQUI(enabled) {
    const checkbox = document.getElementById('eq-enabled');
    const powerSection = document.querySelector('.eq-power-section');
    const status = document.getElementById('eq-status');
    const container = document.querySelector('.eq-container');
    
    // Force update checkbox state
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
    
    // Update EQ sliders visual state
    const sliders = document.querySelectorAll('.eq-slider');
    sliders.forEach(slider => {
      slider.style.opacity = enabled ? '1' : '0.5';
    });
  }

  // UI Update Methods
  updateStatus(text, type) {
    const statusText = document.getElementById('status-text');
    const statusIcon = document.getElementById('status-icon');
    
    if (statusText) statusText.textContent = text;
    if (statusIcon) statusIcon.className = `status-icon ${type}`;
  }

  // EQ Methods
  updateEQBand(index, value) {
    const band = document.querySelectorAll('.eq-band')[index];
    const valueDisplay = band.querySelector('.eq-value');
    
    if (valueDisplay) {
      valueDisplay.textContent = `${value}dB`;
    }
    
    // Update audio processor if active
    if (this.components.audioProcessor && this.components.audioProcessor.isInitialized) {
      this.components.audioProcessor.updateEQBand(index, parseFloat(value));
    }
  }

  applyEQPreset(preset) {
    const presets = {
      flat: [0, 0, 0, 0, 0, 0, 0, 0],
      bass: [8, 6, 4, 2, 0, -1, -2, -3],
      vocal: [-2, -1, 0, 2, 4, 3, 1, -1],
      treble: [-3, -2, -1, 0, 1, 3, 6, 8]
    };
    
    const values = presets[preset] || presets.flat;
    const sliders = document.querySelectorAll('.eq-band input');
    
    sliders.forEach((slider, index) => {
      if (values[index] !== undefined) {
        slider.value = values[index];
        this.updateEQBand(index, values[index]);
      }
    });
    
    // Highlight active preset
    document.querySelectorAll('.presets .btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-preset="${preset}"]`).classList.add('active');
    
    this.showNotification('Preset Applied', `${preset.charAt(0).toUpperCase() + preset.slice(1)} EQ preset applied`, 'success');
  }

  showNotification(title, message, type = 'info') {
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
    
    // Auto-remove after 7 seconds (increased for longer messages)
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 7000);
  }

  async loadSettings() {
    try {
      // Load all settings
      const settings = await this.components.storage.getCurrentSettings();
      
      // Set internal state
      this.state.shouldBeCapturing = settings.eqEnabled;
      
      // Update EQ UI based on settings or background state
      const actualEnabled = settings.eqEnabled || this.state.backgroundActive;
      this.updateEQUI(actualEnabled);
      
      // Set audio processor state if it exists
      if (this.components.audioProcessor) {
        this.components.audioProcessor.eqEnabled = actualEnabled;
        this.components.audioProcessor.eqValues = [...settings.eqBands];
      }
      
      // Set EQ band values in UI
      const sliders = document.querySelectorAll('.eq-band input');
      sliders.forEach((slider, index) => {
        if (settings.eqBands[index] !== undefined) {
          slider.value = settings.eqBands[index];
          this.updateEQBand(index, settings.eqBands[index]);
        }
      });
      
      // Auto-start capture if EQ is enabled and not already active in background
      if (settings.eqEnabled && !this.state.backgroundActive) {
        console.log('🔄 Auto-starting EQ from saved settings...');
        setTimeout(() => this.ensureCapture(), 1000);
      }
      
      console.log('⚙️ Settings loaded:', {
        eqEnabled: settings.eqEnabled,
        backgroundActive: this.state.backgroundActive,
        eqBands: settings.eqBands
      });
      
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // Cleanup when popup closes - register persistence
  cleanup() {
    if (this.state.isCapturing) {
      console.log('🎛️ Popup closing - EQ will continue in background');
      // Don't stop capture, let it continue in background
      // The background script will track the state
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.audioEqualizer = new AudioEqualizer();
  window.audioEqualizer.init();
});

// Handle popup closing - maintain background persistence
window.addEventListener('beforeunload', () => {
  if (window.audioEqualizer) {
    window.audioEqualizer.cleanup();
  }
});