// Storage Module - EQ Settings with User Toggle State
class Storage {
  constructor() {
    this.defaults = {
      eq: [0, 0, 0, 0, 0, 0, 0, 0],
      eqEnabled: true,
      userToggleState: false // ADDED: Remember user's last toggle state
    };
  }

  async init() {
    // Initialize with defaults if no settings exist
    const existing = await this.getAll();
    if (Object.keys(existing).length === 0) {
      await this.saveAll(this.defaults);
    }
  }

  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get('audioEqualizerSettings', (data) => {
        resolve(data.audioEqualizerSettings || {});
      });
    });
  }

  async saveAll(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ audioEqualizerSettings: settings }, resolve);
    });
  }

  async get(key) {
    const all = await this.getAll();
    return all[key] !== undefined ? all[key] : this.defaults[key];
  }

  async save(key, value) {
    const all = await this.getAll();
    all[key] = value;
    await this.saveAll(all);
  }

  // Convenience methods for EQ settings
  async getEQSettings() {
    const all = await this.getAll();
    return {
      enabled: all.eqEnabled !== undefined ? all.eqEnabled : this.defaults.eqEnabled,
      bands: all.eq !== undefined ? all.eq : this.defaults.eq
    };
  }

  async saveEQSettings(enabled, bands) {
    const all = await this.getAll();
    all.eqEnabled = enabled;
    all.eq = bands;
    await this.saveAll(all);
  }

  // Get current settings for easy access
  async getCurrentSettings() {
    const all = await this.getAll();
    return {
      eqEnabled: all.eqEnabled !== undefined ? all.eqEnabled : this.defaults.eqEnabled,
      eqBands: all.eq !== undefined ? all.eq : this.defaults.eq,
      userToggleState: all.userToggleState !== undefined ? all.userToggleState : this.defaults.userToggleState
    };
  }
}

window.Storage = Storage;