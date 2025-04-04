import Controller from "@ember/controller";
import { inject as service } from "@ember/service";
import { tracked } from "@ember/object";

export default Controller.extend({
  ideasService: service("ideas-service"),
  
  topics: null,
  filteredTopics: null,
  selectedTag: null,
  isLoading: true,
  
  init() {
    this._super(...arguments);
    this.loadTopics();
  },
  
  async loadTopics() {
    this.set("isLoading", true);
    
    const currentCategory = this.ideasService.getCurrentCategoryInfo();
    if (!currentCategory) {
      this.set("topics", []);
      this.set("filteredTopics", []);
      this.set("isLoading", false);
      return;
    }
    
    try {
      const topics = await this.ideasService.fetchAllTopicsInCategory(currentCategory.id);
      this.set("topics", topics);
      this.set("filteredTopics", topics);
    } catch (error) {
      console.error("Error loading topics:", error);
      this.set("topics", []);
      this.set("filteredTopics", []);
    } finally {
      this.set("isLoading", false);
    }
  },
  
  actions: {
    filterByTag(tag) {
      this.set("selectedTag", tag);
      
      if (!tag) {
        this.set("filteredTopics", this.topics);
        return;
      }
      
      const filtered = this.topics.filter(topic => {
        const tags = topic.tags || [];
        return tags.includes(tag);
      });
      
      this.set("filteredTopics", filtered);
    }
  }
}); 