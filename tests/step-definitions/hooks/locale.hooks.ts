import { Before } from "@wdio/cucumber-framework";
import { setActiveLocaleConfig } from "../../../config/capabilities/capability-builder";
import { buildLocaleConfigFromTags, hasLocaleConfiguration } from "../../../config/capabilities/locale-configs";

/**
 * Hook to configure locale based on @locale:, @language:, and @timezone: tags
 * Tags are independent and can be mixed (e.g., @locale:pt_BR @language:fr)
 */
Before({ timeout: 5000 }, function (scenario) {
  const tags = scenario.pickle.tags.map((tag) => tag.name);

  // Check if any locale-related tags are present
  if (hasLocaleConfiguration(tags)) {
    console.log(`\n[LOCALE HOOK] Detected locale configuration tags`);

    // Build complete locale config from tags (with fallback to defaults)
    const localeConfig = buildLocaleConfigFromTags(tags);
    setActiveLocaleConfig(localeConfig);

    console.log(`[LOCALE HOOK] ✓ Configured locale environment:`);
    console.log(`  - Language: ${localeConfig.language}`);
    console.log(`  - Locale: ${localeConfig.locale}`);
    console.log(`  - Timezone: ${localeConfig.timezone}`);

    this.expectedLocale = localeConfig;
  }
});
