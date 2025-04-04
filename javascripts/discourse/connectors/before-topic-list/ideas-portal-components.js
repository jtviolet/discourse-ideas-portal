import { inject as service } from "@ember/service";
import Component from "@ember/component";

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
  
  shouldRender: function() {
    const currentCategory = this.ideasService.getCurrentCategoryInfo();
    return !!currentCategory;
  }.property("ideasService.discovery.category"),
  
  async loadTopics() {
    const currentCategory = this.ideasService.getCurrentCategoryInfo();
    if (!currentCategory) return;
    
    const topics = await this.ideasService.fetchAllTopicsInCategory(currentCategory.id);
    this.set("topics", topics);
  },
  
  onTagSelected(tag) {
    // Handle tag selection
    this.sendAction("onTagSelected", tag);
  },
}); 