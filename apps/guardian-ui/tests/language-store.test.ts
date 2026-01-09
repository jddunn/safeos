/**
 * Language Store Tests
 *
 * Unit tests for language/locale management and RTL support.
 *
 * @module tests/language-store.test
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// =============================================================================
// Types (extracted from i18n config)
// =============================================================================

const locales = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'ar'] as const;
type Locale = (typeof locales)[number];

const defaultLocale: Locale = 'en';

const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  zh: '中文',
  ja: '日本語',
  pt: 'Português',
  ar: 'العربية',
};

const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  zh: '🇨🇳',
  ja: '🇯🇵',
  pt: '🇧🇷',
  ar: '🇸🇦',
};

const rtlLocales: Locale[] = ['ar'];

// =============================================================================
// Helper Functions (extracted from store/config)
// =============================================================================

function isRtl(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

interface MockNavigator {
  language: string;
  languages: string[];
}

function detectBrowserLocale(mockNav?: MockNavigator): Locale {
  if (!mockNav) {
    return defaultLocale;
  }

  // Check navigator.language
  const browserLang = mockNav.language.split('-')[0];
  if (locales.includes(browserLang as Locale)) {
    return browserLang as Locale;
  }

  // Check navigator.languages array
  for (const lang of mockNav.languages) {
    const shortLang = lang.split('-')[0];
    if (locales.includes(shortLang as Locale)) {
      return shortLang as Locale;
    }
  }

  return defaultLocale;
}

function getMessages(locale: Locale): Record<string, string> {
  // Mock messages for testing
  return {
    'app.title': `SafeOS Guardian (${locale})`,
    'app.welcome': `Welcome (${locale})`,
  };
}

// =============================================================================
// Mock Store Class
// =============================================================================

class LanguageStore {
  locale: Locale = defaultLocale;
  messages: Record<string, string> = getMessages(defaultLocale);
  isRtl: boolean = false;
  isLoaded: boolean = false;

  // Document mock for testing
  private documentMock: { dir: string; lang: string } | null = null;

  setDocumentMock(mock: { dir: string; lang: string } | null): void {
    this.documentMock = mock;
  }

  setLocale(locale: Locale): void {
    // Validate locale
    if (!locales.includes(locale)) {
      console.warn(`Invalid locale: ${locale}, falling back to ${defaultLocale}`);
      locale = defaultLocale;
    }

    const messages = getMessages(locale);
    const rtl = isRtl(locale);

    // Update document direction for RTL languages
    if (this.documentMock) {
      this.documentMock.dir = rtl ? 'rtl' : 'ltr';
      this.documentMock.lang = locale;
    }

    this.locale = locale;
    this.messages = messages;
    this.isRtl = rtl;
    this.isLoaded = true;
  }

  detectLocale(mockNav?: MockNavigator): void {
    const detected = detectBrowserLocale(mockNav);
    const messages = getMessages(detected);
    const rtl = isRtl(detected);

    if (this.documentMock) {
      this.documentMock.dir = rtl ? 'rtl' : 'ltr';
      this.documentMock.lang = detected;
    }

    this.locale = detected;
    this.messages = messages;
    this.isRtl = rtl;
    this.isLoaded = true;
  }

  reset(): void {
    const messages = getMessages(defaultLocale);
    const rtl = isRtl(defaultLocale);

    if (this.documentMock) {
      this.documentMock.dir = rtl ? 'rtl' : 'ltr';
      this.documentMock.lang = defaultLocale;
    }

    this.locale = defaultLocale;
    this.messages = messages;
    this.isRtl = rtl;
    this.isLoaded = true;
  }
}

// =============================================================================
// Selectors (extracted from store)
// =============================================================================

const selectLocale = (state: LanguageStore) => state.locale;
const selectMessages = (state: LanguageStore) => state.messages;
const selectIsRtl = (state: LanguageStore) => state.isRtl;
const selectIsLoaded = (state: LanguageStore) => state.isLoaded;

// =============================================================================
// Tests
// =============================================================================

describe('Language Store', () => {
  let store: LanguageStore;

  beforeEach(() => {
    store = new LanguageStore();
  });

  describe('i18n Configuration', () => {
    describe('locales', () => {
      it('should have 8 supported locales', () => {
        expect(locales).toHaveLength(8);
      });

      it('should include all expected locales', () => {
        expect(locales).toContain('en');
        expect(locales).toContain('es');
        expect(locales).toContain('fr');
        expect(locales).toContain('de');
        expect(locales).toContain('zh');
        expect(locales).toContain('ja');
        expect(locales).toContain('pt');
        expect(locales).toContain('ar');
      });

      it('should have English as default locale', () => {
        expect(defaultLocale).toBe('en');
      });
    });

    describe('localeNames', () => {
      it('should have names for all locales', () => {
        locales.forEach((locale) => {
          expect(localeNames[locale]).toBeTruthy();
        });
      });

      it('should have correct English name', () => {
        expect(localeNames.en).toBe('English');
      });

      it('should have correct Spanish name', () => {
        expect(localeNames.es).toBe('Español');
      });

      it('should have correct Arabic name', () => {
        expect(localeNames.ar).toBe('العربية');
      });

      it('should have correct Chinese name', () => {
        expect(localeNames.zh).toBe('中文');
      });

      it('should have correct Japanese name', () => {
        expect(localeNames.ja).toBe('日本語');
      });
    });

    describe('localeFlags', () => {
      it('should have flags for all locales', () => {
        locales.forEach((locale) => {
          expect(localeFlags[locale]).toBeTruthy();
        });
      });

      it('should use US flag for English', () => {
        expect(localeFlags.en).toBe('🇺🇸');
      });

      it('should use Saudi flag for Arabic', () => {
        expect(localeFlags.ar).toBe('🇸🇦');
      });

      it('should use China flag for Chinese', () => {
        expect(localeFlags.zh).toBe('🇨🇳');
      });
    });

    describe('rtlLocales', () => {
      it('should have Arabic as RTL', () => {
        expect(rtlLocales).toContain('ar');
      });

      it('should only have one RTL locale', () => {
        expect(rtlLocales).toHaveLength(1);
      });
    });
  });

  describe('isRtl', () => {
    it('should return true for Arabic', () => {
      expect(isRtl('ar')).toBe(true);
    });

    it('should return false for English', () => {
      expect(isRtl('en')).toBe(false);
    });

    it('should return false for all non-RTL locales', () => {
      const ltrLocales: Locale[] = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'pt'];
      ltrLocales.forEach((locale) => {
        expect(isRtl(locale)).toBe(false);
      });
    });
  });

  describe('detectBrowserLocale', () => {
    it('should return default locale when no navigator', () => {
      expect(detectBrowserLocale()).toBe(defaultLocale);
    });

    it('should detect English from navigator.language', () => {
      expect(
        detectBrowserLocale({
          language: 'en-US',
          languages: ['en-US'],
        })
      ).toBe('en');
    });

    it('should detect Spanish from navigator.language', () => {
      expect(
        detectBrowserLocale({
          language: 'es-ES',
          languages: ['es-ES'],
        })
      ).toBe('es');
    });

    it('should detect French from navigator.language', () => {
      expect(
        detectBrowserLocale({
          language: 'fr-FR',
          languages: ['fr-FR'],
        })
      ).toBe('fr');
    });

    it('should detect Arabic from navigator.language', () => {
      expect(
        detectBrowserLocale({
          language: 'ar-SA',
          languages: ['ar-SA'],
        })
      ).toBe('ar');
    });

    it('should fall back to navigator.languages', () => {
      expect(
        detectBrowserLocale({
          language: 'ko-KR', // Korean not supported
          languages: ['ko-KR', 'ja-JP', 'en-US'],
        })
      ).toBe('ja');
    });

    it('should return default for unsupported language', () => {
      expect(
        detectBrowserLocale({
          language: 'ko-KR',
          languages: ['ko-KR', 'th-TH'],
        })
      ).toBe(defaultLocale);
    });

    it('should handle language codes without region', () => {
      expect(
        detectBrowserLocale({
          language: 'de',
          languages: ['de'],
        })
      ).toBe('de');
    });
  });

  describe('Initial State', () => {
    it('should start with default locale', () => {
      expect(store.locale).toBe(defaultLocale);
    });

    it('should have messages for default locale', () => {
      expect(store.messages).toEqual(getMessages(defaultLocale));
    });

    it('should not be RTL initially', () => {
      expect(store.isRtl).toBe(false);
    });

    it('should not be loaded initially', () => {
      expect(store.isLoaded).toBe(false);
    });
  });

  describe('setLocale', () => {
    it('should set locale to Spanish', () => {
      store.setLocale('es');
      expect(store.locale).toBe('es');
    });

    it('should update messages for new locale', () => {
      store.setLocale('fr');
      expect(store.messages).toEqual(getMessages('fr'));
    });

    it('should set isLoaded to true', () => {
      store.setLocale('de');
      expect(store.isLoaded).toBe(true);
    });

    it('should set isRtl for Arabic', () => {
      store.setLocale('ar');
      expect(store.isRtl).toBe(true);
    });

    it('should not set isRtl for LTR languages', () => {
      store.setLocale('ar');
      expect(store.isRtl).toBe(true);

      store.setLocale('en');
      expect(store.isRtl).toBe(false);
    });

    it('should update document direction for RTL', () => {
      const docMock = { dir: 'ltr', lang: 'en' };
      store.setDocumentMock(docMock);

      store.setLocale('ar');
      expect(docMock.dir).toBe('rtl');
      expect(docMock.lang).toBe('ar');
    });

    it('should update document direction for LTR', () => {
      const docMock = { dir: 'rtl', lang: 'ar' };
      store.setDocumentMock(docMock);

      store.setLocale('en');
      expect(docMock.dir).toBe('ltr');
      expect(docMock.lang).toBe('en');
    });

    it('should fall back to default for invalid locale', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Cast to any to test invalid input
      store.setLocale('invalid' as any);

      expect(store.locale).toBe(defaultLocale);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('detectLocale', () => {
    it('should detect locale from navigator', () => {
      store.detectLocale({
        language: 'es-MX',
        languages: ['es-MX', 'en-US'],
      });
      expect(store.locale).toBe('es');
    });

    it('should set isLoaded after detection', () => {
      store.detectLocale({
        language: 'en-US',
        languages: ['en-US'],
      });
      expect(store.isLoaded).toBe(true);
    });

    it('should update document for detected locale', () => {
      const docMock = { dir: 'ltr', lang: 'en' };
      store.setDocumentMock(docMock);

      store.detectLocale({
        language: 'ar-EG',
        languages: ['ar-EG'],
      });

      expect(docMock.dir).toBe('rtl');
      expect(docMock.lang).toBe('ar');
    });

    it('should default without navigator', () => {
      store.detectLocale();
      expect(store.locale).toBe(defaultLocale);
    });
  });

  describe('reset', () => {
    it('should reset to default locale', () => {
      store.setLocale('ja');
      store.reset();
      expect(store.locale).toBe(defaultLocale);
    });

    it('should reset messages', () => {
      store.setLocale('zh');
      store.reset();
      expect(store.messages).toEqual(getMessages(defaultLocale));
    });

    it('should reset RTL', () => {
      store.setLocale('ar');
      expect(store.isRtl).toBe(true);
      store.reset();
      expect(store.isRtl).toBe(false);
    });

    it('should keep isLoaded true after reset', () => {
      store.setLocale('fr');
      store.reset();
      expect(store.isLoaded).toBe(true);
    });

    it('should update document on reset', () => {
      const docMock = { dir: 'rtl', lang: 'ar' };
      store.setDocumentMock(docMock);
      store.setLocale('ar');

      store.reset();

      expect(docMock.dir).toBe('ltr');
      expect(docMock.lang).toBe(defaultLocale);
    });
  });

  describe('Selectors', () => {
    it('selectLocale should return current locale', () => {
      store.setLocale('pt');
      expect(selectLocale(store)).toBe('pt');
    });

    it('selectMessages should return current messages', () => {
      store.setLocale('de');
      expect(selectMessages(store)).toEqual(getMessages('de'));
    });

    it('selectIsRtl should return RTL status', () => {
      expect(selectIsRtl(store)).toBe(false);
      store.setLocale('ar');
      expect(selectIsRtl(store)).toBe(true);
    });

    it('selectIsLoaded should return loaded status', () => {
      expect(selectIsLoaded(store)).toBe(false);
      store.setLocale('en');
      expect(selectIsLoaded(store)).toBe(true);
    });
  });

  describe('Locale Switching', () => {
    it('should switch between multiple locales', () => {
      const testLocales: Locale[] = ['en', 'es', 'fr', 'ar', 'zh'];

      testLocales.forEach((locale) => {
        store.setLocale(locale);
        expect(store.locale).toBe(locale);
        expect(store.isRtl).toBe(isRtl(locale));
      });
    });

    it('should handle rapid locale changes', () => {
      store.setLocale('en');
      store.setLocale('es');
      store.setLocale('fr');
      store.setLocale('de');
      store.setLocale('ja');

      expect(store.locale).toBe('ja');
      expect(store.messages).toEqual(getMessages('ja'));
    });

    it('should correctly toggle RTL on locale switch', () => {
      store.setLocale('en');
      expect(store.isRtl).toBe(false);

      store.setLocale('ar');
      expect(store.isRtl).toBe(true);

      store.setLocale('zh');
      expect(store.isRtl).toBe(false);

      store.setLocale('ar');
      expect(store.isRtl).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle setting same locale multiple times', () => {
      store.setLocale('es');
      store.setLocale('es');
      store.setLocale('es');
      expect(store.locale).toBe('es');
    });

    it('should handle detect after manual set', () => {
      store.setLocale('ja');
      store.detectLocale({
        language: 'fr-FR',
        languages: ['fr-FR'],
      });
      expect(store.locale).toBe('fr');
    });

    it('should handle reset after detect', () => {
      store.detectLocale({
        language: 'ar-SA',
        languages: ['ar-SA'],
      });
      expect(store.isRtl).toBe(true);

      store.reset();
      expect(store.locale).toBe(defaultLocale);
      expect(store.isRtl).toBe(false);
    });
  });

  describe('Messages Structure', () => {
    it('should have consistent message structure across locales', () => {
      locales.forEach((locale) => {
        const messages = getMessages(locale);
        expect(messages['app.title']).toBeTruthy();
        expect(messages['app.welcome']).toBeTruthy();
      });
    });

    it('should include locale in messages', () => {
      const enMessages = getMessages('en');
      const esMessages = getMessages('es');

      expect(enMessages['app.title']).toContain('en');
      expect(esMessages['app.title']).toContain('es');
    });
  });
});
