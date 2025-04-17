// javascripts/discourse/initializers/tag-page-composer.js
import { apiInitializer } from "discourse/lib/api";
import {
    shouldEnableForTagOnly,
    resetCache
} from "../lib/ideas-portal-helper";

export default apiInitializer("0.8.3", (api) => { // Consistent versioning

  api.modifyClass("component:category-chooser", {
    pluginId: "netwrix-ideas-category-filter", // Keep original ID if needed

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
      // Pass api.container to helper
      if (!shouldEnableForTagOnly(api.container)) {
        this._ideasEnabledCategoryIds = null; // Reset cache when not applicable
        // Ensure super exists before calling, fallback to site categories
        const parentContent = this._super ? this._super(...arguments) : (this.site?.categories || []);
        return parentContent;
      }

      const enabledIds = this._getEnabledIds();
      const allCategories = this._super ? this._super(...arguments) : (this.site?.categories || []);

      return allCategories.filter(cat => enabledIds.includes(cat.id));
    },

    willDestroyElement() {
       this._ideasEnabledCategoryIds = null; // Clear cache on destroy
       if (this._super) {
           this._super(...arguments);
       }
    }
  });


  // Add body classes and attempt to filter nav dropdown
  const updateBodyClassesAndNavFilter = () => {
      // Pass api.container
      const shouldEnable = shouldEnableForTagOnly(api.container);

      if (shouldEnable) {
          document.body.classList.add("ideas-hide-category-badges");
          document.body.classList.add("ideas-filter-category-dropdown");

          // WARNING: setTimeout fragile for DOM manipulation timing.
          setTimeout(() => {
              try {
                  const enabledCategoryIds = settings.enabled_categories
                      ? settings.enabled_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
                      : [];

                  // Adjust selector based on current Discourse structure
                  const categoryDropdownItems = document.querySelectorAll('.category-dropdown-menu .category-link[data-category-id]');
                  if (categoryDropdownItems.length > 0) {
                      categoryDropdownItems.forEach(item => {
                          const categoryId = item.getAttribute('data-category-id');
                          // Hide if not in enabled list
                          item.style.display = (categoryId && enabledCategoryIds.includes(parseInt(categoryId, 10))) ? '' : 'none';
                      });
                  }
              } catch (e) { /* Log warning? */ }
          }, 500);

      } else {
          document.body.classList.remove("ideas-hide-category-badges");
          document.body.classList.remove("ideas-filter-category-dropdown");
      }
  };

  api.onPageChange(() => { updateBodyClassesAndNavFilter(); });

  api.cleanupStream(() => {
    resetCache(); // Reset helper state
    document.body.classList.remove("ideas-hide-category-badges");
    document.body.classList.remove("ideas-filter-category-dropdown");
  });
});