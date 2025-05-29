// Enhanced Speech recognition module with virtual microphone support

class SpeechRecognizer {
  constructor() {
    this.recognition = null;
    this.isRecognizing = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.sourceLang = 'en-US';
    this.interimResults = true;
    this.continuousMode = true;
    this.maxAlternatives = 1;
    
    // New properties for virtual microphone support
    this.useVirtualMicrophone = false;
    this.virtualMicStream = null;
    this.audioProcessor = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isUsingVirtualMic = false;
  }

  // Initialize speech recognition with the specified language
  initialize(options = {}) {
    // Check if Speech Recognition is supported
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Speech recognition not supported in this browser');
    }

    // Create SpeechRecognition instance
    this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    
    // Configure recognition settings
    this.sourceLang = options.sourceLang || this.sourceLang;
    this.interimResults = options.interimResults !== undefined ? options.interimResults : this.interimResults;
    this.continuousMode = options.continuousMode !== undefined ? options.continuousMode : this.continuousMode;
    this.maxAlternatives = options.maxAlternatives || this.maxAlternatives;
    
    // Apply settings
    this.recognition.lang = this.sourceLang;
    this.recognition.interimResults = this.interimResults;
    this.recognition.continuous = this.continuousMode;
    this.recognition.maxAlternatives = this.maxAlternatives;
    
    // Set up event handlers
    this.recognition.onresult = (event) => this._handleResult(event);
    this.recognition.onerror = (event) => this._handleError(event);
    this.recognition.onend = () => this._handleEnd();
    
