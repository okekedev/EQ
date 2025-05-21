// Popup UI controller for EQ Translator extension

// Initialize global objects
const audioProcessor = new AudioProcessor();
const speechRecognizer = new SpeechRecognizer();
const translationService = new TranslationService();
const speechSynthesizer = new SpeechSynthesizer();
const storageManager = new StorageManager();

// UI elements
const startCaptureBtn = document.getElementById('start-capture-btn');
const stopCaptureBtn = document.getElementById('stop-capture-btn');
const audioVisualizer = document.getElementById('audio-visualizer');
const statusText = document.getElementById('status-text');
const statusIcon = document.getElementById('status-icon');
const eqSliders = [
  document.getElementById('eq-band1'),
  document.getElementById('eq-band2'),
  document.getElementById('eq-band3'),
  document.getElementById('eq-band4'),
  document.getElementById('eq-band5'),
  document.getElementById('eq-band6')
];
const eqValueLabels = document.querySelectorAll('.eq-value');
const translateBtn = document.getElementById('translate-btn');
const speakBtn = document.getElementById('speak-btn');
const stopSpeechBtn = document.getElementById('stop-speech-btn');
const sourceLangSelect = document.getElementById('source-language');
const targetLangSelect = document.getElementById('target-language');
const transcriptElem = document.getElementById('transcript');
const translationResultElem = document.getElementById('translation-result');
const clearTranscriptBtn = document.getElementById('clear-transcript-btn');
const copyTranslationBtn = document.getElementById('copy-translation-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const voiceSelect = document.getElementById('voice-select');
const speechRateSlider = document.getElementById('speech-rate');
const speechPitchSlider = document.getElementById('speech-pitch');
const speechVolumeSlider = document.getElementById('speech-volume');
const autoTranslateCheckbox = document.getElementById('auto-translate-checkbox');
const autoSpeakCheckbox = document.getElementById('auto-speak-checkbox');
const showVisualizerCheckbox = document.getElementById('show-visualizer-checkbox');
const compactModeCheckbox = document.getElementById('compact-mode-checkbox');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const themeButtons = document.querySelectorAll('.theme-btn');
const eqPresetButtons = document.querySelectorAll('.eq-presets button');
const sectionToggleButtons = [
  document.getElementById('toggle-equalizer-btn'),
  document.getElementById('toggle-recognition-btn'),
  document.getElementById('toggle-translation-btn'),
  document.getElementById('toggle-speech-btn')
];
const resetSettingsBtn = document.getElementById('reset-settings-btn');
const exportSettingsBtn = document.getElementById('export-settings-btn');
const importSettingsBtn = document.getElementById('import-settings-btn');

// State
let isCapturing = false;
let isRecognizing = false;
let isTranslating = false;
let isSpeaking = false;
let activeTabId = null;
let currentTranscript = '';
let currentTranslation = '';
let visualizerContext = null;
let visualizerAnimationFrame = null;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize audio visualizer
    initializeVisualizer();
    
    // Initialize storage
    await storageManager.initialize();
    
    // Load settings
    await loadSettings();
    
    // Initialize translation service
    await translationService.initialize();
    
    // Initialize speech synthesizer and load voices
    await speechSynthesizer.initialize();
    populateVoiceList();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set initial UI state
    updateUIState();
    
    // Add error handling for extension initialization
    setStatus('Ready', 'success');
  } catch (error) {
    console.error('Initialization error:', error);
    setStatus('Error initializing extension', 'error');
    showErrorNotification('Failed to initialize extension', error.message);
  }
});

// Initialize the audio visualizer
function initializeVisualizer() {
  const canvas = audioVisualizer;
  visualizerContext = canvas.getContext('2d');
  
  // Set canvas size to match container
  resizeVisualizer();
  
  // Listen for window resize
  window.addEventListener('resize', resizeVisualizer);
}

// Resize visualizer canvas
function resizeVisualizer() {
  const container = audioVisualizer.parentElement;
  audioVisualizer.width = container.clientWidth;
  audioVisualizer.height = container.clientHeight;
}

