// EQ-Translator/js/global-eq-strategies.js
// Three proven approaches for global browser-wide EQ

/**
 * APPROACH 1: Web Audio API Monkey Patching (Most Comprehensive)
 * This intercepts ALL Web Audio usage by replacing AudioContext constructor
 * Works for: YouTube, Spotify Web, games, Web Audio apps
 * Limitation: Doesn't catch HTML5 audio/video elements directly
 */

class WebAudioInterceptor {
  constructor() {
    this.originalAudioContext = null;
    this.originalWebKitAudioContext = null;
    this.interceptedContexts = new Set();
    this.isActive = false;
    this.eqSettings = { enabled: true, bands: [0,0,0,0,0,0,0,0] };
  }

  start() {
    if (this.isActive) return;
    
    console.log('🌍 Starting Web Audio API interception...');
    
    // Store original constructors
    this.originalAudioContext = window.AudioContext;
    this.originalWebKitAudioContext = window.webkitAudioContext;
    
    const self = this;
    
    // Create intercepting AudioContext
    function InterceptedAudioContext(...args) {
      // Create real context
      const realContext = new self.originalAudioContext(...args);
      console.log('🎚️ Intercepted AudioContext creation');
      
      // Store original destination
      const realDestination = realContext.destination;
      
      // Create EQ chain
      const eqChain = self.createEQChain(realContext);
      
      // Replace destination property to route through EQ
      Object.defineProperty(realContext, 'destination', {
        get: () => eqChain.input,
        configurable: true
      });
      
      // Connect EQ output to real destination
      eqChain.output.connect(realDestination);
      
      // Store references for cleanup and updates
      realContext._realDestination = realDestination;
      realContext._eqChain = eqChain;
      realContext._isIntercepted = true;
      
      self.interceptedContexts.add(realContext);
      
      return realContext;
    }
    
    // Copy prototype and static properties
    InterceptedAudioContext.prototype = this.originalAudioContext.prototype;
    Object.setPrototypeOf(InterceptedAudioContext, this.originalAudioContext);
    
    // Replace global constructors
    window.AudioContext = InterceptedAudioContext;
    if (window.webkitAudioContext) {
      window.webkitAudioContext = InterceptedAudioContext;
    }
    
    this.isActive = true;
    console.log('✅ Web Audio API interception active');
  }

  createEQChain(audioContext) {
    const chain = {
      input: audioContext.createGain(),
      filters: [],
      output: audioContext.createGain()
    };
    
    // 8-band EQ configuration
    const bands = [
      { type: 'lowshelf', frequency: 60, gain: this.eqSettings.bands[0] },
      { type: 'peaking', frequency: 170, Q: 1, gain: this.eqSettings.bands[1] },
      { type: 'peaking', frequency: 310, Q: 1, gain: this.eqSettings.bands[2] },
      { type: 'peaking', frequency: 600, Q: 1, gain: this.eqSettings.bands[3] },
      { type: 'peaking', frequency: 1000, Q: 1, gain: this.eqSettings.bands[4] },
      { type: 'peaking', frequency: 3000, Q: 1, gain: this.eqSettings.bands[5] },
      { type: 'peaking', frequency: 6000, Q: 1, gain: this.eqSettings.bands[6] },
      { type: 'highshelf', frequency: 8000, gain: this.eqSettings.bands[7] }
    ];
    
    let previousNode = chain.input;
    
    bands.forEach((band, index) => {
      const filter = audioContext.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = this.eqSettings.enabled ? band.gain : 0;
      
      if (band.Q) filter.Q.value = band.Q;
      
      previousNode.connect(filter);
      previousNode = filter;
      
      chain.filters.push(filter);
    });
    
    previousNode.connect(chain.output);
    
    return chain;
  }

  updateSettings(newSettings) {
    this.eqSettings = { ...this.eqSettings, ...newSettings };
    
    // Update all active contexts
    this.interceptedContexts.forEach(context => {
      if (context._eqChain) {
        context._eqChain.filters.forEach((filter, index) => {
          if (filter && this.eqSettings.bands[index] !== undefined) {
            filter.gain.value = this.eqSettings.enabled ? this.eqSettings.bands[index] : 0;
          }
        });
      }
    });
    
    console.log('🎛️ Updated EQ settings on', this.interceptedContexts.size, 'contexts');
  }

