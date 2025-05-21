// EQ Translator Popup Script

// Global instances
let storageManager = null;
let audioProcessor = null;
let captureManager = null;
let speechRecognizer = null;
let translationService = null;
let speechSynthesizer = null;
let visualizer = null;
let uiController = null;

// Global state variables
let currentTranscript = '';
let currentTranslation = '';

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize the UI first to show loading state
    initializeUI();
    
    // Initialize all services
    await initializeServices();
    
    // Load settings
    await loadSettings();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check for existing capture status from background
    checkCaptureStatus();
    
    // Set status to ready
    uiController.setStatus('Ready', 'success');
  } catch (error) {
    console.error('Initialization error:', error);
    uiController.showErrorNotification('Initialization Error', error.message);
    uiController.setStatus('Error: ' + error.message, 'error');
  }
});

// Initialize UI controller
function initializeUI() {
  // Create new UI controller
  uiController = new UIController();
  
  // Map DOM elements to UI controller
  uiController.initialize({
    // Status elements
    statusText: document.getElementById('status-text'),
    statusIcon: document.getElementById('status-icon'),
    
    // Capture controls
    startCaptureBtn: document.getElementById('start-capture-btn'),
    stopCaptureBtn: document.getElementById('stop-capture-btn'),
    
    // Equalizer controls
    eqSliders: [
      document.getElementById('eq-band1'),
      document.getElementById('eq-band2'),
      document.getElementById('eq-band3'),
      document.getElementById('eq-band4'),
      document.getElementById('eq-band5'),
      document.getElementById('eq-band6')
    ],
    eqValueLabels: [
      document.querySelector('#eq-band1 + .eq-value'),
      document.querySelector('#eq-band2 + .eq-value'),
      document.querySelector('#eq-band3 + .eq-value'),
      document.querySelector('#eq-band4 + .eq-value'),
      document.querySelector('#eq-band5 + .eq-value'),
      document.querySelector('#eq-band6 + .eq-value')
    ],
    eqPresetButtons: document.querySelectorAll('.eq-presets button'),
    
    // Recognition controls
    sourceLangSelect: document.getElementById('source-language'),
    transcriptElem: document.getElementById('transcript'),
    clearTranscriptBtn: document.getElementById('clear-transcript-btn'),
    
    // Translation controls
    targetLangSelect: document.getElementById('target-language'),
    translateBtn: document.getElementById('translate-btn'),
    autoTranslateCheckbox: document.getElementById('auto-translate-checkbox'),
    translationResultElem: document.getElementById('translation-result'),
    copyTranslationBtn: document.getElementById('copy-translation-btn'),
    
    // Speech controls
    voiceSelect: document.getElementById('voice-select'),
    speechRateSlider: document.getElementById('speech-rate'),
    speechPitchSlider: document.getElementById('speech-pitch'),
    speechVolumeSlider: document.getElementById('speech-volume'),
    autoSpeakCheckbox: document.getElementById('auto-speak-checkbox'),
    speakBtn: document.getElementById('speak-btn'),
    stopSpeechBtn: document.getElementById('stop-speech-btn'),
    
    // Settings controls
    settingsBtn: document.getElementById('settings-btn'),
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    themeButtons: document.querySelectorAll('.theme-btn'),
    showVisualizerCheckbox: document.getElementById('show-visualizer-checkbox'),
    compactModeCheckbox: document.getElementById('compact-mode-checkbox'),
    
    // Section toggle buttons
    sectionToggleButtons: [
      document.getElementById('toggle-equalizer-btn'),
      document.getElementById('toggle-recognition-btn'),
      document.getElementById('toggle-translation-btn'),
      document.getElementById('toggle-speech-btn')
    ]
  });
  
  // Set callbacks
  uiController.setOnSettingsChanged(handleSettingsChanged);
  
  // Initial status
  uiController.setStatus('Initializing...', 'pending');
}

