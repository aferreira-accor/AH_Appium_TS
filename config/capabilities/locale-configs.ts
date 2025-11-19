/**
 * Locale configurations for international testing
 *
 * These configurations can be specified independently via Cucumber tags:
 * - @language:XX - System UI language (ISO 639-1 code, e.g., "fr", "en", "ja")
 * - @locale:XX_YY - Regional format (language_COUNTRY code, e.g., "fr_FR", "en_US")
 * - @timezone:XXX - System timezone (IANA timezone database name, e.g., "Paris", "New_York")
 *
 * Each property is optional and independent:
 * - You can specify only @locale:fr_FR (language and timezone will use defaults from predefined config)
 * - You can mix them: @locale:pt_BR @language:fr (Brazilian formats with French UI)
 * - Omitted properties will use defaults from the predefined locale config or global defaults
 *
 * These settings affect:
 * - Date/time formats displayed in the app
 * - Number and currency formatting
 * - System language for OS-level UI
 * - Timezone for date/time display
 *
 * Note: geoLocation (IP Geolocation) removed - requires BrowserStack Enterprise plan
 */

export interface LocaleConfig {
  /** System UI language (e.g., "fr", "en", "ja") - Optional, can be overridden by @language: tag */
  language?: string;

  /** Regional format for dates, numbers, currency (e.g., "fr_FR", "en_US") - Optional, can be overridden by @locale: tag */
  locale?: string;

  /** IANA timezone (e.g., "Paris", "New_York", "Tokyo") - Optional, can be overridden by @timezone: tag */
  timezone?: string;
}

/**
 * Predefined locale configurations for common Accor Hotels markets
 */
export const LOCALE_CONFIGS: Record<string, LocaleConfig> = {
  // France - Primary market for Accor
  "fr_FR": {
    language: "fr",
    locale: "fr_FR",
    timezone: "Paris",
  },

  // United States - Major international market
  "en_US": {
    language: "en",
    locale: "en_US",
    timezone: "New_York",
  },

  // Japan - Key Asian market
  "ja_JP": {
    language: "ja",
    locale: "ja_JP",
    timezone: "Tokyo",
  },

  // United Kingdom - European market
  "en_GB": {
    language: "en",
    locale: "en_GB",
    timezone: "London",
  },

  // Germany - European market
  "de_DE": {
    language: "de",
    locale: "de_DE",
    timezone: "Berlin",
  },

  // Spain - European market
  "es_ES": {
    language: "es",
    locale: "es_ES",
    timezone: "Madrid",
  },

  // China - Asian market
  "zh_CN": {
    language: "zh",
    locale: "zh_CN",
    timezone: "Shanghai",
  },

  // Australia - Pacific market
  "en_AU": {
    language: "en",
    locale: "en_AU",
    timezone: "Sydney",
  },

  // Brazil - Latin American market
  "pt_BR": {
    language: "pt",
    locale: "pt_BR",
    timezone: "Sao_Paulo",
  },

  // Italy - European market
  "it_IT": {
    language: "it",
    locale: "it_IT",
    timezone: "Rome",
  },
};

/**
 * Get locale configuration by identifier
 * @param localeId - Locale identifier (e.g., "fr_FR", "en_US")
 * @returns Locale configuration
 * @throws Error if locale not found
 */
export function getLocaleConfig(localeId: string): LocaleConfig {
  const config = LOCALE_CONFIGS[localeId];
  if (!config) {
    const availableLocales = Object.keys(LOCALE_CONFIGS).join(", ");
    throw new Error(
      `Unknown locale: ${localeId}. Available locales: ${availableLocales}`
    );
  }
  return config;
}

/**
 * Parse locale configuration from Gherkin data table
 * @param table - Cucumber data table with language, locale, timezone columns
 * @returns Locale configuration
 *
 * Expected table format:
 * | language | locale | timezone |
 * | fr       | fr_FR  | Paris    |
 */
