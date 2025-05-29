// Visualizer - Handles audio visualization

class Visualizer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.context = this.canvas.getContext('2d');
    this.analyser = null;
    this.dataArray = null;
    this.animationFrame = null;
    this.isActive = false;
    this.colorMode = 'rainbow'; // 'rainbow', 'single', 'gradient'
    this.baseColor = 'rgb(0, 122, 255)';
    this.gradientColors = ['#0a84ff', '#64d2ff'];
    
    // Initialize canvas
    this.resizeCanvas();
    
    // Bind resize handler
    this._handleResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._handleResize);
  }

  /**
   * Start visualization with an analyzer node
   * @param {AnalyserNode} analyser - The audio analyzer node
   */
  start(analyser) {
    // Stop any existing visualization
    this.stop();
    
    // Store the analyzer
    this.analyser = analyser;
    
    if (!this.analyser) {
      console.error('No analyzer provided to visualizer');
      return false;
    }
    
    // Create the data array
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    // Mark as active
    this.isActive = true;
    
    // Start the animation
    this._draw();
    
    return true;
  }

  /**
   * Stop visualization
   */
  stop() {
    // Cancel animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    // Clear canvas
    this._clearCanvas();
    
    // Reset state
    this.isActive = false;
    this.analyser = null;
    this.dataArray = null;
  }

  /**
   * Set the visualization color mode
   * @param {string} mode - The color mode ('rainbow', 'single', 'gradient')
   * @param {string|Array} color - The color(s) to use
   */
  setColorMode(mode, color) {
    this.colorMode = mode;
    
    if (mode === 'single' && color) {
      this.baseColor = color;
    } else if (mode === 'gradient' && Array.isArray(color) && color.length >= 2) {
      this.gradientColors = color;
    }
  }

  /**
   * Resize the canvas to fit its container
   */
  resizeCanvas() {
    if (!this.canvas) return;
    
    const container = this.canvas.parentElement;
    if (!container) return;
    
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
  }

  /**
   * Clean up the visualizer
   */
  cleanup() {
    // Stop visualization
    this.stop();
    
    // Remove event listener
    window.removeEventListener('resize', this._handleResize);
  }

  // Private methods

  /**
   * Handle window resize events
   * @private
   */
  _handleResize() {
    this.resizeCanvas();
  }

  /**
   * Clear the canvas
   * @private
   */
  _clearCanvas() {
    if (this.context && this.canvas) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Draw the visualization
   * @private
   */
  _draw() {
    if (!this.isActive || !this.analyser || !this.dataArray || !this.context) {
      return;
    }
    
    // Get the frequency data
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Clear canvas
    this._clearCanvas();
    
    // Draw visualization
    this._drawBars();
    
    // Request next frame
    this.animationFrame = requestAnimationFrame(() => this._draw());
  }

  /**
   * Draw frequency bars visualization
   * @private
   */
  _drawBars() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const bufferLength = this.dataArray.length;
    
    // Calculate bar width based on canvas width and buffer length
    const barWidth = width / bufferLength * 2.5;
    let x = 0;
    
    // Draw each bar
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = this.dataArray[i] / 255 * height;
      
      // Get color based on mode
      let fillStyle;
      
      switch (this.colorMode) {
        case 'rainbow':
          // Use HSL color based on frequency
          const hue = i / bufferLength * 180 + 200;
          fillStyle = `hsl(${hue}, 80%, 50%)`;
          break;
          
        case 'single':
          // Use single color with opacity based on amplitude
          const opacity = 0.3 + (barHeight / height) * 0.7;
          fillStyle = this._getColorWithOpacity(this.baseColor, opacity);
          break;
          
        case 'gradient':
          // Use gradient based on frequency
          const gradient = this.context.createLinearGradient(0, height, 0, height - barHeight);
          gradient.addColorStop(0, this.gradientColors[0]);
          gradient.addColorStop(1, this.gradientColors[1]);
          fillStyle = gradient;
          break;
          
        default:
          // Default to a blue color
          fillStyle = `rgb(0, 122, 255)`;
      }
      
      this.context.fillStyle = fillStyle;
      
      // Draw the bar
      this.context.fillRect(x, height - barHeight, barWidth, barHeight);
      
      // Move to the next bar position
      x += barWidth + 1;
    }
  }

  /**
   * Get a color with opacity
   * @param {string} color - The base color
   * @param {number} opacity - The opacity (0-1)
   * @returns {string} - The color with opacity
   * @private
   */
  _getColorWithOpacity(color, opacity) {
    // Handle RGB format
    if (color.startsWith('rgb')) {
      // If it's already rgba, replace the opacity value
      if (color.startsWith('rgba')) {
        return color.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `rgba($1,$2,$3,${opacity})`);
      }
      
      // Convert rgb to rgba
      return color.replace(/rgb\(([^)]+)\)/, `rgba($1,${opacity})`);
    }
    
    // Handle hex format
    if (color.startsWith('#')) {
      // Convert hex to rgb values
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      
      // Return rgba
      return `rgba(${r},${g},${b},${opacity})`;
    }
    
    // For named colors or other formats, create a temporary element to get computed style
    const tempElement = document.createElement('div');
    tempElement.style.color = color;
    tempElement.style.display = 'none';
    document.body.appendChild(tempElement);
    
    const computedColor = window.getComputedStyle(tempElement).color;
    document.body.removeChild(tempElement);
    
    // Convert computed rgb to rgba
    return computedColor.replace(/rgb\(([^)]+)\)/, `rgba($1,${opacity})`);
  }
}

// Export the Visualizer class
window.Visualizer = Visualizer;