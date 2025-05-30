// Audio Visualizer - Retro EQ Display with Smooth Flowing Bars
class AudioVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = null;
    this.animationId = null;
    this.analyser = null;
    this.isActive = false;
    
    // Visual configuration - optimized for musical frequencies
    this.config = {
      numBars: 32, // Optimal for musical frequency representation
      minBarHeight: 3,
      maxBarHeight: 0.85,
      smoothingFactor: 0.35, // Balanced responsiveness
      spacing: 2, // Better spacing for readability
      borderRadius: 3,
      glowIntensity: 6,
      scanLineSpacing: 3,
      scanLineOpacity: 0.08
    };
    
    // Animation state
    this.barHeights = new Array(this.config.numBars).fill(0);
    
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
    
    console.log('🎨 Audio visualizer initialized');
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

  start(analyser) {
    if (!analyser) {
      console.error('No analyser provided to visualizer');
      return false;
    }
    
    this.analyser = analyser;
    this.analyser.fftSize = 512; // Increased for better frequency resolution
    this.analyser.smoothingTimeConstant = 0.6; // Smoother frequency data
    this.isActive = true;
    
    console.log('🎨 Starting audio visualization with', this.analyser.frequencyBinCount, 'frequency bins');
    this.animate();
    return true;
  }

  stop() {
    this.isActive = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.analyser = null;
    this.drawEmpty();
    
    console.log('🎨 Audio visualization stopped');
  }

  animate() {
    if (!this.isActive || !this.analyser || !this.ctx) return;
    
    this.animationId = requestAnimationFrame(() => this.animate());
    
    // Get frequency data
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    // Update bar heights with smoothing
    this.updateBarHeights(dataArray, bufferLength);
    
    // Draw the visualization
    this.draw();
  }

  updateBarHeights(dataArray, bufferLength) {
    // Music-focused frequency distribution (most music content is 20Hz-20kHz, emphasis on 20Hz-8kHz)
    // Use logarithmic distribution to better represent musical frequencies
    const sampleRate = 44100; // Standard sample rate
    const nyquist = sampleRate / 2; // 22050 Hz
    const minFreq = 20; // 20 Hz - lowest musical frequency
    const maxFreq = 16000; // 16 kHz - covers most important musical content
    
    for (let i = 0; i < this.config.numBars; i++) {
      // Logarithmic frequency mapping for musical content
      const freqRatio = i / (this.config.numBars - 1);
      
      // Use logarithmic scale: more bars for lower frequencies where most musical content lives
      const logMin = Math.log(minFreq);
      const logMax = Math.log(maxFreq);
      const targetFreq = Math.exp(logMin + freqRatio * (logMax - logMin));
      
      // Convert frequency to bin index
      const binIndex = Math.floor((targetFreq / nyquist) * bufferLength);
      const clampedBinIndex = Math.max(0, Math.min(binIndex, bufferLength - 1));
      
      // Use a small range around the target frequency for smoother visualization
      const rangeSize = Math.max(1, Math.floor(bufferLength / this.config.numBars / 4));
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, clampedBinIndex - rangeSize); 
           j <= Math.min(bufferLength - 1, clampedBinIndex + rangeSize); j++) {
        sum += dataArray[j];
        count++;
      }
      
      // Calculate average amplitude for this frequency range
      const avgValue = count > 0 ? sum / count : 0;
      const height = this.canvas.height / 2;
      const targetHeight = (avgValue / 255) * height * this.config.maxBarHeight;
      
      // Smooth animation with easing
      const easingFactor = this.config.smoothingFactor;
      this.barHeights[i] += (targetHeight - this.barHeights[i]) * easingFactor;
      
      // Ensure minimum height for visual appeal
      this.barHeights[i] = Math.max(this.barHeights[i], this.config.minBarHeight);
    }
  }

  draw() {
    const width = this.canvas.width / 2;
    const height = this.canvas.height / 2;
    
    // Clear canvas with retro gradient background
    this.drawBackground(width, height);
    
    // Draw the frequency bars
    this.drawBars(width, height);
    
    // Add retro effects
    this.drawScanLines(width, height);
  }

  drawBackground(width, height) {
    const bgGradient = this.ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#0a0a0a');
    bgGradient.addColorStop(0.5, '#1a0a1a');
    bgGradient.addColorStop(1, '#0a0a2a');
    
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, width, height);
  }

  drawBars(width, height) {
    const barWidth = (width - (this.config.numBars + 1) * this.config.spacing) / this.config.numBars;
    
    for (let i = 0; i < this.config.numBars; i++) {
      const x = i * (barWidth + this.config.spacing) + this.config.spacing;
      const barHeight = Math.max(this.barHeights[i], this.config.minBarHeight);
      
      // Create retro multicolor gradient for each bar
      const gradient = this.createBarGradient(i, barHeight, height);
      
      this.ctx.fillStyle = gradient;
      
      // Draw main bar with rounded top
      this.ctx.beginPath();
      this.ctx.roundRect(x, height - barHeight, barWidth, barHeight, [this.config.borderRadius, this.config.borderRadius, 0, 0]);
      this.ctx.fill();
      
      // Add retro glow effect
      const hue = this.getBarHue(i, barHeight, height);
      this.ctx.shadowColor = `hsl(${hue}, 90%, 60%)`;
      this.ctx.shadowBlur = this.config.glowIntensity;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      
      // Add subtle reflection at the bottom
      this.drawBarReflection(x, barWidth, height, hue);
    }
  }

  createBarGradient(barIndex, barHeight, canvasHeight) {
    const hue = this.getBarHue(barIndex, barHeight, canvasHeight);
    const intensity = barHeight / (canvasHeight * this.config.maxBarHeight);
    
    // More vibrant colors with intensity-based saturation
    const saturationBase = 85 + (intensity * 15); // 85-100% saturation
    const lightnessBase = 50 + (intensity * 25); // 50-75% lightness
    
    const gradient = this.ctx.createLinearGradient(0, canvasHeight - barHeight, 0, canvasHeight);
    
    gradient.addColorStop(0, `hsl(${hue}, ${saturationBase}%, ${lightnessBase + 20}%)`);
    gradient.addColorStop(0.3, `hsl(${hue + 15}, ${saturationBase - 5}%, ${lightnessBase + 10}%)`);
    gradient.addColorStop(0.7, `hsl(${hue + 30}, ${saturationBase - 10}%, ${lightnessBase}%)`);
    gradient.addColorStop(1, `hsl(${hue + 45}, ${saturationBase - 15}%, ${lightnessBase - 10}%)`);
    
    return gradient;
  }

  getBarHue(barIndex, barHeight, canvasHeight) {
    // Color mapping for musical frequencies:
    // Bass (20-200Hz) = Red/Orange
    // Low-Mid (200-800Hz) = Yellow/Green  
    // Mid (800-3kHz) = Green/Cyan
    // High-Mid (3-8kHz) = Cyan/Blue
    // Treble (8-16kHz) = Blue/Purple
    
    const freqRatio = barIndex / this.config.numBars;
    let baseHue;
    
    if (freqRatio < 0.2) {
      // Bass frequencies: Red to Orange (0-30 degrees)
      baseHue = freqRatio * 5 * 30;
    } else if (freqRatio < 0.4) {
      // Low-mid frequencies: Orange to Yellow (30-60 degrees)
      baseHue = 30 + (freqRatio - 0.2) * 5 * 30;
    } else if (freqRatio < 0.6) {
      // Mid frequencies: Yellow to Green (60-120 degrees)
      baseHue = 60 + (freqRatio - 0.4) * 5 * 60;
    } else if (freqRatio < 0.8) {
      // High-mid frequencies: Green to Cyan (120-180 degrees)
      baseHue = 120 + (freqRatio - 0.6) * 5 * 60;
    } else {
      // Treble frequencies: Cyan to Purple (180-280 degrees)
      baseHue = 180 + (freqRatio - 0.8) * 5 * 100;
    }
    
    const intensity = barHeight / (canvasHeight * this.config.maxBarHeight);
    return baseHue + (intensity * 15); // Slight hue shift based on intensity
  }

  drawBarReflection(x, barWidth, height, hue) {
    const reflectionHeight = 10;
    const reflectionGradient = this.ctx.createLinearGradient(0, height, 0, height - reflectionHeight);
    reflectionGradient.addColorStop(0, `hsla(${hue}, 70%, 50%, 0.3)`);
    reflectionGradient.addColorStop(1, `hsla(${hue}, 70%, 50%, 0)`);
    
    this.ctx.fillStyle = reflectionGradient;
    this.ctx.fillRect(x, height - reflectionHeight, barWidth, reflectionHeight);
  }

  drawScanLines(width, height) {
    this.ctx.strokeStyle = `rgba(0, 255, 255, ${this.config.scanLineOpacity})`;
    this.ctx.lineWidth = 1;
    
    for (let y = 0; y < height; y += this.config.scanLineSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }
  }

  drawEmpty() {
    if (!this.ctx) return;
    
    const width = this.canvas.width / 2;
    const height = this.canvas.height / 2;
    
    // Clear with retro gradient background
    this.drawBackground(width, height);
    
    // Draw static retro bars at low height
    this.drawStaticBars(width, height);
    
    // Add retro scan lines
    this.drawScanLines(width, height);
    
    // Draw placeholder text
    this.drawPlaceholderText(width, height);
    
    // Add retro border glow
    this.drawBorderGlow(width, height);
  }

  drawStaticBars(width, height) {
    const barWidth = (width - (this.config.numBars + 1) * this.config.spacing) / this.config.numBars;
    const staticHeight = 8;
    
    for (let i = 0; i < this.config.numBars; i++) {
      const x = i * (barWidth + this.config.spacing) + this.config.spacing;
      const hue = (i / this.config.numBars) * 300;
      
      // Dim colors for inactive state
      const gradient = this.ctx.createLinearGradient(0, height - staticHeight, 0, height);
      gradient.addColorStop(0, `hsla(${hue}, 60%, 30%, 0.6)`);
      gradient.addColorStop(1, `hsla(${hue + 60}, 50%, 20%, 0.4)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.roundRect(x, height - staticHeight, barWidth, staticHeight, [2, 2, 0, 0]);
      this.ctx.fill();
    }
  }

  drawPlaceholderText(width, height) {
    this.ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
    this.ctx.font = '12px "Courier New", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('AUDIO VISUALIZATION READY', width / 2, height / 2 + 20);
  }

  drawBorderGlow(width, height) {
    this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(2, 2, width - 4, height - 4);
  }

  // Configuration methods
  setConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('🎨 Visualizer config updated:', this.config);
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
    console.log('🎨 Visualizer destroyed');
  }
}

// Export for use in other modules
window.AudioVisualizer = AudioVisualizer;