// Draw visualizer
function drawVisualizer(dataArray) {
  if (!visualizerContext || !showVisualizerCheckbox.checked) {
    return;
  }
  
  const width = audioVisualizer.width;
  const height = audioVisualizer.height;
  const bufferLength = dataArray.length;
  
  // Clear canvas
  visualizerContext.clearRect(0, 0, width, height);
  
  // Draw frequency bars
  const barWidth = width / bufferLength * 2.5;
  let x = 0;
  
  for (let i = 0; i < bufferLength; i++) {
    const barHeight = dataArray[i] / 255 * height;
    
    // Use gradient color based on frequency
    const hue = i / bufferLength * 180 + 200;
    visualizerContext.fillStyle = `hsl(${hue}, 80%, 50%)`;
    
    visualizerContext.fillRect(x, height - barHeight, barWidth, barHeight);
    x += barWidth + 1;
  }
  
  // Request next frame
  visualizerAnimationFrame = requestAnimationFrame(() => {
    if (audioProcessor.getAnalyser()) {
      const dataArray = new Uint8Array(audioProcessor.getAnalyser().frequencyBinCount);
      audioProcessor.getAnalyser().getByteFrequencyData(dataArray);
      drawVisualizer(dataArray);
    }
  });
}

// Setup event listeners
function setupEventListeners() {
  // Audio capture controls
  startCaptureBtn.addEventListener('click', startCapture);
  stopCaptureBtn.addEventListener('click', stopCapture);
  
  // Equalizer sliders
  eqSliders.forEach((slider, index) => {
    slider.addEventListener('input', () => {
      updateEqualizerValue(index);
      updateEqualizerSettings();
    });
  });
  
  // Equalizer presets
  eqPresetButtons.forEach(button => {
    button.addEventListener('click', () => {
      applyEqualizerPreset(button.dataset.preset);
    });
  });
  
  // Language selectors
  sourceLangSelect.addEventListener('change', () => {
    updateLanguageSettings();
  });
  
  targetLangSelect.addEventListener('change', () => {
    updateLanguageSettings();
  });
  
  // Translation controls
  translateBtn.addEventListener('click', () => {
    translateText(currentTranscript);
  });
  
  autoTranslateCheckbox.addEventListener('change', () => {
    updateTranslationSettings();
  });
  
  // Speech controls
  speakBtn.addEventListener('click', () => {
    speakTranslation(currentTranslation);
  });
  
  stopSpeechBtn.addEventListener('click', () => {
    stopSpeech();
  });
  
  autoSpeakCheckbox.addEventListener('change', () => {
    updateSpeechSettings();
  });
  
  // Speech synthesis settings
  voiceSelect.addEventListener('change', () => {
    updateSpeechSettings();
  });
  
  speechRateSlider.addEventListener('input', () => {
    updateSpeechSliderValue(speechRateSlider, 'rate');
    updateSpeechSettings();
  });
  
  speechPitchSlider.addEventListener('input', () => {
    updateSpeechSliderValue(speechPitchSlider, 'pitch');
    updateSpeechSettings();
  });
  
  speechVolumeSlider.addEventListener('input', () => {
    updateSpeechSliderValue(speechVolumeSlider, 'volume');
    updateSpeechSettings();
  });
  
  // Transcript controls
  clearTranscriptBtn.addEventListener('click', clearTranscript);
  copyTranslationBtn.addEventListener('click', copyTranslation);
  
  // Section toggle buttons
  sectionToggleButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      toggleSection(button, index);
    });
  });
  
  // Settings modal
  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  
  // Theme selection
  themeButtons.forEach(button => {
    button.addEventListener('click', () => {
      setTheme(button.dataset.theme);
    });
  });
  
  // API key
  saveApiKeyBtn.addEventListener('click', saveApiKey);
  
  // Settings export/import
  exportSettingsBtn.addEventListener('click', exportSettings);
  importSettingsBtn.addEventListener('click', importSettings);
  resetSettingsBtn.addEventListener('click', resetSettings);
  
  // UI settings
  showVisualizerCheckbox.addEventListener('change', () => {
    updateUISettings();
  });
  
  compactModeCheckbox.addEventListener('change', () => {
    updateUISettings();
  });
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Handle messages from background script
function handleMessage(message) {
  switch (message.action) {
    case 'recognition-result':
      handleRecognitionResult(message.result);
      break;
    
    case 'translation-result':
      handleTranslationResult(message.result);
      break;
    
    case 'error':
      handleError(message.error);
      break;
  }
}

// Start audio capture
async function startCapture() {
  try {
    setStatus('Starting capture...', 'pending');
    
    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tabs[0].id;
    
    // Request tab capture
    const response = await chrome.runtime.sendMessage({
      action: 'startCapture',
      tabId: activeTabId
    });
    
    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to start audio capture');
    }
    
    // Update state
    isCapturing = true;
    updateUIState();
    
    // Start speech recognition
    startRecognition();
    
    setStatus('Capturing audio', 'active');
  } catch (error) {
    console.error('Error starting capture:', error);
    setStatus('Capture failed', 'error');
    showErrorNotification('Failed to start audio capture', error.message);
  }
}

