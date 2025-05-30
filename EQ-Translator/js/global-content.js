// Enhanced Global Content Script with Working Visualizer Support

console.log('🌍 GLOBAL EQ: Loading on', window.location.href);

class GlobalAudioEQProcessor {
  constructor() {
    this.isActive = false;
    this.settings = {
      eqEnabled: true,
      eqBands: [0, 0, 0, 0, 0, 0, 0, 0]
    };
    
    // Web Audio API interception
    this.originalAudioContext = null;
    this.originalWebkitAudioContext = null;
    this.interceptedContexts = new Set();
    
    // HTML5 Media interception  
    this.originalCreateElement = null;
    this.interceptedElements = new Set();
    this.mutationObserver = null;
    
    // Visualizer support - FIXED
    this.visualizerAnalyser = null;
    this.visualizerContext = null;
    this.mixerNode = null;
    this.connectedSources = new Set(); // Track what's connected to visualizer
    
    this.keepAliveTimer = null;
  }

  async initialize() {
    try {
      console.log('🚀 GLOBAL EQ: Initializing audio processor...');
      
      // Setup message listeners
      this.setupMessageListeners();
      
      // Check if we should start automatically
      await this.checkInitialState();
      
      // Start keep-alive
      this.startKeepAlive();
      
      console.log('✅ GLOBAL EQ: Initialization complete');
      
    } catch (error) {
      console.error('❌ GLOBAL EQ: Initialization failed:', error);
    }
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 GLOBAL EQ: Received message:', message.action);
      
      switch (message.action) {
        case 'startGlobalEQ':
          this.startGlobalEQ(message.settings).then(result => {
            console.log('🎛️ GLOBAL EQ: Start result:', result);
            sendResponse({ success: result });
          });
          return true;
          
        case 'stopGlobalEQ':
          this.stopGlobalEQ().then(result => {
            console.log('🛑 GLOBAL EQ: Stop result:', result);
            sendResponse({ success: result });
          });
          return true;
          
        case 'updateGlobalEQSettings':
          this.updateGlobalEQSettings(message.settings);
          sendResponse({ success: true });
          break;
          
        case 'getGlobalEQStatus':
          sendResponse({
            isActive: this.isActive,
            settings: this.settings,
            url: window.location.href,
            interceptedContexts: this.interceptedContexts.size,
            interceptedElements: this.interceptedElements.size,
            hasVisualizerAnalyser: !!this.visualizerAnalyser,
            connectedSources: this.connectedSources.size
          });
          break;
          
        case 'getVisualizerAnalyser':
          // FIXED: Return real analyser data
          const data = this.getVisualizerData();
          console.log('🎨 GLOBAL EQ: Sending visualizer data:', data ? 'YES' : 'NO', data);
          sendResponse({ 
            hasAnalyser: !!data,
            analyserData: data
          });
          break;
          
        case 'pingGlobalEQ':
          sendResponse({ 
            alive: true, 
            isActive: this.isActive,
            url: window.location.href
          });
          break;
      }
    });
  }

  async checkInitialState() {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'getGlobalEQState' 
      });
      
      if (response?.isActive) {
        console.log('🔄 GLOBAL EQ: Should be active, starting...');
        this.settings = response.settings || this.settings;
        await this.startGlobalEQ(this.settings);
      }
      
    } catch (error) {
      console.log('❓ GLOBAL EQ: Could not check initial state:', error);
    }
  }

  async startGlobalEQ(settings) {
    try {
      if (this.isActive) {
        console.log('🌐 GLOBAL EQ: Already active');
        return true;
      }
      
      console.log('🎛️ GLOBAL EQ: Starting audio interception...');
      console.log('🎛️ GLOBAL EQ: Settings:', settings);
      
      // Store settings
      this.settings = { ...this.settings, ...settings };
      
      // CRITICAL: Setup visualization system FIRST
      await this.setupVisualizationSystem();
      
      // Start Web Audio API interception
      this.startWebAudioInterception();
      
      // Start HTML5 media interception
      this.startMediaElementInterception();
      
      this.isActive = true;
      
      // Notify background
      chrome.runtime.sendMessage({
        action: 'globalEQStartedOnTab',
        url: window.location.href,
        settings: this.settings
      });
      
      console.log('✅ GLOBAL EQ: Audio interception active!');
      console.log('🎨 GLOBAL EQ: Visualizer ready:', !!this.visualizerAnalyser);
      
      return true;
      
    } catch (error) {
      console.error('❌ GLOBAL EQ: Failed to start:', error);
      return false;
    }
  }

  async setupVisualizationSystem() {
    try {
      console.log('🎨 GLOBAL EQ: Setting up visualization system...');
      
      // Create a dedicated audio context for visualization
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) {
        console.warn('⚠️ GLOBAL EQ: No AudioContext available for visualizer');
        return;
      }
      
      this.visualizerContext = new AudioContextConstructor();
      
      // Resume context if suspended
      if (this.visualizerContext.state === 'suspended') {
        await this.visualizerContext.resume();
      }
      
      // Create mixer node to combine all audio sources
      this.mixerNode = this.visualizerContext.createGain();
      this.mixerNode.gain.value = 1.0;
      
      // Create analyser for visualization
      this.visualizerAnalyser = this.visualizerContext.createAnalyser();
      this.visualizerAnalyser.fftSize = 2048;
      this.visualizerAnalyser.smoothingTimeConstant = 0.3;
      this.visualizerAnalyser.minDecibels = -90;
      this.visualizerAnalyser.maxDecibels = -10;
      
      // Connect mixer to analyser (don't connect to destination - we just want to analyze)
      this.mixerNode.connect(this.visualizerAnalyser);
      
      console.log('✅ GLOBAL EQ: Visualization system ready');
      console.log('🎨 GLOBAL EQ: Analyser FFT size:', this.visualizerAnalyser.fftSize);
      console.log('🎨 GLOBAL EQ: Analyser frequency bins:', this.visualizerAnalyser.frequencyBinCount);
      
    } catch (error) {
      console.error('❌ GLOBAL EQ: Failed to setup visualization system:', error);
    }
  }

  startWebAudioInterception() {
    if (this.originalAudioContext) {
      console.log('ℹ️ GLOBAL EQ: Web Audio already intercepted');
      return;
    }
    
    console.log('🎚️ GLOBAL EQ: Starting Web Audio API interception...');
    
    // Store original constructors
    this.originalAudioContext = window.AudioContext;
    this.originalWebkitAudioContext = window.webkitAudioContext;
    
    if (!this.originalAudioContext && !this.originalWebkitAudioContext) {
      console.log('⚠️ GLOBAL EQ: No AudioContext available to intercept');
      return;
    }
    
    const self = this;
    
    // Create intercepting AudioContext
    function InterceptedAudioContext(...args) {
      console.log('🎚️ GLOBAL EQ: Creating intercepted AudioContext');
      
      // Create real context using original constructor
      const OriginalConstructor = self.originalAudioContext || self.originalWebkitAudioContext;
      const realContext = new OriginalConstructor(...args);
      
      // Store original destination
      const originalDestination = realContext.destination;
      
      try {
        // Create EQ chain
        const eqChain = self.createEQChain(realContext);
        console.log('🎛️ GLOBAL EQ: Created EQ chain with', eqChain.filters.length, 'filters');
        
        // Create a new destination that routes through EQ
        const eqDestination = realContext.createGain();
        
        // Connect EQ: eqDestination -> EQ -> originalDestination
        eqDestination.connect(eqChain.input);
        eqChain.output.connect(originalDestination);
        
        // VISUALIZER: Connect to visualization system
        self.connectToVisualizationSystem(eqChain.output, realContext);
        
        // Replace the destination property
        Object.defineProperty(realContext, 'destination', {
          get: () => eqDestination,
          configurable: true,
          enumerable: true
        });
        
        // Store references for cleanup and updates
        realContext._originalDestination = originalDestination;
        realContext._eqChain = eqChain;
        realContext._eqDestination = eqDestination;
        realContext._isIntercepted = true;
        
        self.interceptedContexts.add(realContext);
        
        console.log('✅ GLOBAL EQ: AudioContext intercepted successfully');
        
      } catch (error) {
        console.error('❌ GLOBAL EQ: Failed to create EQ chain:', error);
        realContext._isIntercepted = false;
      }
      
      return realContext;
    }
    
    // Copy prototype and static properties
    if (this.originalAudioContext) {
      InterceptedAudioContext.prototype = this.originalAudioContext.prototype;
      Object.setPrototypeOf(InterceptedAudioContext, this.originalAudioContext);
    }
    
    // Replace global constructors
    window.AudioContext = InterceptedAudioContext;
    if (window.webkitAudioContext) {
      window.webkitAudioContext = InterceptedAudioContext;
    }
    
    console.log('✅ GLOBAL EQ: Web Audio API interception installed');
  }

  startMediaElementInterception() {
    if (this.originalCreateElement) {
      console.log('ℹ️ GLOBAL EQ: Media elements already intercepted');
      return;
    }
    
    console.log('🎵 GLOBAL EQ: Starting HTML5 media interception...');
    
    // Store original createElement
    this.originalCreateElement = document.createElement.bind(document);
    
    const self = this;
    
    // Override createElement
    document.createElement = function(tagName, options) {
      const element = self.originalCreateElement.call(this, tagName, options);
      
      if (tagName.toLowerCase() === 'audio' || tagName.toLowerCase() === 'video') {
        console.log('🎵 GLOBAL EQ: Intercepted', tagName, 'element creation');
        setTimeout(() => self.processMediaElement(element), 100);
      }
      
      return element;
    };
    
    // Process existing elements
    const existingElements = document.querySelectorAll('audio, video');
    console.log('🔍 GLOBAL EQ: Found', existingElements.length, 'existing media elements');
    existingElements.forEach(el => this.processMediaElement(el));
    
    // Setup mutation observer for dynamically added elements
    this.setupMutationObserver();
    
    console.log('✅ GLOBAL EQ: HTML5 media interception installed');
  }

  processMediaElement(element) {
    if (element._globalEQProcessed) return;
    
    console.log('🎵 GLOBAL EQ: Processing media element:', element.tagName, element.src || 'no src');
    
    element._globalEQProcessed = true;
    this.interceptedElements.add(element);
    
    const setupEQ = () => {
      try {
        if (element._globalAudioContext) return; // Already processed
        
        console.log('🎛️ GLOBAL EQ: Setting up EQ for media element');
        
        // Create audio context (use original constructor)
        const OriginalConstructor = this.originalAudioContext || window.AudioContext;
        const audioContext = new OriginalConstructor();
        
        // Create media element source
        const source = audioContext.createMediaElementSource(element);
        
        // Create EQ chain
        const eqChain = this.createEQChain(audioContext);
        
        // Connect: source -> EQ -> destination
        source.connect(eqChain.input);
        eqChain.output.connect(audioContext.destination);
        
        // VISUALIZER: Connect to visualization system
        this.connectToVisualizationSystem(eqChain.output, audioContext);
        
        // Store references
        element._globalAudioContext = audioContext;
        element._globalEQChain = eqChain;
        element._globalSource = source;
        
        console.log('✅ GLOBAL EQ: Media element EQ setup complete');
        
      } catch (error) {
        console.error('❌ GLOBAL EQ: Failed to setup media element EQ:', error);
      }
    };
    
    // Setup when element is ready
    if (element.readyState >= 2) {
      setupEQ();
    } else {
      element.addEventListener('loadedmetadata', setupEQ, { once: true });
      element.addEventListener('canplay', setupEQ, { once: true });
    }
  }

  connectToVisualizationSystem(audioNode, sourceContext) {
    if (!this.visualizerContext || !this.mixerNode) {
      console.warn('⚠️ GLOBAL EQ: Visualization system not ready');
      return;
    }
    
    try {
      console.log('🎨 GLOBAL EQ: Connecting audio to visualization system...');
      
      // Create media stream destination in the source context
      const streamDestination = sourceContext.createMediaStreamDestination();
      audioNode.connect(streamDestination);
      
      // Create source in visualizer context from the stream
      const visualizerSource = this.visualizerContext.createMediaStreamSource(streamDestination.stream);
      visualizerSource.connect(this.mixerNode);
      
      // Track the connection
      this.connectedSources.add(visualizerSource);
      
      console.log('✅ GLOBAL EQ: Connected to visualization system');
      console.log('🎨 GLOBAL EQ: Total connected sources:', this.connectedSources.size);
      
    } catch (error) {
      console.error('❌ GLOBAL EQ: Failed to connect to visualization system:', error);
    }
  }

  setupMutationObserver() {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
              this.processMediaElement(node);
            }
            
            // Check subtree
            const mediaElements = node.querySelectorAll && node.querySelectorAll('audio, video');
            if (mediaElements) {
              mediaElements.forEach(el => this.processMediaElement(el));
            }
          }
        });
      });
    });
    
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  createEQChain(audioContext) {
    console.log('🔧 GLOBAL EQ: Creating EQ chain...');
    
    const chain = {
      input: audioContext.createGain(),
      filters: [],
      output: audioContext.createGain()
    };
    
    // 8-band EQ configuration
    const bands = [
      { type: 'lowshelf', frequency: 60, gain: this.settings.eqBands[0] || 0 },
      { type: 'peaking', frequency: 170, Q: 1, gain: this.settings.eqBands[1] || 0 },
      { type: 'peaking', frequency: 310, Q: 1, gain: this.settings.eqBands[2] || 0 },
      { type: 'peaking', frequency: 600, Q: 1, gain: this.settings.eqBands[3] || 0 },
      { type: 'peaking', frequency: 1000, Q: 1, gain: this.settings.eqBands[4] || 0 },
      { type: 'peaking', frequency: 3000, Q: 1, gain: this.settings.eqBands[5] || 0 },
      { type: 'peaking', frequency: 6000, Q: 1, gain: this.settings.eqBands[6] || 0 },
      { type: 'highshelf', frequency: 8000, gain: this.settings.eqBands[7] || 0 }
    ];
    
    let previousNode = chain.input;
    
    bands.forEach((band, index) => {
      const filter = audioContext.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = this.settings.eqEnabled ? band.gain : 0;
      
      if (band.Q) filter.Q.value = band.Q;
      
      previousNode.connect(filter);
      previousNode = filter;
      
      chain.filters.push(filter);
      
      console.log(`🎛️ GLOBAL EQ: Created ${band.type} filter at ${band.frequency}Hz with ${band.gain}dB gain`);
    });
    
    previousNode.connect(chain.output);
    
    console.log('✅ GLOBAL EQ: EQ chain created with', chain.filters.length, 'filters');
    return chain;
  }

  // FIXED: Get real visualizer data
  getVisualizerData() {
    if (!this.visualizerAnalyser) {
      console.log('🎨 GLOBAL EQ: No visualizer analyser available');
      return null;
    }
    
    try {
      const bufferLength = this.visualizerAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.visualizerAnalyser.getByteFrequencyData(dataArray);
      
      // Check if we have any actual audio data
      const hasData = Array.from(dataArray).some(value => value > 0);
      
      console.log('🎨 GLOBAL EQ: Visualizer data - Buffer length:', bufferLength, 'Has data:', hasData);
      if (hasData) {
        console.log('🎨 GLOBAL EQ: Sample data:', Array.from(dataArray.slice(0, 10)));
      }
      
      return {
        frequencyData: Array.from(dataArray),
        bufferLength: bufferLength,
        sampleRate: this.visualizerContext.sampleRate,
        connectedSources: this.connectedSources.size,
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error('❌ GLOBAL EQ: Error getting visualizer data:', error);
      return null;
    }
  }

  updateGlobalEQSettings(settings) {
    try {
      console.log('⚙️ GLOBAL EQ: Updating settings:', settings);
      
      this.settings = { ...this.settings, ...settings };
      
      // Update Web Audio contexts
      let updatedContexts = 0;
      this.interceptedContexts.forEach(context => {
        if (context._eqChain) {
          this.updateEQChain(context._eqChain);
          updatedContexts++;
        }
      });
      
      // Update media elements
      let updatedElements = 0;
      this.interceptedElements.forEach(element => {
        if (element._globalEQChain) {
          this.updateEQChain(element._globalEQChain);
          updatedElements++;
        }
      });
      
      console.log(`⚙️ GLOBAL EQ: Updated ${updatedContexts} contexts and ${updatedElements} elements`);
      
    } catch (error) {
      console.error('❌ GLOBAL EQ: Error updating settings:', error);
    }
  }

  updateEQChain(eqChain) {
    eqChain.filters.forEach((filter, index) => {
      if (filter && this.settings.eqBands[index] !== undefined) {
        const newGain = this.settings.eqEnabled ? this.settings.eqBands[index] : 0;
        filter.gain.value = newGain;
        console.log(`🎛️ GLOBAL EQ: Updated filter ${index} to ${newGain}dB`);
      }
    });
  }

  async stopGlobalEQ() {
    try {
      if (!this.isActive) return true;
      
      console.log('🛑 GLOBAL EQ: Stopping audio interception...');
      
      // Stop Web Audio interception
      this.stopWebAudioInterception();
      
      // Stop media element interception
      this.stopMediaElementInterception();
      
      // Clean up visualization system
      this.cleanupVisualizationSystem();
      
      this.isActive = false;
      
      // Notify background
      chrome.runtime.sendMessage({
        action: 'globalEQStoppedOnTab',
        url: window.location.href
      });
      
      console.log('✅ GLOBAL EQ: Stopped');
      return true;
      
    } catch (error) {
      console.error('❌ GLOBAL EQ: Error stopping:', error);
      return false;
    }
  }

  cleanupVisualizationSystem() {
    console.log('🎨 GLOBAL EQ: Cleaning up visualization system...');
    
    // Disconnect all sources
    this.connectedSources.forEach(source => {
      try {
        source.disconnect();
      } catch (error) {
        // Ignore disconnect errors
      }
    });
    this.connectedSources.clear();
    
    // Clean up analyser and mixer
    if (this.visualizerAnalyser) {
      try {
        this.visualizerAnalyser.disconnect();
      } catch (error) {
        // Ignore disconnect errors
      }
      this.visualizerAnalyser = null;
    }
    
    if (this.mixerNode) {
      try {
        this.mixerNode.disconnect();
      } catch (error) {
        // Ignore disconnect errors
      }
      this.mixerNode = null;
    }
    
    // Close visualizer context
    if (this.visualizerContext) {
      try {
        this.visualizerContext.close();
      } catch (error) {
        // Ignore close errors
      }
      this.visualizerContext = null;
    }
    
    console.log('✅ GLOBAL EQ: Visualization system cleaned up');
  }

  stopWebAudioInterception() {
    // Restore original constructors
    if (this.originalAudioContext) {
      window.AudioContext = this.originalAudioContext;
      this.originalAudioContext = null;
    }
    if (this.originalWebkitAudioContext) {
      window.webkitAudioContext = this.originalWebkitAudioContext;
      this.originalWebkitAudioContext = null;
    }
    
    // Restore contexts
    this.interceptedContexts.forEach(context => {
      if (context._originalDestination && context._eqChain) {
        try {
          context._eqChain.output.disconnect();
          
          Object.defineProperty(context, 'destination', {
            value: context._originalDestination,
            configurable: true,
            enumerable: true
          });
        } catch (error) {
          console.error('❌ GLOBAL EQ: Error restoring context:', error);
        }
      }
    });
    
    this.interceptedContexts.clear();
    console.log('🛑 GLOBAL EQ: Web Audio interception stopped');
  }

  stopMediaElementInterception() {
    // Restore createElement
    if (this.originalCreateElement) {
      document.createElement = this.originalCreateElement;
      this.originalCreateElement = null;
    }
    
    // Disconnect observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    
    // Clean up elements
    this.interceptedElements.forEach(element => {
      if (element._globalAudioContext) {
        element._globalAudioContext.close();
      }
      element._globalEQProcessed = false;
    });
    
    this.interceptedElements.clear();
    console.log('🛑 GLOBAL EQ: Media element interception stopped');
  }

  startKeepAlive() {
    this.keepAliveTimer = setInterval(() => {
      if (this.isActive) {
        try {
          chrome.runtime.sendMessage({
            action: 'keepAliveGlobalEQ',
            url: window.location.href
          });
        } catch (error) {
          console.log('📡 GLOBAL EQ: Keep-alive failed:', error);
        }
      }
    }, 25000);
  }

  cleanup() {
    console.log('🧹 GLOBAL EQ: Cleaning up...');
    
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    
    if (this.isActive) {
      this.stopGlobalEQ();
    }
  }
}

