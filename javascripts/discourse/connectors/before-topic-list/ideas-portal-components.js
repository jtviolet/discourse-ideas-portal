import { inject as service } from "@ember/service";
import Component from "@ember/component";
import { computed } from "@ember/object";

export default Component.extend({
  classNames: ["ideas-portal-connector"],
  ideasService: service(),
  
  init() {
    this._super(...arguments);
    if (this.shouldRender) {
      this.set("topics", []);
      this.loadTopics();
    }
  },
  
  shouldRender: computed("ideasService.discovery.category", function() {
    const currentCategory = this.ideasService.getCurrentCategoryInfo();
    return !!currentCategory;
  }),
  
  async loadTopics() {
    const currentCategory = this.ideasService.getCurrentCategoryInfo();
    if (!currentCategory) return;
    
    const topics = await this.ideasService.fetchAllTopicsInCategory(currentCategory.id);
    this.set("topics", topics);
  },
  
  actions: {
    onTagSelected(tag) {
      // Handle tag selection
      if (this.ideasService) {
        this.ideasService.set("selectedTag", tag);
        // Implement filtering logic here if needed
      }
    }
  }
}); 