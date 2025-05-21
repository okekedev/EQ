// Speech synthesis module for EQ Translator

class SpeechSynthesizer {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voice = null;
    this.voices = [];
    this.pitch = 1.0;
    this.rate = 1.0;
    this.volume = 1.0;
    this.targetLang = 'es'; // Default target language
    this.utteranceQueue = [];
    this.isProcessingQueue = false;
    this.onStartCallback = null;
    this.onEndCallback = null;
    this.onErrorCallback = null;
    this.isInitialized = false;
  }

  // Initialize the speech synthesizer
  async initialize() {
    // Check if Speech Synthesis is supported
    if (!('speechSynthesis' in window)) {
      throw new Error('Speech synthesis not supported in this browser');
    }
    
    // Load saved settings
    const settings = await this.loadSettings();
    
    // Apply settings
    this.targetLang = settings.targetLang || this.targetLang;
    this.pitch = settings.pitch || this.pitch;
    this.rate = settings.rate || this.rate;
    this.volume = settings.volume || this.volume;
    
    // Get available voices
    await this.loadVoices();
    
    // Set voice based on target language
    this.setVoiceByLang(this.targetLang);
    
    this.isInitialized = true;
    
    return true;
  }

  // Load available voices
  async loadVoices() {
    return new Promise((resolve) => {
      // If voices are already available
      if (this.synth.getVoices().length > 0) {
        this.voices = this.synth.getVoices();
        resolve(this.voices);
        return;
      }
      
      // Wait for voices to be loaded
      const voicesChanged = () => {
        this.voices = this.synth.getVoices();
        resolve(this.voices);
      };
      
      // Add event listener for voices changed
      this.synth.addEventListener('voiceschanged', voicesChanged, { once: true });
      
      // Set a timeout in case the event doesn't fire
      setTimeout(() => {
        this.synth.removeEventListener('voiceschanged', voicesChanged);
        this.voices = this.synth.getVoices();
        resolve(this.voices);
      }, 1000);
    });
  }

  // Set voice by language code
  setVoiceByLang(languageCode) {
    // Ensure voices are loaded
    if (this.voices.length === 0) {
      this.loadVoices();
    }
    
    // Find a voice matching the language code
    const voice = this.voices.find(v => v.lang.startsWith(languageCode));
    
    if (voice) {
      this.voice = voice;
      return true;
    } else {
      // Fallback to the first voice if no match
      this.voice = this.voices[0];
      console.warn(`No voice found for language ${languageCode}, using default voice`);
      return false;
    }
  }

  // Speak the provided text
  speak(text, options = {}) {
    if (!this.isInitialized) {
      this.initialize().catch(console.error);
    }
    
    if (!text || text.trim() === '') {
      return false;
    }
    
    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set utterance properties
    utterance.voice = options.voice || this.voice;
    utterance.pitch = options.pitch !== undefined ? options.pitch : this.pitch;
    utterance.rate = options.rate !== undefined ? options.rate : this.rate;
    utterance.volume = options.volume !== undefined ? options.volume : this.volume;
    utterance.lang = options.lang || (this.voice ? this.voice.lang : this.targetLang);
    
    // Set event handlers
    utterance.onstart = (event) => {
      if (this.onStartCallback) {
        this.onStartCallback(event);
      }
    };
    
    utterance.onend = (event) => {
      if (this.onEndCallback) {
        this.onEndCallback(event);
      }
      
      // Process next utterance if any
      this.processQueue();
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      
      if (this.onErrorCallback) {
        this.onErrorCallback(event);
      }
      
      // Process next utterance if any
      this.processQueue();
    };
    
    // Add to queue
    this.utteranceQueue.push(utterance);
    
    // Process queue
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
    
    return true;
  }

  // Process the utterance queue
  processQueue() {
    if (this.utteranceQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }
    
    this.isProcessingQueue = true;
    
    // Get the next utterance
    const utterance = this.utteranceQueue.shift();
    
    // Speak the utterance
    this.synth.speak(utterance);
  }

  // Stop speaking
  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.utteranceQueue = [];
      this.isProcessingQueue = false;
    }
  }

  // Pause speaking
  pause() {
    if (this.synth) {
      this.synth.pause();
    }
  }

  // Resume speaking
  resume() {
    if (this.synth) {
      this.synth.resume();
    }
  }

  // Get available voices
  getVoices() {
    return this.voices;
  }

  // Set voice by index
  setVoice(voiceIndex) {
    if (voiceIndex >= 0 && voiceIndex < this.voices.length) {
      this.voice = this.voices[voiceIndex];
      return true;
    }
    return false;
  }

  // Set speaking rate (0.1 to 10)
  setRate(rate) {
    if (rate >= 0.1 && rate <= 10) {
      this.rate = rate;
      this.saveSettings();
      return true;
    }
    return false;
  }

  // Set pitch (0 to 2)
  setPitch(pitch) {
    if (pitch >= 0 && pitch <= 2) {
      this.pitch = pitch;
      this.saveSettings();
      return true;
    }
    return false;
  }

  // Set volume (0 to 1)
  setVolume(volume) {
    if (volume >= 0 && volume <= 1) {
      this.volume = volume;
      this.saveSettings();
      return true;
    }
    return false;
  }

  // Set target language
  setLanguage(languageCode) {
    this.targetLang = languageCode;
    this.setVoiceByLang(languageCode);
    this.saveSettings();
  }

  // Set callback for speech start
  onStart(callback) {
    this.onStartCallback = callback;
  }

  // Set callback for speech end
  onEnd(callback) {
    this.onEndCallback = callback;
  }

  // Set callback for speech errors
  onError(callback) {
    this.onErrorCallback = callback;
  }

  // Load settings from storage
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get('speechSynthesisSettings', (data) => {
        resolve(data.speechSynthesisSettings || {});
      });
    });
  }

  // Save settings to storage
  async saveSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        speechSynthesisSettings: {
          targetLang: this.targetLang,
          pitch: this.pitch,
          rate: this.rate,
          volume: this.volume
        }
      }, () => {
        resolve(true);
      });
    });
  }
}

// Export the SpeechSynthesizer class
window.SpeechSynthesizer = SpeechSynthesizer;