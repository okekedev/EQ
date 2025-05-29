// EQ Translator - Main Controller (Streamlined)

class EQTranslator {
  constructor() {
    this.components = {};
    this.state = {
      isCapturing: false,
      isRecognizing: false,
      isTranslating: false,
      isSpeaking: false,
      useAPIInterception: true,
      currentTranscript: '',
      currentTranslation: ''
    };
  }

  async init() {
    try {
      this.updateStatus('Initializing...', 'pending');
      
      // Initialize core components
      this.components.storage = new Storage();
      this.components.audioProcessor = new AudioProcessor();
      this.components.captureManager = new CaptureManager(this.components.audioProcessor);
      this.components.speechRecognizer = new SpeechRecognizer(this.components.audioProcessor);
      this.components.translator = new Translator();
      this.components.speechSynthesizer = new SpeechSynthesizer();
      this.components.visualizer = new Visualizer();
      
      // Initialize all components
      await this.components.storage.init();
      await this.components.translator.init();
      await this.components.speechSynthesizer.init();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Load settings
      await this.loadSettings();
      
      // Setup component callbacks
      this.setupCallbacks();
      
      this.updateStatus('🎯 Ready for API Interception Magic!', 'success');
      
    } catch (error) {
      console.error('Initialization error:', error);
      this.updateStatus('Initialization failed', 'error');
      this.showNotification('Initialization Error', error.message, 'error');
    }
  }