// Stop audio capture
async function stopCapture() {
  try {
    setStatus('Stopping capture...', 'pending');
    
    // Stop speech recognition
    stopRecognition();
    
    // Stop audio capture
    await chrome.runtime.sendMessage({ action: 'stopCapture' });
    
    // Update state
    isCapturing = false;
    updateUIState();
    
    // Stop visualizer
    if (visualizerAnimationFrame) {
      cancelAnimationFrame(visualizerAnimationFrame);
      visualizerAnimationFrame = null;
    }
    
    setStatus('Ready', 'success');
  } catch (error) {
    console.error('Error stopping capture:', error);
    setStatus('Error stopping capture', 'error');
    showErrorNotification('Failed to stop audio capture', error.message);
  }
}

// Start speech recognition
function startRecognition() {
  try {
    // Configure speech recognizer
    speechRecognizer.configure({
      sourceLang: sourceLangSelect.value,
      interimResults: true,
      continuousMode: true
    });
    
    // Set up recognition callbacks
    speechRecognizer.onResult(handleRecognitionResult);
    speechRecognizer.onError(handleRecognitionError);
    
    // Start recognition
    speechRecognizer.start();
    
    // Update state
    isRecognizing = true;
    updateUIState();
  } catch (error) {
    console.error('Error starting recognition:', error);
    showErrorNotification('Failed to start speech recognition', error.message);
  }
}

// Stop speech recognition
function stopRecognition() {
  try {
    speechRecognizer.stop();
    isRecognizing = false;
    updateUIState();
  } catch (error) {
    console.error('Error stopping recognition:', error);
  }
}

// Handle speech recognition result
function handleRecognitionResult(result) {
  // Update transcript
  if (result.isFinal) {
    currentTranscript = result.transcript;
    transcriptElem.innerHTML += `<p>${result.transcript}</p>`;
    transcriptElem.scrollTop = transcriptElem.scrollHeight;
    
    // Auto-translate if enabled
    if (autoTranslateCheckbox.checked) {
      translateText(result.transcript);
    }
  } else {
    // Show interim results with different style
    const existingText = transcriptElem.innerHTML.split('<p class="interim">')[0];
    transcriptElem.innerHTML = `${existingText}<p class="interim">${result.transcript}</p>`;
    transcriptElem.scrollTop = transcriptElem.scrollHeight;
  }
}

// Handle speech recognition error
function handleRecognitionError(error) {
  console.error('Recognition error:', error);
  showErrorNotification('Speech Recognition Error', error.message);
  isRecognizing = false;
  updateUIState();
}

// Translate text
async function translateText(text) {
  if (!text || text.trim() === '') {
    return;
  }
  
  try {
    isTranslating = true;
    updateUIState();
    
    setStatus('Translating...', 'pending');
    
    // Add loading indicator
    translationResultElem.innerHTML = '<p class="loading">Translating...</p>';
    
    // Configure translation service
    translationService.setLanguages(
      sourceLangSelect.value.split('-')[0],
      targetLangSelect.value
    );
    
    // Set translation callbacks
    translationService.onTranslation(handleTranslationResult);
    translationService.onError(handleTranslationError);
    
    // Request translation
    await translationService.translate(text);
  } catch (error) {
    console.error('Translation error:', error);
    showErrorNotification('Translation Error', error.message);
    isTranslating = false;
    updateUIState();
  }
}

// Handle translation result
function handleTranslationResult(result) {
  // Update translation
  currentTranslation = result.translatedText;
  translationResultElem.innerHTML = `<p>${result.translatedText}</p>`;
  translationResultElem.scrollTop = translationResultElem.scrollHeight;
  
  // Auto-speak if enabled
  if (autoSpeakCheckbox.checked) {
    speakTranslation(result.translatedText);
  }
  
  isTranslating = false;
  updateUIState();
  setStatus('Translation completed', 'success');
  
  // Show success notification
  showSuccessNotification('Translation completed');
}

// Handle translation error
function handleTranslationError(error) {
  console.error('Translation error:', error);
  translationResultElem.innerHTML = `<p class="error">Translation failed: ${error.error}</p>`;
  
  showErrorNotification('Translation Failed', error.error);
  isTranslating = false;
  updateUIState();
  setStatus('Translation failed', 'error');
}

