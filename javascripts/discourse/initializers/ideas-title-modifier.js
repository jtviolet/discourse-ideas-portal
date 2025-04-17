import { apiInitializer } from "discourse/lib/api";
// Assuming ideas-portal-helper.js is correctly imported or helpers are globally available
import { shouldEnableForCategoryOrTag } from "../lib/ideas-portal-helper"; // Adjust path as needed

export default apiInitializer("0.8.1", (api) => { // Increment version if dependent on helper
  const customPlaceholder = "Enter the title of your idea here...";

  api.modifyClass("component:composer-title", {
    pluginId: "ideas-title-modifier", // Unique ID for modification

    /**
     * Check if the placeholder needs updating after rendering.
     */
    _updatePlaceholderIfNeeded() {
      if (shouldEnableForCategoryOrTag()) { // Use helper
        try {
          // Use this.element which is the standard Ember way to access the component's element
          const titleInput = this.element?.querySelector('#reply-title');
          if (titleInput && titleInput.placeholder !== customPlaceholder) {
            titleInput.placeholder = customPlaceholder;
          }
        } catch (e) {
          console.warn("Ideas Portal: Failed to update composer title placeholder.", e);
        }
      }
      // No 'else' needed - if not enabled, composer should revert to default placeholder automatically
    },

    didInsertElement() {
      this._super(...arguments);
      this._updatePlaceholderIfNeeded(); // Check on initial insert
    },

    didReceiveAttrs() {
      this._super(...arguments);
      // Check if attributes changing might affect whether it should be enabled (e.g., composer model changes)
      // Using requestAnimationFrame helps ensure DOM is ready after potential re-renders from attr changes.
      requestAnimationFrame(() => this._updatePlaceholderIfNeeded());
    }
  });
});