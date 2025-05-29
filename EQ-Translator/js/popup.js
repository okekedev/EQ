// EQ Translator Popup Script with API Interception Magic - Complete Optimized Version

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

// Audio monitoring
let audioMonitoringInterval = null;

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize the UI first to show loading state
    initializeUI();
    
    // Initialize enhanced services with API interception
    await initializeEnhancedServices();
    
    // Load settings
    await loadSettings();
    
    // Setup event listeners
    setupEventListeners();
    setupAPIInterceptionEventListeners();
    
    // Check for existing capture status from background
    checkCaptureStatus();
    
    // Set status to ready
    uiController.setStatus('🎯 Ready for API Interception Magic!', 'success');
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
  uiController.setStatus('Initializing API Interception...', 'pending');
}

// Initialize enhanced services with API interception
async function initializeEnhancedServices() {
  // Create storage manager
  storageManager = new StorageManager();
  await storageManager.initialize();
  
  // Create enhanced audio processor with API interception
  audioProcessor = new APIInterceptionAudioProcessor();
  
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
      
      // Start audio monitoring if enabled
      if (document.getElementById('enable-audio-monitoring-checkbox')?.checked !== false) {
        startAudioMonitoring();
      }
    })
    .setOnCaptureStopped(() => {
      uiController.updateState({ isCapturing: false });
      uiController.setStatus('Ready', 'success');
      
      // Stop everything
      visualizer.stop();
      stopAudioMonitoring();
      stopVirtualMicrophoneInterception();
    })
    .setOnCaptureError((error) => {
      console.error('Capture error:', error);
      uiController.updateState({ isCapturing: false });
      uiController.setStatus('Capture error', 'error');
      uiController.showErrorNotification('Capture Error', error.message || 'Unknown error');
    });
  
  // Create visualizer
  visualizer = new Visualizer(document.getElementById('audio-visualizer'));
  
  // Create enhanced speech recognizer with interception support
  speechRecognizer = new InterceptingSpeechRecognizer();
  await initializeEnhancedSpeechRecognizer();
  
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
  
  // Populate voice list
  populateVoiceList();
  
  console.log('🎯 All services initialized with API interception support!');
}

// Enhanced speech recognizer initialization
async function initializeEnhancedSpeechRecognizer() {
  try {
    speechRecognizer.initialize();
    
    // Set audio processor for interception
    speechRecognizer.setAudioProcessor(audioProcessor);
    
    // Set enhanced recognition result handler
    speechRecognizer.onResult(handleRecognitionResultWithInterception);
    
    speechRecognizer.onError((error) => {
      console.error('Recognition error:', error);
      uiController.setStatus('Recognition error', 'error');
      uiController.showErrorNotification('Recognition Error', error.message);
      uiController.updateState({ isRecognizing: false });
      updateRecognitionSourceIndicator('error');
    });
    
    console.log('✅ Enhanced speech recognizer initialized with API interception support');
    
  } catch (error) {
    console.error('❌ Failed to initialize enhanced speech recognizer:', error);
  }
}

// Initialize API interception support
async function initializeAPIInterception() {
  try {
    if (audioProcessor) {
      console.log('🎯 Initializing API interception...');
      
      // The audioProcessor now includes the SmartAudioInterceptor
      // Test if everything is ready
      const status = audioProcessor.getInterceptionStatus();
      console.log('API Interception Status:', status);
      
      return true;
    }
  } catch (error) {
    console.error('❌ Error initializing API interception:', error);
    return false;
  }
}

// Start virtual microphone with API interception
async function startVirtualMicrophoneWithInterception() {
  try {
    uiController.setStatus('Starting virtual microphone with API interception...', 'pending');
    
    if (!audioProcessor || !audioProcessor.isInitialized) {
      throw new Error('Audio processor not ready');
    }

    // Start the API interception magic!
    const result = await audioProcessor.startVirtualMicrophoneInterception();
    
    if (result.success) {
      console.log('🎯 MAGIC ACTIVATED!', result.message);
      uiController.setStatus('Virtual microphone active (API intercepted)', 'active');
      uiController.showSuccessNotification('🎯 API Interception Active!', 'Speech Recognition will now use your EQ-processed audio!');
      
      // Update UI to show interception status
      updateInterceptionStatus(true);
      
      return true;
    } else {
      throw new Error(result.message || 'API interception failed');
    }

  } catch (error) {
    console.error('❌ Virtual microphone interception failed:', error);
    uiController.showErrorNotification('API Interception Failed', error.message);
    uiController.setStatus('Interception failed', 'error');
    return false;
  }
}

