import { apiInitializer } from "discourse/lib/api";
import I18n from "I18n";
import { shouldEnable } from "../lib/ideas-portal-utils";

export default apiInitializer("0.8", (api) => {
  // Save the original translation for the category chooser
  const originalChoose = I18n.translations.en.js.category.choose;
  
  // Override the translation getter to conditionally return our custom text
  Object.defineProperty(I18n.translations.en.js.category, 'choose', {
    get: function() {
      return shouldEnable(api) ? "Choose a product..." : originalChoose;
    },
    configurable: true
  });
});
