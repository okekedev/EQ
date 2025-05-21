// UI Controller - Handles UI interactions and state

class UIController {
  constructor() {
    // Status elements
    this.statusText = null;
    this.statusIcon = null;
    
    // UI elements by category
    this.captureControls = {};
    this.equalizerControls = {};
    this.recognitionControls = {};
    this.translationControls = {};
    this.speechControls = {};
    this.settingsControls = {};
    
    // State
    this.isCapturing = false;
    this.isRecognizing = false;
    this.isTranslating = false;
    this.isSpeaking = false;
    
    // Presets
    this.equalizerPresets = {
      flat: [0, 0, 0, 0, 0, 0],
      bass: [8, 4, 0, -2, -2, 0],
      vocal: [-2, -1, 2, 4, 0, -2],
      treble: [-5, -3, 0, 2, 6, 8]
    };
    
    // Callbacks
    this.onSettingsChanged = null;
    this.onUIStateChanged = null;
  }

  /**
   * Initialize UI controller with elements
   * @param {Object} elements - Map of element IDs to DOM elements
   */
  initialize(elements) {
    // Store references to key UI elements

    // Status elements
    this.statusText = elements.statusText;
    this.statusIcon = elements.statusIcon;
    
    // Capture controls
    this.captureControls = {
      startBtn: elements.startCaptureBtn,
      stopBtn: elements.stopCaptureBtn
    };
    
    // Equalizer controls
    this.equalizerControls = {
      sliders: elements.eqSliders,
      valueLabels: elements.eqValueLabels,
      presetButtons: elements.eqPresetButtons
    };
    
    // Recognition controls
    this.recognitionControls = {
      sourceLangSelect: elements.sourceLangSelect,
      transcript: elements.transcriptElem,
      clearTranscriptBtn: elements.clearTranscriptBtn
    };
    
    // Translation controls
    this.translationControls = {
      targetLangSelect: elements.targetLangSelect,
      translateBtn: elements.translateBtn,
      autoTranslateCheckbox: elements.autoTranslateCheckbox,
      translationResult: elements.translationResultElem,
      copyTranslationBtn: elements.copyTranslationBtn
    };
    
    // Speech controls
    this.speechControls = {
      voiceSelect: elements.voiceSelect,
      rateSlider: elements.speechRateSlider,
      pitchSlider: elements.speechPitchSlider,
      volumeSlider: elements.speechVolumeSlider,
      autoSpeakCheckbox: elements.autoSpeakCheckbox,
      speakBtn: elements.speakBtn,
      stopSpeechBtn: elements.stopSpeechBtn
    };
    
    // Settings controls
    this.settingsControls = {
      settingsBtn: elements.settingsBtn,
      closeSettingsBtn: elements.closeSettingsBtn,
      settingsModal: elements.settingsModal,
      themeButtons: elements.themeButtons,
      showVisualizerCheckbox: elements.showVisualizerCheckbox,
      compactModeCheckbox: elements.compactModeCheckbox,
      apiKeyInput: elements.apiKeyInput,
      saveApiKeyBtn: elements.saveApiKeyBtn,
      exportSettingsBtn: elements.exportSettingsBtn,
      importSettingsBtn: elements.importSettingsBtn,
      resetSettingsBtn: elements.resetSettingsBtn
    };
    
    // Section toggle buttons
    this.sectionToggleButtons = elements.sectionToggleButtons;
    
    return this;
  }

  /**
   * Set callback for settings changes
   * @param {Function} callback - The callback function
   */
  setOnSettingsChanged(callback) {
    this.onSettingsChanged = callback;
    return this;
  }

  /**
   * Set callback for UI state changes
   * @param {Function} callback - The callback function
   */
  setOnUIStateChanged(callback) {
    this.onUIStateChanged = callback;
    return this;
  }

  /**
   * Update UI state
   * @param {Object} state - The new state
   */
  updateState(state) {
    // Update internal state
    if (state.isCapturing !== undefined) this.isCapturing = state.isCapturing;
    if (state.isRecognizing !== undefined) this.isRecognizing = state.isRecognizing;
    if (state.isTranslating !== undefined) this.isTranslating = state.isTranslating;
    if (state.isSpeaking !== undefined) this.isSpeaking = state.isSpeaking;
    
    // Update UI elements
    this._updateUIState();
    
    // Call the state changed callback
    if (this.onUIStateChanged) {
      this.onUIStateChanged(this._getState());
    }
    
    return this;
  }

