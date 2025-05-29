// EQ Translator - Simplified Controller

class EQTranslator {
  constructor() {
    this.components = {};
    this.state = {
      isTranslating: false,
      currentInput: '',
      currentOutput: ''
    };
  }

  async init() {
    try {
      this.updateStatus('Initializing...', 'pending');
      
      // Initialize components
      this.components.storage = new Storage();
      this.components.audioProcessor = new AudioProcessor();
      this.components.captureManager = new CaptureManager();
      this.components.speechRecognizer = new SpeechRecognizer(this.components.audioProcessor);
      this.components.translator = new Translator();
      this.components.speechSynthesizer = new SpeechSynthesizer();
      
      // Visualizer removed - no longer needed
      
      // Initialize speech recognizer
      try {
        this.components.speechRecognizer.init();
      } catch (error) {
        console.warn('Speech recognition not available:', error.message);
      }
      
      // Initialize other components
      await this.components.storage.init();
      await this.components.translator.init();
      await this.components.speechSynthesizer.init();
      
      // Setup everything
      this.setupEventListeners();
      this.setupCallbacks();
      await this.loadSettings();
      this.populateVoices();
      
      this.updateStatus('Ready', 'active');
      
    } catch (error) {
      console.error('Initialization error:', error);
      this.updateStatus('Initialization failed', 'error');
      this.showNotification('Error', error.message, 'error');
    }
  }

