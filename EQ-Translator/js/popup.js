
// Handle translation result
function handleTranslationResult(result) {
  // Update translation UI
  currentTranslation = result.translatedText;
  uiController.updateTranslation(result.translatedText);
  
  // Update state
  uiController.updateState({ isTranslating: false });
  uiController.setStatus('Translation completed', 'success');
  
  // Show success notification
  uiController.showSuccessNotification('Translation completed');
  
  // Auto-speak if enabled
  if (document.getElementById('auto-speak-checkbox').checked) {
    speakTranslation(result.translatedText);
  }
}

// Handle translation error
function handleTranslationError(error) {
  console.error('Translation error:', error);
  uiController.setTranslationError(error.error);
  uiController.showErrorNotification('Translation Failed', error.error);
  uiController.updateState({ isTranslating: false });
  uiController.setStatus('Translation failed', 'error');
}

// Speak translation
async function speakTranslation(text) {
  if (!text || text.trim() === '') {
    return;
  }
  
  try {
    uiController.updateState({ isSpeaking: true });
    uiController.setStatus('Speaking...', 'pending');
    
    // Configure speech settings
    speechSynthesizer.setLanguage(document.getElementById('target-language').value);
    
    const voiceSelect = document.getElementById('voice-select');
    if (voiceSelect.value) {
      speechSynthesizer.setVoice(parseInt(voiceSelect.value));
    }
    
    speechSynthesizer.setRate(parseFloat(document.getElementById('speech-rate').value));
    speechSynthesizer.setPitch(parseFloat(document.getElementById('speech-pitch').value));
    speechSynthesizer.setVolume(parseFloat(document.getElementById('speech-volume').value));
    
    // Speak the text
    speechSynthesizer.speak(text);
  } catch (error) {
    console.error('Speech synthesis error:', error);
    uiController.showErrorNotification('Speech Synthesis Error', error.message);
    uiController.updateState({ isSpeaking: false });
    uiController.setStatus('Speech failed', 'error');
  }
}

// Stop speech
function stopSpeech() {
  speechSynthesizer.stop();
  uiController.updateState({ isSpeaking: false });
  uiController.setStatus('Ready', 'success');
}

// Clear transcript
function clearTranscript() {
  uiController.clearTranscript();
  currentTranscript = '';
}

// Handle settings changed
function handleSettingsChanged(section, settings) {
  // Save settings to storage
  storageManager.saveSettings(section, settings);
  
  // Apply settings as needed
  switch (section) {
    case 'equalizer':
      // Update equalizer if capturing
      if (captureManager.isActive() && audioProcessor.isInitialized) {
        audioProcessor.updateEqualizer(settings);
      }
      break;
      
    case 'ui':
      // Toggle visualizer
      if (settings.visualizer !== undefined) {
        if (settings.visualizer && captureManager.isActive()) {
          // Start visualizer
          const analyser = audioProcessor.getAnalyser();
          if (analyser) {
            visualizer.start(analyser);
          }
        } else {
          // Stop visualizer
          visualizer.stop();
        }
      }
      break;
  }
}

// Update equalizer settings
function updateEqualizerSettings() {
  // Get settings from UI
  const settings = uiController.getEqualizerSettings();
  
  // Save and apply settings
  handleSettingsChanged('equalizer', settings);
}

// Update language settings
function updateLanguageSettings() {
  // Get settings from UI
  const settings = uiController.getTranslationSettings();
  
  // Update speech recognizer
  if (speechRecognizer && uiController.getState().isRecognizing) {
    speechRecognizer.setLanguage(settings.sourceLang);
  }
  
  // Update translation service
  translationService.setLanguages(
    settings.sourceLang.split('-')[0],
    settings.targetLang
  );
  
  // Update speech synthesizer
  speechSynthesizer.setLanguage(settings.targetLang);
  
  // Save settings
  storageManager.saveSettings('translation', settings);
  
  // Re-populate voice list for new target language
  populateVoiceList();
}

