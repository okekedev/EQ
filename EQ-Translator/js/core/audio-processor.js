// Audio processing module with equalizer implementation

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
    this.eqEnabled = true;
    this.eqValues = [0, 0, 0, 0, 0, 0, 0, 0]; // 8-band EQ values
    
    // API Interception
    this.originalGetUserMedia = null;
    this.isIntercepting = false;
    this.processedAudioTrack = null;
  }

  // Initialize the audio processor with an input stream and existing audio context
  async initialize(stream, existingAudioContext = null) {
    try {
      console.log('🎯 Initializing audio processor with stream');
      
      // Clean up any existing audio context
      await this.cleanup();

      // Use provided audio context or create a new one
      this.audioContext = existingAudioContext || new AudioContext();
      
      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('🎯 Audio context resumed');
      }

      // Create media stream source
      this.inputNode = this.audioContext.createMediaStreamSource(stream);

      // Create analyzer node for visualizations
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      // Create gain node for output
      this.outputNode = this.audioContext.createGain();

      // Load EQ settings and create equalizer
      await this.loadEQSettings();
      await this.createEqualizer();

      // Setup API interception
      this.setupAPIInterception();

      // Mark as initialized
      this.isInitialized = true;
      
      console.log('🎯 Audio processor initialized successfully');
      return this.audioContext;
      
    } catch (error) {
      console.error('Audio processor initialization failed:', error);
      throw error;
    }
  }

  // Load EQ settings from storage
  async loadEQSettings() {
    try {
      const settings = await new Promise((resolve) => {
        chrome.storage.local.get('audioEqualizerSettings', (data) => {
          resolve(data.audioEqualizerSettings || {});
        });
      });
      
      this.eqEnabled = settings.eqEnabled !== undefined ? settings.eqEnabled : true;
      this.eqValues = settings.eq || [0, 0, 0, 0, 0, 0, 0, 0];
      
      console.log('🎛️ EQ settings loaded:', { enabled: this.eqEnabled, values: this.eqValues });
      
    } catch (error) {
      console.error('Error loading EQ settings:', error);
      // Use defaults
      this.eqEnabled = true;
      this.eqValues = [0, 0, 0, 0, 0, 0, 0, 0];
    }
  }

  // Save EQ settings to storage
  async saveEQSettings() {
    try {
      const allSettings = await new Promise((resolve) => {
        chrome.storage.local.get('audioEqualizerSettings', (data) => {
          resolve(data.audioEqualizerSettings || {});
        });
      });
      
      allSettings.eqEnabled = this.eqEnabled;
      allSettings.eq = this.eqValues;
      
      await new Promise((resolve) => {
        chrome.storage.local.set({ audioEqualizerSettings: allSettings }, resolve);
      });
      
      console.log('🎛️ EQ settings saved');
      
    } catch (error) {
      console.error('Error saving EQ settings:', error);
    }
  }

  // Create the equalizer with 8 bands
  async createEqualizer() {
    // Clear existing filters
    this.filters = [];

    // Disconnect input if already connected
    if (this.inputNode) {
      this.inputNode.disconnect();
    }

    // Create the 8-band equalizer
    const bands = [
      { type: 'lowshelf', frequency: 60, gain: this.eqValues[0] || 0 },
      { type: 'peaking', frequency: 170, Q: 1, gain: this.eqValues[1] || 0 },
      { type: 'peaking', frequency: 310, Q: 1, gain: this.eqValues[2] || 0 },
      { type: 'peaking', frequency: 600, Q: 1, gain: this.eqValues[3] || 0 },
      { type: 'peaking', frequency: 1000, Q: 1, gain: this.eqValues[4] || 0 },
      { type: 'peaking', frequency: 3000, Q: 1, gain: this.eqValues[5] || 0 },
      { type: 'peaking', frequency: 6000, Q: 1, gain: this.eqValues[6] || 0 },
      { type: 'highshelf', frequency: 8000, gain: this.eqValues[7] || 0 }
    ];

    // Connect the input to the first filter
    let prevNode = this.inputNode;

    // Create and connect each filter
    bands.forEach((band, index) => {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = this.eqEnabled ? band.gain : 0;

      if (band.Q) {
        filter.Q.value = band.Q;
      }

      // Connect to the previous node
      prevNode.connect(filter);
      prevNode = filter;

      // Store filter for later adjustment
      this.filters.push(filter);
      
      console.log(`🎛️ Created EQ band ${index}: ${band.frequency}Hz`);
    });

    // Connect the last filter to the analyzer and output
    prevNode.connect(this.analyser);
    this.analyser.connect(this.outputNode);
    
    // Store the processed audio track for API interception
    const virtualMicDestination = this.audioContext.createMediaStreamDestination();
    this.outputNode.connect(virtualMicDestination);
    this.processedAudioTrack = virtualMicDestination.stream.getAudioTracks()[0];

    console.log('🎛️ EQ chain connected successfully');
    return this.filters;
  }

  // Update a specific EQ band
  updateEQBand(index, gainDB) {
    if (this.filters[index]) {
      this.eqValues[index] = gainDB;
      const actualGain = this.eqEnabled ? gainDB : 0;
      this.filters[index].gain.value = actualGain;
      
      console.log(`🎛️ EQ Band ${index} updated: ${gainDB}dB`);
      
      // Save settings
      this.saveEQSettings();
    } else {
      console.warn(`⚠️ EQ Band ${index} not found`);
    }
  }

  // Toggle EQ on/off
  async toggleEQ(enabled) {
    this.eqEnabled = enabled;
    
    // Update all EQ bands
    if (this.filters && this.filters.length > 0) {
      this.filters.forEach((filter, index) => {
        if (filter && filter.gain) {
          filter.gain.value = enabled ? this.eqValues[index] : 0;
        }
      });
      console.log(`🎛️ EQ ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    // Save settings
    await this.saveEQSettings();
    
    return enabled;
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

  // Check if EQ is enabled
  isEQEnabled() {
    return this.eqEnabled;
  }

  // Get EQ values
  getEQValues() {
    return [...this.eqValues];
  }

  // Start the visualizer
  startVisualizer(callback, intervalMs = 100) {
    if (!this.isInitialized || !this.analyser) {
      return false;
    }

    this.visualizerCallback = callback;

    const updateVisualizer = () => {
      if (this.visualizerCallback && this.analyser) {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
        this.visualizerCallback(dataArray, bufferLength);
      }
    };

    this.visualizerIntervalId = setInterval(updateVisualizer, intervalMs);
    return true;
  }

  // Stop the visualizer
  stopVisualizer() {
    if (this.visualizerIntervalId) {
      clearInterval(this.visualizerIntervalId);
      this.visualizerIntervalId = null;
    }
    this.visualizerCallback = null;
  }

  // API Interception Methods
  setupAPIInterception() {
    // Store original getUserMedia
    this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  }

  startAPIInterception() {
    if (this.isIntercepting) return true;
    
    const self = this;
    
    // Replace getUserMedia with our intercepting version
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      console.log('🎯 getUserMedia intercepted!', constraints);
      
      // If requesting audio and we have processed audio available
      if (constraints?.audio && self.processedAudioTrack && self.isIntercepting) {
        console.log('🎯 Returning processed audio instead of microphone!');
        
        try {
          // Create a new stream with our processed audio
          const processedStream = new MediaStream([self.processedAudioTrack.clone()]);
          
          // Add video if requested
          if (constraints.video) {
            try {
              const videoStream = await self.originalGetUserMedia({ video: constraints.video });
              const videoTrack = videoStream.getVideoTracks()[0];
              if (videoTrack) processedStream.addTrack(videoTrack);
            } catch (videoError) {
              console.warn('Could not add video track:', videoError);
            }
          }
          
          return processedStream;
          
        } catch (error) {
          console.error('Error creating processed stream:', error);
          return self.originalGetUserMedia.call(this, constraints);
        }
      }
      
      // For non-audio requests or when not intercepting, use original
      return self.originalGetUserMedia.call(this, constraints);
    };
    
    this.isIntercepting = true;
    console.log('🎯 API interception started!');
    
    return true;
  }

  stopAPIInterception() {
    if (!this.isIntercepting) return;
    
    navigator.mediaDevices.getUserMedia = this.originalGetUserMedia;
    this.isIntercepting = false;
    
    console.log('🔄 API interception stopped');
  }

  // Clean up the audio processor
  async cleanup() {
    console.log('🛑 Cleaning up audio processor...');
    
    // Save EQ settings before cleanup
    await this.saveEQSettings();
    
    // Stop API interception
    this.stopAPIInterception();
    
    // Stop visualizer
    this.stopVisualizer();

    // Disconnect and clean up audio nodes
    try {
      if (this.outputNode) {
        this.outputNode.disconnect();
      }
      
      if (this.analyser) {
        this.analyser.disconnect();
      }
      
      if (this.inputNode) {
        this.inputNode.disconnect();
      }
      
      if (this.filters) {
        this.filters.forEach(filter => {
          try { 
            filter.disconnect(); 
          } catch (e) {
            // Ignore disconnect errors
          }
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
    this.isInitialized = false;
    this.processedAudioTrack = null;
    
    console.log('🛑 Audio processor cleanup complete');
  }
}

// Export the AudioProcessor class
window.AudioProcessor = AudioProcessor;