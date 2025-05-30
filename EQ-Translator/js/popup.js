// Audio Equalizer - Minimalist Single Section Design

class AudioEqualizer {
  constructor() {
    this.components = {};
    this.visualizer = {
      canvas: null,
      ctx: null,
      animationId: null,
      analyser: null
    };
    this.state = {
      isCapturing: false,
      shouldBeCapturing: false
    };
  }

  async init() {
    try {
      this.updateStatus('Initializing...', 'pending');
      
      // Initialize components
      this.components.storage = new Storage();
      this.components.audioProcessor = new AudioProcessor();
      this.components.captureManager = new CaptureManager();
      
      // Initialize components
      await this.components.storage.init();
      
      // Setup everything
      this.setupEventListeners();
      this.setupCallbacks();
      this.setupVisualizer();
      await this.loadSettings();
      
      this.updateStatus('Ready', 'active');
      
    } catch (error) {
      console.error('Initialization error:', error);
      this.updateStatus('Initialization failed', 'error');
      this.showNotification('Error', error.message, 'error');
    }
  }

  setupEventListeners() {
    // EQ Power Switch - This now controls everything
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
        this.updateStatus('🎛️ EQ Active', 'active');
        
        // Initialize audio processor with the captured stream
        if (this.components.captureManager.getActiveStream()) {
          this.components.audioProcessor.initialize(
            this.components.captureManager.getActiveStream(),
            this.components.captureManager.getAudioContext()
          ).then(() => {
            console.log('🎯 Audio processor initialized with captured stream');
            this.startVisualizer();
          }).catch(error => {
            console.error('Failed to initialize audio processor:', error);
          });
        }
      };
      
      this.components.captureManager.onStop = () => {
        this.state.isCapturing = false;
        this.stopVisualizer();
        // Auto-restart if EQ should be active
        if (this.state.shouldBeCapturing) {
          setTimeout(() => this.ensureCapture(), 1000);
        } else {
          this.updateStatus('Ready', 'active');
        }
      };
      
      this.components.captureManager.onError = (error) => {
        this.showNotification('Capture Error', error.message, 'error');
        this.updateStatus('Error', 'error');
        this.stopVisualizer();
        // Try to restart if EQ should be active
        if (this.state.shouldBeCapturing) {
          setTimeout(() => this.ensureCapture(), 2000);
        }
      };
    }
  }

  // Visualizer Methods
  setupVisualizer() {
    this.visualizer.canvas = document.getElementById('visualizer-canvas');
    if (this.visualizer.canvas) {
      this.visualizer.ctx = this.visualizer.canvas.getContext('2d');
      
      // Set canvas size
      const rect = this.visualizer.canvas.getBoundingClientRect();
      this.visualizer.canvas.width = rect.width * 2; // High DPI
      this.visualizer.canvas.height = rect.height * 2;
      this.visualizer.ctx.scale(2, 2);
      
      // Start with empty visualization
      this.drawEmptyVisualizer();
    }
  }

  startVisualizer() {
    if (this.components.audioProcessor && this.components.audioProcessor.isInitialized) {
      this.visualizer.analyser = this.components.audioProcessor.getAnalyser();
      if (this.visualizer.analyser) {
        this.visualizer.analyser.fftSize = 256;
        this.animateVisualizer();
      }
    }
  }

  stopVisualizer() {
    if (this.visualizer.animationId) {
      cancelAnimationFrame(this.visualizer.animationId);
      this.visualizer.animationId = null;
    }
    this.drawEmptyVisualizer();
  }

  animateVisualizer() {
    if (!this.visualizer.analyser || !this.visualizer.ctx) return;
    
    const bufferLength = this.visualizer.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      this.visualizer.animationId = requestAnimationFrame(draw);
      
      this.visualizer.analyser.getByteFrequencyData(dataArray);
      
      const ctx = this.visualizer.ctx;
      const canvas = this.visualizer.canvas;
      const width = canvas.width / 2;
      const height = canvas.height / 2;
      
      // Clear canvas
      ctx.fillStyle = 'linear-gradient(45deg, #000, #1a1a1a)';
      ctx.fillRect(0, 0, width, height);
      
      // Draw frequency bars
      const barWidth = width / bufferLength * 2.5;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height * 0.8;
        
        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, '#00ff88');
        gradient.addColorStop(0.6, '#0088ff');
        gradient.addColorStop(1, '#ff0088');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
        
        x += barWidth;
      }
    };
    
    draw();
  }

  drawEmptyVisualizer() {
    if (!this.visualizer.ctx) return;
    
    const ctx = this.visualizer.ctx;
    const canvas = this.visualizer.canvas;
    const width = canvas.width / 2;
    const height = canvas.height / 2;
    
    // Clear with dark gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#000');
    gradient.addColorStop(1, '#1a1a1a');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw placeholder text
    ctx.fillStyle = '#444';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Audio visualization will appear here', width / 2, height / 2);
  }

  // EQ Power Switch Methods - Now controls everything
  async toggleEQPower(enabled) {
    try {
      // Save state
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
        await this.ensureCapture();
        this.showNotification('EQ Enabled', 'Audio processing started automatically', 'success');
      } else {
        await this.stopCapture();
        this.showNotification('EQ Disabled', 'Audio processing stopped', 'info');
      }
      
      console.log(`🎛️ EQ ${enabled ? 'enabled' : 'disabled'}`);
      
    } catch (error) {
      console.error('Error toggling EQ:', error);
      this.showNotification('EQ Error', 'Failed to toggle equalizer', 'error');
      
      // Revert UI on error
      const checkbox = document.getElementById('eq-enabled');
      if (checkbox) checkbox.checked = !enabled;
    }
  }

  // Ensure capture is active when needed
  async ensureCapture() {
    if (this.state.shouldBeCapturing && !this.state.isCapturing) {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0) {
          // Pass the audio processor to capture manager so it can initialize it
          await this.components.captureManager.start(tabs[0].id, true);
          
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
        }
      } catch (error) {
        console.error('Failed to ensure capture:', error);
        this.showNotification('Capture Failed', error.message, 'error');
      }
    }
  }

  // Stop capture
  async stopCapture() {
    if (this.state.isCapturing) {
      try {
        await this.components.captureManager.stop();
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
      flat: [0, 0, 0, 0, 0],
      bass: [6, 3, 0, -1, -2],
      vocal: [-2, -1, 2, 4, 0],
      treble: [-3, -1, 0, 2, 4]
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
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  async loadSettings() {
    try {
      // Load all settings
      const settings = await this.components.storage.getCurrentSettings();
      
      // Set internal state
      this.state.shouldBeCapturing = settings.eqEnabled;
      
      // Update EQ UI
      this.updateEQUI(settings.eqEnabled);
      
      // Set audio processor state if it exists
      if (this.components.audioProcessor) {
        this.components.audioProcessor.eqEnabled = settings.eqEnabled;
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
      
      // Auto-start capture if EQ is enabled
      if (settings.eqEnabled) {
        setTimeout(() => this.ensureCapture(), 1000);
      }
      
      console.log('⚙️ Settings loaded', settings);
      
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.audioEqualizer = new AudioEqualizer();
  window.audioEqualizer.init();
});