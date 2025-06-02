// Enhanced Audio Visualizer - 64-bar retro spectrum connected to real audio
class AudioVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = null;
    this.animationId = null;
    this.analyser = null;
    this.isActive = false;
    this.audioContext = null;
    this.sourceNode = null;
    
    // Enhanced configuration for 8-bar EQ visualization (matching all EQ bands)
    this.config = {
      numBars: 8, // 8 bars matching all EQ frequency bands
      minBarHeight: 2,
      maxBarHeight: 0.9,
      smoothingFactor: 0.25, // More responsive for spectrum display
      spacing: 1, // Tighter spacing for more bars
      borderRadius: 2,
      glowIntensity: 4,
      scanLineSpacing: 4,
      scanLineOpacity: 0.06,
      
      // EQ band frequencies and colors (8 bands to match all your sliders)
      eqBands: [60, 170, 310, 600, 1000, 3000, 6000, 8000], // All EQ frequencies
      eqLabels: ['60Hz', '170Hz', '310Hz', '600Hz', '1kHz', '3kHz', '6kHz', '8kHz'],
      eqColors: [
        '#ff3333', // 60Hz - Deep Red
        '#ff6633', // 170Hz - Orange-Red
        '#ff9933', // 310Hz - Orange  
        '#ffcc33', // 600Hz - Yellow
        '#33ff33', // 1kHz - Green
        '#33ccff', // 3kHz - Cyan
        '#3366ff', // 6kHz - Blue
        '#9933ff'  // 8kHz - Purple
      ]
    };
    
    // Animation state
    this.barHeights = new Array(this.config.numBars).fill(0);
    this.barPeaks = new Array(this.config.numBars).fill(0);
    this.peakDecay = new Array(this.config.numBars).fill(0);
    
    this.init();
  }

  init() {
    if (!this.canvas) {
      console.error('Visualizer canvas not found');
      return false;
    }
    
    this.ctx = this.canvas.getContext('2d');
    
    // Set canvas size for high DPI displays
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * 2;
    this.canvas.height = rect.height * 2;
    this.ctx.scale(2, 2);
    
    // Add roundRect polyfill if needed
    this.addRoundRectPolyfill();
    
    // Start with empty visualization
    this.drawEmpty();
    
    console.log('🎨 64-bar spectrum visualizer initialized');
    return true;
  }

  addRoundRectPolyfill() {
    if (!this.ctx.roundRect) {
      this.ctx.roundRect = function(x, y, width, height, radii) {
        const radius = Array.isArray(radii) ? radii[0] : radii;
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
      };
    }
  }

  // Connect to actual audio stream from global EQ
  connectToAudioStream(audioContext, sourceNode) {
    try {
      console.log('🔗 Connecting visualizer to audio stream...');
      
      this.audioContext = audioContext;
      this.sourceNode = sourceNode;
      
      // Create dedicated analyser for visualization
      this.analyser = audioContext.createAnalyser();
      this.analyser.fftSize = 2048; // Higher resolution for 64 bars
      this.analyser.smoothingTimeConstant = 0.3; // Balanced smoothing
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
      
      // Connect source to analyser (this doesn't affect the audio output)
      sourceNode.connect(this.analyser);
      
      console.log('✅ Visualizer connected to audio stream');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to connect visualizer to audio stream:', error);
      return false;
    }
  }

  start(analyser = null) {
    // If analyser is provided directly, use it
    if (analyser) {
      this.analyser = analyser;
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.3;
    }
    
    if (!this.analyser) {
      console.error('No analyser available for visualizer');
      return false;
    }
    
    this.isActive = true;
    
    console.log('🎨 Starting 64-bar spectrum visualization');
    this.animate();
    return true;
  }

  stop() {
    this.isActive = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Don't disconnect the analyser as it might be used by the EQ
    this.drawEmpty();
    
    console.log('🎨 Spectrum visualization stopped');
  }

  animate() {
    if (!this.isActive || !this.analyser || !this.ctx) return;
    
    this.animationId = requestAnimationFrame(() => this.animate());
    
    // Get frequency data
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    // Update bar heights with frequency mapping
    this.updateSpectrumBars(dataArray, bufferLength);
    
    // Draw the spectrum
    this.draw();
  }

  updateSpectrumBars(dataArray, bufferLength) {
    const sampleRate = this.audioContext?.sampleRate || 44100;
    const nyquist = sampleRate / 2;
    
    // Map each bar to a specific EQ frequency band
    for (let i = 0; i < this.config.numBars; i++) {
      const targetFreq = this.config.eqBands[i];
      
      // Convert frequency to FFT bin index
      const binIndex = Math.floor((targetFreq / nyquist) * bufferLength);
      const clampedBinIndex = Math.max(0, Math.min(binIndex, bufferLength - 1));
      
      // Average several bins around the target frequency for smoother visualization
      const binRange = Math.max(1, Math.floor(bufferLength / 256)); // Wider range for 6 bars
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, clampedBinIndex - binRange); 
           j <= Math.min(bufferLength - 1, clampedBinIndex + binRange); j++) {
        sum += dataArray[j];
        count++;
      }
      
      // Calculate normalized height
      const avgValue = count > 0 ? sum / count : 0;
      const height = this.canvas.height / 2;
      const targetHeight = (avgValue / 255) * height * this.config.maxBarHeight;
      
      // Smooth animation with faster attack, slower decay
      const currentHeight = this.barHeights[i];
      if (targetHeight > currentHeight) {
        // Fast attack
        this.barHeights[i] += (targetHeight - currentHeight) * 0.7;
      } else {
        // Slower decay
        this.barHeights[i] += (targetHeight - currentHeight) * this.config.smoothingFactor;
      }
      
      // Ensure minimum height for visual appeal
      this.barHeights[i] = Math.max(this.barHeights[i], this.config.minBarHeight);
      
      // Peak tracking for retro effect
      if (this.barHeights[i] > this.barPeaks[i]) {
        this.barPeaks[i] = this.barHeights[i];
        this.peakDecay[i] = 0;
      } else {
        this.peakDecay[i] += 0.5;
        this.barPeaks[i] = Math.max(this.barHeights[i], this.barPeaks[i] - this.peakDecay[i]);
      }
    }
  }

  draw() {
    const width = this.canvas.width / 2;
    const height = this.canvas.height / 2;
    
    // Clear canvas with retro gradient background
    this.drawBackground(width, height);
    
    // Draw the spectrum bars
    this.drawSpectrumBars(width, height);
    
    // Add retro effects
    this.drawScanLines(width, height);
    this.drawFrequencyLabels(width, height);
  }

  drawBackground(width, height) {
    const bgGradient = this.ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#0a0a0a');
    bgGradient.addColorStop(0.3, '#1a0a1a');
    bgGradient.addColorStop(0.7, '#0a1a1a');
    bgGradient.addColorStop(1, '#0a0a2a');
    
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, width, height);
  }

  drawSpectrumBars(width, height) {
    const barWidth = (width - (this.config.numBars + 1) * this.config.spacing) / this.config.numBars;
    
    for (let i = 0; i < this.config.numBars; i++) {
      const x = i * (barWidth + this.config.spacing) + this.config.spacing;
      const barHeight = Math.max(this.barHeights[i], this.config.minBarHeight);
      const peakHeight = this.barPeaks[i];
      
      // Use the specific EQ frequency for this bar
      const frequency = this.config.eqBands[i];
      
      // Get color based on frequency
      const { hue, saturation, lightness } = this.getFrequencyColor(frequency, barHeight, height);
      const outlineColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      
      // RETRO LOOK: Black fill with colored outline
      
      // Draw black fill
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.roundRect(x + 2, height - barHeight + 2, barWidth - 4, barHeight - 4, [this.config.borderRadius, this.config.borderRadius, 0, 0]);
      this.ctx.fill();
      
      // Draw colored outline/border
      this.ctx.strokeStyle = outlineColor;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.roundRect(x, height - barHeight, barWidth, barHeight, [this.config.borderRadius, this.config.borderRadius, 0, 0]);
      this.ctx.stroke();
      
      // Add inner glow effect on the outline
      this.ctx.shadowColor = outlineColor;
      this.ctx.shadowBlur = 8;
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
      
      // Draw peak indicator as colored line
      if (peakHeight > barHeight + 3) {
        this.ctx.strokeStyle = `hsl(${hue}, 100%, 80%)`;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, height - peakHeight);
        this.ctx.lineTo(x + barWidth, height - peakHeight);
        this.ctx.stroke();
      }
      
      // Frequency labels removed for cleaner look
    }
  }

  getFrequencyColor(frequency, barHeight, canvasHeight) {
    // Find which EQ band this frequency belongs to
    let bandIndex = 0;
    for (let i = 0; i < this.config.eqBands.length; i++) {
      if (frequency === this.config.eqBands[i]) {
        bandIndex = i;
        break;
      }
    }
    
    // Get color from our EQ color palette
    const hexColor = this.config.eqColors[bandIndex];
    const { h, s, l } = this.hexToHsl(hexColor);
    
    // Adjust brightness based on bar height
    const intensity = barHeight / (canvasHeight * this.config.maxBarHeight);
    const adjustedLightness = Math.min(80, l + (intensity * 30));
    const adjustedSaturation = Math.min(100, s + (intensity * 20));
    
    return {
      hue: h,
      saturation: adjustedSaturation,
      lightness: adjustedLightness
    };
  }

  hexToHsl(hex) {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  drawBarReflection(x, barWidth, height, hue) {
    const reflectionHeight = 8;
    const reflectionGradient = this.ctx.createLinearGradient(0, height, 0, height - reflectionHeight);
    reflectionGradient.addColorStop(0, `hsla(${hue}, 70%, 50%, 0.2)`);
    reflectionGradient.addColorStop(1, `hsla(${hue}, 70%, 50%, 0)`);
    
    this.ctx.fillStyle = reflectionGradient;
    this.ctx.fillRect(x, height - reflectionHeight, barWidth, reflectionHeight);
  }

  drawScanLines(width, height) {
    this.ctx.strokeStyle = `rgba(0, 255, 255, ${this.config.scanLineOpacity})`;
    this.ctx.lineWidth = 0.5;
    
    for (let y = 0; y < height; y += this.config.scanLineSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }
  }

  drawFrequencyLabel(x, y, label) {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.font = '10px "Courier New", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(label, x, y - 8);
  }

  drawFrequencyLabels(width, height) {
    // Labels are now drawn individually with each bar
    // This method kept for compatibility but not used
  }

  drawEmpty() {
    if (!this.ctx) return;
    
    const width = this.canvas.width / 2;
    const height = this.canvas.height / 2;
    
    // Clear with retro gradient background
    this.drawBackground(width, height);
    
    // Draw static spectrum bars at low height
    this.drawStaticSpectrum(width, height);
    
    // Add retro scan lines
    this.drawScanLines(width, height);
    
    // Draw placeholder text
    this.drawPlaceholderText(width, height);
    
    // Add frequency labels
    this.drawFrequencyLabels(width, height);
  }

  drawStaticSpectrum(width, height) {
    const barWidth = (width - (this.config.numBars + 1) * this.config.spacing) / this.config.numBars;
    const staticHeight = 8;
    
    for (let i = 0; i < this.config.numBars; i++) {
      const x = i * (barWidth + this.config.spacing) + this.config.spacing;
      
      // Use the specific EQ frequency for color
      const frequency = this.config.eqBands[i];
      const { hue } = this.getFrequencyColor(frequency, staticHeight, height);
      const outlineColor = `hsla(${hue}, 60%, 50%, 0.7)`;
      
      // RETRO LOOK: Black fill with colored outline for static bars
      
      // Draw black fill
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      this.ctx.beginPath();
      this.ctx.roundRect(x + 1, height - staticHeight + 1, barWidth - 2, staticHeight - 2, [1, 1, 0, 0]);
      this.ctx.fill();
      
      // Draw colored outline
      this.ctx.strokeStyle = outlineColor;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.roundRect(x, height - staticHeight, barWidth, staticHeight, [1, 1, 0, 0]);
      this.ctx.stroke();
      
      // Frequency labels removed for cleaner look
    }
  }

  drawPlaceholderText(width, height) {
    this.ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
    this.ctx.font = 'bold 14px "Courier New", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('8-BAND EQ VISUALIZER', width / 2, height / 2 - 15);
    
    this.ctx.font = '11px "Courier New", monospace';
    this.ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
    this.ctx.fillText('Enable Global EQ to see live audio', width / 2, height / 2 + 5);
    
    this.ctx.font = '9px "Courier New", monospace';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.fillText('Each bar represents an EQ frequency band', width / 2, height / 2 + 20);
  }

  // Configuration methods
  setConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('🎨 Spectrum visualizer config updated:', this.config);
  }

  getConfig() {
    return { ...this.config };
  }

  // State methods
  isRunning() {
    return this.isActive;
  }

  hasAnalyser() {
    return !!this.analyser;
  }

  // Cleanup
  destroy() {
    this.stop();
    this.canvas = null;
    this.ctx = null;
    this.barHeights = null;
    this.barPeaks = null;
    this.peakDecay = null;
    console.log('🎨 Spectrum visualizer destroyed');
  }
}

// Export for use in other modules
window.AudioVisualizer = AudioVisualizer;