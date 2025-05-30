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
    
    // Callback properties to match popup.js usage
    this.onStart = null;
    this.onStop = null;
    this.onError = null;
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
   * @param {boolean} useAPIInterception - Whether to enable API interception (for compatibility)
   * @returns {Promise<boolean>} - Whether capture was successful
   */
  async start(tabId, useAPIInterception = true) {
    try {
      // Stop any existing capture
      await this.stop();
      
      console.log(`🎯 Starting capture for tab ${tabId}`);
      
      // Store the active tab ID
      this.activeTabId = tabId;
      
      // Capture tab audio
      const stream = await this._captureTabAudio();
      
      if (!stream) {
        throw new Error('Failed to capture tab audio - no stream returned');
      }
      
      console.log('🎯 Tab audio captured successfully:', {
        streamId: stream.id,
        audioTracks: stream.getAudioTracks().length
      });
      
      // Store the stream
      this.activeStream = stream;
      
      // Create audio context if it doesn't exist
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
        console.log('🎯 Created new AudioContext:', this.audioContext.state);
      }
      
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('🎯 AudioContext resumed');
      }
      
      // Create media stream source
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
      
      // Create destination for audio passthrough
      this.audioDestination = this.audioContext.createMediaStreamDestination();
      
      // Initialize audio processor with the stream
      if (this.audioProcessor) {
        console.log('🎯 Initializing audio processor...');
        await this.audioProcessor.initialize(stream, this.audioContext);
        
        // Enable API interception if requested
        if (useAPIInterception) {
          this.audioProcessor.startAPIInterception();
          console.log('🎯 API interception started');
        }
        
        // Connect the processor's output to the destination if passthrough is enabled
        if (this.audioPassthrough) {
          const outputNode = this.audioProcessor.getOutputNode();
          if (outputNode) {
            outputNode.connect(this.audioDestination);
            
            // Create audio element for playback
            this._createAudioElement(this.audioDestination.stream);
            console.log('🔊 EQ-processed audio connected for playback');
          }
        }
      } else {
        console.warn('⚠️ No audio processor provided - basic passthrough only');
        // If no processor, connect source directly to destination for passthrough
        if (this.audioPassthrough) {
          this.mediaStreamSource.connect(this.audioDestination);
          
          // Create audio element for playback
          this._createAudioElement(this.audioDestination.stream);
          console.log('🔊 Basic audio connected for playback');
        }
      }
      
      // Update state
      this.isCapturing = true;
      
      // Notify background script
      this._notifyBackground('captureStarted', { tabId });
      
      // Call the capture started callbacks
      if (this.onCaptureStarted) {
        this.onCaptureStarted();
      }
      if (this.onStart) {
        this.onStart();
      }
      
      console.log('✅ Capture started successfully');
      return true;
      
    } catch (error) {
      console.error('🚫 Capture start failed:', error);
      
      // Reset state
      this.isCapturing = false;
      this.activeTabId = null;
      
      // Call error callbacks
      if (this.onCaptureError) {
        this.onCaptureError(error);
      }
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
        console.log('🛑 Audio processor cleaned up');
      }
      
      // Stop the stream
      if (this.activeStream) {
        this.activeStream.getTracks().forEach(track => {
          track.stop();
          console.log(`🛑 Stopped track: ${track.kind}`);
        });
        this.activeStream = null;
      }
      
      // Clean up audio element
      this._removeAudioElement();
      
      // Clean up audio context connections
      if (this.mediaStreamSource) {
        try {
          this.mediaStreamSource.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        this.mediaStreamSource = null;
      }
      
      if (this.audioDestination) {
        this.audioDestination = null;
      }
      
      // Update state
      this.isCapturing = false;
      this.activeTabId = null;
      
      // Notify background script
      this._notifyBackground('captureStopped');
      
      // Call the capture stopped callbacks
      if (this.onCaptureStopped) {
        this.onCaptureStopped();
      }
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
      
      // Call error callbacks
      if (this.onCaptureError) {
        this.onCaptureError(error);
      }
      if (this.onError) {
        this.onError(error);
      }
      
      throw error;
    }
  }

  /**
   * Update audio routing based on current settings
   */
  updateAudioRouting() {
    if (!this.isCapturing) return;
    
    if (this.audioProcessor && this.audioProcessor.getOutputNode()) {
      const outputNode = this.audioProcessor.getOutputNode();
      
      if (this.audioPassthrough) {
        // Connect for passthrough
        if (this.audioDestination) {
          outputNode.connect(this.audioDestination);
          
          if (!document.getElementById('eq-audio-passthrough')) {
            this._createAudioElement(this.audioDestination.stream);
          }
        }
      } else {
        // Disconnect passthrough
        try {
          outputNode.disconnect(this.audioDestination);
        } catch (e) {
          // Ignore disconnect errors
        }
        this._removeAudioElement();
      }
    } else if (this.mediaStreamSource && this.audioDestination) {
      // Basic audio routing without processor
      if (this.audioPassthrough) {
        this.mediaStreamSource.connect(this.audioDestination);
        
        if (!document.getElementById('eq-audio-passthrough')) {
          this._createAudioElement(this.audioDestination.stream);
        }
      } else {
        try {
          this.mediaStreamSource.disconnect(this.audioDestination);
        } catch (e) {
          // Ignore disconnect errors
        }
        this._removeAudioElement();
      }
    }
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
          // Verify the stream has audio tracks
          const audioTracks = stream.getAudioTracks();
          if (audioTracks.length === 0) {
            reject(new Error('Captured stream has no audio tracks'));
          } else {
            console.log(`🎯 Captured ${audioTracks.length} audio track(s)`);
            resolve(stream);
          }
        }
      });
    });
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
    audioElement.volume = 1.0; // Full volume to hear EQ effects clearly
    audioElement.style.display = 'none';
    
    // Add event listeners for debugging
    audioElement.addEventListener('loadedmetadata', () => {
      console.log('🔊 Audio element loaded and ready to play');
    });
    
    audioElement.addEventListener('play', () => {
      console.log('🔊 Audio playback started - EQ effects should be audible!');
    });
    
    audioElement.addEventListener('error', (e) => {
      console.error('🚫 Audio element error:', e);
    });
    
    document.body.appendChild(audioElement);
    console.log('🔊 Audio passthrough element created');
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
      console.log('🔊 Audio passthrough element removed');
    }
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