// Speak translation
async function speakTranslation(text) {
  if (!text || text.trim() === '') {
    return;
  }
  
  try {
    isSpeaking = true;
    updateUIState();
    
    setStatus('Speaking...', 'pending');
    
    // Configure speech settings
    speechSynthesizer.setLanguage(targetLangSelect.value);
    
    if (voiceSelect.value) {
      speechSynthesizer.setVoice(parseInt(voiceSelect.value));
    }
    
    speechSynthesizer.setRate(parseFloat(speechRateSlider.value));
    speechSynthesizer.setPitch(parseFloat(speechPitchSlider.value));
    speechSynthesizer.setVolume(parseFloat(speechVolumeSlider.value));
    
    // Set callbacks
    speechSynthesizer.onStart(() => {
      isSpeaking = true;
      updateUIState();
    });
    
    speechSynthesizer.onEnd(() => {
      isSpeaking = false;
      updateUIState();
      setStatus('Ready', 'success');
    });
    
    speechSynthesizer.onError((error) => {
      console.error('Speech synthesis error:', error);
      showErrorNotification('Speech Synthesis Error', 'Failed to speak translation');
      isSpeaking = false;
      updateUIState();
      setStatus('Speech failed', 'error');
    });
    
    // Speak the text
    speechSynthesizer.speak(text);
  } catch (error) {
    console.error('Speech synthesis error:', error);
    showErrorNotification('Speech Synthesis Error', error.message);
    isSpeaking = false;
    updateUIState();
    setStatus('Speech failed', 'error');
  }
}

// Stop speech
function stopSpeech() {
  speechSynthesizer.stop();
  isSpeaking = false;
  updateUIState();
  setStatus('Ready', 'success');
}

// Clear transcript
function clearTranscript() {
  transcriptElem.innerHTML = '';
  currentTranscript = '';
}

// Copy translation to clipboard
function copyTranslation() {
  if (currentTranslation) {
    navigator.clipboard.writeText(currentTranslation)
      .then(() => {
        showSuccessNotification('Translation copied to clipboard');
      })
      .catch(error => {
        console.error('Failed to copy translation:', error);
        showErrorNotification('Failed to Copy', 'Could not copy translation to clipboard');
      });
  }
}

// Update equalizer slider value display
function updateEqualizerValue(index) {
  const slider = eqSliders[index];
  const valueLabel = eqValueLabels[index];
  valueLabel.textContent = `${slider.value} dB`;
}

// Update equalizer settings
function updateEqualizerSettings() {
  const settings = {
    band1: parseInt(eqSliders[0].value),
    band2: parseInt(eqSliders[1].value),
    band3: parseInt(eqSliders[2].value),
    band4: parseInt(eqSliders[3].value),
    band5: parseInt(eqSliders[4].value),
    band6: parseInt(eqSliders[5].value)
  };
  
  // Save settings
  storageManager.saveSettings('equalizer', settings);
  
  // Update equalizer if capturing
  if (isCapturing) {
    chrome.runtime.sendMessage({
      action: 'updateEqualizer',
      settings: settings
    });
  }
}

// Apply equalizer preset
function applyEqualizerPreset(preset) {
  let settings;
  
  switch (preset) {
    case 'flat':
      settings = [0, 0, 0, 0, 0, 0];
      break;
    case 'bass':
      settings = [8, 4, 0, -2, -2, 0];
      break;
    case 'vocal':
      settings = [-2, -1, 2, 4, 0, -2];
      break;
    case 'treble':
      settings = [-5, -3, 0, 2, 6, 8];
      break;
    default:
      settings = [0, 0, 0, 0, 0, 0];
  }
  
  // Apply settings to sliders
  eqSliders.forEach((slider, index) => {
    slider.value = settings[index];
    updateEqualizerValue(index);
  });
  
  // Update settings
  updateEqualizerSettings();
}

// Update language settings
function updateLanguageSettings() {
  // Update speech recognizer
  if (isRecognizing) {
    speechRecognizer.setLanguage(sourceLangSelect.value);
  }
  
  // Update translation service
  translationService.setLanguages(
    sourceLangSelect.value.split('-')[0],
    targetLangSelect.value
  );
  
  // Update speech synthesizer
  speechSynthesizer.setLanguage(targetLangSelect.value);
  
  // Save settings
  storageManager.saveSettings('translation', {
    sourceLang: sourceLangSelect.value,
    targetLang: targetLangSelect.value
  });
}

