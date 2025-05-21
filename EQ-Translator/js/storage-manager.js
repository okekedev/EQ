// Storage manager for user preferences

class StorageManager {
  constructor() {
    this.defaultSettings = {
      equalizer: {
        band1: 0, // 100 Hz (lowshelf)
        band2: 0, // 250 Hz
        band3: 0, // 500 Hz
        band4: 0, // 1000 Hz
        band5: 0, // 4000 Hz
        band6: 0  // 8000 Hz (highshelf)
      },
      translation: {
        sourceLang: 'en',
        targetLang: 'es',
        autoTranslate: true
      },
      speech: {
        recognition: {
          enabled: true,
          continuous: true,
          interimResults: true,
          sourceLang: 'en-US'
        },
        synthesis: {
          enabled: true,
          autoSpeak: true,
          voice: null,
          pitch: 1.0,
          rate: 1.0,
          volume: 1.0
        }
      },
      ui: {
        theme: 'light',
        visualizer: true,
        showTranscript: true,
        compactMode: false
      }
    };
  }

  // Initialize storage with default settings if needed
  async initialize() {
    const settings = await this.getAllSettings();
    
    // If no settings exist, set defaults
    if (!settings || Object.keys(settings).length === 0) {
      await this.saveAllSettings(this.defaultSettings);
      return this.defaultSettings;
    }
    
    return settings;
  }

  // Get all settings from storage
  async getAllSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get('settings', (data) => {
        resolve(data.settings || {});
      });
    });
  }

  // Save all settings to storage
  async saveAllSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ settings }, () => {
        resolve(true);
      });
    });
  }

  // Get specific settings section
  async getSettings(section) {
    const settings = await this.getAllSettings();
    return settings[section] || this.defaultSettings[section] || {};
  }

  // Save specific settings section
  async saveSettings(section, sectionSettings) {
    const settings = await this.getAllSettings();
    
    // Update section settings
    settings[section] = {
      ...(settings[section] || {}),
      ...sectionSettings
    };
    
    // Save all settings
    return this.saveAllSettings(settings);
  }

  // Get individual setting
  async getSetting(section, key) {
    const sectionSettings = await this.getSettings(section);
    return sectionSettings[key];
  }

  // Save individual setting
  async saveSetting(section, key, value) {
    const sectionSettings = await this.getSettings(section);
    sectionSettings[key] = value;
    return this.saveSettings(section, sectionSettings);
  }

  // Reset settings to defaults
  async resetSettings(section = null) {
    if (section) {
      // Reset only the specified section
      return this.saveSettings(section, this.defaultSettings[section] || {});
    } else {
      // Reset all settings
      return this.saveAllSettings(this.defaultSettings);
    }
  }

  // Check if settings exist
  async hasSettings() {
    const settings = await this.getAllSettings();
    return settings && Object.keys(settings).length > 0;
  }

  // Listen for settings changes
  listenForChanges(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.settings) {
        callback(changes.settings.newValue);
      }
    });
  }

  // Get default settings
  getDefaultSettings(section = null) {
    if (section) {
      return this.defaultSettings[section] || {};
    }
    return this.defaultSettings;
  }

  // Export settings
  async exportSettings() {
    const settings = await this.getAllSettings();
    return JSON.stringify(settings, null, 2);
  }

  // Import settings
  async importSettings(settingsJson) {
    try {
      const settings = JSON.parse(settingsJson);
      await this.saveAllSettings(settings);
      return true;
    } catch (error) {
      console.error('Error importing settings:', error);
      return false;
    }
  }
}

// Export the StorageManager class
window.StorageManager = StorageManager;