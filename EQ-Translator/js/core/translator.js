// Streamlined Translator
class Translator {
  constructor() {
    this.apiKey = null;
    this.sourceLang = 'en';
    this.targetLang = 'es';
    this.onResult = null;
    this.onError = null;
    this.isTranslating = false;
  }

  async init() {
    // Load API key from config or storage
    try {
      // First try to get from config
      if (window.CONFIG && window.CONFIG.GOOGLE_TRANSLATE_API_KEY) {
        this.apiKey = window.CONFIG.GOOGLE_TRANSLATE_API_KEY;
        console.log('🔑 Using API key from config');
      } else {
        // Fallback to stored API key
        const savedKey = await this.getStoredApiKey();
        if (savedKey) {
          this.apiKey = savedKey;
          console.log('🔑 Using stored API key');
        } else {
          console.warn('⚠️ No API key found. Please set your Google Translate API key.');
        }
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  }

  setTargetLanguage(lang) {
    this.targetLang = lang;
  }

  setSourceLanguage(lang) {
    this.sourceLang = lang;
  }

  async translate(text, sourceLang = null, targetLang = null) {
    if (!text || text.trim() === '') {
      throw new Error('No text to translate');
    }

    if (this.isTranslating) {
      console.warn('Translation already in progress');
      return;
    }

    this.isTranslating = true;

    try {
      const source = sourceLang || this.sourceLang;
      const target = targetLang || this.targetLang;

      console.log(`🌐 Translating: "${text}" from ${source} to ${target}`);

      const result = await this.callGoogleTranslateAPI(text, source, target);

      if (this.onResult) {
        this.onResult({
          originalText: text,
          translatedText: result,
          sourceLang: source,
          targetLang: target
        });
      }

      return result;

    } catch (error) {
      console.error('Translation error:', error);
      
      if (this.onError) {
        this.onError({
          message: error.message || 'Translation failed',
          originalText: text
        });
      }
      
      throw error;
      
    } finally {
      this.isTranslating = false;
    }
  }

  async callGoogleTranslateAPI(text, sourceLang, targetLang) {
    const url = new URL('https://translation.googleapis.com/language/translate/v2');
    
    // Add parameters
    url.searchParams.append('key', this.apiKey);
    url.searchParams.append('q', text);
    url.searchParams.append('source', sourceLang);
    url.searchParams.append('target', targetLang);
    url.searchParams.append('format', 'text');

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data?.data?.translations?.[0]?.translatedText) {
        return data.data.translations[0].translatedText;
      } else {
        throw new Error('No translation result received');
      }

    } catch (error) {
      if (error.message.includes('403') || error.message.includes('API key')) {
        throw new Error('Invalid API key or quota exceeded');
      } else if (error.message.includes('400')) {
        throw new Error('Invalid language codes or text format');
      } else if (error.message.includes('network') || error.name === 'NetworkError') {
        throw new Error('Network error - check your internet connection');
      } else {
        throw new Error(`Translation failed: ${error.message}`);
      }
    }
  }

  getAvailableLanguages() {
    // Common languages for the dropdowns
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
      { code: 'nl', name: 'Dutch' },
      { code: 'sv', name: 'Swedish' },
      { code: 'no', name: 'Norwegian' }
    ];
  }

  async getStoredApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get('translationApiKey', (data) => {
        resolve(data.translationApiKey || null);
      });
    });
  }

  async saveApiKey(apiKey) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ translationApiKey: apiKey }, () => {
        this.apiKey = apiKey;
        resolve(true);
      });
    });
  }

  // Simple validation for language codes
  isValidLanguageCode(code) {
    const validCodes = this.getAvailableLanguages().map(lang => lang.code);
    return validCodes.includes(code);
  }

  // Get language name from code
  getLanguageName(code) {
    const lang = this.getAvailableLanguages().find(l => l.code === code);
    return lang ? lang.name : code;
  }
}

window.Translator = Translator;