// Stop virtual microphone interception
function stopVirtualMicrophoneInterception() {
  try {
    if (audioProcessor) {
      audioProcessor.stopVirtualMicrophoneInterception();
      uiController.setStatus('API interception stopped', 'success');
      updateInterceptionStatus(false);
      console.log('🔄 API interception stopped');
    }
  } catch (error) {
    console.error('❌ Error stopping interception:', error);
  }
}

// Update interception status in UI
function updateInterceptionStatus(isActive) {
  const statusElement = document.getElementById('api-interception-status');
  if (statusElement) {
    if (isActive) {
      statusElement.textContent = 'API Interception: ACTIVE';
      statusElement.className = 'status-badge api-intercepted';
    } else {
      statusElement.textContent = 'API Interception: INACTIVE';
      statusElement.className = 'status-badge';
    }
  }
  
  // Show magic indicator
  const magicIndicator = document.getElementById('magic-indicator');
  if (magicIndicator) {
    magicIndicator.style.display = isActive ? 'inline-block' : 'none';
  }
}

// Enhanced start capture with API interception
async function startCaptureWithAPIInterception() {
  try {
    uiController.setStatus('Starting capture with API interception...', 'pending');
    
    // Get current tab ID
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }
    
    const tabId = tabs[0].id;
    
    // Start capturing audio from the tab
    await captureManager.startCapture(tabId);
    
    // Initialize API interception
    await initializeAPIInterception();
    
    // Start virtual microphone with API interception
    const interceptionStarted = await startVirtualMicrophoneWithInterception();
    
    if (interceptionStarted) {
      // Configure speech recognizer
      speechRecognizer.configure({
        sourceLang: document.getElementById('source-language').value,
        interimResults: true,
        continuousMode: true
      });
      
      // Start speech recognition - it will now use intercepted processed audio!
      if (!uiController.getState().isRecognizing) {
        await startRecognitionWithInterception();
      }
      
      // Start visualizer if enabled
      if (document.getElementById('show-visualizer-checkbox').checked) {
        const analyser = audioProcessor.getAnalyser();
        if (analyser) {
          visualizer.start(analyser);
        }
      }
      
      // Start audio monitoring
      if (document.getElementById('enable-audio-monitoring-checkbox')?.checked !== false) {
        startAudioMonitoring();
      }
      
      uiController.setStatus('🎯 Magic Active: Speech Recognition using EQ-processed audio!', 'active');
    }
    
  } catch (error) {
    console.error('❌ Error starting capture with API interception:', error);
    uiController.showErrorNotification('Capture + Interception Error', error.message);
    uiController.setStatus('Failed to start magic', 'error');
  }
}

// Enhanced start recognition with interception
async function startRecognitionWithInterception() {
  try {
    console.log('🎯 Starting Speech Recognition with API interception...');
    
    // The magic happens here - speechRecognizer.start() will trigger getUserMedia
    // which is now intercepted to return our processed audio!
    await speechRecognizer.start();
    
    uiController.updateState({ isRecognizing: true });
    
    // Check if interception is working
    const config = speechRecognizer.getConfiguration();
    if (config.isUsingInterception) {
      uiController.setStatus('🎯 MAGIC WORKING: Recognition using processed audio!', 'active');
      updateRecognitionSourceIndicator('api-intercepted');
      console.log('✅ SUCCESS: Speech Recognition is using intercepted processed audio!');
    } else {
      uiController.setStatus('Recognition started (checking interception...)', 'active');
      updateRecognitionSourceIndicator('checking');
    }
    
  } catch (error) {
    console.error('❌ Error starting recognition with interception:', error);
    uiController.showErrorNotification('Recognition Error', error.message);
    updateRecognitionSourceIndicator('error');
  }
}