  setupEventListeners() {
    // Capture controls
    document.getElementById('start-capture').addEventListener('click', () => this.startCapture());
    document.getElementById('stop-capture').addEventListener('click', () => this.stopCapture());
    
    // Recognition controls
    document.getElementById('toggle-recognition').addEventListener('click', () => this.toggleRecognition());
    document.getElementById('check-mic').addEventListener('click', () => this.checkMicrophone());
    document.getElementById('clear-transcript').addEventListener('click', () => this.clearTranscript());
    
    // Translation controls
    document.getElementById('translate-btn').addEventListener('click', () => this.translate());
    document.getElementById('copy-translation').addEventListener('click', () => this.copyTranslation());
    
    // Speech controls
    document.getElementById('speak-btn').addEventListener('click', () => this.speak());
    document.getElementById('stop-speech').addEventListener('click', () => this.stopSpeech());
    
    // Equalizer controls
    document.getElementById('eq-reset').addEventListener('click', () => this.resetEqualizer());
    document.getElementById('eq-enabled').addEventListener('change', (e) => this.toggleEqualizer(e.target.checked));
    
    // EQ sliders
    document.querySelectorAll('.eq-band input').forEach((slider, index) => {
      slider.addEventListener('input', () => this.updateEQBand(index, slider.value));
    });
    
    // EQ presets
    document.querySelectorAll('.presets button').forEach(btn => {
      btn.addEventListener('click', () => this.applyEQPreset(btn.dataset.preset));
    });
    
    // Speech sliders
    document.getElementById('speech-rate').addEventListener('input', (e) => {
      document.getElementById('rate-value').textContent = e.target.value;
      this.components.speechSynthesizer.setRate(parseFloat(e.target.value));
    });
    
    document.getElementById('speech-pitch').addEventListener('input', (e) => {
      document.getElementById('pitch-value').textContent = e.target.value;
      this.components.speechSynthesizer.setPitch(parseFloat(e.target.value));
    });
    
    document.getElementById('speech-volume').addEventListener('input', (e) => {
      document.getElementById('volume-value').textContent = e.target.value;
      this.components.speechSynthesizer.setVolume(parseFloat(e.target.value));
    });
    
    // Language selectors
    document.getElementById('source-language').addEventListener('change', (e) => {
      this.components.speechRecognizer.setLanguage(e.target.value);
    });
    
    document.getElementById('target-language').addEventListener('change', (e) => {
      this.components.translator.setTargetLanguage(e.target.value);
      this.populateVoices();
    });
    
    // Section toggles
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => this.toggleSection(btn.dataset.section));
    });
    
    // Settings
    document.getElementById('use-api-interception').addEventListener('change', (e) => {
      this.state.useAPIInterception = e.target.checked;
      this.saveSettings();
    });
    
    document.getElementById('hide-help').addEventListener('click', () => {
      document.getElementById('permission-help').style.display = 'none';
    });
  }

  setupCallbacks() {
    // Capture callbacks
    this.components.captureManager.onStart = () => {
      this.state.isCapturing = true;
      this.updateButtons();
      this.updateStatus('Capturing audio', 'active');
      
      // Start visualizer
      const canvas = document.getElementById('audio-visualizer');
      this.components.visualizer.start(canvas, this.components.audioProcessor.getAnalyser());
    };
    
    this.components.captureManager.onStop = () => {
      this.state.isCapturing = false;
      this.updateButtons();
      this.updateStatus('Ready', 'success');
      this.components.visualizer.stop();
    };
    
    this.components.captureManager.onError = (error) => {
      this.updateStatus('Capture error', 'error');
      this.showNotification('Capture Error', error.message, 'error');
    };
    
    // Speech recognition callbacks
    this.components.speechRecognizer.onResult = (result) => {
      this.updateTranscript(result);
      
      if (result.isFinal) {
        this.state.currentTranscript = result.transcript;
        
        // Auto-translate if enabled
        if (document.getElementById('auto-translate').checked) {
          this.translate();
        }
      }
    };
    
    this.components.speechRecognizer.onError = (error) => {
      this.handleSpeechError(error);
    };
    
    // Translation callbacks
    this.components.translator.onResult = (result) => {
      this.state.currentTranslation = result.translatedText;
      this.updateTranslation(result.translatedText);
      
      // Auto-speak if enabled
      if (document.getElementById('auto-speak').checked) {
        this.speak();
      }
    };
    
    this.components.translator.onError = (error) => {
      this.showNotification('Translation Error', error.message, 'error');
    };
  }

  async startCapture() {
    try {
      this.updateStatus('Starting capture...', 'pending');
      
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs.length) throw new Error('No active tab found');
      
      // Start capture with API interception
      await this.components.captureManager.start(tabs[0].id, this.state.useAPIInterception);
      
      if (this.state.useAPIInterception) {
        this.updateInterceptionStatus(true);
        this.updateStatus('🎯 Magic Active: API Interception enabled!', 'active');
      }
      
    } catch (error) {
      console.error('Capture error:', error);
      this.updateStatus('Capture failed', 'error');
      this.showNotification('Capture Error', error.message, 'error');
    }
  }

  async stopCapture() {
    try {
      this.updateStatus('Stopping capture...', 'pending');
      
      // Stop recognition first
      if (this.state.isRecognizing) {
        this.stopRecognition();
      }
      
      await this.components.captureManager.stop();
      this.updateInterceptionStatus(false);
      
    } catch (error) {
      console.error('Stop error:', error);
      this.showNotification('Stop Error', error.message, 'error');
    }
  }

  async toggleRecognition() {
    if (this.state.isRecognizing) {
      this.stopRecognition();
    } else {
      await this.startRecognition();
    }
  }

  async startRecognition() {
    try {
      if (!this.state.isCapturing) {
        throw new Error('Please start audio capture first');
      }
      
      this.updateStatus('Starting recognition...', 'pending');
      
      const language = document.getElementById('source-language').value;
      await this.components.speechRecognizer.start(language);
      
      this.state.isRecognizing = true;
      this.updateButtons();
      this.updateStatus('🎤 Listening...', 'active');
      
      // Update source indicator
      const sourceIndicator = document.getElementById('recognition-source');
      if (this.state.useAPIInterception) {
        sourceIndicator.textContent = '🎯 Magic Active';
        sourceIndicator.className = 'badge api-intercepted';
        document.getElementById('magic-indicator').style.display = 'inline';
      } else {
        sourceIndicator.textContent = 'Microphone';
        sourceIndicator.className = 'badge active';
      }
      
    } catch (error) {
      console.error('Recognition error:', error);
      this.handleSpeechError(error);
    }
  }

  stopRecognition() {
    this.components.speechRecognizer.stop();
    this.state.isRecognizing = false;
    this.updateButtons();
    
    const sourceIndicator = document.getElementById('recognition-source');
    sourceIndicator.textContent = 'Ready';
    sourceIndicator.className = 'badge';
    document.getElementById('magic-indicator').style.display = 'none';
    
    this.updateStatus(this.state.isCapturing ? 'Capturing audio' : 'Ready', 
                     this.state.isCapturing ? 'active' : 'success');
  }

  async checkMicrophone() {
    try {
      this.updateStatus('Checking microphone...', 'pending');
      
      const hasPermission = await this.components.speechRecognizer.checkPermission();
      
      if (hasPermission) {
        this.updateStatus('Microphone access confirmed', 'success');
        this.showNotification('Microphone OK', 'Permission granted successfully!', 'success');
        document.getElementById('permission-help').style.display = 'none';
      } else {
        throw new Error('Permission denied');
      }
      
    } catch (error) {
      this.updateStatus('Microphone access required', 'error');
      this.showNotification('Microphone Required', 
        'Please allow microphone access and try again.', 'error');
      document.getElementById('permission-help').style.display = 'block';
    }
  }

  handleSpeechError(error) {
    this.state.isRecognizing = false;
    this.updateButtons();
    
    let title = 'Recognition Error';
    let message = error.message;
    
    if (error.type === 'not-allowed') {
      title = '🎤 Microphone Required';
      message = 'Please allow microphone access to use speech recognition.';
      document.getElementById('permission-help').style.display = 'block';
    }
    
    this.updateStatus('Recognition error', 'error');
    this.showNotification(title, message, 'error');
  }

  async translate() {
    if (!this.state.currentTranscript) return;
    
    try {
      this.state.isTranslating = true;
      this.updateButtons();
      this.updateStatus('Translating...', 'pending');
      
      const sourceLang = document.getElementById('source-language').value.split('-')[0];
      const targetLang = document.getElementById('target-language').value;
      
      await this.components.translator.translate(this.state.currentTranscript, sourceLang, targetLang);
      
    } catch (error) {
      console.error('Translation error:', error);
      this.showNotification('Translation Error', error.message, 'error');
    } finally {
      this.state.isTranslating = false;
      this.updateButtons();
    }
  }

  async speak() {
    if (!this.state.currentTranslation) return;
    
    try {
      this.state.isSpeaking = true;
      this.updateButtons();
      this.updateStatus('Speaking...', 'active');
      
      const voiceIndex = document.getElementById('voice-select').value;
      await this.components.speechSynthesizer.speak(this.state.currentTranslation, parseInt(voiceIndex));
      
    } catch (error) {
      console.error('Speech error:', error);
      this.showNotification('Speech Error', error.message, 'error');
    } finally {
      this.state.isSpeaking = false;
      this.updateButtons();
      this.updateStatus('Ready', 'success');
    }
  }

  stopSpeech() {
    this.components.speechSynthesizer.stop();
    this.state.isSpeaking = false;
    this.updateButtons();
    this.updateStatus('Ready', 'success');
  }

  // EQ Methods
  updateEQBand(index, value) {
    const band = document.querySelectorAll('.eq-band')[index];
    band.querySelector('.value').textContent = `${value}dB`;
    
    if (this.state.isCapturing) {
      this.components.audioProcessor.updateEQBand(index, parseFloat(value));
    }
  }

  applyEQPreset(preset) {
    const presets = {
      flat: [0, 0, 0, 0, 0, 0],
      bass: [6, 3, 0, -1, -2, 0],
      vocal: [-2, -1, 2, 4, 0, -2],
      treble: [-3, -1, 0, 2, 4, 6]
    };
    
    const values = presets[preset] || presets.flat;
    const sliders = document.querySelectorAll('.eq-band input');
    
    sliders.forEach((slider, index) => {
      slider.value = values[index];
      this.updateEQBand(index, values[index]);
    });
  }

  resetEqualizer() {
    this.applyEQPreset('flat');
  }

  toggleEqualizer(enabled) {
    const sliders = document.querySelectorAll('.eq-band input');
    sliders.forEach(slider => slider.disabled = !enabled);
    
    if (this.state.isCapturing) {
      this.components.audioProcessor.toggleEQ(enabled);
    }
  }

  // UI Methods
  updateStatus(text, type) {
    document.getElementById('status-text').textContent = text;
    const icon = document.getElementById('status-icon');
    icon.className = `status-icon ${type}`;
  }

  updateButtons() {
    document.getElementById('start-capture').disabled = this.state.isCapturing;
    document.getElementById('stop-capture').disabled = !this.state.isCapturing;
    document.getElementById('toggle-recognition').textContent = 
      this.state.isRecognizing ? 'Stop Recognition' : 'Start Recognition';
    document.getElementById('translate-btn').disabled = !this.state.currentTranscript || this.state.isTranslating;
    document.getElementById('speak-btn').disabled = !this.state.currentTranslation || this.state.isSpeaking;
    document.getElementById('stop-speech').disabled = !this.state.isSpeaking;
  }

  updateTranscript(result) {
    const transcript = document.getElementById('transcript');
    
    if (result.isFinal) {
      transcript.innerHTML += `<p>${result.transcript}</p>`;
    } else {
      // Update interim result
      const interim = transcript.querySelector('.interim');
      if (interim) {
        interim.textContent = result.transcript;
      } else {
        transcript.innerHTML += `<p class="interim" style="opacity: 0.7">${result.transcript}</p>`;
      }
    }
    
    transcript.scrollTop = transcript.scrollHeight;
  }

  updateTranslation(text) {
    const translation = document.getElementById('translation-result');
    translation.innerHTML = `<p>${text}</p>`;
    translation.scrollTop = translation.scrollHeight;
  }

  clearTranscript() {
    document.getElementById('transcript').innerHTML = '';
    this.state.currentTranscript = '';
  }

  async copyTranslation() {
    if (!this.state.currentTranslation) return;
    
    try {
      await navigator.clipboard.writeText(this.state.currentTranslation);
      this.showNotification('Copied', 'Translation copied to clipboard', 'success');
    } catch (error) {
      this.showNotification('Copy Failed', 'Could not copy to clipboard', 'error');
    }
  }

  updateInterceptionStatus(active) {
    const status = document.getElementById('interception-status');
    if (active) {
      status.textContent = 'API Interception: ACTIVE';
      status.className = 'badge api-intercepted';
    } else {
      status.textContent = 'Ready';
      status.className = 'badge';
    }
  }

  toggleSection(sectionName) {
    const content = document.getElementById(`${sectionName}-content`);
    const button = document.querySelector(`[data-section="${sectionName}"]`);
    
    const isCollapsed = content.classList.contains('collapsed');
    content.classList.toggle('collapsed');
    button.classList.toggle('collapsed', !isCollapsed);
  }

  populateVoices() {
    const select = document.getElementById('voice-select');
    const voices = this.components.speechSynthesizer.getVoices();
    const targetLang = document.getElementById('target-language').value;
    
    select.innerHTML = '';
    voices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${voice.name} (${voice.lang})`;
      
      if (voice.lang.startsWith(targetLang)) {
        option.selected = true;
      }
      
      select.appendChild(option);
    });
  }

  showNotification(title, message, type = 'info') {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="title">${title}</div>
      <div class="message">${message}</div>
      <button class="close">×</button>
    `;
    
    notification.querySelector('.close').addEventListener('click', () => {
      notification.remove();
    });
    
    container.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  async loadSettings() {
    try {
      const settings = await this.components.storage.getAll();
      
      // Apply settings to UI
      if (settings.useAPIInterception !== undefined) {
        document.getElementById('use-api-interception').checked = settings.useAPIInterception;
        this.state.useAPIInterception = settings.useAPIInterception;
      }
      
      if (settings.sourceLang) {
        document.getElementById('source-language').value = settings.sourceLang;
      }
      
      if (settings.targetLang) {
        document.getElementById('target-language').value = settings.targetLang;
      }
      
      if (settings.autoTranslate !== undefined) {
        document.getElementById('auto-translate').checked = settings.autoTranslate;
      }
      
      if (settings.autoSpeak !== undefined) {
        document.getElementById('auto-speak').checked = settings.autoSpeak;
      }
      
      // Load EQ settings
      if (settings.eq) {
        const sliders = document.querySelectorAll('.eq-band input');
        sliders.forEach((slider, index) => {
          if (settings.eq[index] !== undefined) {
            slider.value = settings.eq[index];
            this.updateEQBand(index, settings.eq[index]);
          }
        });
      }
      
      // Load speech settings
      if (settings.speech) {
        if (settings.speech.rate) {
          document.getElementById('speech-rate').value = settings.speech.rate;
          document.getElementById('rate-value').textContent = settings.speech.rate;
        }
        if (settings.speech.pitch) {
          document.getElementById('speech-pitch').value = settings.speech.pitch;
          document.getElementById('pitch-value').textContent = settings.speech.pitch;
        }
        if (settings.speech.volume) {
          document.getElementById('speech-volume').value = settings.speech.volume;
          document.getElementById('volume-value').textContent = settings.speech.volume;
        }
      }
      
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async saveSettings() {
    try {
      const settings = {
        useAPIInterception: this.state.useAPIInterception,
        sourceLang: document.getElementById('source-language').value,
        targetLang: document.getElementById('target-language').value,
        autoTranslate: document.getElementById('auto-translate').checked,
        autoSpeak: document.getElementById('auto-speak').checked,
        eq: Array.from(document.querySelectorAll('.eq-band input')).map(s => parseFloat(s.value)),
        speech: {
          rate: parseFloat(document.getElementById('speech-rate').value),
          pitch: parseFloat(document.getElementById('speech-pitch').value),
          volume: parseFloat(document.getElementById('speech-volume').value)
        }
      };
      
      await this.components.storage.saveAll(settings);
      
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.eqTranslator = new EQTranslator();
  window.eqTranslator.init();
});

// Auto-save settings on page unload
window.addEventListener('beforeunload', () => {
  if (window.eqTranslator) {
    window.eqTranslator.saveSettings();
  }
});