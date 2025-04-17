// javascripts/discourse/initializers/category-placeholder.js
import { apiInitializer } from "discourse/lib/api";
import I18n from "I18n";
import { shouldEnableForCategoryOrTag, resetCache } from "../lib/ideas-portal-helper"; // Assuming cleanup resets cache

export default apiInitializer("0.8.3", (api) => { // Consistent versioning
  const originalChooseCategoryText = I18n.translations.en.js.category.choose;
  const customPlaceholderText = "Choose a product..."; // Or make configurable

  // Avoid re-applying the modification if the script runs again
  const descriptor = Object.getOwnPropertyDescriptor(I18n.translations.en.js.category, 'choose');
   if (descriptor && descriptor.get && descriptor.get._ideasPortalPatched) {
       return; // Already patched
   }

  try {
    const newGetter = function() {
        // Pass api.container to the helper function
        return shouldEnableForCategoryOrTag(api.container) ? customPlaceholderText : originalChooseCategoryText;
    };
    newGetter._ideasPortalPatched = true; // Mark our getter

    Object.defineProperty(I18n.translations.en.js.category, 'choose', {
      get: newGetter,
      configurable: true // Allow cleanup/redefinition
    });
  } catch (e) {
      console.error("Ideas Portal: Failed to modify category placeholder text.", e);
  }

  // Optional: Clean up modification (restore original) - might not be needed
  // api.cleanupStream(() => {
  //     // Might be complex to safely restore if other things modified it
  //     resetCache(); // Reset helper state if applicable
  // });
});