// Enhanced stop capture with interception cleanup
async function stopCaptureWithInterception() {
  try {
    uiController.setStatus('Stopping capture and API interception...', 'pending');
    
    // Stop speech recognition first
    if (uiController.getState().isRecognizing) {
      stopRecognition();
    }
    
    // Stop API interception
    stopVirtualMicrophoneInterception();
    
    // Stop audio monitoring
    stopAudioMonitoring();
    
    // Stop visualizer
    visualizer.stop();
    
    // Stop capture
    await captureManager.stopCapture();
    
    // Reset status
    updateInterceptionStatus(false);
    updateRecognitionSourceIndicator('ready');
    
    uiController.setStatus('Ready', 'success');
    
  } catch (error) {
    console.error('❌ Error stopping capture with interception:', error);
    uiController.showErrorNotification('Stop Error', error.message);
    uiController.setStatus('Error stopping', 'error');
  }
}

// Enhanced recognition result handler with interception info
function handleRecognitionResultWithInterception(result) {
  // Show magic indicator for intercepted results
  if (result.source === 'api-intercepted-processed') {
    console.log('🎯 MAGIC RESULT from processed audio:', result.transcript);
    
    // Update transcript UI with clean text
    uiController.updateTranscript({
      ...result,
      transcript: result.transcript // Keep it clean for UI
    });
    
    // Update status to confirm magic is working
    updateRecognitionSourceIndicator('api-intercepted');
    
    // Show success notification for first intercepted result
    if (!window.hasShownInterceptionSuccess) {
      uiController.showSuccessNotification('🎯 MAGIC CONFIRMED!', 'Speech Recognition is using your EQ-processed audio!');
      window.hasShownInterceptionSuccess = true;
    }
    
  } else {
    // Regular result handling
    uiController.updateTranscript(result);
    updateRecognitionSourceIndicator(
      result.source === 'default-microphone' ? 'default-mic' : 'unknown'
    );
  }
  
  // Store current transcript for translation
  if (result.isFinal) {
    currentTranscript = result.transcript;
    
    // Translate if auto-translate is enabled
    if (document.getElementById('auto-translate-checkbox').checked) {
      translateText(result.transcript);
    }
  }
  
  // Log the result with source info
  console.log(`Recognition result from ${result.source}:`, result.transcript);
}

// Enhanced recognition source indicator for interception
function updateRecognitionSourceIndicator(status) {
  const indicator = document.getElementById('recognition-source-indicator');
  if (!indicator) return;
  
  // Remove all status classes
  indicator.classList.remove('virtual-mic', 'default-mic', 'api-intercepted');
  
  switch (status) {
    case 'api-intercepted':
      indicator.textContent = '🎯 Magic Active';
      indicator.classList.add('status-badge', 'api-intercepted');
      indicator.style.backgroundColor = '#ff6b35'; // Special color for magic
      break;
    case 'virtual-mic':
      indicator.textContent = 'Virtual Mic';
      indicator.classList.add('status-badge', 'virtual-mic');
      break;
    case 'default-mic':
      indicator.textContent = 'Default Mic';
      indicator.classList.add('status-badge', 'default-mic');
      break;
    case 'checking':
      indicator.textContent = 'Checking...';
      indicator.classList.add('status-badge');
      indicator.style.backgroundColor = '#f7931e';
      break;
    case 'error':
      indicator.textContent = 'Error';
      indicator.classList.add('status-badge');
      break;
    default:
      indicator.textContent = 'Ready';
      indicator.classList.add('status-badge');
      indicator.style.backgroundColor = '';
  }
}

