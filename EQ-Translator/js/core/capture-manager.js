// CaptureManager - Streamlined and Optimized

class CaptureManager {
  constructor(audioProcessor = null) {
    this.activeStream = null;
    this.audioContext = null;
    this.mediaStreamSource = null;
    this.audioDestination = null;
    this.activeTabId = null;
    this.isCapturing = false;
    this.audioProcessor = audioProcessor;
    this.audioPassthrough = true;
    
    // Callback properties to match popup.js usage
    this.onStart = null;
    this.onStop = null;
    this.onError = null;
  }

  /**
   * Start capturing audio from the specified tab with optional API interception
   * @param {number} tabId - The ID of the tab to capture
   * @param {boolean} useAPIInterception - Whether to enable API interception
   * @returns {Promise<boolean>} - Whether capture was successful
   */
  async start(tabId, useAPIInterception = false) {
    try {
      // Stop any existing capture
      await this.stop();
      
      console.log(`🎯 Starting capture for tab ${tabId}, API interception: ${useAPIInterception}`);
      
      // Store the active tab ID
      this.activeTabId = tabId;
      
      // Capture tab audio
      const stream = await this._captureTabAudio();
      
      if (!stream) {
        throw new Error('Failed to capture tab audio - no stream returned');
      }
      
      // Store the stream
      this.activeStream = stream;
      
      // Create audio context if it doesn't exist
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
      
      // Initialize audio processor with the stream
      if (this.audioProcessor) {
        await this.audioProcessor.initialize(stream, this.audioContext);
        
        // Enable API interception if requested
        if (useAPIInterception) {
          this.audioProcessor.startAPIInterception();
        }
        
        // Setup audio routing for passthrough
        this._setupAudioRouting();
      } else {
        // If no processor, setup basic passthrough
        this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
        this.audioDestination = this.audioContext.createMediaStreamDestination();
        
        if (this.audioPassthrough) {
          this.mediaStreamSource.connect(this.audioDestination);
          this._createAudioElement(this.audioDestination.stream);
        }
      }
      
      // Update state
      this.isCapturing = true;
      
      // Notify background script
      this._notifyBackground('captureStarted', { tabId });
      
      // Call the start callback
      if (this.onStart) {
        this.onStart();
      }
      
      console.log('🎯 Capture started successfully');
      return true;
      
    } catch (error) {
      console.error('🚫 Capture start failed:', error);
      
      // Reset state
      this.isCapturing = false;
      this.activeTabId = null;
      
      // Call error callback
      if (this.onError) {
        this.onError(error);
      }
      
      throw error;
    }
  }

  /**
   * Stop capturing audio
   * @returns {Promise<boolean>} - Whether stop was successful
   */
  async stop() {
    if (!this.isCapturing) {
      return true;
    }
    
    try {
      console.log('🛑 Stopping capture...');
      
      // Stop API interception
      if (this.audioProcessor) {
        this.audioProcessor.stopAPIInterception();
        await this.audioProcessor.cleanup();
      }
      
      // Stop the stream
      if (this.activeStream) {
        this.activeStream.getTracks().forEach(track => track.stop());
        this.activeStream = null;
      }
      
      // Clean up audio elements and connections
      this._cleanupAudio();
      
      // Update state
      this.isCapturing = false;
      this.activeTabId = null;
      
      // Notify background script
      this._notifyBackground('captureStopped');
      
      // Call the stop callback
      if (this.onStop) {
        this.onStop();
      }
      
      console.log('✅ Capture stopped successfully');
      return true;
      
    } catch (error) {
      console.error('🚫 Stop capture error:', error);
      
      // Force state reset
      this.isCapturing = false;
      this.activeTabId = null;
      
      // Call error callback
      if (this.onError) {
        this.onError(error);
      }
      
      throw error;
    }
  }

  /**
   * Enable or disable audio passthrough
   * @param {boolean} enabled - Whether audio should be passed through to output
   */
  setAudioPassthrough(enabled) {
    this.audioPassthrough = enabled;
    
    if (this.isCapturing) {
      this._updateAudioRouting();
    }
    
    return this;
  }