export function parseLocaleFromTable(table: any): LocaleConfig {
  // Get the data table as an array of hashes (objects)
  // First row is headers, second row is data
  const hashes = table.hashes();

  if (hashes.length === 0) {
    throw new Error("Data table is empty. Expected one row with locale configuration.");
  }

  const data = hashes[0]; // Get first data row

  return {
    language: data.language,
    locale: data.locale,
    timezone: data.timezone,
  };
}

/**
 * Get default locale configuration (French/France)
 */
export function getDefaultLocaleConfig(): LocaleConfig {
  return LOCALE_CONFIGS["fr_FR"];
}

/**
 * Extract language, locale, and timezone from Cucumber tags
 * @param tags - Array of Cucumber tags (e.g., ["@locale:fr_FR", "@language:fr", "@timezone:Paris"])
 * @returns LocaleConfig with extracted values (properties may be undefined if not specified)
 *
 * @example
 * // Full specification
 * extractLocaleFromTags(["@locale:fr_FR", "@language:fr", "@timezone:Paris"])
 * // => { locale: "fr_FR", language: "fr", timezone: "Paris" }
 *
 * @example
 * // Partial specification (mix Brazilian formats with French UI)
 * extractLocaleFromTags(["@locale:pt_BR", "@language:fr"])
 * // => { locale: "pt_BR", language: "fr", timezone: undefined }
 *
 * @example
 * // Only locale specified
 * extractLocaleFromTags(["@locale:en_US"])
 * // => { locale: "en_US", language: undefined, timezone: undefined }
 */
export function extractLocaleFromTags(tags: string[]): LocaleConfig {
  const config: LocaleConfig = {};

  for (const tag of tags) {
    if (tag.startsWith("@locale:")) {
      config.locale = tag.replace("@locale:", "");
    } else if (tag.startsWith("@language:")) {
      config.language = tag.replace("@language:", "");
    } else if (tag.startsWith("@timezone:")) {
      config.timezone = tag.replace("@timezone:", "");
    }
  }

  return config;
}

/**
 * Build complete locale configuration by merging tag overrides with predefined defaults
 * @param tags - Array of Cucumber tags
 * @param defaultLocaleId - Default locale ID to use for missing properties (default: "fr_FR")
 * @returns Complete LocaleConfig with all properties defined
 *
 * Priority order:
 * 1. Explicit tags (@language:, @locale:, @timezone:)
 * 2. Predefined config from @locale: tag if it exists
 * 3. Predefined config from defaultLocaleId
 *
 * @example
 * // Override language but keep locale defaults
 * buildLocaleConfigFromTags(["@locale:pt_BR", "@language:fr"])
 * // => { locale: "pt_BR", language: "fr", timezone: "Sao_Paulo" (from pt_BR config) }
 *
 * @example
 * // Full override
 * buildLocaleConfigFromTags(["@locale:en_US", "@language:ja", "@timezone:Tokyo"])
 * // => { locale: "en_US", language: "ja", timezone: "Tokyo" }
 */
export function buildLocaleConfigFromTags(
  tags: string[],
  defaultLocaleId: string = "fr_FR"
): LocaleConfig {
  // Extract explicit overrides from tags
  const overrides = extractLocaleFromTags(tags);

  // Get base config: use the locale specified in tags, or fall back to default
  const baseLocaleId = overrides.locale || defaultLocaleId;
  const baseConfig = LOCALE_CONFIGS[baseLocaleId] || getDefaultLocaleConfig();

  // Merge: explicit overrides take precedence over base config
  return {
    language: overrides.language ?? baseConfig.language,
    locale: overrides.locale ?? baseConfig.locale,
    timezone: overrides.timezone ?? baseConfig.timezone,
  };
}

/**
 * Check if tags contain any locale-related configuration
 * @param tags - Array of Cucumber tags
 * @returns True if any @locale:, @language:, or @timezone: tag is present
 */
export function hasLocaleConfiguration(tags: string[]): boolean {
  return tags.some(
    (tag) =>
      tag.startsWith("@locale:") ||
      tag.startsWith("@language:") ||
      tag.startsWith("@timezone:")
  );
}
