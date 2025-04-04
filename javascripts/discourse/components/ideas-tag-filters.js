import Component from "@ember/component";
import { inject as service } from "@ember/service";

export default Component.extend({
  classNames: ["ideas-tag-filters"],
  ideasService: service("ideas-service"),
  
  tagName: "div",
  
  selectedTag: null,
  
  init() {
    this._super(...arguments);
    this.set("tagMap", this.ideasService.tagMap);
  },
  
  actions: {
    filterByTag(tag, event) {
      event.preventDefault();
      this.set("selectedTag", tag === this.selectedTag ? null : tag);
      if (this.onTagSelected) {
        this.onTagSelected(this.selectedTag);
      }
    },
    
    resetFilter(event) {
      event.preventDefault();
      this.set("selectedTag", null);
      if (this.onTagSelected) {
        this.onTagSelected(null);
      }
    }
  }
}); 