  stop() {
    if (!this.isActive) return;
    
    // Restore original constructors
    if (this.originalAudioContext) {
      window.AudioContext = this.originalAudioContext;
    }
    if (this.originalWebKitAudioContext) {
      window.webkitAudioContext = this.originalWebKitAudioContext;
    }
    
    // Restore contexts
    this.interceptedContexts.forEach(context => {
      if (context._realDestination && context._eqChain) {
        // Disconnect EQ
        context._eqChain.output.disconnect();
        
        // Restore original destination
        Object.defineProperty(context, 'destination', {
          value: context._realDestination,
          configurable: true
        });
      }
    });
    
    this.interceptedContexts.clear();
    this.isActive = false;
    
    console.log('🛑 Web Audio API interception stopped');
  }
}

/**
 * APPROACH 2: HTML5 Media Element Monkey Patching
 * This intercepts HTML5 <audio> and <video> elements
 * Works for: HTML5 video/audio, some streaming sites
 */

class MediaElementInterceptor {
  constructor() {
    this.originalCreateElement = null;
    this.interceptedElements = new Set();
    this.isActive = false;
    this.eqSettings = { enabled: true, bands: [0,0,0,0,0,0,0,0] };
    this.observer = null;
  }

  start() {
    if (this.isActive) return;
    
    console.log('🎵 Starting HTML5 media interception...');
    
    // Store original createElement
    this.originalCreateElement = document.createElement.bind(document);
    
    const self = this;
    
    // Override createElement
    document.createElement = function(tagName, options) {
      const element = self.originalCreateElement.call(this, tagName, options);
      
      if (tagName.toLowerCase() === 'audio' || tagName.toLowerCase() === 'video') {
        console.log('🎵 Intercepted', tagName, 'element');
        self.processMediaElement(element);
      }
      
      return element;
    };
    
    // Process existing elements
    document.querySelectorAll('audio, video').forEach(el => this.processMediaElement(el));
    
    // Setup mutation observer for dynamically added elements
    this.setupMutationObserver();
    
    this.isActive = true;
    console.log('✅ HTML5 media interception active');
  }

  processMediaElement(element) {
    if (element._eqProcessed) return;
    
    element._eqProcessed = true;
    this.interceptedElements.add(element);
    
    const setupEQ = () => {
      try {
        if (element._audioContext) return; // Already processed
        
        const audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(element);
        const eqChain = this.createEQChain(audioContext);
        
        // Connect: source -> EQ -> destination
        source.connect(eqChain.input);
        eqChain.output.connect(audioContext.destination);
        
        // Store references
        element._audioContext = audioContext;
        element._eqChain = eqChain;
        element._source = source;
        
        console.log('🎛️ EQ applied to', element.tagName);
        
      } catch (error) {
        console.error('❌ Failed to apply EQ to media element:', error);
      }
    };
    
    // Setup when ready
    if (element.readyState >= 2) {
      setupEQ();
    } else {
      element.addEventListener('loadedmetadata', setupEQ, { once: true });
      element.addEventListener('canplay', setupEQ, { once: true });
    }
  }

  createEQChain(audioContext) {
    // Same EQ chain as WebAudioInterceptor
    const chain = {
      input: audioContext.createGain(),
      filters: [],
      output: audioContext.createGain()
    };
    
    const bands = [
      { type: 'lowshelf', frequency: 60, gain: this.eqSettings.bands[0] },
      { type: 'peaking', frequency: 170, Q: 1, gain: this.eqSettings.bands[1] },
      { type: 'peaking', frequency: 310, Q: 1, gain: this.eqSettings.bands[2] },
      { type: 'peaking', frequency: 600, Q: 1, gain: this.eqSettings.bands[3] },
      { type: 'peaking', frequency: 1000, Q: 1, gain: this.eqSettings.bands[4] },
      { type: 'peaking', frequency: 3000, Q: 1, gain: this.eqSettings.bands[5] },
      { type: 'peaking', frequency: 6000, Q: 1, gain: this.eqSettings.bands[6] },
      { type: 'highshelf', frequency: 8000, gain: this.eqSettings.bands[7] }
    ];
    
    let previousNode = chain.input;
    
    bands.forEach((band, index) => {
      const filter = audioContext.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = this.eqSettings.enabled ? band.gain : 0;
      if (band.Q) filter.Q.value = band.Q;
      
      previousNode.connect(filter);
      previousNode = filter;
      chain.filters.push(filter);
    });
    
    previousNode.connect(chain.output);
    return chain;
  }

  setupMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
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
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  updateSettings(newSettings) {
    this.eqSettings = { ...this.eqSettings, ...newSettings };
    
    this.interceptedElements.forEach(element => {
      if (element._eqChain) {
        element._eqChain.filters.forEach((filter, index) => {
          if (filter && this.eqSettings.bands[index] !== undefined) {
            filter.gain.value = this.eqSettings.enabled ? this.eqSettings.bands[index] : 0;
          }
        });
      }
    });
    
    console.log('🎵 Updated media element EQ settings');
  }

  stop() {
    if (!this.isActive) return;
    
    // Restore createElement
    if (this.originalCreateElement) {
      document.createElement = this.originalCreateElement;
    }
    
    // Disconnect observer
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Clean up elements
    this.interceptedElements.forEach(element => {
      if (element._audioContext) {
        element._audioContext.close();
      }
      element._eqProcessed = false;
    });
    
    this.interceptedElements.clear();
    this.isActive = false;
    
    console.log('🛑 HTML5 media interception stopped');
  }
}

/**
 * APPROACH 3: Multiple Tab Capture (Most Reliable)
 * This captures audio from all audible tabs simultaneously
 * Works for: Everything, most reliable approach
 * Limitation: Requires active management of tabs
 */

class MultiTabCaptureEQ {
  constructor() {
    this.capturedTabs = new Map(); // tabId -> { stream, processor, audioContext }
    this.isActive = false;
    this.eqSettings = { enabled: true, bands: [0,0,0,0,0,0,0,0] };
    this.tabCheckInterval = null;
  }

  async start() {
    if (this.isActive) return;
    
    console.log('🎯 Starting multi-tab capture EQ...');
    
    // Find all audible tabs
    const audibleTabs = await this.getAudibleTabs();
    console.log('🔊 Found', audibleTabs.length, 'audible tabs');
    
    // Capture each audible tab
    for (const tab of audibleTabs) {
      await this.captureTab(tab.id);
    }
    
    // Start monitoring for new audible tabs
    this.startTabMonitoring();
    
    this.isActive = true;
    console.log('✅ Multi-tab capture EQ active');
  }

  async getAudibleTabs() {
    return new Promise((resolve) => {
      chrome.tabs.query({ audible: true }, (tabs) => {
        resolve(tabs || []);
      });
    });
  }

  async captureTab(tabId) {
    try {
      console.log('🎯 Capturing tab:', tabId);
      
      // Get media stream ID
      const streamId = await new Promise((resolve, reject) => {
        chrome.tabCapture.getMediaStreamId(
          { consumerTabId: tabId },
          (id) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(id);
            }
          }
        );
      });
      
