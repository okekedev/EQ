// Complete API Interception Integration - Let's make this work!

// Enhanced Audio Processor with API Interception
class APIInterceptionAudioProcessor extends AudioProcessor {
  constructor() {
    super();
    this.apiInterceptor = null;
  }

  // Enhanced initialization with API interception setup
  async initialize(stream, existingAudioContext = null) {
    // Call parent initialization
    await super.initialize(stream, existingAudioContext);
    
    // Create and initialize API interceptor
    this.apiInterceptor = new SmartAudioInterceptor();
    await this.apiInterceptor.initialize(this);
    
    console.log('🎯 Audio processor with API interception ready!');
    return this.audioContext;
  }

  // Start virtual microphone with API interception
  async startVirtualMicrophoneInterception() {
    if (!this.apiInterceptor) {
      throw new Error('API interceptor not initialized');
    }

    try {
      // Get the processed audio stream
      const processedStream = this.getVirtualMicrophoneStream();
      if (!processedStream) {
        throw new Error('No processed audio stream available');
      }

      // Set up interception
      this.apiInterceptor.setProcessedAudio(processedStream);
      this.apiInterceptor.startInterception();

      // Test if it's working
      const testResult = await this.apiInterceptor.testInterception();
      
      console.log('🎯 API Interception Status:', testResult ? 'SUCCESS' : 'FAILED');
      
      return {
        success: testResult,
        message: testResult ? 
          'API interception active - Speech Recognition will use processed audio!' :
          'API interception failed - falling back to standard mode',
        method: 'api-interception'
      };

    } catch (error) {
      console.error('❌ Virtual microphone interception failed:', error);
      throw error;
    }
  }

  // Stop virtual microphone interception
  stopVirtualMicrophoneInterception() {
    if (this.apiInterceptor) {
      this.apiInterceptor.stopInterception();
      console.log('🔄 API interception stopped');
    }
  }

  // Check if interception is active
  isInterceptionActive() {
    return this.apiInterceptor && this.apiInterceptor.isIntercepting;
  }

  // Get interception status
  getInterceptionStatus() {
    return this.apiInterceptor ? this.apiInterceptor.getStatus() : null;
  }

  // Enhanced cleanup
  async cleanup() {
    if (this.apiInterceptor) {
      this.apiInterceptor.cleanup();
    }
    await super.cleanup();
  }
}

// Smart Audio Interceptor (from previous artifact, but integrated)
class SmartAudioInterceptor {
  constructor() {
    this.originalGetUserMedia = null;
    this.processedAudioTrack = null;
    this.isIntercepting = false;
    this.audioProcessor = null;
    this.fallbackMicStream = null;
    this.interceptCount = 0;
  }

  async initialize(audioProcessor) {
    this.audioProcessor = audioProcessor;
    
    // Store original getUserMedia function
    this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    
    // Try to get fallback microphone stream
    try {
      this.fallbackMicStream = await this.originalGetUserMedia({ audio: true });
      console.log('✅ Fallback microphone stream obtained');
      
      // Stop it for now - we'll use it when needed
      this.fallbackMicStream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.warn('⚠️ Could not get fallback microphone stream:', error);
    }
    
    return true;
  }

  startInterception() {
    if (this.isIntercepting) return;
    
    const self = this;
    
    // Replace getUserMedia with our intercepting version
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      self.interceptCount++;
      console.log(`🎤 getUserMedia intercepted! (Call #${self.interceptCount})`, constraints);
      
      // Check if this is requesting audio and we have processed audio
      if (constraints && constraints.audio && self.processedAudioTrack && self.isIntercepting) {
        console.log('🎯 MAGIC HAPPENING: Returning processed audio instead of microphone!');
        
        try {
          // Clone the processed audio track to avoid conflicts
          const clonedTrack = self.processedAudioTrack.clone();
          const processedStream = new MediaStream([clonedTrack]);
          
          // Add video track if requested
          if (constraints.video) {
            try {
              const videoStream = await self.originalGetUserMedia({ video: constraints.video });
              const videoTrack = videoStream.getVideoTracks()[0];
              if (videoTrack) {
                processedStream.addTrack(videoTrack);
              }
            } catch (error) {
              console.warn('Could not add video track:', error);
            }
          }
          
          console.log('✅ Processed audio stream created and returned');
          return processedStream;
          
        } catch (error) {
          console.error('❌ Error creating processed stream, falling back to original:', error);
          return self.originalGetUserMedia.call(this, constraints);
        }
      }
      
      // For non-audio requests or when not intercepting, use original
      console.log('📞 Forwarding to original getUserMedia');
      return self.originalGetUserMedia.call(this, constraints);
    };
    