// Initialize services
async function initializeServices() {
  // Create storage manager
  storageManager = new StorageManager();
  await storageManager.initialize();
  
  // Create audio processor
  audioProcessor = new AudioProcessor();
  
  // Create capture manager
  captureManager = new CaptureManager();
  captureManager
    .initialize(audioProcessor)
    .setOnCaptureStarted(() => {
      uiController.updateState({ isCapturing: true });
      uiController.setStatus('Capturing audio', 'active');
      
      // Start visualizer if enabled
      if (document.getElementById('show-visualizer-checkbox').checked) {
        const analyser = audioProcessor.getAnalyser();
        if (analyser) {
          visualizer.start(analyser);
        }
      }
    })
    .setOnCaptureStopped(() => {
      uiController.updateState({ isCapturing: false });
      uiController.setStatus('Ready', 'success');
      
      // Stop visualizer
      visualizer.stop();
    })
    .setOnCaptureError((error) => {
      console.error('Capture error:', error);
      uiController.updateState({ isCapturing: false });
      uiController.setStatus('Capture error', 'error');
      uiController.showErrorNotification('Capture Error', error.message || 'Unknown error');
    });
  
  // Create visualizer
  visualizer = new Visualizer(document.getElementById('audio-visualizer'));
  
  // Create speech recognizer
  speechRecognizer = new SpeechRecognizer();
  
  // Create translation service
  translationService = new TranslationService();
  await translationService.initialize();
  
  // Set translation callbacks
  translationService.onTranslation(handleTranslationResult);
  translationService.onError(handleTranslationError);
  
  // Create speech synthesizer
  speechSynthesizer = new SpeechSynthesizer();
  await speechSynthesizer.initialize();
  
  // Set speech callbacks
  speechSynthesizer.onStart(() => {
    uiController.updateState({ isSpeaking: true });
    uiController.setStatus('Speaking...', 'active');
  });
  
  speechSynthesizer.onEnd(() => {
    uiController.updateState({ isSpeaking: false });
    uiController.setStatus('Ready', 'success');
  });
  
  speechSynthesizer.onError((error) => {
    console.error('Speech synthesis error:', error);
    uiController.updateState({ isSpeaking: false });
    uiController.setStatus('Speech error', 'error');
    uiController.showErrorNotification('Speech Error', 'Failed to synthesize speech');
  });
  
  // Initialize speech recognizer
  try {
    speechRecognizer.initialize();
    
    // Set recognition callbacks
    speechRecognizer.onResult((result) => {
      // Update transcript
      uiController.updateTranscript(result);
      
      // Store current transcript for translation
      if (result.isFinal) {
        currentTranscript = result.transcript;
        
        // Translate if auto-translate is enabled
        if (document.getElementById('auto-translate-checkbox').checked) {
          translateText(result.transcript);
        }
      }
    });
    
    speechRecognizer.onError((error) => {
      console.error('Recognition error:', error);
      uiController.setStatus('Recognition error', 'error');
      uiController.showErrorNotification('Recognition Error', error.message);
      uiController.updateState({ isRecognizing: false });
    });
  } catch (error) {
    console.error('Failed to initialize speech recognizer:', error);
    // Continue, as this is not critical
  }
  
  // Populate voice list
  populateVoiceList();
}

