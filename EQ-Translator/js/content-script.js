// content-script.js
// This script runs in the context of web pages to enable audio output

// Setup audio playback in the page
(function() {
  // Check if we've already set up
  if (window.eq_translator_setup) {
    return;
  }
  
  // Create an audio context
  let audioContext = null;
  let audioElement = null;
  
  // Setup function to be called from the background script
  window.eq_translator_setup = function() {
    try {
      // Create audio context if needed
      if (!audioContext) {
        audioContext = new AudioContext();
      }
      
      // Create audio element if needed
      if (!audioElement) {
        audioElement = document.createElement('audio');
        audioElement.id = 'eq-translator-audio-element';
        audioElement.autoplay = true;
        audioElement.style.display = 'none';
        document.body.appendChild(audioElement);
      }
      
      // Setup bridge for stream communication
      window.eq_translator_setup_stream = function(streamId) {
        // In a real implementation, you'd have a way to connect streams
        console.log('EQ Translator: Stream setup requested', streamId);
      };
      
      return true;
    } catch (error) {
      console.error('EQ Translator: Setup error', error);
      return false;
    }
  };
  
  // Cleanup function
  window.eq_translator_cleanup = function() {
    try {
      if (audioElement) {
        audioElement.pause();
        audioElement.srcObject = null;
        audioElement.remove();
        audioElement = null;
      }
      
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      
      return true;
    } catch (error) {
      console.error('EQ Translator: Cleanup error', error);
      return false;
    }
  };
  
  console.log('EQ Translator: Content script loaded');
})();