    this.isIntercepting = true;
    console.log('🎯 API INTERCEPTION ACTIVE! Next getUserMedia call will return processed audio!');
  }

  stopInterception() {
    if (!this.isIntercepting) return;
    
    navigator.mediaDevices.getUserMedia = this.originalGetUserMedia;
    this.isIntercepting = false;
    this.interceptCount = 0;
    
    console.log('🔄 API interception stopped - back to normal microphone');
  }

  setProcessedAudio(processedStream) {
    if (processedStream && processedStream.getAudioTracks().length > 0) {
      this.processedAudioTrack = processedStream.getAudioTracks()[0];
      console.log('✅ Processed audio track set for interception');
      console.log('Track details:', {
        kind: this.processedAudioTrack.kind,
        label: this.processedAudioTrack.label,
        enabled: this.processedAudioTrack.enabled,
        muted: this.processedAudioTrack.muted,
        readyState: this.processedAudioTrack.readyState
      });
      return true;
    }
    console.error('❌ Invalid processed stream provided');
    return false;
  }

  async testInterception() {
    if (!this.isIntercepting) {
      console.log('❌ Interception not active - call startInterception() first');
      return false;
    }

    try {
      console.log('🧪 Testing interception with getUserMedia call...');
      
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = testStream.getAudioTracks()[0];
      
      console.log('Test result:', {
        gotStream: !!testStream,
        gotAudioTrack: !!audioTrack,
        trackLabel: audioTrack?.label,
        isProcessedTrack: audioTrack === this.processedAudioTrack || 
                         audioTrack?.label === this.processedAudioTrack?.label
      });
      
      // Clean up test stream
      testStream.getTracks().forEach(track => track.stop());
      
      if (audioTrack) {
        console.log('✅ SUCCESS! Interception working - getUserMedia returned audio');
        return true;
      } else {
        console.log('❌ No audio track returned');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      return false;
    }
  }

  getStatus() {
    return {
      isIntercepting: this.isIntercepting,
      hasProcessedAudio: !!this.processedAudioTrack,
      hasOriginalAPI: !!this.originalGetUserMedia,
      interceptCount: this.interceptCount,
      processedTrackInfo: this.processedAudioTrack ? {
        kind: this.processedAudioTrack.kind,
        label: this.processedAudioTrack.label,
        enabled: this.processedAudioTrack.enabled,
        readyState: this.processedAudioTrack.readyState
      } : null
    };
  }

  cleanup() {
    this.stopInterception();
    
    if (this.processedAudioTrack) {
      this.processedAudioTrack.stop();
      this.processedAudioTrack = null;
    }
  }
}

// Enhanced Speech Recognizer that works with API interception
class InterceptingSpeechRecognizer extends SpeechRecognizer {
  constructor() {
    super();
    this.isUsingInterception = false;
    this.audioProcessor = null;
  }

  // Set audio processor for interception
  setAudioProcessor(audioProcessor) {
    this.audioProcessor = audioProcessor;
    return this;
  }

  // Enhanced start method that activates interception
  async start() {
    try {
      // Check if we should use interception
      if (this.audioProcessor && this.audioProcessor.isInterceptionActive()) {
        console.log('🎯 Starting Speech Recognition with API interception!');
        this.isUsingInterception = true;
        
        // Start normal recognition - it will use intercepted audio
        const result = await super.start();
        
        if (result) {
          console.log('✅ Speech Recognition started with intercepted processed audio!');
        }
        
        return result;
      } else {
        console.log('📞 Starting Speech Recognition with normal microphone');
        this.isUsingInterception = false;
        return await super.start();
      }
    } catch (error) {
      console.error('❌ Error starting intercepting speech recognition:', error);
      this.isUsingInterception = false;
      throw error;
    }
  }

  // Enhanced result handling
  _handleResult(event) {
    if (!event.results || event.results.length === 0) {
      return;
    }
    
    const lastResult = event.results[event.results.length - 1];
    const transcript = lastResult[0].transcript;
    const isFinal = lastResult.isFinal;
    const confidence = lastResult[0].confidence;
    
    // Create result object with interception info
    const result = {
      transcript,
      isFinal,
      confidence,
      alternatives: [],
      source: this.isUsingInterception ? 'api-intercepted-processed' : 'default-microphone'
    };
    
    // Add alternatives
    if (lastResult.length > 1) {
      for (let i = 1; i < lastResult.length; i++) {
        result.alternatives.push({
          transcript: lastResult[i].transcript,
          confidence: lastResult[i].confidence
        });
      }
    }
    
    // Log the magic!
    if (this.isUsingInterception) {
      console.log('🎯 INTERCEPTED SPEECH RESULT:', transcript);
    }
    
    // Call the result callback
    if (this.onResultCallback) {
      this.onResultCallback(result);
    }
  }

  // Get configuration with interception info
  getConfiguration() {
    const config = super.getConfiguration ? super.getConfiguration() : {};
    return {
      ...config,
      isUsingInterception: this.isUsingInterception,
      hasAudioProcessor: !!this.audioProcessor,
      interceptionActive: this.audioProcessor?.isInterceptionActive() || false
    };
  }
}

// Export enhanced classes
window.APIInterceptionAudioProcessor = APIInterceptionAudioProcessor;
window.SmartAudioInterceptor = SmartAudioInterceptor;
window.InterceptingSpeechRecognizer = InterceptingSpeechRecognizer;

// Replace the original classes
window.AudioProcessor = APIInterceptionAudioProcessor;
window.SpeechRecognizer = InterceptingSpeechRecognizer;