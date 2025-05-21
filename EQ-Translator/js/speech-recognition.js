// Speech recognition module for EQ Translator

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
    this.hasAudioSource = false;
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

  // Set the audio stream to use for recognition
  setAudioSource(stream) {
    // Store reference that this is a valid audio source
    this.hasAudioSource = !!stream;
    return this.hasAudioSource;
  }

  // Start speech recognition
  async start() {
    if (!this.recognition) {
      this.initialize();
    }
    
    // Check if we have an audio source
    if (!this.hasAudioSource) {
      const error = {
        type: 'no-audio-source',
        message: 'No audio source available. Please start audio capture first.'
      };
      
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      return false;
    }
    
    if (!this.isRecognizing) {
      try {
        this.recognition.start();
        this.isRecognizing = true;
        console.log('Speech recognition started');
        return true;
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        
        // Handle specific error cases
        if (error.name === 'NotAllowedError') {
          const customError = {
            type: 'not-allowed',
            message: 'Speech recognition not allowed. This may be due to browser restrictions.'
          };
          
          if (this.onErrorCallback) {
            this.onErrorCallback(customError);
          }
        } else {
          throw error;
        }
        
        return false;
      }
    }
    
    return false;
  }

  // Stop speech recognition
  stop() {
    if (this.recognition && this.isRecognizing) {
      try {
        this.recognition.stop();
        this.isRecognizing = false;
        console.log('Speech recognition stopped');
        return true;
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
        throw error;
      }
    }
    
    return false;
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
      alternatives: []
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
      message: this._getErrorMessage(event.error)
    };
    
    // Call the error callback
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
    
    // Reset recognition state
    this.isRecognizing = false;
  }

  // Handle recognition end
  _handleEnd() {
    console.log('Speech recognition ended');
    this.isRecognizing = false;
    
    // Restart recognition if continuous mode is enabled
    if (this.continuousMode) {
      this.start();
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
        return 'Audio capture failed. Please check your audio source.';
      case 'network':
        return 'Network error occurred';
      case 'not-allowed':
        return 'Speech recognition not allowed. This may be due to browser restrictions.';
      case 'service-not-allowed':
        return 'Speech recognition service not allowed';
      case 'bad-grammar':
        return 'Grammar error in speech recognition';
      case 'language-not-supported':
        return 'Language not supported';
      case 'no-audio-source':
        return 'No audio source available. Please start audio capture first.';
      default:
        return `Unknown error: ${errorType}`;
    }
  }
}

// Export the SpeechRecognizer class
window.SpeechRecognizer = SpeechRecognizer;