  /**
   * Set the status message and state
   * @param {string} text - The status text
   * @param {string} state - The status state ('active', 'error', 'pending', 'success')
   */
  setStatus(text, state) {
    if (this.statusText) {
      this.statusText.textContent = text;
    }
    
    if (this.statusIcon) {
      switch (state) {
        case 'active':
          this.statusIcon.className = 'status-icon active';
          break;
        case 'error':
          this.statusIcon.className = 'status-icon error';
          break;
        case 'pending':
          this.statusIcon.className = 'status-icon pending';
          break;
        case 'success':
          this.statusIcon.className = 'status-icon success';
          break;
        default:
          this.statusIcon.className = 'status-icon';
      }
    }
    
    return this;
  }

  /**
   * Update equalizer value display
   * @param {number} index - The slider index
   */
  updateEqualizerValue(index) {
    if (!this.equalizerControls.sliders || !this.equalizerControls.valueLabels) return this;
    
    const slider = this.equalizerControls.sliders[index];
    const valueLabel = this.equalizerControls.valueLabels[index];
    
    if (slider && valueLabel) {
      valueLabel.textContent = `${slider.value} dB`;
    }
    
    return this;
  }

  /**
   * Apply an equalizer preset
   * @param {string} preset - The preset name ('flat', 'bass', 'vocal', 'treble')
   */
  applyEqualizerPreset(preset) {
    if (!this.equalizerControls.sliders) return false;
    
    const settings = this.equalizerPresets[preset] || this.equalizerPresets.flat;
    
    // Apply settings to sliders
    this.equalizerControls.sliders.forEach((slider, index) => {
      slider.value = settings[index];
      this.updateEqualizerValue(index);
    });
    
    // Call the settings changed callback
    if (this.onSettingsChanged) {
      this.onSettingsChanged('equalizer', this._getEqualizerSettings());
    }
    
    return true;
  }

  /**
   * Get the current equalizer settings
   * @returns {Object} - The equalizer settings
   */
  getEqualizerSettings() {
    return this._getEqualizerSettings();
  }

  /**
   * Update a speech slider value display
   * @param {HTMLElement} slider - The slider element
   */
  updateSpeechSliderValue(slider) {
    if (!slider) return this;
    
    const valueLabel = slider.nextElementSibling;
    
    if (valueLabel) {
      valueLabel.textContent = slider.value;
    }
    
    return this;
  }

  /**
   * Get the speech settings
   * @returns {Object} - The speech settings
   */
  getSpeechSettings() {
    return this._getSpeechSettings();
  }

  /**
   * Get the translation settings
   * @returns {Object} - The translation settings
   */
  getTranslationSettings() {
    return this._getTranslationSettings();
  }

  /**
   * Get the UI settings
   * @returns {Object} - The UI settings
   */
  getUISettings() {
    return this._getUISettings();
  }

