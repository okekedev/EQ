// Enhanced Audio processing module with microphone routing capability

class AudioProcessor {
  constructor() {
    this.audioContext = null;
    this.inputNode = null;
    this.outputNode = null;
    this.filters = [];
    this.analyser = null;
    this.isInitialized = false;
    this.visualizerCallback = null;
    this.visualizerIntervalId = null;
    
    // New properties for microphone routing
    this.microphoneDestination = null;
    this.virtualMicStream = null;
    this.isMicRoutingEnabled = false;
    this.micGainNode = null;
  }

  // Initialize the audio processor with an input stream and existing audio context
  async initialize(stream, existingAudioContext = null) {
    // Clean up any existing audio context
    await this.cleanup();
    
    // Use provided audio context or create a new one
    this.audioContext = existingAudioContext || new AudioContext();
    
    // Create media stream source
    this.inputNode = this.audioContext.createMediaStreamSource(stream);
    
    // Create analyzer node for visualizations
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    
    // Create gain node for output
    this.outputNode = this.audioContext.createGain();
    
    // Create microphone destination for routing processed audio
    this.microphoneDestination = this.audioContext.createMediaStreamDestination();
    
    // Create gain node for microphone output level control
    this.micGainNode = this.audioContext.createGain();
    this.micGainNode.gain.value = 1.0; // Default gain
    
    // Create default equalizer
    await this.createEqualizer();
    
    // Mark as initialized
    this.isInitialized = true;
    
    return this.audioContext;
  }

  // Create the equalizer with 6 bands and connect microphone routing
  async createEqualizer(settings = null) {
    // Load saved settings or use defaults
    const eqSettings = settings || await this.loadEqualizerSettings();
    
    // Clear existing filters
    this.filters = [];
    
    // Disconnect input if already connected
    if (this.inputNode) {
      this.inputNode.disconnect();
    }
    
    // Create the 6-band equalizer
    const bands = [
      { type: 'lowshelf', frequency: 100, gain: eqSettings.band1 || 0 },
      { type: 'peaking', frequency: 250, Q: 1, gain: eqSettings.band2 || 0 },
      { type: 'peaking', frequency: 500, Q: 1, gain: eqSettings.band3 || 0 },
      { type: 'peaking', frequency: 1000, Q: 1, gain: eqSettings.band4 || 0 },
      { type: 'peaking', frequency: 4000, Q: 1, gain: eqSettings.band5 || 0 },
      { type: 'highshelf', frequency: 8000, gain: eqSettings.band6 || 0 }
    ];
    
    // Connect the input to the first filter
    let prevNode = this.inputNode;
    
    // Create and connect each filter
    bands.forEach(band => {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = band.gain;
      
      if (band.Q) {
        filter.Q.value = band.Q;
      }
      
      // Connect to the previous node
      prevNode.connect(filter);
      prevNode = filter;
      
      // Store filter for later adjustment
      this.filters.push(filter);
    });
    
    // Connect the last filter to the analyzer and output
    prevNode.connect(this.analyser);
    this.analyser.connect(this.outputNode);
    
    // Connect to microphone destination through gain control
    this.analyser.connect(this.micGainNode);
    this.micGainNode.connect(this.microphoneDestination);
    
    // Create the virtual microphone stream
    this.virtualMicStream = this.microphoneDestination.stream;
    
    return this.filters;
  }

  // Enable or disable microphone routing
  enableMicrophoneRouting(enabled = true) {
    this.isMicRoutingEnabled = enabled;
    
    if (enabled) {
      console.log('Microphone routing enabled - processed audio will be available as virtual microphone');
    } else {
      console.log('Microphone routing disabled');
    }
    
    return this.virtualMicStream;
  }

  // Set the microphone output gain (volume control for the virtual mic)
  setMicrophoneGain(gain) {
    if (this.micGainNode) {
      // Clamp gain between 0 and 2 for safety
      const clampedGain = Math.max(0, Math.min(2, gain));
      this.micGainNode.gain.value = clampedGain;
      console.log(`Microphone output gain set to: ${clampedGain}`);
    }
  }