// Test API interception function (for debugging)
async function testAPIInterception() {
  try {
    console.log('🧪 Testing API interception...');
    
    if (!audioProcessor || !audioProcessor.isInitialized) {
      throw new Error('Audio processor not ready');
    }
    
    const status = audioProcessor.getInterceptionStatus();
    console.log('Interception Status:', status);
    
    if (status && status.isIntercepting) {
      // Test getUserMedia call
      console.log('Testing getUserMedia call...');
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Test stream:', testStream);
      
      // Clean up
      testStream.getTracks().forEach(track => track.stop());
      
      uiController.showSuccessNotification('🧪 Test Complete', 'Check console for results');
    } else {
      uiController.showErrorNotification('Test Failed', 'API interception not active');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    uiController.showErrorNotification('Test Error', error.message);
  }
}

// Load settings from storage (enhanced)
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
    
    // Load API interception settings
    const audioSettings = await storageManager.getSettings('audio');
    if (audioSettings) {
      // Set API interception checkbox
      const useAPIInterceptionCheckbox = document.getElementById('use-api-interception-checkbox');
      if (useAPIInterceptionCheckbox && audioSettings.useAPIInterception !== undefined) {
        useAPIInterceptionCheckbox.checked = audioSettings.useAPIInterception;
      }
      
      // Set virtual microphone gain
      const virtualMicGainSlider = document.getElementById('virtual-mic-gain');
      if (virtualMicGainSlider && audioSettings.virtualMicGain !== undefined) {
        virtualMicGainSlider.value = audioSettings.virtualMicGain;
        updateVirtualMicGainDisplay();
      }
      
      // Set audio monitoring checkbox
      const audioMonitoringCheckbox = document.getElementById('enable-audio-monitoring-checkbox');
      if (audioMonitoringCheckbox && audioSettings.enableAudioMonitoring !== undefined) {
        audioMonitoringCheckbox.checked = audioSettings.enableAudioMonitoring;
      }
    }
    
    // Load equalizer settings
    const eqSettings = await storageManager.getSettings('equalizer');
    
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

// Setup event listeners (enhanced)
function setupEventListeners() {
  // Virtual microphone controls
  const virtualMicGainSlider = document.getElementById('virtual-mic-gain');
  if (virtualMicGainSlider) {
    virtualMicGainSlider.addEventListener('input', updateVirtualMicGainDisplay);
    virtualMicGainSlider.addEventListener('change', updateVirtualMicGain);
  }
  
  const audioMonitoringCheckbox = document.getElementById('enable-audio-monitoring-checkbox');
  if (audioMonitoringCheckbox) {
    audioMonitoringCheckbox.addEventListener('change', updateAudioMonitoringSettings);
  }
  
  // Speech recognition toggle
  const toggleRecognitionButton = document.getElementById('toggle-recognition-button');
  if (toggleRecognitionButton) {
    toggleRecognitionButton.addEventListener('click', toggleRecognition);
  }
  
  // Add EQ reset button event listener
  const resetEqBtn = document.getElementById('reset-eq-btn');
  if (resetEqBtn) {
    resetEqBtn.addEventListener('click', resetEqualizer);
  }
  
  // Add EQ enabled checkbox event listener
  const eqEnabledCheckbox = document.getElementById('eq-enabled-checkbox');
  if (eqEnabledCheckbox) {
    eqEnabledCheckbox.addEventListener('change', toggleEqualizerEnabled);
  }
  
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
    if (button) {
      button.addEventListener('click', () => {
        uiController.toggleSection(index);
      });
    }
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
      
      // Clean up API interception
      stopVirtualMicrophoneInterception();
    }
  });
}

// Add event listeners for API interception
function setupAPIInterceptionEventListeners() {
  // Replace existing capture button listeners
  const startCaptureBtn = document.getElementById('start-capture-btn');
  const stopCaptureBtn = document.getElementById('stop-capture-btn');
  
  if (startCaptureBtn) {
    // Remove existing listeners
    startCaptureBtn.replaceWith(startCaptureBtn.cloneNode(true));
    const newStartBtn = document.getElementById('start-capture-btn');
    
    newStartBtn.addEventListener('click', async () => {
      const useAPIInterception = document.getElementById('use-api-interception-checkbox')?.checked !== false;
      
      if (useAPIInterception) {
        await startCaptureWithAPIInterception();
      } else {
        await startCapture(); // Fallback to original
      }
    });
  }
  
  if (stopCaptureBtn) {
    // Remove existing listeners  
    stopCaptureBtn.replaceWith(stopCaptureBtn.cloneNode(true));
    const newStopBtn = document.getElementById('stop-capture-btn');
    
    newStopBtn.addEventListener('click', async () => {
      await stopCaptureWithInterception();
    });
  }
  
  // Test button
  const testInterceptionBtn = document.getElementById('test-api-interception-btn');
  if (testInterceptionBtn) {
    testInterceptionBtn.addEventListener('click', testAPIInterception);
  }
  
  // API interception checkbox
  const useAPIInterceptionCheckbox = document.getElementById('use-api-interception-checkbox');
  if (useAPIInterceptionCheckbox) {
    useAPIInterceptionCheckbox.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      storageManager.saveSetting('audio', 'useAPIInterception', enabled);
      console.log(`API Interception ${enabled ? 'enabled' : 'disabled'} by default`);
    });
  }
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

