import { apiInitializer } from "discourse/lib/api";
import I18n from "I18n";
// Assuming ideas-portal-helper.js is correctly imported or helpers are globally available
import { shouldEnableForCategoryOrTag } from "../lib/ideas-portal-helper"; // Adjust path as needed

export default apiInitializer("0.8.1", (api) => { // Increment version if dependent on helper
  // Store the original translation once
  const originalChooseCategoryText = I18n.translations.en.js.category.choose;
  const customPlaceholderText = "Choose a product..."; // Or make this configurable via settings/locale

  // Check if the getter is already defined by this initializer to prevent multiple overrides
  const descriptor = Object.getOwnPropertyDescriptor(I18n.translations.en.js.category, 'choose');
  if (descriptor && descriptor.get && descriptor.get.toString().includes("shouldEnableForCategoryOrTag")) {
     console.debug("Ideas Portal: Category placeholder modification already applied.");
     return;
  }

  // Override the translation getter conditionally
  try {
    Object.defineProperty(I18n.translations.en.js.category, 'choose', {
      get: function() {
        // Use the centralized helper function to determine if override should apply
        return shouldEnableForCategoryOrTag() ? customPlaceholderText : originalChooseCategoryText;
      },
      configurable: true // Allow redefining/deleting later if needed
    });
  } catch (e) {
      console.error("Ideas Portal: Failed to modify category placeholder text.", e);
  }

  // No cleanup needed for this specific modification if it's intended to be persistent
  // unless you want to restore the original text under specific conditions via cleanupStream.
});