      // Capture the stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId
          }
        }
      });
      
      // Create audio processing
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const destination = audioContext.createMediaStreamDestination();
      
      // Create EQ chain
      const eqChain = this.createEQChain(audioContext);
      
      // Connect: source -> EQ -> destination
      source.connect(eqChain.input);
      eqChain.output.connect(destination);
      eqChain.output.connect(audioContext.destination); // Also play processed audio
      
      // Store capture info
      this.capturedTabs.set(tabId, {
        stream,
        audioContext,
        source,
        destination,
        eqChain,
        processedStream: destination.stream
      });
      
      console.log('✅ Tab', tabId, 'captured and EQ applied');
      
    } catch (error) {
      console.error('❌ Failed to capture tab', tabId, ':', error);
    }
  }

  createEQChain(audioContext) {
    // Same as other approaches
    const chain = {
      input: audioContext.createGain(),
      filters: [],
      output: audioContext.createGain()
    };
    
    const bands = [
      { type: 'lowshelf', frequency: 60, gain: this.eqSettings.bands[0] },
      { type: 'peaking', frequency: 170, Q: 1, gain: this.eqSettings.bands[1] },
      { type: 'peaking', frequency: 310, Q: 1, gain: this.eqSettings.bands[2] },
      { type: 'peaking', frequency: 600, Q: 1, gain: this.eqSettings.bands[3] },
      { type: 'peaking', frequency: 1000, Q: 1, gain: this.eqSettings.bands[4] },
      { type: 'peaking', frequency: 3000, Q: 1, gain: this.eqSettings.bands[5] },
      { type: 'peaking', frequency: 6000, Q: 1, gain: this.eqSettings.bands[6] },
      { type: 'highshelf', frequency: 8000, gain: this.eqSettings.bands[7] }
    ];
    
    let previousNode = chain.input;
    
    bands.forEach((band, index) => {
      const filter = audioContext.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = this.eqSettings.enabled ? band.gain : 0;
      if (band.Q) filter.Q.value = band.Q;
      
      previousNode.connect(filter);
      previousNode = filter;
      chain.filters.push(filter);
    });
    
    previousNode.connect(chain.output);
    return chain;
  }

  startTabMonitoring() {
    // Check for new audible tabs every 5 seconds
    this.tabCheckInterval = setInterval(async () => {
      const audibleTabs = await this.getAudibleTabs();
      
      for (const tab of audibleTabs) {
        if (!this.capturedTabs.has(tab.id)) {
          console.log('🆕 New audible tab detected:', tab.id);
          await this.captureTab(tab.id);
        }
      }
      
      // Remove tabs that are no longer audible
      for (const tabId of this.capturedTabs.keys()) {
        if (!audibleTabs.some(tab => tab.id === tabId)) {
          console.log('🔇 Tab no longer audible:', tabId);
          this.releaseTab(tabId);
        }
      }
    }, 5000);
  }

  releaseTab(tabId) {
    const capture = this.capturedTabs.get(tabId);
    if (capture) {
      capture.stream.getTracks().forEach(track => track.stop());
      capture.audioContext.close();
      this.capturedTabs.delete(tabId);
      console.log('🛑 Released tab:', tabId);
    }
  }

  updateSettings(newSettings) {
    this.eqSettings = { ...this.eqSettings, ...newSettings };
    
    this.capturedTabs.forEach((capture, tabId) => {
      if (capture.eqChain) {
        capture.eqChain.filters.forEach((filter, index) => {
          if (filter && this.eqSettings.bands[index] !== undefined) {
            filter.gain.value = this.eqSettings.enabled ? this.eqSettings.bands[index] : 0;
          }
        });
      }
    });
    
    console.log('🎯 Updated multi-tab EQ settings on', this.capturedTabs.size, 'tabs');
  }

  stop() {
    if (!this.isActive) return;
    
    // Stop monitoring
    if (this.tabCheckInterval) {
      clearInterval(this.tabCheckInterval);
    }
    
    // Release all captured tabs
    this.capturedTabs.forEach((capture, tabId) => {
      this.releaseTab(tabId);
    });
    
    this.isActive = false;
    console.log('🛑 Multi-tab capture EQ stopped');
  }
}

// Export all approaches
window.WebAudioInterceptor = WebAudioInterceptor;
window.MediaElementInterceptor = MediaElementInterceptor;
window.MultiTabCaptureEQ = MultiTabCaptureEQ;

// Combined Global EQ Manager
class GlobalEQManager {
  constructor() {
    this.webAudioInterceptor = new WebAudioInterceptor();
    this.mediaElementInterceptor = new MediaElementInterceptor();
    this.multiTabCapture = new MultiTabCaptureEQ();
    this.activeApproaches = new Set();
  }

  async start(approaches = ['webaudio', 'media']) {
    console.log('🌍 Starting Global EQ with approaches:', approaches);
    
    if (approaches.includes('webaudio')) {
      this.webAudioInterceptor.start();
      this.activeApproaches.add('webaudio');
    }
    
    if (approaches.includes('media')) {
      this.mediaElementInterceptor.start();
      this.activeApproaches.add('media');
    }
    
    if (approaches.includes('tabcapture')) {
      await this.multiTabCapture.start();
      this.activeApproaches.add('tabcapture');
    }
    
    console.log('✅ Global EQ started with', this.activeApproaches.size, 'approaches');
  }

  updateSettings(newSettings) {
    if (this.activeApproaches.has('webaudio')) {
      this.webAudioInterceptor.updateSettings(newSettings);
    }
    if (this.activeApproaches.has('media')) {
      this.mediaElementInterceptor.updateSettings(newSettings);
    }
    if (this.activeApproaches.has('tabcapture')) {
      this.multiTabCapture.updateSettings(newSettings);
    }
  }

  stop() {
    this.webAudioInterceptor.stop();
    this.mediaElementInterceptor.stop();
    this.multiTabCapture.stop();
    this.activeApproaches.clear();
    console.log('🛑 Global EQ stopped');
  }
}

window.GlobalEQManager = GlobalEQManager;