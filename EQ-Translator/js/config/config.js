// Configuration File
// This file should NOT be committed to Git

const CONFIG = {
  // Google Translate API Key
  GOOGLE_TRANSLATE_API_KEY: 'AIzaSyBbtzyrm0tOf1vbcFZcpWSdVrV6vlSWJWQ',
  
  // API Endpoints
  TRANSLATE_API_URL: 'https://translation.googleapis.com/language/translate/v2',
  
  // Default Settings
  DEFAULT_SOURCE_LANG: 'en',
  DEFAULT_TARGET_LANG: 'es',
  
  // Rate Limiting
  MAX_REQUESTS_PER_MINUTE: 100,
  REQUEST_DELAY_MS: 600,
  
  // Development Mode
  DEBUG: true
};

// Export for use in extension
window.CONFIG = CONFIG;