// Update speech slider value display
function updateSpeechSliderValue(slider, type) {
  const valueLabel = slider.nextElementSibling;
  valueLabel.textContent = slider.value;
}

// Update speech settings
function updateSpeechSettings() {
  // Get values
  const voiceIndex = voiceSelect.value ? parseInt(voiceSelect.value) : null;
  const rate = parseFloat(speechRateSlider.value);
  const pitch = parseFloat(speechPitchSlider.value);
  const volume = parseFloat(speechVolumeSlider.value);
  const autoSpeak = autoSpeakCheckbox.checked;
  
  // Update speech synthesizer
  if (voiceIndex !== null) {
    speechSynthesizer.setVoice(voiceIndex);
  }
  
  speechSynthesizer.setRate(rate);
  speechSynthesizer.setPitch(pitch);
  speechSynthesizer.setVolume(volume);
  
  // Save settings
  storageManager.saveSettings('speech', {
    synthesis: {
      voice: voiceIndex,
      rate: rate,
      pitch: pitch,
      volume: volume,
      autoSpeak: autoSpeak
    }
  });
}

// Update translation settings
function updateTranslationSettings() {
  // Save settings
  storageManager.saveSettings('translation', {
    autoTranslate: autoTranslateCheckbox.checked
  });
}

// Update UI settings
function updateUISettings() {
  // Apply compact mode
  document.body.classList.toggle('compact-mode', compactModeCheckbox.checked);
  
  // Save settings
  storageManager.saveSettings('ui', {
    visualizer: showVisualizerCheckbox.checked,
    compactMode: compactModeCheckbox.checked
  });
}

// Toggle section visibility
function toggleSection(button, index) {
  // Get the container element
  const section = button.closest('.section');
  const container = section.querySelector(
    ['.equalizer-container', '.recognition-container', '.translation-container', '.speech-container'][index]
  );
  
  // Toggle container visibility
  container.style.display = container.style.display === 'none' ? 'block' : 'none';
  
  // Update button text
  button.textContent = container.style.display === 'none' ? '▼' : '▲';
}