// Load settings from storage
async function loadSettings() {
  try {
    // Load UI settings
    const uiSettings = await storageManager.getSettings('ui');
    if (uiSettings.theme) {
      uiController.setTheme(uiSettings.theme);
    }
    
    if (uiSettings.compactMode !== undefined) {
      uiController.setCompactMode(uiSettings.compactMode);
    }
    
    if (uiSettings.visualizer !== undefined) {
      document.getElementById('show-visualizer-checkbox').checked = uiSettings.visualizer;
    }
    
    // Load equalizer settings
    const eqSettings = await storageManager.getSettings('equalizer');
    
    // Update sliders
    if (eqSettings) {
      const sliders = [
        document.getElementById('eq-band1'),
        document.getElementById('eq-band2'),
        document.getElementById('eq-band3'),
        document.getElementById('eq-band4'),
        document.getElementById('eq-band5'),
        document.getElementById('eq-band6')
      ];
      
      // Update each slider
      sliders.forEach((slider, index) => {
        if (slider) {
          const band = `band${index + 1}`;
          if (eqSettings[band] !== undefined) {
            slider.value = eqSettings[band];
            uiController.updateEqualizerValue(index);
          }
        }
      });
    }
    
    // Load translation settings
    const translationSettings = await storageManager.getSettings('translation');
    
    if (translationSettings) {
      // Set source language
      if (translationSettings.sourceLang) {
        document.getElementById('source-language').value = translationSettings.sourceLang;
      }
      
      // Set target language
      if (translationSettings.targetLang) {
        document.getElementById('target-language').value = translationSettings.targetLang;
      }
      
      // Set auto-translate
      if (translationSettings.autoTranslate !== undefined) {
        document.getElementById('auto-translate-checkbox').checked = translationSettings.autoTranslate;
      }
    }
    
    // Load speech settings
    const speechSettings = await storageManager.getSettings('speech');
    
    if (speechSettings && speechSettings.synthesis) {
      // Set rate
      if (speechSettings.synthesis.rate !== undefined) {
        document.getElementById('speech-rate').value = speechSettings.synthesis.rate;
        uiController.updateSpeechSliderValue(document.getElementById('speech-rate'));
      }
      
      // Set pitch
      if (speechSettings.synthesis.pitch !== undefined) {
        document.getElementById('speech-pitch').value = speechSettings.synthesis.pitch;
        uiController.updateSpeechSliderValue(document.getElementById('speech-pitch'));
      }
      
      // Set volume
      if (speechSettings.synthesis.volume !== undefined) {
        document.getElementById('speech-volume').value = speechSettings.synthesis.volume;
        uiController.updateSpeechSliderValue(document.getElementById('speech-volume'));
      }
      
      // Set auto-speak
      if (speechSettings.synthesis.autoSpeak !== undefined) {
        document.getElementById('auto-speak-checkbox').checked = speechSettings.synthesis.autoSpeak;
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    // Continue with defaults
  }
}

// Setup event listeners
function setupEventListeners() {
  // Capture buttons
  document.getElementById('start-capture-btn').addEventListener('click', startCapture);
  document.getElementById('stop-capture-btn').addEventListener('click', stopCapture);
  
  // Speech recognition toggle
  document.getElementById('toggle-recognition-button').addEventListener('click', toggleRecognition);
  
  // Equalizer sliders
  const eqSliders = document.querySelectorAll('.eq-slider input');
  eqSliders.forEach((slider, index) => {
    slider.addEventListener('input', () => {
      uiController.updateEqualizerValue(index);
    });
    
    slider.addEventListener('change', updateEqualizerSettings);
  });
  
  // Equalizer presets
  const presetButtons = document.querySelectorAll('.eq-presets button');
  presetButtons.forEach(button => {
    button.addEventListener('click', () => {
      const preset = button.dataset.preset;
      uiController.applyEqualizerPreset(preset);
      updateEqualizerSettings();
    });
  });
  
  // Language selectors
  document.getElementById('source-language').addEventListener('change', updateLanguageSettings);
  document.getElementById('target-language').addEventListener('change', updateLanguageSettings);
  
  // Translation controls
  document.getElementById('auto-translate-checkbox').addEventListener('change', updateTranslationSettings);
  document.getElementById('translate-btn').addEventListener('click', () => translateText(currentTranscript));
  document.getElementById('copy-translation-btn').addEventListener('click', () => uiController.copyTranslation(currentTranslation));
  
  // Transcript controls
  document.getElementById('clear-transcript-btn').addEventListener('click', clearTranscript);
  
  // Speech controls
  document.getElementById('voice-select').addEventListener('change', updateSpeechSettings);
  
  const speechSliders = [
    document.getElementById('speech-rate'),
    document.getElementById('speech-pitch'),
    document.getElementById('speech-volume')
  ];
  
  speechSliders.forEach(slider => {
    slider.addEventListener('input', () => {
      uiController.updateSpeechSliderValue(slider);
    });
    
    slider.addEventListener('change', updateSpeechSettings);
  });
  
  document.getElementById('auto-speak-checkbox').addEventListener('change', updateSpeechSettings);
  document.getElementById('speak-btn').addEventListener('click', () => speakTranslation(currentTranslation));
  document.getElementById('stop-speech-btn').addEventListener('click', stopSpeech);
  
  // Section toggle buttons
  const toggleButtons = [
    document.getElementById('toggle-equalizer-btn'),
    document.getElementById('toggle-recognition-btn'),
    document.getElementById('toggle-translation-btn'),
    document.getElementById('toggle-speech-btn')
  ];
  
  toggleButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      uiController.toggleSection(index);
    });
  });
  
  // Settings controls
  document.getElementById('settings-btn').addEventListener('click', () => uiController.openSettings());
  document.getElementById('close-settings-btn').addEventListener('click', () => uiController.closeSettings());
  
  const themeButtons = document.querySelectorAll('.theme-btn');
  themeButtons.forEach(button => {
    button.addEventListener('click', () => {
      uiController.setTheme(button.dataset.theme);
    });
  });
  
  document.getElementById('show-visualizer-checkbox').addEventListener('change', updateUISettings);
  document.getElementById('compact-mode-checkbox').addEventListener('change', updateUISettings);
  
  // Handle message from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'tabClosed' && message.tabId === captureManager.getActiveTabId()) {
      uiController.showErrorNotification('Capture Stopped', 'The tab being captured was closed');
      uiController.updateState({ isCapturing: false });
      uiController.setStatus('Ready', 'success');
      
      // Stop visualizer
      visualizer.stop();
    }
  });
}

