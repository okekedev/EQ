// Audio Processor with Built-in API Interception and EQ Persistence
class AudioProcessor {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.eqNodes = [];
    this.analyser = null;
    this.outputNode = null;
    this.virtualMicDestination = null;
    this.isInitialized = false;
    this.eqEnabled = true;
    this.eqValues = [0, 0, 0, 0, 0]; // Store EQ values
    
    // API Interception
    this.originalGetUserMedia = null;
    this.isIntercepting = false;
    this.processedAudioTrack = null;
  }

  async initialize(stream, existingContext = null) {
    try {
      console.log('🎯 Initializing audio processor with stream:', {
        streamId: stream.id,
        audioTracks: stream.getAudioTracks().length,
        hasExistingContext: !!existingContext
      });
      
      // Create or use existing audio context
      this.audioContext = existingContext || new AudioContext();
      
      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('🎯 Audio context resumed');
      }
      
      // Create audio nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.outputNode = this.audioContext.createGain();
      this.virtualMicDestination = this.audioContext.createMediaStreamDestination();
      
      // Load EQ settings from storage
      await this.loadEQSettings();
      
      // Create EQ (5-band equalizer)
      this.createEqualizer();
      
      // Connect the audio chain
      this.connectNodes();
      
      // Setup API interception
      this.setupAPIInterception();
      
      this.isInitialized = true;
      console.log('🎯 Audio processor initialized successfully with EQ settings:', {
        eqEnabled: this.eqEnabled,
        eqValues: this.eqValues
      });
      
      return this.audioContext;
      
    } catch (error) {
      console.error('Audio processor initialization failed:', error);
      throw error;
    }
  }

  async loadEQSettings() {
    try {
      const settings = await new Promise((resolve) => {
        chrome.storage.local.get('eqTranslatorSettings', (data) => {
          resolve(data.eqTranslatorSettings || {});
        });
      });
      
      this.eqEnabled = settings.eqEnabled !== undefined ? settings.eqEnabled : true;
      this.eqValues = settings.eq || [0, 0, 0, 0, 0];
      
      console.log('🎛️ EQ settings loaded:', { enabled: this.eqEnabled, values: this.eqValues });
      
    } catch (error) {
      console.error('Error loading EQ settings:', error);
      // Use defaults
      this.eqEnabled = true;
      this.eqValues = [0, 0, 0, 0, 0];
    }
  }

  async saveEQSettings() {
    try {
      const allSettings = await new Promise((resolve) => {
        chrome.storage.local.get('eqTranslatorSettings', (data) => {
          resolve(data.eqTranslatorSettings || {});
        });
      });
      
      allSettings.eqEnabled = this.eqEnabled;
      allSettings.eq = this.eqValues;
      
      await new Promise((resolve) => {
        chrome.storage.local.set({ eqTranslatorSettings: allSettings }, resolve);
      });
      
      console.log('🎛️ EQ settings saved:', { enabled: this.eqEnabled, values: this.eqValues });
      
    } catch (error) {
      console.error('Error saving EQ settings:', error);
    }
  }

  createEqualizer() {
    // Clear existing EQ
    this.eqNodes = [];
    
    // EQ bands: 100Hz, 250Hz, 500Hz, 1kHz, 4kHz (5 bands instead of 6)
    const bands = [
      { type: 'lowshelf', frequency: 100, gain: this.eqValues[0] || 0 },
      { type: 'peaking', frequency: 250, Q: 1, gain: this.eqValues[1] || 0 },
      { type: 'peaking', frequency: 500, Q: 1, gain: this.eqValues[2] || 0 },
      { type: 'peaking', frequency: 1000, Q: 1, gain: this.eqValues[3] || 0 },
      { type: 'highshelf', frequency: 4000, gain: this.eqValues[4] || 0 }
    ];
    
    bands.forEach((band, index) => {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = this.eqEnabled ? band.gain : 0;
      if (band.Q) filter.Q.value = band.Q;
      
      this.eqNodes.push(filter);
    });
  }

  connectNodes() {
    // Disconnect any existing connections
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {
        // Ignore disconnect errors for new nodes
      }
    }
    this.eqNodes.forEach(node => {
      try {
        node.disconnect();
      } catch (e) {
        // Ignore disconnect errors for new nodes
      }
    });
    
    console.log('🎯 Connecting audio nodes:', {
      sourceNode: !!this.sourceNode,
      eqNodes: this.eqNodes.length,
      analyser: !!this.analyser,
      outputNode: !!this.outputNode,
      virtualMic: !!this.virtualMicDestination
    });
    
    // Connect: source -> EQ chain -> analyser -> output & virtual mic
    let currentNode = this.sourceNode;
    
    this.eqNodes.forEach((eqNode, index) => {
      currentNode.connect(eqNode);
      currentNode = eqNode;
      console.log(`🎛️ Connected EQ band ${index} (${eqNode.frequency.value}Hz)`);
    });
    
    currentNode.connect(this.analyser);
    this.analyser.connect(this.outputNode);
    this.outputNode.connect(this.virtualMicDestination);
    
    // Store the processed audio track for API interception
    this.processedAudioTrack = this.virtualMicDestination.stream.getAudioTracks()[0];
    
    console.log('🎯 Audio chain connected successfully:', {
      processedTrackId: this.processedAudioTrack.id,
      processedTrackEnabled: this.processedAudioTrack.enabled
    });
  }

  updateEQBand(index, gainDB) {
    if (this.eqNodes[index]) {
      this.eqValues[index] = gainDB;
      const actualGain = this.eqEnabled ? gainDB : 0;
      this.eqNodes[index].gain.value = actualGain;
      
      console.log(`🎛️ EQ Band ${index} updated:`, {
        frequency: this.eqNodes[index].frequency.value + 'Hz',
        requestedGain: gainDB + 'dB',
        actualGain: actualGain + 'dB',
        eqEnabled: this.eqEnabled
      });
      
      // Save settings
      this.saveEQSettings();
    } else {
      console.warn(`⚠️ EQ Band ${index} not found - processor may not be initialized`);
    }
  }

  async toggleEQ(enabled) {
    this.eqEnabled = enabled;
    
    // Update all EQ bands if nodes exist
    if (this.eqNodes && this.eqNodes.length > 0) {
      this.eqNodes.forEach((node, index) => {
        if (node && node.gain) {
          node.gain.value = enabled ? this.eqValues[index] : 0;
        }
      });
      console.log(`🎛️ EQ nodes updated: ${enabled ? 'enabled' : 'disabled'}`);
    } else {
      console.log(`🎛️ EQ state set to ${enabled ? 'enabled' : 'disabled'} (will apply when audio is initialized)`);
    }
    
    // Save settings
    await this.saveEQSettings();
    
    return enabled;
  }

  isEQEnabled() {
    return this.eqEnabled;
  }

  getEQValues() {
    return [...this.eqValues];
  }

  getAnalyser() {
    return this.analyser;
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
        console.log('🎯 MAGIC: Returning processed audio instead of microphone!');
        
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

  isAPIIntercepting() {
    return this.isIntercepting;
  }

  async testInterception() {
    if (!this.isIntercepting) return false;
    
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const hasAudio = testStream.getAudioTracks().length > 0;
      testStream.getTracks().forEach(track => track.stop());
      return hasAudio;
    } catch (error) {
      console.error('Interception test failed:', error);
      return false;
    }
  }

  async cleanup() {
    // Save EQ settings before cleanup
    await this.saveEQSettings();
    
    // Stop API interception
    this.stopAPIInterception();
    
    // Disconnect audio nodes
    if (this.sourceNode) this.sourceNode.disconnect();
    this.eqNodes.forEach(node => node.disconnect());
    if (this.analyser) this.analyser.disconnect();
    if (this.outputNode) this.outputNode.disconnect();
    
    // Reset state
    this.isInitialized = false;
    this.processedAudioTrack = null;
  }
}

window.AudioProcessor = AudioProcessor;