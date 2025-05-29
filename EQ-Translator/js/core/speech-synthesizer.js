// Streamlined Speech Synthesizer
class SpeechSynthesizer {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.currentVoice = null;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    this.targetLang = 'es';
    this.isSpeaking = false;
    this.currentUtterance = null;
    
    // Callbacks
    this.onStart = null;
    this.onEnd = null;
    this.onError = null;
  }

  async init() {
    if (!('speechSynthesis' in window)) {
      throw new Error('Speech synthesis not supported in this browser');
    }

    // Load voices
    await this.loadVoices();
    
    // Load saved settings
    await this.loadSettings();
    
    console.log('🔊 Speech synthesizer initialized');
  }

  async loadVoices() {
    return new Promise((resolve) => {
      // Check if voices are already available
      if (this.synth.getVoices().length > 0) {
        this.voices = this.synth.getVoices();
        this.selectDefaultVoice();
        resolve(this.voices);
        return;
      }

      // Wait for voices to be loaded
      const handleVoicesChanged = () => {
        this.voices = this.synth.getVoices();
        this.selectDefaultVoice();
        this.synth.removeEventListener('voiceschanged', handleVoicesChanged);
        resolve(this.voices);
      };

      this.synth.addEventListener('voiceschanged', handleVoicesChanged);

      // Fallback timeout
      setTimeout(() => {
        this.synth.removeEventListener('voiceschanged', handleVoicesChanged);
        this.voices = this.synth.getVoices();
        this.selectDefaultVoice();
        resolve(this.voices);
      }, 1000);
    });
  }

  selectDefaultVoice() {
    if (this.voices.length === 0) return;

    // Try to find a voice for the target language
    let voice = this.voices.find(v => v.lang.startsWith(this.targetLang));
    
    // If no voice for target language, use first available
    if (!voice) {
      voice = this.voices[0];
    }

    this.currentVoice = voice;
  }

  getVoices() {
    return this.voices;
  }

  setVoice(voiceIndex) {
    if (voiceIndex >= 0 && voiceIndex < this.voices.length) {
      this.currentVoice = this.voices[voiceIndex];
      return true;
    }
    return false;
  }

  setVoiceByLanguage(languageCode) {
    const voice = this.voices.find(v => v.lang.startsWith(languageCode));
    if (voice) {
      this.currentVoice = voice;
      this.targetLang = languageCode;
      return true;
    }
    return false;
  }

  setRate(rate) {
    if (rate >= 0.1 && rate <= 10) {
      this.rate = rate;
      this.saveSettings();
      return true;
    }
    return false;
  }

  setPitch(pitch) {
    if (pitch >= 0 && pitch <= 2) {
      this.pitch = pitch;
      this.saveSettings();
      return true;
    }
    return false;
  }

  setVolume(volume) {
    if (volume >= 0 && volume <= 1) {
      this.volume = volume;
      this.saveSettings();
      return true;
    }
    return false;
  }

  async speak(text, voiceIndex = null) {
    if (!text || text.trim() === '') {
      throw new Error('No text to speak');
    }

    if (this.isSpeaking) {
      this.stop(); // Stop current speech
    }

    return new Promise((resolve, reject) => {
      try {
        // Create utterance
        this.currentUtterance = new SpeechSynthesisUtterance(text);
        
        // Set voice
        if (voiceIndex !== null && voiceIndex >= 0 && voiceIndex < this.voices.length) {
          this.currentUtterance.voice = this.voices[voiceIndex];
        } else if (this.currentVoice) {
          this.currentUtterance.voice = this.currentVoice;
        }
        
        // Set properties
        this.currentUtterance.rate = this.rate;
        this.currentUtterance.pitch = this.pitch;
        this.currentUtterance.volume = this.volume;
        this.currentUtterance.lang = this.currentVoice?.lang || this.targetLang;

        // Set event handlers
        this.currentUtterance.onstart = () => {
          this.isSpeaking = true;
          console.log('🔊 Speech started');
          if (this.onStart) this.onStart();
        };

        this.currentUtterance.onend = () => {
          this.isSpeaking = false;
          this.currentUtterance = null;
          console.log('🔊 Speech ended');
          if (this.onEnd) this.onEnd();
          resolve();
        };

        this.currentUtterance.onerror = (event) => {
          this.isSpeaking = false;
          this.currentUtterance = null;
          console.error('🔊 Speech error:', event.error);
          
          const error = new Error(`Speech synthesis failed: ${event.error}`);
          if (this.onError) this.onError(error);
          reject(error);
        };

        // Start speaking
        this.synth.speak(this.currentUtterance);
        
      } catch (error) {
        this.isSpeaking = false;
        this.currentUtterance = null;
        console.error('Speech synthesis error:', error);
        if (this.onError) this.onError(error);
        reject(error);
      }
    });
  }

  stop() {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
    this.isSpeaking = false;
    this.currentUtterance = null;
    console.log('🔊 Speech stopped');
  }

  pause() {
    if (this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
      console.log('🔊 Speech paused');
    }
  }

  resume() {
    if (this.synth.paused) {
      this.synth.resume();
      console.log('🔊 Speech resumed');
    }
  }

  // Get current settings
  getSettings() {
    return {
      rate: this.rate,
      pitch: this.pitch,
      volume: this.volume,
      targetLang: this.targetLang,
      voiceIndex: this.currentVoice ? this.voices.indexOf(this.currentVoice) : -1
    };
  }

  // Load settings from storage
  async loadSettings() {
    try {
      const settings = await new Promise((resolve) => {
        chrome.storage.local.get('speechSynthesisSettings', (data) => {
          resolve(data.speechSynthesisSettings || {});
        });
      });

      if (settings.rate !== undefined) this.rate = settings.rate;
      if (settings.pitch !== undefined) this.pitch = settings.pitch;
      if (settings.volume !== undefined) this.volume = settings.volume;
      if (settings.targetLang) this.targetLang = settings.targetLang;
      
      // Set voice by language after voices are loaded
      if (settings.targetLang && this.voices.length > 0) {
        this.setVoiceByLanguage(settings.targetLang);
      }

      console.log('🔊 Speech settings loaded');
      
    } catch (error) {
      console.error('Error loading speech settings:', error);
    }
  }

  // Save settings to storage
  async saveSettings() {
    try {
      const settings = {
        rate: this.rate,
        pitch: this.pitch,
        volume: this.volume,
        targetLang: this.targetLang
      };

      await new Promise((resolve) => {
        chrome.storage.local.set({ speechSynthesisSettings: settings }, resolve);
      });

    } catch (error) {
      console.error('Error saving speech settings:', error);
    }
  }

  // Check if speech synthesis is available
  isSupported() {
    return 'speechSynthesis' in window;
  }

  // Get available languages
  getAvailableLanguages() {
    const languages = new Set();
    this.voices.forEach(voice => {
      const langCode = voice.lang.split('-')[0];
      languages.add(langCode);
    });
    return Array.from(languages).sort();
  }

  // Get voices for a specific language
  getVoicesForLanguage(languageCode) {
    return this.voices.filter(voice => voice.lang.startsWith(languageCode));
  }
}

window.SpeechSynthesizer = SpeechSynthesizer;