// Check capture status from background script
function checkCaptureStatus() {
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response && response.isCapturing) {
      // Update UI to reflect active capture
      uiController.updateState({ isCapturing: true });
      uiController.setStatus('Capturing audio', 'active');
    }
  });
}

// Start capturing audio from the tab
async function startCapture() {
  try {
    uiController.setStatus('Starting capture...', 'pending');
    
    // Get current tab ID
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }
    
    const tabId = tabs[0].id;
    
    // Start capturing audio from the tab
    await captureManager.startCapture(tabId);
    
    // Get the active stream and set it as audio source for speech recognition
    const stream = captureManager.getActiveStream();
    if (stream && speechRecognizer) {
      speechRecognizer.setAudioSource(stream);
    }
    
    // Only start visualizer if enabled
    if (document.getElementById('show-visualizer-checkbox').checked) {
      const analyser = audioProcessor.getAnalyser();
      if (analyser) {
        visualizer.start(analyser);
      }
    }
    
    uiController.updateState({ isCapturing: true });
    uiController.setStatus('Capturing audio', 'active');
  } catch (error) {
    console.error('Error starting capture:', error);
    uiController.showErrorNotification('Capture Error', error.message);
    uiController.setStatus('Capture failed', 'error');
  }
}

// Stop audio capture and speech recognition
async function stopCapture() {
  try {
    uiController.setStatus('Stopping capture...', 'pending');
    
    // Stop speech recognition first if it's running
    if (uiController.getState().isRecognizing) {
      stopRecognition();
    }
    
    // Then stop capture
    await captureManager.stopCapture();
    
    // Reset audio source for speech recognition
    if (speechRecognizer) {
      speechRecognizer.setAudioSource(null);
    }
    
    // Stop visualizer
    visualizer.stop();
    
    uiController.updateState({ isCapturing: false });
    uiController.setStatus('Ready', 'success');
  } catch (error) {
    console.error('Error stopping capture:', error);
    uiController.showErrorNotification('Stop Capture Error', error.message);
    uiController.setStatus('Error stopping capture', 'error');
  }
}

// Toggle speech recognition on/off
function toggleRecognition() {
  if (uiController.getState().isRecognizing) {
    stopRecognition();
  } else {
    // Check if audio capture is active before starting recognition
    if (!captureManager.isActive()) {
      uiController.showErrorNotification('Recognition Error', 
        'Please start audio capture first before enabling speech recognition.');
      return;
    }
    startRecognition();
  }
}

// Start speech recognition
function startRecognition() {
  try {
    // Check if audio capture is active
    if (!captureManager.isActive()) {
      uiController.showErrorNotification('Recognition Error', 
        'Please start audio capture first before enabling speech recognition.');
      return;
    }
    
    // Configure recognizer
    speechRecognizer.configure({
      sourceLang: document.getElementById('source-language').value,
      interimResults: true,
      continuousMode: true
    });
    
    // Start recognition
    speechRecognizer.start();
    
    uiController.updateState({ isRecognizing: true });
    uiController.setStatus('Recognizing speech', 'active');
  } catch (error) {
    console.error('Error starting recognition:', error);
    uiController.showErrorNotification('Recognition Error', error.message);
  }
}

// Stop speech recognition
function stopRecognition() {
  try {
    speechRecognizer.stop();
    uiController.updateState({ isRecognizing: false });
    uiController.setStatus(captureManager.isActive() ? 'Capturing audio' : 'Ready', 
                           captureManager.isActive() ? 'active' : 'success');
  } catch (error) {
    console.error('Error stopping recognition:', error);
    uiController.showErrorNotification('Recognition Error', error.message);
  }
}

// Translate text
async function translateText(text) {
  if (!text || text.trim() === '') {
    return;
  }
  
  try {
    uiController.updateState({ isTranslating: true });
    uiController.setStatus('Translating...', 'pending');
    uiController.setTranslationLoading();
    
    // Get source and target languages
    const sourceLang = document.getElementById('source-language').value.split('-')[0];
    const targetLang = document.getElementById('target-language').value;
    
    // Request translation
    translationService.translate(text, {
      sourceLang: sourceLang,
      targetLang: targetLang
    });
  } catch (error) {
    console.error('Translation error:', error);
    uiController.updateState({ isTranslating: false });
    uiController.setStatus('Translation failed', 'error');
    uiController.setTranslationError(error.message);
    uiController.showErrorNotification('Translation Error', error.message);
  }
}

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
// Add these functions to your popup.js file

