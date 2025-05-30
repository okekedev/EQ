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
    
    // Enhanced configuration for 64-bar spectrum
    this.config = {
      numBars: 64, // 64 bars for detailed spectrum
      minBarHeight: 2,
      maxBarHeight: 0.9,
      smoothingFactor: 0.25, // More responsive for spectrum display
      spacing: 1, // Tighter spacing for more bars
      borderRadius: 2,
      glowIntensity: 4,
      scanLineSpacing: 4,
      scanLineOpacity: 0.06,
      
      // Frequency mapping to match our EQ bands
      minFreq: 20,   // Start from 20Hz
      maxFreq: 20000, // Go up to 20kHz
      
      // EQ band frequencies for color mapping
      eqBands: [60, 170, 310, 600, 1000, 3000, 6000, 8000],
      eqColors: [
        '#ff4444', // Bass - Red
        '#ff8844', // Low-Mid - Orange  
        '#ffaa44', // Lower Mid - Yellow-Orange
        '#ffdd44', // Mid - Yellow
        '#44ff44', // Upper Mid - Green
        '#44ddff', // High-Mid - Cyan
        '#4488ff', // High - Blue
        '#8844ff'  // Treble - Purple
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
    
    // Logarithmic frequency distribution for musical spectrum
    const minLog = Math.log(this.config.minFreq);
    const maxLog = Math.log(this.config.maxFreq);
    const logRange = maxLog - minLog;
    
    for (let i = 0; i < this.config.numBars; i++) {
      // Calculate target frequency for this bar using logarithmic scale
      const logFreq = minLog + (i / (this.config.numBars - 1)) * logRange;
      const targetFreq = Math.exp(logFreq);
      
      // Convert frequency to FFT bin index
      const binIndex = Math.floor((targetFreq / nyquist) * bufferLength);
      const clampedBinIndex = Math.max(0, Math.min(binIndex, bufferLength - 1));
      
      // Average several bins for smoother visualization
      const binRange = Math.max(1, Math.floor(bufferLength / this.config.numBars / 2));
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
        this.barHeights[i] += (targetHeight - currentHeight) * 0.6;
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
      
      // Calculate frequency for this bar
      const minLog = Math.log(this.config.minFreq);
      const maxLog = Math.log(this.config.maxFreq);
      const logRange = maxLog - minLog;
      const logFreq = minLog + (i / (this.config.numBars - 1)) * logRange;
      const frequency = Math.exp(logFreq);
      
      // Get color based on frequency range
      const { hue, saturation, lightness } = this.getFrequencyColor(frequency, barHeight, height);
      
      // Draw main bar with gradient
      const gradient = this.ctx.createLinearGradient(0, height - barHeight, 0, height);
      gradient.addColorStop(0, `hsl(${hue}, ${saturation}%, ${lightness + 30}%)`);
      gradient.addColorStop(0.3, `hsl(${hue + 10}, ${saturation - 5}%, ${lightness + 15}%)`);
      gradient.addColorStop(0.7, `hsl(${hue + 20}, ${saturation - 10}%, ${lightness}%)`);
      gradient.addColorStop(1, `hsl(${hue + 30}, ${saturation - 15}%, ${lightness - 10}%)`);
      
      this.ctx.fillStyle = gradient;
      
      // Draw bar with rounded top
      this.ctx.beginPath();
      this.ctx.roundRect(x, height - barHeight, barWidth, barHeight, [this.config.borderRadius, this.config.borderRadius, 0, 0]);
      this.ctx.fill();
      
      // Add glow effect
      this.ctx.shadowColor = `hsl(${hue}, 90%, 60%)`;
      this.ctx.shadowBlur = this.config.glowIntensity;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      
      // Draw peak indicator
      if (peakHeight > barHeight + 2) {
        this.ctx.fillStyle = `hsl(${hue}, 100%, 80%)`;
        this.ctx.fillRect(x, height - peakHeight - 2, barWidth, 2);
      }
      
      // Add subtle reflection
      this.drawBarReflection(x, barWidth, height, hue);
    }
  }

  getFrequencyColor(frequency, barHeight, canvasHeight) {
    // Map frequency to EQ band colors
    const eqBands = this.config.eqBands;
    const eqColors = this.config.eqColors;
    
    let bandIndex = 0;
    for (let i = 0; i < eqBands.length - 1; i++) {
      if (frequency >= eqBands[i] && frequency < eqBands[i + 1]) {
        bandIndex = i;
        break;
      } else if (frequency >= eqBands[eqBands.length - 1]) {
        bandIndex = eqBands.length - 1;
        break;
      }
    }
    
    // Convert hex color to HSL for manipulation
    const hexColor = eqColors[bandIndex];
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

  drawFrequencyLabels(width, height) {
    this.ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
    this.ctx.font = '8px "Courier New", monospace';
    this.ctx.textAlign = 'center';
    
    // Draw frequency markers at key points
    const markers = [
      { freq: 60, label: '60Hz' },
      { freq: 1000, label: '1kHz' },
      { freq: 8000, label: '8kHz' }
    ];
    
    markers.forEach(marker => {
      const minLog = Math.log(this.config.minFreq);
      const maxLog = Math.log(this.config.maxFreq);
      const logRange = maxLog - minLog;
      const markerLog = Math.log(marker.freq);
      const position = (markerLog - minLog) / logRange;
      const x = position * width;
      
      this.ctx.fillText(marker.label, x, height - 4);
    });
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
    const staticHeight = 4;
    
    for (let i = 0; i < this.config.numBars; i++) {
      const x = i * (barWidth + this.config.spacing) + this.config.spacing;
      
      // Calculate frequency for color
      const minLog = Math.log(this.config.minFreq);
      const maxLog = Math.log(this.config.maxFreq);
      const logRange = maxLog - minLog;
      const logFreq = minLog + (i / (this.config.numBars - 1)) * logRange;
      const frequency = Math.exp(logFreq);
      
      const { hue } = this.getFrequencyColor(frequency, staticHeight, height);
      
      // Dim colors for inactive state
      const gradient = this.ctx.createLinearGradient(0, height - staticHeight, 0, height);
      gradient.addColorStop(0, `hsla(${hue}, 40%, 25%, 0.4)`);
      gradient.addColorStop(1, `hsla(${hue + 60}, 30%, 15%, 0.3)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.roundRect(x, height - staticHeight, barWidth, staticHeight, [1, 1, 0, 0]);
      this.ctx.fill();
    }
  }

  drawPlaceholderText(width, height) {
    this.ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
    this.ctx.font = '11px "Courier New", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('64-BAR SPECTRUM ANALYZER', width / 2, height / 2 - 8);
    this.ctx.font = '9px "Courier New", monospace';
    this.ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
    this.ctx.fillText('Enable Global EQ to see live audio', width / 2, height / 2 + 8);
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