// Initialize when ready
let globalEQProcessor = null;

// Start immediately if document is already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGlobalEQ);
} else {
  initGlobalEQ();
}

async function initGlobalEQ() {
  // Skip on browser pages
  if (window.location.protocol === 'chrome:' || 
      window.location.protocol === 'chrome-extension:' ||
      window.location.protocol === 'moz-extension:') {
    console.log('⏭️ GLOBAL EQ: Skipping browser page');
    return;
  }
  
  try {
    console.log('🚀 GLOBAL EQ: Initializing on', window.location.href);
    
    globalEQProcessor = new GlobalAudioEQProcessor();
    await globalEQProcessor.initialize();
    
    console.log('✅ GLOBAL EQ: Ready for audio processing!');
    
  } catch (error) {
    console.error('❌ GLOBAL EQ: Initialization failed:', error);
  }
}

// Cleanup handlers
window.addEventListener('beforeunload', () => {
  if (globalEQProcessor) {
    globalEQProcessor.cleanup();
  }
});

document.addEventListener('visibilitychange', () => {
  if (globalEQProcessor && !document.hidden) {
    try {
      chrome.runtime.sendMessage({
        action: 'keepAliveGlobalEQ',
        url: window.location.href
      });
    } catch (error) {
      // Extension might be reloading
    }
  }
});

console.log('🌍 GLOBAL EQ: Content script loaded and ready!');