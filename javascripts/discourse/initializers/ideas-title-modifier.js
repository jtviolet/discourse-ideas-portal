// javascripts/discourse/initializers/ideas-title-modifier.js
import { apiInitializer } from "discourse/lib/api";
import { shouldEnableForCategoryOrTag, resetCache } from "../lib/ideas-portal-helper";

export default apiInitializer("0.8.3", (api) => { // Consistent versioning
  const customPlaceholder = "Enter the title of your idea here...";

  api.modifyClass("component:composer-title", {
    pluginId: "ideas-title-modifier", // Unique ID

    _updatePlaceholderIfNeeded() {
      // Pass api.container to the helper function
      if (shouldEnableForCategoryOrTag(api.container)) {
        try {
          const titleInput = this.element?.querySelector('#reply-title');
          // Only update if placeholder is not already the custom one
          if (titleInput && titleInput.placeholder !== customPlaceholder) {
            titleInput.placeholder = customPlaceholder;
          }
        } catch (e) {
          console.warn("Ideas Portal: Failed to update composer title placeholder.", e);
        }
      }
      // If not enabled, the default placeholder should render automatically
    },

    didInsertElement() {
      this._super(...arguments);
      this._updatePlaceholderIfNeeded(); // Check on initial insert
    },

    didReceiveAttrs() {
      this._super(...arguments);
      // Update if relevant attributes change; rAF ensures DOM is ready
      requestAnimationFrame(() => this._updatePlaceholderIfNeeded());
    },

    // Optional: reset placeholder if composer model changes category/tags?
    // This depends on whetherdidReceiveAttrs covers those changes.
  });

  // // Optional cleanup if needed
  // api.cleanupStream(() => {
  //     resetCache();
  // });
});