// Streamlined Speech Recognizer
class SpeechRecognizer {
  constructor(audioProcessor) {
    this.recognition = null;
    this.audioProcessor = audioProcessor;
    this.isRecognizing = false;
    this.language = 'en-US';
    this.onResult = null;
    this.onError = null;
    this.hasUserInteraction = false;
  }

  init() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Speech recognition not supported in this browser');
    }

    this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    
    this.recognition.onresult = (event) => this.handleResult(event);
    this.recognition.onerror = (event) => this.handleError(event);
    this.recognition.onend = () => this.handleEnd();
  }

  async checkPermission() {
    try {
      // Try to get microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }

  async start(language = 'en-US') {
    this.hasUserInteraction = true;
    this.language = language;
    
    if (!this.recognition) {
      this.init();
    }
    
    if (this.isRecognizing) {
      console.warn('Speech recognition already active');
      return;
    }
    
    try {
      // Check permission first
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }
      
      this.recognition.lang = language;
      this.recognition.start();
      this.isRecognizing = true;
      
      console.log('🎤 Speech recognition started');
      
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      this.isRecognizing = false;
      if (this.onError) {
        this.onError({
          type: error.name === 'NotAllowedError' ? 'not-allowed' : 'unknown',
          message: error.message
        });
      }
      throw error;
    }
  }

  stop() {
    if (!this.isRecognizing) return;
    
    try {
      this.recognition.stop();
      this.isRecognizing = false;
      console.log('🎤 Speech recognition stopped');
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  }

  setLanguage(language) {
    this.language = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  handleResult(event) {
    if (!event.results || event.results.length === 0) return;
    
    const lastResult = event.results[event.results.length - 1];
    const transcript = lastResult[0].transcript;
    const isFinal = lastResult.isFinal;
    const confidence = lastResult[0].confidence;
    
    const result = {
      transcript,
      isFinal,
      confidence,
      source: this.audioProcessor?.isAPIIntercepting() ? 'api-intercepted-processed' : 'default-microphone'
    };
    
    if (this.onResult) {
      this.onResult(result);
    }
  }

  handleError(event) {
    console.error('Speech recognition error:', event.error);
    
    this.isRecognizing = false;
    
    const error = {
      type: event.error,
      message: this.getErrorMessage(event.error)
    };
    
    if (this.onError) {
      this.onError(error);
    }
  }

  handleEnd() {
    console.log('Speech recognition ended');
    this.isRecognizing = false;
    
    // Auto-restart if we have user interaction
    if (this.hasUserInteraction) {
      setTimeout(() => {
        if (!this.isRecognizing) {
          this.start(this.language).catch(console.error);
        }
      }, 1000);
    }
  }

  getErrorMessage(errorType) {
    const messages = {
      'no-speech': 'No speech detected. Please speak clearly.',
      'aborted': 'Speech recognition was aborted.',
      'audio-capture': 'Audio capture failed. Check your microphone.',
      'network': 'Network error. Check your internet connection.',
      'not-allowed': 'Microphone access denied. Please allow microphone permission.',
      'service-not-allowed': 'Speech recognition service not allowed.',
      'bad-grammar': 'Grammar error in speech recognition.',
      'language-not-supported': 'Language not supported.'
    };
    
    return messages[errorType] || `Speech recognition error: ${errorType}`;
  }
}

window.SpeechRecognizer = SpeechRecognizer;