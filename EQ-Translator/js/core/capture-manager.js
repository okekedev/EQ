// CaptureManager - Handles all tab audio capture functionality

class CaptureManager {
  constructor() {
    this.activeStream = null;
    this.audioContext = null;
    this.mediaStreamSource = null;
    this.audioDestination = null;
    this.activeTabId = null;
    this.isCapturing = false;
    this.audioProcessor = null;
    this.onCaptureStarted = null;
    this.onCaptureStopped = null;
    this.onCaptureError = null;
    this.audioPassthrough = true; // Enable or disable passing audio through to output
  }

  /**
   * Initialize with an audio processor instance
   * @param {AudioProcessor} audioProcessor - The audio processor instance
   */
  initialize(audioProcessor) {
    this.audioProcessor = audioProcessor;
    return this;
  }

  /**
   * Set callback for when capture starts
   * @param {Function} callback - The callback function
   */
  setOnCaptureStarted(callback) {
    this.onCaptureStarted = callback;
    return this;
  }

  /**
   * Set callback for when capture stops
   * @param {Function} callback - The callback function
   */
  setOnCaptureStopped(callback) {
    this.onCaptureStopped = callback;
    return this;
  }

  /**
   * Set callback for capture errors
   * @param {Function} callback - The callback function
   */
  setOnCaptureError(callback) {
    this.onCaptureError = callback;
    return this;
  }

  /**
   * Enable or disable audio passthrough
   * @param {boolean} enabled - Whether audio should be passed through to output
   */
  setAudioPassthrough(enabled) {
    this.audioPassthrough = enabled;
    this.updateAudioRouting();
    return this;
  }

  /**
   * Start capturing audio from the specified tab
   * @param {number} tabId - The ID of the tab to capture
   * @returns {Promise<boolean>} - Whether capture was successful
   */
  async startCapture(tabId) {
    try {
      // Stop any existing capture
      await this.stopCapture();
      
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
      
      // Create media stream source
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
      
      // Create destination for audio passthrough
      this.audioDestination = this.audioContext.createMediaStreamDestination();
      
      // Initialize audio processor with the stream AND our audio context
      if (this.audioProcessor) {
        await this.audioProcessor.initialize(stream, this.audioContext);
        
        // Connect the processor's output to the destination if passthrough is enabled
        if (this.audioPassthrough) {
          const outputNode = this.audioProcessor.getOutputNode();
          if (outputNode) {
            outputNode.connect(this.audioDestination);
            
            // Create audio element for playback
            this._createAudioElement(this.audioDestination.stream);
          }
        }
      } else {
        // If no processor, connect source directly to destination for passthrough
        if (this.audioPassthrough) {
          this.mediaStreamSource.connect(this.audioDestination);
          
          // Create audio element for playback
          this._createAudioElement(this.audioDestination.stream);
        }
      }
      
      // Update state
      this.isCapturing = true;
      
      // Notify background script if needed
      chrome.runtime.sendMessage({ action: 'captureStarted', tabId: tabId });
      
      // Call the capture started callback
      if (this.onCaptureStarted) {
        this.onCaptureStarted();
      }
      
      return true;
    } catch (error) {
      console.error('Error starting capture:', error);
      
      // Call the error callback
      if (this.onCaptureError) {
        this.onCaptureError(error);
      }
      
      // Reset state
      this.isCapturing = false;
      this.activeTabId = null;
      
      throw error;
    }
  }

  /**
   * Stop capturing audio
   * @returns {Promise<boolean>} - Whether stop was successful
   */
  async stopCapture() {
    if (!this.isCapturing) {
      return true;
    }
    
    try {
      // Stop the stream
      if (this.activeStream) {
        this.activeStream.getTracks().forEach(track => track.stop());
        this.activeStream = null;
      }
      
      // Clean up audio element
      this._removeAudioElement();
      
      // Clean up audio processor
      if (this.audioProcessor) {
        await this.audioProcessor.cleanup();
      }
      
      // Clean up audio context connections
      if (this.mediaStreamSource) {
        this.mediaStreamSource.disconnect();
        this.mediaStreamSource = null;
      }
      
      if (this.audioDestination) {
        this.audioDestination = null;
      }
      
      // Update state
      this.isCapturing = false;
      this.activeTabId = null;
      
      // Notify background script
      chrome.runtime.sendMessage({ action: 'captureStopped' });
      
      // Call the capture stopped callback
      if (this.onCaptureStopped) {
        this.onCaptureStopped();
      }
      
      return true;
    } catch (error) {
      console.error('Error stopping capture:', error);
      
      // Call the error callback
      if (this.onCaptureError) {
        this.onCaptureError(error);
      }
      
      // Force state reset
      this.isCapturing = false;
      this.activeTabId = null;
      
      throw error;
    }
  }

  /**
   * Update the audio routing based on passthrough setting
   */
  updateAudioRouting() {
    if (!this.isCapturing) {
      return;
    }
    
    if (this.audioPassthrough) {
      // Connect to destination for passthrough
      if (this.audioProcessor) {
        const outputNode = this.audioProcessor.getOutputNode();
        if (outputNode && this.audioDestination) {
          outputNode.connect(this.audioDestination);
          
          // Create audio element if needed
          if (!document.getElementById('eq-audio-passthrough')) {
            this._createAudioElement(this.audioDestination.stream);
          }
        }
      } else if (this.mediaStreamSource && this.audioDestination) {
        this.mediaStreamSource.connect(this.audioDestination);
        
        // Create audio element if needed
        if (!document.getElementById('eq-audio-passthrough')) {
          this._createAudioElement(this.audioDestination.stream);
        }
      }
    } else {
      // Disconnect from destination
      if (this.audioProcessor) {
        const outputNode = this.audioProcessor.getOutputNode();
        if (outputNode && this.audioDestination) {
          outputNode.disconnect(this.audioDestination);
        }
      } else if (this.mediaStreamSource && this.audioDestination) {
        this.mediaStreamSource.disconnect(this.audioDestination);
      }
      
      // Remove audio element
      this._removeAudioElement();
    }
  }

  /**
   * Get the audio context
   * @returns {AudioContext} - The audio context
   */
  getAudioContext() {
    return this.audioContext;
  }

  /**
   * Get the active stream
   * @returns {MediaStream} - The active stream
   */
  getActiveStream() {
    return this.activeStream;
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
   * @returns {number} - The active tab ID
   */
  getActiveTabId() {
    return this.activeTabId;
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
   * Create an audio element for passthrough
   * @param {MediaStream} stream - The stream to play
   * @private
   */
  _createAudioElement(stream) {
    // Remove any existing audio element
    this._removeAudioElement();
    
    // Create new audio element
    const audioElement = document.createElement('audio');
    audioElement.id = 'eq-audio-passthrough';
    audioElement.srcObject = stream;
    audioElement.autoplay = true;
    audioElement.style.display = 'none';
    
    // Add to document
    document.body.appendChild(audioElement);
  }

  /**
   * Remove the audio element
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
}

// Export the CaptureManager class
window.CaptureManager = CaptureManager;