  // Get the virtual microphone stream for use with Speech Recognition API
  getVirtualMicrophoneStream() {
    if (!this.isInitialized || !this.virtualMicStream) {
      console.warn('Virtual microphone stream not available - processor not initialized');
      return null;
    }
    
    return this.virtualMicStream;
  }

  // Check if microphone routing is available and enabled
  isMicrophoneRoutingEnabled() {
    return this.isMicRoutingEnabled && this.virtualMicStream !== null;
  }

  // Get audio metrics for monitoring
  getAudioMetrics() {
    if (!this.analyser) {
      return null;
    }
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    // Calculate RMS (Root Mean Square) for volume level
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    const volume = rms / 255; // Normalize to 0-1
    
    return {
      volume: volume,
      frequencyData: dataArray,
      bufferLength: bufferLength
    };
  }

  // Update equalizer settings
  async updateEqualizer(settings) {
    if (!this.isInitialized) {
      throw new Error('Audio processor not initialized');
    }
    
    // Recreate equalizer with new settings
    await this.createEqualizer(settings);
    
    // Save settings
    await this.saveEqualizerSettings(settings);
    
    return true;
  }

  // Get the analyser node for visualizations
  getAnalyser() {
    return this.analyser;
  }

  // Get the output node for further processing or output
  getOutputNode() {
    return this.outputNode;
  }

  // Get the audio context
  getAudioContext() {
    return this.audioContext;
  }

  // Start the visualizer
  startVisualizer(callback, intervalMs = 100) {
    if (!this.isInitialized || !this.analyser) {
      throw new Error('Analyzer not available');
    }
    
    this.visualizerCallback = callback;
    
    // Stop any existing visualizer
    this.stopVisualizer();
    
    // Create the visualizer data array
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Start the visualizer interval
    this.visualizerIntervalId = setInterval(() => {
      // Get the frequency data
      this.analyser.getByteFrequencyData(dataArray);
      
      // Call the callback with the data
      if (this.visualizerCallback) {
        this.visualizerCallback(dataArray, bufferLength);
      }
    }, intervalMs);
  }

  // Stop the visualizer
  stopVisualizer() {
    if (this.visualizerIntervalId) {
      clearInterval(this.visualizerIntervalId);
      this.visualizerIntervalId = null;
    }
  }

  // Clean up resources
  async cleanup() {
    // Stop visualizer
    this.stopVisualizer();
    
    // Disable microphone routing
    this.isMicRoutingEnabled = false;
    
    // Close audio context if it exists and we created it
    if (this.audioContext) {
      try {
        // Disconnect nodes instead of closing the context
        // since the context might be shared
        if (this.outputNode) {
          this.outputNode.disconnect();
        }
        
        if (this.analyser) {
          this.analyser.disconnect();
        }
        
        if (this.inputNode) {
          this.inputNode.disconnect();
        }
        
        if (this.micGainNode) {
          this.micGainNode.disconnect();
        }
        
        if (this.filters) {
          this.filters.forEach(filter => {
            try { filter.disconnect(); } catch (e) {}
          });
        }
      } catch (error) {
        console.error('Error cleaning up audio processor:', error);
      }
      
      // Reset nodes but keep the context reference
      this.inputNode = null;
      this.outputNode = null;
      this.filters = [];
      this.analyser = null;
      this.microphoneDestination = null;
      this.virtualMicStream = null;
      this.micGainNode = null;
      this.isInitialized = false;
    }
  }

  // Load equalizer settings from storage
  async loadEqualizerSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get('equalizerSettings', (data) => {
        resolve(data.equalizerSettings || this.getDefaultEqualizerSettings());
      });
    });
  }

  // Save equalizer settings to storage
  async saveEqualizerSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ equalizerSettings: settings }, () => {
        resolve(true);
      });
    });
  }

  // Get default equalizer settings
  getDefaultEqualizerSettings() {
    return {
      band1: 0, // 100 Hz (lowshelf)
      band2: 0, // 250 Hz
      band3: 0, // 500 Hz
      band4: 0, // 1000 Hz
      band5: 0, // 4000 Hz
      band6: 0  // 8000 Hz (highshelf)
    };
  }
}

// Export the AudioProcessor class
window.AudioProcessor = AudioProcessor;