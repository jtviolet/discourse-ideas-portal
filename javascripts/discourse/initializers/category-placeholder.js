import { apiInitializer } from "discourse/lib/api";
import I18n from "I18n";
// Assuming ideas-portal-helper.js is correctly imported or helpers are globally available
import { shouldEnableForCategoryOrTag } from "../lib/ideas-portal-helper"; // Adjust path as needed

export default apiInitializer("0.8.2", (api) => { // Increment version
  const originalChooseCategoryText = I18n.translations.en.js.category.choose;
  const customPlaceholderText = "Choose a product...";

  const descriptor = Object.getOwnPropertyDescriptor(I18n.translations.en.js.category, 'choose');
   // Add check to prevent redefining if script runs multiple times
   if (descriptor && descriptor.get && descriptor.get.toString().includes("CUSTOM_PLACEHOLDER_CHECK")) {
       console.debug("Ideas Portal: Category placeholder modification already applied.");
       return;
   }


  try {
    Object.defineProperty(I18n.translations.en.js.category, 'choose', {
      get: function() {
        // Add a comment marker to check if already applied
        // CUSTOM_PLACEHOLDER_CHECK
        // Pass api.container to the helper function
        return shouldEnableForCategoryOrTag(api.container) ? customPlaceholderText : originalChooseCategoryText;
      },
      configurable: true
    });
  } catch (e) {
      console.error("Ideas Portal: Failed to modify category placeholder text.", e);
  }
});