import { apiInitializer } from "discourse/lib/api";
// Assuming ideas-portal-helper.js is correctly imported or helpers are globally available
import {
    shouldEnableForTagOnly,
    isEnabledTagPage, // Keep for direct checks if needed
    resetCache // Import resetCache if needed for cleanup
} from "../lib/ideas-portal-helper"; // Adjust path as needed

export default apiInitializer("0.8.1", (api) => { // Increment version if dependent on helper

  // Filter categories shown in the composer's category chooser ONLY on enabled tag pages
  api.modifyClass("component:category-chooser", {
    pluginId: "netwrix-ideas-category-filter", // Keep original pluginId if necessary

    // Cache enabled category IDs specific to this modification
    _ideasEnabledCategoryIds: null,

    _getEnabledIds() {
        if (this._ideasEnabledCategoryIds === null) {
            this._ideasEnabledCategoryIds = settings.enabled_categories
                ? settings.enabled_categories
                    .split("|")
                    .map(id => parseInt(id, 10))
                    .filter(id => !isNaN(id))
                : [];
        }
        return this._ideasEnabledCategoryIds;
    },

    // Override the content getter
    get content() {
      // Only filter if we are specifically on an enabled tag page
      if (!shouldEnableForTagOnly()) { // Use helper for tag-only check
        // Reset cache if navigating away from relevant page
        this._ideasEnabledCategoryIds = null;
        // Use the original getter logic if available, otherwise default to site categories
        return this._super ? this._super() : (this.site?.categories || []);
      }

      const enabledIds = this._getEnabledIds();
      const allCategories = this._super ? this._super() : (this.site?.categories || []);

      // Filter the categories based on the enabled IDs
      return allCategories.filter(cat => enabledIds.includes(cat.id));
    },

    // Ensure cache is cleared if component is destroyed or settings change
     willDestroyElement() {
        this._ideasEnabledCategoryIds = null;
        if (this._super) {
            this._super(...arguments);
        }
     }
  });


  // Add body classes and attempt to filter navigation dropdown categories
  const updateBodyClassesAndNavFilter = () => {
      const shouldEnable = shouldEnableForTagOnly(); // Use helper

      if (shouldEnable) {
          document.body.classList.add("ideas-hide-category-badges");
          document.body.classList.add("ideas-filter-category-dropdown"); // Class for potential CSS-based filtering

          // WARNING: Filtering the navigation dropdown via JS/setTimeout is fragile.
          // It depends on timing and the exact DOM structure of the dropdown, which can change.
          // A CSS-based approach using the body class might be more reliable if feasible.
          // Consider looking for Discourse plugin outlets or core events related to dropdowns.
          setTimeout(() => {
              try {
                  const enabledCategoryIds = settings.enabled_categories
                      ? settings.enabled_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
                      : [];

                  // Adjust selector based on current Discourse structure for category dropdown items
                  const categoryDropdownItems = document.querySelectorAll('.category-dropdown-menu .category-link[data-category-id]'); // Example selector
                  if (categoryDropdownItems.length > 0) {
                      categoryDropdownItems.forEach(item => {
                          const categoryId = item.getAttribute('data-category-id');
                          if (categoryId && !enabledCategoryIds.includes(parseInt(categoryId, 10))) {
                              // Hiding might be better done by adding a class and using CSS
                              item.style.display = 'none';
                          } else {
                              item.style.display = ''; // Ensure visible if it should be
                          }
                      });
                  }
              } catch (e) {
                  console.warn("Ideas Portal: Failed to apply filter to category navigation dropdown (fragile operation).", e);
              }
          }, 500); // 500ms delay is arbitrary and might not always be sufficient

      } else {
          document.body.classList.remove("ideas-hide-category-badges");
          document.body.classList.remove("ideas-filter-category-dropdown");
      }
  };

  // Apply changes on page load/change
  api.onPageChange(() => {
      updateBodyClassesAndNavFilter();
  });

  // Clean up body classes on exit
  api.cleanupStream(() => {
    resetCache(); // Reset helper cache if needed
    document.body.classList.remove("ideas-hide-category-badges");
    document.body.classList.remove("ideas-filter-category-dropdown");
  });
});