  /**
   * Apply theme to the UI
   * @param {string} theme - The theme ('light', 'dark', 'system')
   */
  setTheme(theme) {
    if (!document.body) return this;
    
    // Apply theme
    if (theme === 'system') {
      // Use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.dataset.theme = prefersDark ? 'dark' : 'light';
    } else {
      document.body.dataset.theme = theme;
    }
    
    // Update active button
    if (this.settingsControls.themeButtons) {
      this.settingsControls.themeButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.theme === theme);
      });
    }
    
    // Call the settings changed callback
    if (this.onSettingsChanged) {
      this.onSettingsChanged('ui', { theme });
    }
    
    return this;
  }

  /**
   * Toggle compact mode
   * @param {boolean} enabled - Whether compact mode is enabled
   */
  setCompactMode(enabled) {
    if (!document.body) return this;
    
    // Apply compact mode
    document.body.classList.toggle('compact-mode', enabled);
    
    // Update checkbox
    if (this.settingsControls.compactModeCheckbox) {
      this.settingsControls.compactModeCheckbox.checked = enabled;
    }
    
    // Call the settings changed callback
    if (this.onSettingsChanged) {
      this.onSettingsChanged('ui', { compactMode: enabled });
    }
    
    return this;
  }

  /**
   * Toggle a section
   * @param {number} index - The section index
   */
  toggleSection(index) {
    if (!this.sectionToggleButtons || !this.sectionToggleButtons[index]) return this;
    
    const button = this.sectionToggleButtons[index];
    const section = button.closest('.section');
    
    if (!section) return this;
    
    const containerSelectors = [
      '.equalizer-container',
      '.recognition-container',
      '.translation-container',
      '.speech-container'
    ];
    
    const container = section.querySelector(containerSelectors[index]);
    
    if (!container) return this;
    
    // Toggle container visibility
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
    
    // Update button text
    button.textContent = container.style.display === 'none' ? '▼' : '▲';
    
    return this;
  }

  /**
   * Show settings modal
   */
  openSettings() {
    if (this.settingsControls.settingsModal) {
      this.settingsControls.settingsModal.classList.add('show');
    }
    
    return this;
  }

  /**
   * Hide settings modal
   */
  closeSettings() {
    if (this.settingsControls.settingsModal) {
      this.settingsControls.settingsModal.classList.remove('show');
    }
    
    return this;
  }

  /**
   * Show error notification
   * @param {string} title - The notification title
   * @param {string} message - The notification message
   */
  showErrorNotification(title, message) {
    return this._showNotification(title, message, 'error');
  }

  /**
   * Show success notification
   * @param {string} message - The notification message
   */
  showSuccessNotification(message) {
    return this._showNotification('Success', message, 'success');
  }

  /**
   * Clear the transcript
   */
  clearTranscript() {
    if (this.recognitionControls.transcript) {
      this.recognitionControls.transcript.innerHTML = '';
    }
    
    return this;
  }

  /**
   * Update transcript with recognition result
   * @param {Object} result - The recognition result
   * @param {string} result.transcript - The transcript text
   * @param {boolean} result.isFinal - Whether the result is final
   */
  updateTranscript(result) {
    if (!this.recognitionControls.transcript) return this;
    
    if (result.isFinal) {
      this.recognitionControls.transcript.innerHTML += `<p>${result.transcript}</p>`;
      this.recognitionControls.transcript.scrollTop = this.recognitionControls.transcript.scrollHeight;
    } else {
      // Show interim results with different style
      const existingText = this.recognitionControls.transcript.innerHTML.split('<p class="interim">')[0];
      this.recognitionControls.transcript.innerHTML = `${existingText}<p class="interim">${result.transcript}</p>`;
      this.recognitionControls.transcript.scrollTop = this.recognitionControls.transcript.scrollHeight;
    }
    
    return this;
  }

  /**
   * Update translation result
   * @param {string} translation - The translation text
   */
  updateTranslation(translation) {
    if (this.translationControls.translationResult) {
      this.translationControls.translationResult.innerHTML = `<p>${translation}</p>`;
      this.translationControls.translationResult.scrollTop = this.translationControls.translationResult.scrollHeight;
    }
    
    return this;
  }

  /**
   * Set translation loading state
   */
  setTranslationLoading() {
    if (this.translationControls.translationResult) {
      this.translationControls.translationResult.innerHTML = '<p class="loading">Translating...</p>';
    }
    
    return this;
  }

  /**
   * Set translation error state
   * @param {string} error - The error message
   */
  setTranslationError(error) {
    if (this.translationControls.translationResult) {
      this.translationControls.translationResult.innerHTML = `<p class="error">Translation failed: ${error}</p>`;
    }
    
    return this;
  }

  /**
   * Copy translation to clipboard
   * @param {string} translation - The translation text
   * @returns {Promise<boolean>} - Whether the copy was successful
   */
  async copyTranslation(translation) {
    if (!translation) return false;
    
    try {
      await navigator.clipboard.writeText(translation);
      this.showSuccessNotification('Translation copied to clipboard');
      return true;
    } catch (error) {
      console.error('Failed to copy translation:', error);
      this.showErrorNotification('Failed to Copy', 'Could not copy translation to clipboard');
      return false;
    }
  }

  /**
   * Clean up the UI controller
   */
  cleanup() {
    // Add cleanup code if needed
  }

  // Private methods

  /**
   * Update UI state based on internal state
   * @private
   */
  _updateUIState() {
    // Update capture buttons
    if (this.captureControls.startBtn) {
      this.captureControls.startBtn.disabled = this.isCapturing;
    }
    
    if (this.captureControls.stopBtn) {
      this.captureControls.stopBtn.disabled = !this.isCapturing;
    }
    
    // Update translation button
    if (this.translationControls.translateBtn) {
      this.translationControls.translateBtn.disabled = this.isTranslating;
    }
    
    // Update speech buttons
    if (this.speechControls.speakBtn) {
      this.speechControls.speakBtn.disabled = this.isSpeaking;
    }
    
    if (this.speechControls.stopSpeechBtn) {
      this.speechControls.stopSpeechBtn.disabled = !this.isSpeaking;
    }
    
    // Update status icon
    if (this.statusIcon) {
      if (this.isCapturing) {
        this.statusIcon.className = 'status-icon active';
      } else {
        this.statusIcon.className = 'status-icon';
      }
    }
  }

  /**
   * Get the current state
   * @returns {Object} - The current state
   * @private
   */
  _getState() {
    return {
      isCapturing: this.isCapturing,
      isRecognizing: this.isRecognizing,
      isTranslating: this.isTranslating,
      isSpeaking: this.isSpeaking
    };
  }

  /**
   * Get the current equalizer settings
   * @returns {Object} - The equalizer settings
   * @private
   */
  _getEqualizerSettings() {
    if (!this.equalizerControls.sliders) {
      return {
        band1: 0,
        band2: 0,
        band3: 0,
        band4: 0,
        band5: 0,
        band6: 0
      };
    }
    
    return {
      band1: parseInt(this.equalizerControls.sliders[0]?.value || 0),
      band2: parseInt(this.equalizerControls.sliders[1]?.value || 0),
      band3: parseInt(this.equalizerControls.sliders[2]?.value || 0),
      band4: parseInt(this.equalizerControls.sliders[3]?.value || 0),
      band5: parseInt(this.equalizerControls.sliders[4]?.value || 0),
      band6: parseInt(this.equalizerControls.sliders[5]?.value || 0)
    };
  }

  /**
   * Get the current speech settings
   * @returns {Object} - The speech settings
   * @private
   */
  _getSpeechSettings() {
    return {
      voice: this.speechControls.voiceSelect ? 
        parseInt(this.speechControls.voiceSelect.value) : null,
      rate: this.speechControls.rateSlider ? 
        parseFloat(this.speechControls.rateSlider.value) : 1.0,
      pitch: this.speechControls.pitchSlider ? 
        parseFloat(this.speechControls.pitchSlider.value) : 1.0,
      volume: this.speechControls.volumeSlider ? 
        parseFloat(this.speechControls.volumeSlider.value) : 1.0,
      autoSpeak: this.speechControls.autoSpeakCheckbox ? 
        this.speechControls.autoSpeakCheckbox.checked : true
    };
  }

  /**
   * Get the current translation settings
   * @returns {Object} - The translation settings
   * @private
   */
  _getTranslationSettings() {
    return {
      sourceLang: this.recognitionControls.sourceLangSelect ? 
        this.recognitionControls.sourceLangSelect.value : 'en-US',
      targetLang: this.translationControls.targetLangSelect ? 
        this.translationControls.targetLangSelect.value : 'es',
      autoTranslate: this.translationControls.autoTranslateCheckbox ? 
        this.translationControls.autoTranslateCheckbox.checked : true
    };
  }

  /**
   * Get the current UI settings
   * @returns {Object} - The UI settings
   * @private
   */
  _getUISettings() {
    return {
      visualizer: this.settingsControls.showVisualizerCheckbox ? 
        this.settingsControls.showVisualizerCheckbox.checked : true,
      compactMode: this.settingsControls.compactModeCheckbox ? 
        this.settingsControls.compactModeCheckbox.checked : false,
      theme: document.body.dataset.theme || 'light'
    };
  }

  /**
   * Show a notification
   * @param {string} title - The notification title
   * @param {string} message - The notification message
   * @param {string} type - The notification type ('error', 'success')
   * @returns {HTMLElement} - The notification element
   * @private
   */
  _showNotification(title, message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-header">
        <h3>${title}</h3>
        <button class="btn icon-btn close-btn">×</button>
      </div>
      <div class="notification-body">
        <p>${message}</p>
      </div>
    `;
    
    // Create notifications container if it doesn't exist
    let notificationsContainer = document.getElementById('notifications-container');
    
    if (!notificationsContainer) {
      notificationsContainer = document.createElement('div');
      notificationsContainer.id = 'notifications-container';
      notificationsContainer.className = 'notifications-container';
      document.body.appendChild(notificationsContainer);
    }
    
    // Add notification to container
    notificationsContainer.appendChild(notification);
    
    // Add close button event listener
    const closeBtn = notification.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
      notification.classList.add('closing');
      setTimeout(() => {
        notification.remove();
        
        // Remove container if empty
        if (notificationsContainer.childElementCount === 0) {
          notificationsContainer.remove();
        }
      }, 300);
    });
    
    // Auto-close after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('closing');
        setTimeout(() => {
          notification.remove();
          
          // Remove container if empty
          if (notificationsContainer.childElementCount === 0) {
            notificationsContainer.remove();
          }
        }, 300);
      }
    }, 5000);
    
    return notification;
  }
}

// Export the UIController class
window.UIController = UIController;