// Start capturing audio from the tab (fallback function)
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
    
    uiController.updateState({ isCapturing: true });
    uiController.setStatus('Capturing audio', 'active');
  } catch (error) {
    console.error('Error starting capture:', error);
    uiController.showErrorNotification('Capture Error', error.message);
    uiController.setStatus('Capture failed', 'error');
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

// Start speech recognition (fallback function)
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
    
    // Update recognition source indicator
    updateRecognitionSourceIndicator('ready');
  } catch (error) {
    console.error('Error stopping recognition:', error);
    uiController.showErrorNotification('Recognition Error', error.message);
  }
}

// Virtual microphone gain control functions
function updateVirtualMicGainDisplay() {
  const slider = document.getElementById('virtual-mic-gain');
  const valueLabel = slider?.nextElementSibling;
  
  if (slider && valueLabel) {
    valueLabel.textContent = slider.value;
  }
}

function updateVirtualMicGain() {
  const slider = document.getElementById('virtual-mic-gain');
  if (!slider) return;
  
  const gain = parseFloat(slider.value);
  
  // Update audio processor gain
  if (audioProcessor && audioProcessor.setVirtualAudioGain) {
    audioProcessor.setVirtualAudioGain(gain);
  }
  
  // Save gain setting
  storageManager.saveSetting('audio', 'virtualMicGain', gain);
  
  console.log(`Virtual microphone gain set to: ${gain}`);
  uiController.showSuccessNotification(`Virtual mic gain: ${gain}`);
}

function updateAudioMonitoringSettings() {
  const enableMonitoring = document.getElementById('enable-audio-monitoring-checkbox')?.checked || false;
  
  // Save setting
  storageManager.saveSetting('audio', 'enableAudioMonitoring', enableMonitoring);
  
  // Start or stop monitoring based on setting
  if (enableMonitoring && captureManager.isActive()) {
    startAudioMonitoring();
  } else {
    stopAudioMonitoring();
  }
}

// Audio monitoring functions
function startAudioMonitoring() {
  if (!audioProcessor || !audioProcessor.isInitialized) {
    return;
  }
  
  // Stop existing monitoring
  stopAudioMonitoring();
  
  audioMonitoringInterval = setInterval(() => {
    const metrics = audioProcessor.getAudioMetrics();
    
    if (metrics) {
      // Update volume meter in UI
      updateVolumeDisplay(metrics.volume);
      
      // Log audio levels for debugging (only when significant)
      if (metrics.volume > 0.1) {
        console.log(`Audio level: ${(metrics.volume * 100).toFixed(1)}%`);
      }
    }
  }, 100); // Update every 100ms for smooth meter
  
  console.log('Audio monitoring started');
}

function stopAudioMonitoring() {
  if (audioMonitoringInterval) {
    clearInterval(audioMonitoringInterval);
    audioMonitoringInterval = null;
    
    // Reset volume display
    updateVolumeDisplay(0);
    
    console.log('Audio monitoring stopped');
  }
}

// Update volume display
function updateVolumeDisplay(volume) {
  const volumeMeter = document.getElementById('volume-meter');
  if (volumeMeter) {
    const percentage = Math.round(volume * 100);
    volumeMeter.style.width = `${percentage}%`;
    volumeMeter.textContent = `${percentage}%`;
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
  
  // Add enabled state to settings
  const eqEnabledCheckbox = document.getElementById('eq-enabled-checkbox');
  if (eqEnabledCheckbox) {
    settings.enabled = eqEnabledCheckbox.checked;
  }
  
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
  const eqEnabledCheckbox = document.getElementById('eq-enabled-checkbox');
  if (!eqEnabledCheckbox) return;
  
  const isEnabled = eqEnabledCheckbox.checked;
  
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

// Enhanced cleanup when popup closes
window.addEventListener('unload', () => {
  // Stop API interception
  stopVirtualMicrophoneInterception();
  
  // Clean up audio monitoring
  stopAudioMonitoring();
  
  if (captureManager && captureManager.isActive()) {
    captureManager.stopCapture().catch(console.error);
  }
  
  if (visualizer) {
    visualizer.cleanup();
  }
  
  if (uiController) {
    uiController.cleanup();
  }
  
  console.log('🧹 Enhanced cleanup completed with API interception cleanup');
});