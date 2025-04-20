import { apiInitializer } from "discourse/lib/api";
import { shouldEnable } from "../lib/ideas-portal-utils";

export default apiInitializer("0.8", (api) => {
  // Only modify composer title if on enabled category or tag page
  const shouldModifyTitle = () => shouldEnable(api);

  // Modify the composer title placeholder
  api.modifyClass("component:composer-title", {
    pluginId: "ideas-title-modifier",
    
    didRender() {
      this._super(...arguments);
      
      if (shouldModifyTitle()) {
        try {
          const titleInput = document.getElementById('reply-title');
          if (titleInput) {
            titleInput.placeholder = "Enter the title of your idea here...";
          }
        } catch (e) {
          // Silent fail
        }
      }
    }
  });
});
