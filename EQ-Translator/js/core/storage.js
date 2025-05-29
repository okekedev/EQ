// Simple Storage Module
class Storage {
  constructor() {
    this.defaults = {
      useAPIInterception: true,
      sourceLang: 'en-US',
      targetLang: 'es',
      autoTranslate: true,
      autoSpeak: true,
      eq: [0, 0, 0, 0, 0, 0],
      speech: {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      }
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
      chrome.storage.local.get('eqTranslatorSettings', (data) => {
        resolve(data.eqTranslatorSettings || {});
      });
    });
  }

  async saveAll(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ eqTranslatorSettings: settings }, resolve);
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
}

window.Storage = Storage;