// 32 supported locales in exact specified order (same policy as the public site)
export const LOCALES = [
  { code: 'bn-BD', native: 'বাংলা', english: 'Bangla', flag: '🇧🇩', rtl: false },
  { code: 'en-GB', native: 'English (UK)', english: 'English (UK)', flag: '🇬🇧', rtl: false },
  { code: 'en-US', native: 'English (US)', english: 'English (US)', flag: '🇺🇸', rtl: false },
  { code: 'en-AU', native: 'English (Australian)', english: 'English (Australian)', flag: '🇦🇺', rtl: false },
  { code: 'ar-SA', native: 'العربية', english: 'Arabic', flag: '🇸🇦', rtl: true },
  { code: 'bg-BG', native: 'Български', english: 'Bulgarian', flag: '🇧🇬', rtl: false },
  { code: 'zh-CN', native: '简体中文', english: 'Chinese Simplified', flag: '🇨🇳', rtl: false },
  { code: 'zh-TW', native: '繁體中文', english: 'Chinese Traditional', flag: '🇹🇼', rtl: false },
  { code: 'hr-HR', native: 'Hrvatski', english: 'Croatian', flag: '🇭🇷', rtl: false },
  { code: 'cs-CZ', native: 'Čeština', english: 'Czech', flag: '🇨🇿', rtl: false },
  { code: 'nl-NL', native: 'Nederlands', english: 'Dutch', flag: '🇳🇱', rtl: false },
  { code: 'fi-FI', native: 'Suomi', english: 'Finnish', flag: '🇫🇮', rtl: false },
  { code: 'fr-FR', native: 'Français', english: 'French', flag: '🇫🇷', rtl: false },
  { code: 'de-DE', native: 'Deutsch', english: 'German', flag: '🇩🇪', rtl: false },
  { code: 'el-GR', native: 'Ελληνικά', english: 'Greek', flag: '🇬🇷', rtl: false },
  { code: 'hu-HU', native: 'Magyar', english: 'Hungarian', flag: '🇭🇺', rtl: false },
  { code: 'id-ID', native: 'Bahasa Indonesia', english: 'Indonesian', flag: '🇮🇩', rtl: false },
  { code: 'it-IT', native: 'Italiano', english: 'Italian', flag: '🇮🇹', rtl: false },
  { code: 'lt-LT', native: 'Lietuvių', english: 'Lithuanian', flag: '🇱🇹', rtl: false },
  { code: 'pl-PL', native: 'Polski', english: 'Polish', flag: '🇵🇱', rtl: false },
  { code: 'pt-PT', native: 'Português', english: 'Portuguese (Portugal)', flag: '🇵🇹', rtl: false },
  { code: 'pt-BR', native: 'Português (Brasil)', english: 'Portuguese (Brazil)', flag: '🇧🇷', rtl: false },
  { code: 'fa-IR', native: 'فارسی', english: 'Persian', flag: '🇮🇷', rtl: true },
  { code: 'ro-RO', native: 'Română', english: 'Romanian', flag: '🇷🇴', rtl: false },
  { code: 'ru-RU', native: 'Русский', english: 'Russian', flag: '🇷🇺', rtl: false },
  { code: 'sr-RS', native: 'Srpski', english: 'Serbian', flag: '🇷🇸', rtl: false },
  { code: 'es-ES', native: 'Español', english: 'Spanish', flag: '🇪🇸', rtl: false },
  { code: 'th-TH', native: 'ภาษาไทย', english: 'Thai', flag: '🇹🇭', rtl: false },
  { code: 'tr-TR', native: 'Türkçe', english: 'Turkish', flag: '🇹🇷', rtl: false },
  { code: 'uk-UA', native: 'Українська', english: 'Ukrainian', flag: '🇺🇦', rtl: false },
  { code: 'vi-VN', native: 'Tiếng Việt', english: 'Vietnamese', flag: '🇻🇳', rtl: false },
  { code: 'he-IL', native: 'עברית', english: 'Hebrew', flag: '🇮🇱', rtl: true },
]

export const getLocale = (code) => LOCALES.find(l => l.code === code) || LOCALES[2]

// Map legacy short codes to full locale codes (admin default: English)
export const normalizeLang = (lang) => {
  if (!lang) return 'en-US'
  if (lang === 'bn') return 'bn-BD'
  if (lang === 'en') return 'en-US'
  if (LOCALES.some(l => l.code === lang)) return lang
  return 'en-US'
}