// Update speech settings
function updateSpeechSettings() {
  // Get settings from UI
  const settings = uiController.getSpeechSettings();
  
  // Update speech synthesizer
  if (settings.voice !== null) {
    speechSynthesizer.setVoice(settings.voice);
  }
  
  speechSynthesizer.setRate(settings.rate);
  speechSynthesizer.setPitch(settings.pitch);
  speechSynthesizer.setVolume(settings.volume);
  
  // Save settings
  storageManager.saveSettings('speech', {
    synthesis: settings
  });
}

// Update translation settings
function updateTranslationSettings() {
  const autoTranslate = document.getElementById('auto-translate-checkbox').checked;
  
  // Save settings
  storageManager.saveSettings('translation', {
    autoTranslate: autoTranslate
  });
}

// Update UI settings
function updateUISettings() {
  // Get settings from UI
  const settings = uiController.getUISettings();
  
  // Apply settings
  uiController.setCompactMode(settings.compactMode);
  
  // Toggle visualizer based on setting
  if (settings.visualizer && captureManager.isActive()) {
    // Start visualizer
    const analyser = audioProcessor.getAnalyser();
    if (analyser) {
      visualizer.start(analyser);
    }
  } else {
    // Stop visualizer
    visualizer.stop();
  }
  
  // Save settings
  storageManager.saveSettings('ui', settings);
}

// Save API key
async function saveApiKey() {
  const apiKey = document.getElementById('api-key-input').value.trim();
  
  if (apiKey) {
    try {
      await translationService.saveApiKey(apiKey);
      document.getElementById('api-key-input').value = '';
      uiController.showSuccessNotification('API key saved successfully');
    } catch (error) {
      console.error('Error saving API key:', error);
      uiController.showErrorNotification('Failed to save API key', error.message);
    }
  }
}

// Export settings
async function exportSettings() {
  try {
    const settingsJson = await storageManager.exportSettings();
    
    // Create a download link
    const blob = new Blob([settingsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eq-translator-settings.json';
    a.click();
    
    // Clean up
    URL.revokeObjectURL(url);
    
    uiController.showSuccessNotification('Settings exported successfully');
  } catch (error) {
    console.error('Error exporting settings:', error);
    uiController.showErrorNotification('Failed to export settings', error.message);
  }
}

// Import settings
async function importSettings() {
  try {
    // Create file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    
    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      
      if (file) {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
          try {
            const settingsJson = e.target.result;
            const success = await storageManager.importSettings(settingsJson);
            
            if (success) {
              uiController.showSuccessNotification('Settings imported successfully');
              await loadSettings();
            } else {
              uiController.showErrorNotification('Failed to import settings', 'Invalid settings file');
            }
          } catch (error) {
            console.error('Error importing settings:', error);
            uiController.showErrorNotification('Failed to import settings', error.message);
          }
        };
        
        reader.readAsText(file);
      }
    });
    
    fileInput.click();
  } catch (error) {
    console.error('Error importing settings:', error);
    uiController.showErrorNotification('Failed to import settings', error.message);
  }
}

// Reset settings
async function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to default?')) {
    try {
      await storageManager.resetSettings();
      await loadSettings();
      uiController.showSuccessNotification('Settings reset to defaults');
    } catch (error) {
      console.error('Error resetting settings:', error);
      uiController.showErrorNotification('Failed to reset settings', error.message);
    }
  }
}

// Populate voice select dropdown
function populateVoiceList() {
  // Get available voices
  const voices = speechSynthesizer.getVoices();
  
  // Get voice select element
  const voiceSelect = document.getElementById('voice-select');
  
  // Clear dropdown
  voiceSelect.innerHTML = '';
  
  // Get target language
  const targetLang = document.getElementById('target-language').value;
  
  // Add voices to dropdown
  voices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${voice.name} (${voice.lang})`;
    
    // Set as selected if it matches the target language
    if (voice.lang.startsWith(targetLang)) {
      option.selected = true;
    }
    
    voiceSelect.appendChild(option);
  });
}

// Clean up when popup closes
window.addEventListener('unload', () => {
  if (captureManager && captureManager.isActive()) {
    captureManager.stopCapture().catch(console.error);
  }
  
  if (visualizer) {
    visualizer.cleanup();
  }
  
  if (uiController) {
    uiController.cleanup();
  }
});