// Populate voice select dropdown
function populateVoiceList() {
  // Get available voices
  const voices = speechSynthesizer.getVoices();
  
  // Clear dropdown
  voiceSelect.innerHTML = '';
  
  // Add voices to dropdown
  voices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${voice.name} (${voice.lang})`;
    
    // Set as selected if it matches the target language
    if (voice.lang.startsWith(targetLangSelect.value)) {
      option.selected = true;
    }
    
    voiceSelect.appendChild(option);
  });
}

// Open settings modal
function openSettings() {
  settingsModal.classList.add('show');
}

// Close settings modal
function closeSettings() {
  settingsModal.classList.remove('show');
}

// Set theme
function setTheme(theme) {
  // Apply theme
  if (theme === 'system') {
    // Use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.dataset.theme = prefersDark ? 'dark' : 'light';
  } else {
    document.body.dataset.theme = theme;
  }
  
  // Save theme setting
  storageManager.saveSettings('ui', { theme });
  
  // Update active button
  themeButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.theme === theme);
  });
}

// Save API key
async function saveApiKey() {
  const apiKey = apiKeyInput.value.trim();
  
  if (apiKey) {
    try {
      await translationService.saveApiKey(apiKey);
      apiKeyInput.value = '';
      showSuccessNotification('API key saved successfully');
    } catch (error) {
      console.error('Error saving API key:', error);
      showErrorNotification('Failed to save API key', error.message);
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
    
    showSuccessNotification('Settings exported successfully');
  } catch (error) {
    console.error('Error exporting settings:', error);
    showErrorNotification('Failed to export settings', error.message);
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
              showSuccessNotification('Settings imported successfully');
              await loadSettings();
            } else {
              showErrorNotification('Failed to import settings', 'Invalid settings file');
            }
          } catch (error) {
            console.error('Error importing settings:', error);
            showErrorNotification('Failed to import settings', error.message);
          }
        };
        
        reader.readAsText(file);
      }
    });
    
    fileInput.click();
  } catch (error) {
    console.error('Error importing settings:', error);
    showErrorNotification('Failed to import settings', error.message);
  }
}

// Reset settings
async function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to default?')) {
    try {
      await storageManager.resetSettings();
      await loadSettings();
      showSuccessNotification('Settings reset to defaults');
    } catch (error) {
      console.error('Error resetting settings:', error);
      showErrorNotification('Failed to reset settings', error.message);
    }
  }
}

// Load settings
async function loadSettings() {
  try {
    // Load equalizer settings
    const eqSettings = await storageManager.getSettings('equalizer');
    
    // Apply equalizer settings to UI
    eqSliders[0].value = eqSettings.band1 || 0;
    eqSliders[1].value = eqSettings.band2 || 0;
    eqSliders[2].value = eqSettings.band3 || 0;
    eqSliders[3].value = eqSettings.band4 || 0;
    eqSliders[4].value = eqSettings.band5 || 0;
    eqSliders[5].value = eqSettings.band6 || 0;
    
    // Update equalizer value labels
    eqSliders.forEach((_, index) => {
      updateEqualizerValue(index);
    });
    
    // Load translation settings
    const translationSettings = await storageManager.getSettings('translation');
    
    // Apply translation settings to UI
    sourceLangSelect.value = translationSettings.sourceLang || 'en-US';
    targetLangSelect.value = translationSettings.targetLang || 'es';
    autoTranslateCheckbox.checked = translationSettings.autoTranslate !== false;
    
    // Load speech settings
    const speechSettings = await storageManager.getSettings('speech');
    const synthSettings = speechSettings.synthesis || {};
    
    // Apply speech settings to UI
    speechRateSlider.value = synthSettings.rate || 1.0;
    speechPitchSlider.value = synthSettings.pitch || 1.0;
    speechVolumeSlider.value = synthSettings.volume || 1.0;
    autoSpeakCheckbox.checked = synthSettings.autoSpeak !== false;
    
    // Update speech slider value labels
    updateSpeechSliderValue(speechRateSlider, 'rate');
    updateSpeechSliderValue(speechPitchSlider, 'pitch');
    updateSpeechSliderValue(speechVolumeSlider, 'volume');
    
    // Load UI settings
    const uiSettings = await storageManager.getSettings('ui');
    
    // Apply UI settings
    showVisualizerCheckbox.checked = uiSettings.visualizer !== false;
    compactModeCheckbox.checked = uiSettings.compactMode === true;
    
    // Apply theme
    setTheme(uiSettings.theme || 'light');
    
    // Apply compact mode
    document.body.classList.toggle('compact-mode', compactModeCheckbox.checked);
  } catch (error) {
    console.error('Error loading settings:', error);
    showErrorNotification('Failed to load settings', error.message);
  }
}

// Update UI state based on current state
function updateUIState() {
  // Update capture buttons
  startCaptureBtn.disabled = isCapturing;
  stopCaptureBtn.disabled = !isCapturing;
  
  // Update translation button
  translateBtn.disabled = !currentTranscript || isTranslating;
  
  // Update speech buttons
  speakBtn.disabled = !currentTranslation || isSpeaking;
  stopSpeechBtn.disabled = !isSpeaking;
  
  // Update status indicator
  if (isCapturing) {
    statusIcon.className = 'status-icon active';
  } else {
    statusIcon.className = 'status-icon';
  }
}

// Set status text and icon
function setStatus(text, state) {
  statusText.textContent = text;
  
  switch (state) {
    case 'active':
      statusIcon.className = 'status-icon active';
      break;
    case 'error':
      statusIcon.className = 'status-icon error';
      break;
    case 'pending':
      statusIcon.className = 'status-icon pending';
      break;
    case 'success':
      statusIcon.className = 'status-icon success';
      break;
    default:
      statusIcon.className = 'status-icon';
  }
}

// Handle general error
function handleError(error) {
  console.error('Error:', error);
  showErrorNotification('Error', error.message || 'An unknown error occurred');
  setStatus('Error', 'error');
}

// Show error notification
function showErrorNotification(title, message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'notification error';
  notification.innerHTML = `
    <div class="notification-header">
      <h3>${title}</h3>
      <button class="btn icon-btn close-btn">×</button>
    </div>
    <div class="notification-body">
      <p>${message}</p>
    </div>
  `;
  
  // Add to document
  showNotification(notification);
}

// Show success notification
function showSuccessNotification(message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'notification success';
  notification.innerHTML = `
    <div class="notification-header">
      <h3>Success</h3>
      <button class="btn icon-btn close-btn">×</button>
    </div>
    <div class="notification-body">
      <p>${message}</p>
    </div>
  `;
  
  // Add to document
  showNotification(notification);
}

// Show notification
function showNotification(notification) {
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
}