// Function to reset equalizer to default values
function resetEqualizer() {
  // Apply flat preset (all values set to 0)
  uiController.applyEqualizerPreset('flat');
  
  // Update settings
  updateEqualizerSettings();
  
  // Show notification
  uiController.showSuccessNotification('Equalizer reset to default values');
}

// Function to toggle equalizer on/off
function toggleEqualizerEnabled() {
  const isEnabled = document.getElementById('eq-enabled-checkbox').checked;
  
  // Enable/disable sliders visually
  const sliderGroup = document.querySelector('.eq-slider-group');
  if (sliderGroup) {
    sliderGroup.classList.toggle('disabled', !isEnabled);
  }
  
  // Enable/disable preset buttons
  const presetButtons = document.querySelectorAll('.eq-presets button');
  presetButtons.forEach(button => {
    button.disabled = !isEnabled;
  });
  
  // Apply bypassed equalizer or current settings
  if (audioProcessor && audioProcessor.isInitialized) {
    if (isEnabled) {
      // Apply current equalizer settings
      const settings = uiController.getEqualizerSettings();
      audioProcessor.updateEqualizer(settings);
    } else {
      // Bypass equalizer (all bands set to 0)
      const flatSettings = {
        band1: 0,
        band2: 0,
        band3: 0,
        band4: 0,
        band5: 0,
        band6: 0
      };
      audioProcessor.updateEqualizer(flatSettings);
    }
  }
  
  // Save the enabled state
  storageManager.saveSettings('equalizer', {
    enabled: isEnabled
  });
  
  // Show notification
  uiController.showSuccessNotification(`Equalizer ${isEnabled ? 'enabled' : 'disabled'}`);
}

// Add these event listeners in the setupEventListeners function
function setupEventListeners() {
  // ... existing code ...
  
  // Add EQ reset button event listener
  document.getElementById('reset-eq-btn').addEventListener('click', resetEqualizer);
  
  // Add EQ enabled checkbox event listener
  document.getElementById('eq-enabled-checkbox').addEventListener('change', toggleEqualizerEnabled);
  
  // ... rest of existing code ...
}

// Modify the loadSettings function to load EQ enabled state
async function loadSettings() {
  try {
    // ... existing code ...
    
    // Load equalizer settings
    const eqSettings = await storageManager.getSettings('equalizer');
    
    // Update sliders
    if (eqSettings) {
      // Set enabled state if available
      if (eqSettings.enabled !== undefined) {
        const eqEnabledCheckbox = document.getElementById('eq-enabled-checkbox');
        if (eqEnabledCheckbox) {
          eqEnabledCheckbox.checked = eqSettings.enabled;
          
          // Apply disabled visual state if needed
          if (!eqSettings.enabled) {
            const sliderGroup = document.querySelector('.eq-slider-group');
            if (sliderGroup) {
              sliderGroup.classList.add('disabled');
            }
            
            // Disable preset buttons
            const presetButtons = document.querySelectorAll('.eq-presets button');
            presetButtons.forEach(button => {
              button.disabled = true;
            });
          }
        }
      }
      
      // ... existing slider update code ...
    }
    
    // ... rest of existing code ...
  } catch (error) {
    console.error('Error loading settings:', error);
    // Continue with defaults
  }
}

// Modify the updateEqualizerSettings function to respect enabled state
function updateEqualizerSettings() {
  // Get settings from UI
  const settings = uiController.getEqualizerSettings();
  
  // Add enabled state to settings
  const isEnabled = document.getElementById('eq-enabled-checkbox').checked;
  settings.enabled = isEnabled;
  
  // Save and apply settings
  handleSettingsChanged('equalizer', settings);
}

// Modify the AudioProcessor class to handle bypass mode
// Add this method to the AudioProcessor class in audio-processor.js
class AudioProcessor {
  // ... existing code ...
  
  // Bypass equalizer (set all bands to 0)
  bypassEqualizer() {
    if (!this.isInitialized) {
      return false;
    }
    
    // Create flat settings
    const flatSettings = {
      band1: 0,
      band2: 0,
      band3: 0,
      band4: 0,
      band5: 0,
      band6: 0
    };
    
    // Apply flat settings
    return this.updateEqualizer(flatSettings);
  }
  
  // ... rest of existing code ...
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