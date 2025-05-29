// Audio Processor with Built-in API Interception
class AudioProcessor {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.eqNodes = [];
    this.analyser = null;
    this.outputNode = null;
    this.virtualMicDestination = null;
    this.isInitialized = false;
    
    // API Interception
    this.originalGetUserMedia = null;
    this.isIntercepting = false;
    this.processedAudioTrack = null;
  }

  async initialize(stream, existingContext = null) {
    try {
      // Create or use existing audio context
      this.audioContext = existingContext || new AudioContext();
      
      // Create audio nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.outputNode = this.audioContext.createGain();
      this.virtualMicDestination = this.audioContext.createMediaStreamDestination();
      
      // Create EQ (6-band equalizer)
      this.createEqualizer();
      
      // Connect the audio chain
      this.connectNodes();
      
      // Setup API interception
      this.setupAPIInterception();
      
      this.isInitialized = true;
      console.log('🎯 Audio processor initialized with API interception');
      
      return this.audioContext;
      
    } catch (error) {
      console.error('Audio processor initialization failed:', error);
      throw error;
    }
  }

  createEqualizer() {
    // Clear existing EQ
    this.eqNodes = [];
    
    // EQ bands: 100Hz, 250Hz, 500Hz, 1kHz, 4kHz, 8kHz
    const bands = [
      { type: 'lowshelf', frequency: 100, gain: 0 },
      { type: 'peaking', frequency: 250, Q: 1, gain: 0 },
      { type: 'peaking', frequency: 500, Q: 1, gain: 0 },
      { type: 'peaking', frequency: 1000, Q: 1, gain: 0 },
      { type: 'peaking', frequency: 4000, Q: 1, gain: 0 },
      { type: 'highshelf', frequency: 8000, gain: 0 }
    ];
    
    bands.forEach(band => {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = band.gain;
      if (band.Q) filter.Q.value = band.Q;
      
      this.eqNodes.push(filter);
    });
  }

  connectNodes() {
    // Disconnect any existing connections
    if (this.sourceNode) this.sourceNode.disconnect();
    this.eqNodes.forEach(node => node.disconnect());
    
    // Connect: source -> EQ chain -> analyser -> output & virtual mic
    let currentNode = this.sourceNode;
    
    this.eqNodes.forEach(eqNode => {
      currentNode.connect(eqNode);
      currentNode = eqNode;
    });
    
    currentNode.connect(this.analyser);
    this.analyser.connect(this.outputNode);
    this.analyser.connect(this.virtualMicDestination);
    
    // Store the processed audio track for API interception
    this.processedAudioTrack = this.virtualMicDestination.stream.getAudioTracks()[0];
  }

  updateEQBand(index, gainDB) {
    if (this.eqNodes[index]) {
      this.eqNodes[index].gain.value = gainDB;
    }
  }

  toggleEQ(enabled) {
    this.eqNodes.forEach(node => {
      node.gain.value = enabled ? node.gain.value : 0;
    });
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