    return this.recognition;
  }

  // Set the audio processor instance to get the virtual microphone stream
  setAudioProcessor(audioProcessor) {
    this.audioProcessor = audioProcessor;
    return this;
  }

  // Enable or disable virtual microphone usage
  setVirtualMicrophoneEnabled(enabled) {
    this.useVirtualMicrophone = enabled;
    
    if (enabled && this.audioProcessor) {
      this.virtualMicStream = this.audioProcessor.getVirtualMicrophoneStream();
      console.log('Virtual microphone enabled for speech recognition');
    } else {
      this.virtualMicStream = null;
      console.log('Virtual microphone disabled - using default microphone');
    }
    
    return this;
  }

  // Start speech recognition
  async start() {
    if (!this.recognition) {
      this.initialize();
    }
    
    if (this.isRecognizing) {
      console.warn('Speech recognition already active');
      return false;
    }
    
    try {
      // Check if we should use virtual microphone
      if (this.useVirtualMicrophone && this.virtualMicStream) {
        await this._startWithVirtualMicrophone();
      } else {
        await this._startWithDefaultMicrophone();
      }
      
      this.isRecognizing = true;
      console.log('Speech recognition started');
      
      return true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      throw error;
    }
  }

  // Stop speech recognition
  stop() {
    if (!this.isRecognizing) {
      return false;
    }
    
    try {
      if (this.isUsingVirtualMic) {
        this._stopVirtualMicrophoneRecognition();
      } else {
        this.recognition.stop();
      }
      
      this.isRecognizing = false;
      console.log('Speech recognition stopped');
      
      return true;
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
      throw error;
    }
  }

  // Set callback for recognition results
  onResult(callback) {
    this.onResultCallback = callback;
  }

  // Set callback for recognition errors
  onError(callback) {
    this.onErrorCallback = callback;
  }

  // Change the recognition language
  setLanguage(languageCode) {
    this.sourceLang = languageCode;
    
    if (this.recognition) {
      // Update the language setting
      this.recognition.lang = languageCode;
      
      // Restart recognition if it was active
      if (this.isRecognizing) {
        this.stop();
        this.start();
      }
    }
  }

  // Configure recognition options
  configure(options) {
    let needsRestart = false;
    
    // Update configuration options
    if (options.sourceLang !== undefined && options.sourceLang !== this.sourceLang) {
      this.sourceLang = options.sourceLang;
      needsRestart = true;
    }
    
    if (options.interimResults !== undefined && options.interimResults !== this.interimResults) {
      this.interimResults = options.interimResults;
      needsRestart = true;
    }
    
    if (options.continuousMode !== undefined && options.continuousMode !== this.continuousMode) {
      this.continuousMode = options.continuousMode;
      needsRestart = true;
    }
    
    if (options.maxAlternatives !== undefined && options.maxAlternatives !== this.maxAlternatives) {
      this.maxAlternatives = options.maxAlternatives;
      needsRestart = true;
    }
    
    if (options.useVirtualMicrophone !== undefined) {
      this.setVirtualMicrophoneEnabled(options.useVirtualMicrophone);
      needsRestart = true;
    }
    
    // Apply settings if recognition is initialized
    if (this.recognition) {
      this.recognition.lang = this.sourceLang;
      this.recognition.interimResults = this.interimResults;
      this.recognition.continuous = this.continuousMode;
      this.recognition.maxAlternatives = this.maxAlternatives;
      
      // Restart if needed
      if (needsRestart && this.isRecognizing) {
        this.stop();
        this.start();
      }
    }
  }

  // Get current configuration
  getConfiguration() {
    return {
      sourceLang: this.sourceLang,
      interimResults: this.interimResults,
      continuousMode: this.continuousMode,
      maxAlternatives: this.maxAlternatives,
      useVirtualMicrophone: this.useVirtualMicrophone,
      isUsingVirtualMic: this.isUsingVirtualMic
    };
  }

  // Private methods

  // Start recognition with default microphone
  async _startWithDefaultMicrophone() {
    this.isUsingVirtualMic = false;
    this.recognition.start();
  }

  // Start recognition with virtual microphone
  async _startWithVirtualMicrophone() {
    if (!this.virtualMicStream) {
      throw new Error('Virtual microphone stream not available');
    }
    
    this.isUsingVirtualMic = true;
    
    // Note: The Web Speech API doesn't directly support custom audio streams
    // We need to use a workaround with MediaRecorder and speech recognition
    
    try {
      // Create MediaRecorder to capture the virtual microphone stream
      this.mediaRecorder = new MediaRecorder(this.virtualMicStream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      this.audioChunks = [];
      
      // Handle data from MediaRecorder
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          
          // Process audio chunks for speech recognition
          this._processAudioChunk(event.data);
        }
      };
      
      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        this._handleError({ error: 'media-recorder-error', message: event.error.message });
      };
      
      // Start recording with small timeslices for real-time processing
      this.mediaRecorder.start(100); // 100ms chunks
      
      console.log('Virtual microphone recording started');
      
    } catch (error) {
      console.error('Error starting virtual microphone recognition:', error);
      throw error;
    }
  }

  // Stop virtual microphone recognition
  _stopVirtualMicrophoneRecognition() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    
    this.isUsingVirtualMic = false;
    this.audioChunks = [];
  }

  // Process audio chunks from virtual microphone
  // Note: This is a simplified approach - in practice, you might need
  // more sophisticated audio processing or use the Web Speech API's
  // standard microphone input with virtual audio cable software
  async _processAudioChunk(audioBlob) {
    try {
      // Convert blob to audio buffer for analysis
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // This is where you could implement custom speech recognition
      // or send the audio to a speech recognition service
      
      // For now, we'll simulate recognition results
      if (this.audioChunks.length % 10 === 0) { // Every ~1 second
        this._simulateRecognitionResult();
      }
      
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }

  // Simulate recognition results for virtual microphone
  // In a real implementation, you'd send the audio to a speech recognition service
  _simulateRecognitionResult() {
    if (!this.audioProcessor) return;
    
    // Get current audio metrics to determine if there's speech
    const metrics = this.audioProcessor.getAudioMetrics();
    
    if (metrics && metrics.volume > 0.1) { // If there's significant audio
      const result = {
        transcript: '[Processed Audio from Virtual Microphone]',
        isFinal: false,
        confidence: 0.8,
        alternatives: []
      };
      
      if (this.onResultCallback) {
        this.onResultCallback(result);
      }
    }
  }

  // Handle recognition results
  _handleResult(event) {
    if (!event.results || event.results.length === 0) {
      return;
    }
    
    // Get the latest result
    const lastResult = event.results[event.results.length - 1];
    
    // Get the transcript
    const transcript = lastResult[0].transcript;
    
    // Check if this is a final result
    const isFinal = lastResult.isFinal;
    
    // Get confidence score
    const confidence = lastResult[0].confidence;
    
    // Create result object
    const result = {
      transcript,
      isFinal,
      confidence,
      alternatives: [],
      source: this.isUsingVirtualMic ? 'virtual-microphone' : 'default-microphone'
    };
    
    // Add alternatives if available
    if (lastResult.length > 1) {
      for (let i = 1; i < lastResult.length; i++) {
        result.alternatives.push({
          transcript: lastResult[i].transcript,
          confidence: lastResult[i].confidence
        });
      }
    }
    
    // Call the result callback
    if (this.onResultCallback) {
      this.onResultCallback(result);
    }
  }

  // Handle recognition errors
  _handleError(event) {
    console.error('Speech recognition error:', event.error);
    
    const error = {
      type: event.error,
      message: this._getErrorMessage(event.error),
      source: this.isUsingVirtualMic ? 'virtual-microphone' : 'default-microphone'
    };
    
    // Call the error callback
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
    
    // Reset recognition state
    this.isRecognizing = false;
    this.isUsingVirtualMic = false;
  }

  // Handle recognition end
  _handleEnd() {
    console.log('Speech recognition ended');
    
    // Reset recognizing state
    this.isRecognizing = false;
    this.isUsingVirtualMic = false;
    
    // Restart recognition if continuous mode is enabled
    if (this.continuousMode) {
      setTimeout(() => {
        this.start();
      }, 100);
    }
  }

  // Get readable error message
  _getErrorMessage(errorType) {
    switch (errorType) {
      case 'no-speech':
        return 'No speech was detected';
      case 'aborted':
        return 'Speech recognition was aborted';
      case 'audio-capture':
        return 'Audio capture failed';
      case 'network':
        return 'Network error occurred';
      case 'not-allowed':
        return 'Speech recognition not allowed';
      case 'service-not-allowed':
        return 'Speech recognition service not allowed';
      case 'bad-grammar':
        return 'Grammar error in speech recognition';
      case 'language-not-supported':
        return 'Language not supported';
      case 'media-recorder-error':
        return 'Media recorder error occurred';
      default:
        return `Unknown error: ${errorType}`;
    }
  }
}

// Export the SpeechRecognizer class
window.SpeechRecognizer = SpeechRecognizer;