  /**
   * Check if capture is active
   * @returns {boolean} - Whether capture is active
   */
  isActive() {
    return this.isCapturing;
  }

  /**
   * Get the active tab ID
   * @returns {number|null} - The active tab ID
   */
  getActiveTabId() {
    return this.activeTabId;
  }

  /**
   * Get the audio context
   * @returns {AudioContext|null} - The audio context
   */
  getAudioContext() {
    return this.audioContext;
  }

  /**
   * Get the active stream
   * @returns {MediaStream|null} - The active stream
   */
  getActiveStream() {
    return this.activeStream;
  }

  // Private methods

  /**
   * Capture tab audio using the tabCapture API
   * @returns {Promise<MediaStream>} - The captured audio stream
   * @private
   */
  async _captureTabAudio() {
    return new Promise((resolve, reject) => {
      chrome.tabCapture.capture({
        audio: true,
        video: false
      }, (stream) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!stream) {
          reject(new Error('Failed to capture tab audio - no stream returned'));
        } else {
          resolve(stream);
        }
      });
    });
  }

  /**
   * Setup audio routing for the processor
   * @private
   */
  _setupAudioRouting() {
    if (!this.audioProcessor) return;
    
    // Create destination for passthrough
    this.audioDestination = this.audioContext.createMediaStreamDestination();
    
    // Connect processor output to destination if passthrough is enabled
    if (this.audioPassthrough) {
      const outputNode = this.audioProcessor.outputNode;
      if (outputNode) {
        outputNode.connect(this.audioDestination);
        this._createAudioElement(this.audioDestination.stream);
      }
    }
  }

  /**
   * Update audio routing based on passthrough setting
   * @private
   */
  _updateAudioRouting() {
    if (!this.isCapturing || !this.audioDestination) return;
    
    const outputNode = this.audioProcessor?.outputNode || this.mediaStreamSource;
    
    if (this.audioPassthrough) {
      // Connect for passthrough
      if (outputNode) {
        outputNode.connect(this.audioDestination);
        
        if (!document.getElementById('eq-audio-passthrough')) {
          this._createAudioElement(this.audioDestination.stream);
        }
      }
    } else {
      // Disconnect passthrough
      if (outputNode) {
        try {
          outputNode.disconnect(this.audioDestination);
        } catch (e) {
          // Ignore disconnect errors
        }
      }
      this._removeAudioElement();
    }
  }

  /**
   * Create an audio element for passthrough playback
   * @param {MediaStream} stream - The stream to play
   * @private
   */
  _createAudioElement(stream) {
    this._removeAudioElement(); // Remove existing first
    
    const audioElement = document.createElement('audio');
    audioElement.id = 'eq-audio-passthrough';
    audioElement.srcObject = stream;
    audioElement.autoplay = true;
    audioElement.volume = 0.8; // Slightly lower to prevent feedback
    audioElement.style.display = 'none';
    
    document.body.appendChild(audioElement);
  }

  /**
   * Remove the audio passthrough element
   * @private
   */
  _removeAudioElement() {
    const audioElement = document.getElementById('eq-audio-passthrough');
    if (audioElement) {
      audioElement.pause();
      audioElement.srcObject = null;
      audioElement.remove();
    }
  }

  /**
   * Clean up all audio connections and elements
   * @private
   */
  _cleanupAudio() {
    // Remove audio element
    this._removeAudioElement();
    
    // Disconnect audio nodes
    if (this.mediaStreamSource) {
      try {
        this.mediaStreamSource.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.mediaStreamSource = null;
    }
    
    // Clear destination
    this.audioDestination = null;
  }

  /**
   * Notify background script of state changes
   * @param {string} action - The action to notify
   * @param {Object} data - Additional data to send
   * @private
   */
  _notifyBackground(action, data = {}) {
    try {
      chrome.runtime.sendMessage({ action, ...data });
    } catch (error) {
      // Ignore messaging errors (extension might be reloading)
      console.warn('Background message failed:', error);
    }
  }
}

// Export the CaptureManager class
window.CaptureManager = CaptureManager;
