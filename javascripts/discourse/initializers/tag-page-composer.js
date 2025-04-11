import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.8", (api) => {
  api.modifyClass("component:composer-title", {
    didInsertElement() {
      this._super(...arguments);
      
      // Replace the placeholder text
      const titleInput = this.element.querySelector('#reply-title');
      if (titleInput) {
        titleInput.placeholder = "Enter the title of your idea here...";
      }
    }
  });
});