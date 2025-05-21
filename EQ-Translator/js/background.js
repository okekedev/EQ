// Background service worker for EQ Translator extension

// Store active tab capture session
let activeTabCapture = null;
let audioContext = null;
let mediaStreamSource = null;
let equalizerNode = null;
let analyserNode = null;
let recognitionActive = false;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startCapture':
      startAudioCapture(message.tabId)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Indicates async response

    case 'stopCapture':
      stopAudioCapture();
      sendResponse({ success: true });
      break;

    case 'updateEqualizer':
      updateEqualizerSettings(message.settings);
      sendResponse({ success: true });
      break;

    case 'getStatus':
      sendResponse({
        isCapturing: !!activeTabCapture,
        isRecognizing: recognitionActive
      });
      break;
  }
});

// Start capturing audio from the specified tab
async function startAudioCapture(tabId) {
  // Stop any existing capture session
  stopAudioCapture();

  try {
    // Capture tab audio
    const stream = await chrome.tabCapture.capture({
      audio: true,
      video: false,
      audioConstraints: {
        mandatory: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }
    });

    if (!stream) {
      throw new Error('Failed to capture tab audio');
    }

    // Store the active capture session
    activeTabCapture = stream;

    // Initialize audio processing
    initAudioProcessing(stream);
    
    return true;
  } catch (error) {
    console.error('Error starting audio capture:', error);
    throw error;
  }
}

// Stop the active capture session
function stopAudioCapture() {
  if (activeTabCapture) {
    // Stop all tracks
    activeTabCapture.getTracks().forEach(track => track.stop());
    activeTabCapture = null;
  }

  // Clean up audio context
  if (audioContext) {
    audioContext.close().catch(console.error);
    audioContext = null;
    mediaStreamSource = null;
    equalizerNode = null;
    analyserNode = null;
  }

  // Stop speech recognition if active
  if (recognitionActive) {
    chrome.runtime.sendMessage({ action: 'stopRecognition' });
    recognitionActive = false;
  }
}

// Initialize audio processing pipeline
function initAudioProcessing(stream) {
  // Create audio context
  audioContext = new AudioContext();
  
  // Create media stream source
  mediaStreamSource = audioContext.createMediaStreamSource(stream);
  
  // Create analyzer for visualizations
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 2048;
  
  // Initialize with default equalizer settings
  chrome.storage.local.get('equalizerSettings', (data) => {
    const settings = data.equalizerSettings || getDefaultEqualizerSettings();
    createEqualizerNode(settings);
    
    // Connect the audio processing nodes
    mediaStreamSource.connect(equalizerNode);
    equalizerNode.connect(analyserNode);
    
    // Start speech recognition
    chrome.runtime.sendMessage({ 
      action: 'startRecognition',
      audioContext: audioContext,
      analyserNode: analyserNode
    });
    recognitionActive = true;
  });
}

// Create equalizer node with the specified settings
function createEqualizerNode(settings) {
  // If equalizer exists, disconnect it
  if (equalizerNode) {
    equalizerNode.disconnect();
  }
  
  // Create a new gain node for the equalizer
  equalizerNode = audioContext.createGain();
  
  // Create the 6-band equalizer (lowshelf, 4x peaking, highshelf)
  const bands = [
    { type: 'lowshelf', frequency: 100, gain: settings.band1 },
    { type: 'peaking', frequency: 250, Q: 1, gain: settings.band2 },
    { type: 'peaking', frequency: 500, Q: 1, gain: settings.band3 },
    { type: 'peaking', frequency: 1000, Q: 1, gain: settings.band4 },
    { type: 'peaking', frequency: 4000, Q: 1, gain: settings.band5 },
    { type: 'highshelf', frequency: 8000, gain: settings.band6 }
  ];
  
  // Create and connect each filter in the equalizer
  let prevNode = mediaStreamSource;
  
  bands.forEach(band => {
    const filter = audioContext.createBiquadFilter();
    filter.type = band.type;
    filter.frequency.value = band.frequency;
    filter.gain.value = band.gain;
    
    if (band.Q) {
      filter.Q.value = band.Q;
    }
    
    prevNode.connect(filter);
    prevNode = filter;
  });
  
  // Connect the last filter to the equalizer output
  prevNode.connect(equalizerNode);
}

// Update equalizer settings
function updateEqualizerSettings(settings) {
  if (audioContext && equalizerNode) {
    createEqualizerNode(settings);
    
    // Save settings
    chrome.storage.local.set({ equalizerSettings: settings });
  }
}

// Get default equalizer settings
function getDefaultEqualizerSettings() {
  return {
    band1: 0, // 100 Hz (lowshelf)
    band2: 0, // 250 Hz
    band3: 0, // 500 Hz
    band4: 0, // 1000 Hz
    band5: 0, // 4000 Hz
    band6: 0  // 8000 Hz (highshelf)
  };
}