  setupEventListeners() {
    // Main translation button - updated selector
    const toggleBtn = document.getElementById('toggle-translation');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleTranslation());
    }
    
    // Language selectors
    const sourceLang = document.getElementById('source-language');
    if (sourceLang) {
      sourceLang.addEventListener('change', (e) => {
        this.updateLanguageDisplay();
        if (this.components.speechRecognizer) {
          this.components.speechRecognizer.setLanguage(e.target.value);
        }
      });
    }
    
    const targetLang = document.getElementById('target-language');
    if (targetLang) {
      targetLang.addEventListener('change', (e) => {
        this.updateLanguageDisplay();
        if (this.components.translator) {
          this.components.translator.setTargetLanguage(e.target.value);
        }
        this.populateVoices();
      });
    }
    
    // Copy button
    const copyBtn = document.getElementById('copy-output');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyOutput());
    }
    
    // Settings toggles
    document.querySelectorAll('.section-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.dataset.section;
        if (section) {
          this.toggleSection(section);
        }
      });
    });
    
    // EQ controls - updated for 5 bands
    document.querySelectorAll('.eq-band input').forEach((slider, index) => {
      slider.addEventListener('input', (e) => this.updateEQBand(index, e.target.value));
    });
    
    document.querySelectorAll('.presets button').forEach(btn => {
      btn.addEventListener('click', () => this.applyEQPreset(btn.dataset.preset));
    });
    
    // Speech controls
    const speechRate = document.getElementById('speech-rate');
    if (speechRate) {
      speechRate.addEventListener('input', (e) => {
        const rateValue = document.getElementById('rate-value');
        if (rateValue) rateValue.textContent = e.target.value;
        if (this.components.speechSynthesizer) {
          this.components.speechSynthesizer.setRate(parseFloat(e.target.value));
        }
      });
    }
    
    const speechVolume = document.getElementById('speech-volume');
    if (speechVolume) {
      speechVolume.addEventListener('input', (e) => {
        const volumeValue = document.getElementById('volume-value');
        if (volumeValue) volumeValue.textContent = e.target.value;
        if (this.components.speechSynthesizer) {
          this.components.speechSynthesizer.setVolume(parseFloat(e.target.value));
        }
      });
    }
  }

  setupCallbacks() {
    // Capture manager callbacks
    if (this.components.captureManager) {
      this.components.captureManager.onCaptureStarted = () => {
        this.updateInputStatus('🎯 Magic Active');
        // Visualizer removed - no longer needed
      };
      
      this.components.captureManager.onCaptureStopped = () => {
        this.updateInputStatus('Ready');
        // Visualizer removed - no longer needed
      };
      
      this.components.captureManager.onCaptureError = (error) => {
        this.showNotification('Capture Error', error.message, 'error');
      };
    }
    
    // Speech recognition callbacks
    if (this.components.speechRecognizer) {
      this.components.speechRecognizer.onResult = (result) => {
        this.updateInput(result.transcript, result.isFinal);
        
        if (result.isFinal) {
          this.state.currentInput = result.transcript;
          
          // Auto-translate if enabled
          const autoTranslate = document.getElementById('auto-translate');
          if (autoTranslate && autoTranslate.checked) {
            this.translate();
          }
        }
      };
      
      this.components.speechRecognizer.onError = (error) => {
        this.showNotification('Recognition Error', error.message, 'error');
      };
    }
    
    // Translation callbacks
    if (this.components.translator) {
      this.components.translator.onResult = (result) => {
        this.state.currentOutput = result.translatedText;
        this.updateOutput(result.translatedText);
        
        // Auto-speak if enabled
        const autoSpeak = document.getElementById('auto-speak');
        if (autoSpeak && autoSpeak.checked) {
          this.speak();
        }
      };
      
      this.components.translator.onError = (error) => {
        this.showNotification('Translation Error', error.message, 'error');
      };
    }
  }

  async toggleTranslation() {
    if (this.state.isTranslating) {
      await this.stopTranslation();
    } else {
      await this.startTranslation();
    }
  }

  async startTranslation() {
    try {
      this.updateStatus('Starting translation...', 'pending');
      
      // Get current tab and start capture
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs.length) throw new Error('No active tab found');
      
      // Initialize capture manager with audio processor
      this.components.captureManager.initialize(this.components.audioProcessor);
      
      // Start capture with API interception
      await this.components.captureManager.startCapture(tabs[0].id);
      this.components.audioProcessor.startAPIInterception();
      
      // Start speech recognition
      const language = document.getElementById('source-language').value;
      await this.components.speechRecognizer.start(language);
      
      // Update UI
      this.state.isTranslating = true;
      this.updateTranslationButton();
      this.updateStatus('🎯 Translation Active', 'active');
      
    } catch (error) {
      console.error('Translation start error:', error);
      this.updateStatus('Failed to start', 'error');
      this.showNotification('Error', error.message, 'error');
    }
  }

  async stopTranslation() {
    try {
      this.updateStatus('Stopping translation...', 'pending');
      
      // Stop speech recognition
      if (this.components.speechRecognizer) {
        this.components.speechRecognizer.stop();
      }
      
      // Stop API interception
      if (this.components.audioProcessor.isAPIIntercepting()) {
        this.components.audioProcessor.stopAPIInterception();
      }
      
      // Stop capture
      await this.components.captureManager.stopCapture();
      
      // Update UI
      this.state.isTranslating = false;
      this.updateTranslationButton();
      this.updateStatus('Ready', 'active');
      
    } catch (error) {
      console.error('Translation stop error:', error);
      this.showNotification('Error', error.message, 'error');
    }
  }

  async translate() {
    if (!this.state.currentInput) return;
    
    const sourceLang = document.getElementById('source-language').value.split('-')[0];
    const targetLang = document.getElementById('target-language').value;
    
    await this.components.translator.translate(this.state.currentInput, sourceLang, targetLang);
  }

  async speak() {
    if (!this.state.currentOutput) return;
    
    const voiceSelect = document.getElementById('voice-select');
    const voiceIndex = voiceSelect ? parseInt(voiceSelect.value) : 0;
    
    await this.components.speechSynthesizer.speak(this.state.currentOutput, voiceIndex);
  }

  // UI Update Methods
  updateStatus(text, type) {
    const statusText = document.getElementById('status-text');
    const statusIcon = document.getElementById('status-icon');
    
    if (statusText) statusText.textContent = text;
    if (statusIcon) statusIcon.className = `status-icon ${type}`;
  }

  updateTranslationButton() {
    const button = document.getElementById('toggle-translation');
    if (button) {
      button.textContent = this.state.isTranslating ? '🛑 Stop Translation' : '🎯 Start Translation';
    }
  }

  updateLanguageDisplay() {
    const sourceLang = document.getElementById('source-language');
    const targetLang = document.getElementById('target-language');
    const sourceDisplay = document.getElementById('source-lang-display');
    const targetDisplay = document.getElementById('target-lang-display');
    
    if (sourceLang && sourceDisplay) {
      sourceDisplay.textContent = sourceLang.options[sourceLang.selectedIndex].text;
    }
    
    if (targetLang && targetDisplay) {
      targetDisplay.textContent = targetLang.options[targetLang.selectedIndex].text;
    }
  }

  updateInputStatus(status) {
    const inputSource = document.getElementById('input-source');
    if (inputSource) {
      inputSource.textContent = status;
      inputSource.className = status === '🎯 Magic Active' ? 'badge magic' : 'badge';
    }
  }

  updateInput(text, isFinal) {
    const inputContent = document.getElementById('input-content');
    if (inputContent) {
      if (isFinal) {
        inputContent.innerHTML += `<p>${text}</p>`;
      } else {
        // Update interim result
        let interim = inputContent.querySelector('.interim');
        if (!interim) {
          interim = document.createElement('p');
          interim.className = 'interim';
          interim.style.opacity = '0.7';
          inputContent.appendChild(interim);
        }
        interim.textContent = text;
      }
      inputContent.scrollTop = inputContent.scrollHeight;
    }
  }

  updateOutput(text) {
    const outputContent = document.getElementById('output-content');
    if (outputContent) {
      outputContent.innerHTML = `<p>${text}</p>`;
      outputContent.scrollTop = outputContent.scrollHeight;
    }
  }

  async copyOutput() {
    if (!this.state.currentOutput) return;
    
    try {
      await navigator.clipboard.writeText(this.state.currentOutput);
      this.showNotification('Copied', 'Translation copied to clipboard', 'success');
    } catch (error) {
      this.showNotification('Copy Failed', 'Could not copy to clipboard', 'error');
    }
  }

  toggleSection(sectionName) {
    const content = document.getElementById(`${sectionName}-content`);
    const button = document.querySelector(`[data-section="${sectionName}"] .toggle-btn`);
    
    if (content && button) {
      const isCollapsed = content.classList.contains('collapsed');
      content.classList.toggle('collapsed');
      button.classList.toggle('collapsed', !isCollapsed);
    }
  }

  // EQ Methods - Updated for 5 bands
  updateEQBand(index, value) {
    const band = document.querySelectorAll('.eq-band')[index];
    const valueDisplay = band.querySelector('.eq-value');
    
    if (valueDisplay) {
      valueDisplay.textContent = `${value}dB`;
    }
    
    if (this.state.isTranslating && this.components.audioProcessor) {
      this.components.audioProcessor.updateEQBand(index, parseFloat(value));
    }
  }

  applyEQPreset(preset) {
    const presets = {
      flat: [0, 0, 0, 0, 0],      // 5 bands instead of 6
      bass: [6, 3, 0, -1, -2],    // 5 bands instead of 6
      vocal: [-2, -1, 2, 4, 0],   // 5 bands instead of 6
      treble: [-3, -1, 0, 2, 4]   // 5 bands instead of 6
    };
    
    const values = presets[preset] || presets.flat;
    const sliders = document.querySelectorAll('.eq-band input');
    
    sliders.forEach((slider, index) => {
      if (values[index] !== undefined) {
        slider.value = values[index];
        this.updateEQBand(index, values[index]);
      }
    });
  }

  populateVoices() {
    const select = document.getElementById('voice-select');
    if (!select || !this.components.speechSynthesizer) return;
    
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
    if (!container) return;
    
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
    // Load basic settings
    this.updateLanguageDisplay();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.eqTranslator = new EQTranslator();
  window.eqTranslator.init();
});