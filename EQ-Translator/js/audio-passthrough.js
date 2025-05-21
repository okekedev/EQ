// Audio passthrough content script for EQ Translator
// This script injects into pages to facilitate audio playback from captured streams

(function() {
  // Flag to avoid re-initialization
  if (window.eqTranslatorInitialized) {
    return;
  }
  
  window.eqTranslatorInitialized = true;
  
  // Create audio context and element when needed
  let audioContext = null;
  let audioElement = null;
  
  // Listen for messages from extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'setupAudioPassthrough') {
      setupAudioPassthrough()
        .then(result => sendResponse({ success: true, result: result }))
        .catch(error => sendResponse({ 
          success: false, 
          error: error.message || 'Unknown error' 
        }));
      return true; // Async response
    }
    
    if (message.action === 'cleanupAudioPassthrough') {
      cleanupAudioPassthrough()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ 
          success: false, 
          error: error.message || 'Unknown error' 
        }));
      return true; // Async response
    }
  });
  
  // Setup audio passthrough
  async function setupAudioPassthrough() {
    try {
      // Create audio context if needed
      if (!audioContext || audioContext.state === 'closed') {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Resume context if needed
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Create audio element if needed
      if (!audioElement) {
        audioElement = document.createElement('audio');
        audioElement.id = 'eq-translator-audio';
        audioElement.autoplay = true;
        audioElement.controls = false;
        audioElement.style.display = 'none';
        document.body.appendChild(audioElement);
      }
      
      return {
        contextState: audioContext.state,
        audioElementCreated: !!audioElement
      };
    } catch (error) {
      console.error('EQ Translator: Error setting up audio passthrough', error);
      throw error;
    }
  }
  
  // Clean up audio passthrough
  async function cleanupAudioPassthrough() {
    try {
      // Remove audio element
      if (audioElement) {
        audioElement.pause();
        audioElement.srcObject = null;
        audioElement.remove();
        audioElement = null;
      }
      
      // Close audio context
      if (audioContext) {
        await audioContext.close();
        audioContext = null;
      }
      
      return true;
    } catch (error) {
      console.error('EQ Translator: Error cleaning up audio passthrough', error);
      throw error;
    }
  }
  
  // Play stream from extension
  window.playStream = function(streamId) {
    if (!audioElement) {
      console.error('EQ Translator: Audio element not initialized');
      return false;
    }
    
    try {
      // TODO: This is a simplified example. In a real implementation,
      // you would need a more complex mechanism to pass streams between
      // extension contexts.
      // This function would be called by the extension to play a stream.
      console.log('EQ Translator: Playing stream', streamId);
      return true;
    } catch (error) {
      console.error('EQ Translator: Error playing stream', error);
      return false;
    }
  };
  
  console.log('EQ Translator: Audio passthrough initialized');
})();