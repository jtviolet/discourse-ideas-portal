import Service from "@ember/service";
import { inject as service } from "@ember/service";
import { getOwner } from "@ember/application";

export default Service.extend({
  discovery: service(),
  site: service(),
  
  selectedTag: null,

  tagMap: {
    'new': 'New',
    'under-review': 'Under Review',
    'planned': 'Planned',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'not-planned': 'Not Planned',
    'already-exists': 'Already Exists',
  },

  init() {
    this._super(...arguments);
    this.enabledCategories = settings.ideas_portal_categories
      ? settings.ideas_portal_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
      : [];
  },

  getCurrentCategoryInfo() {
    const category = this.discovery?.category;
    if (!category) return null;
    return this.enabledCategories.includes(category.id) ? category : null;
  },

  async fetchAllTopicsInCategory(categoryId) {
    const pageSize = 100;
    let page = 0;
    let allTopics = [];
    let done = false;

    while (!done) {
      const response = await fetch(`/c/${categoryId}.json?page=${page}`);
      if (!response.ok) break;

      const data = await response.json();
      const topics = data.topic_list.topics || [];

      allTopics = allTopics.concat(topics);
      if (topics.length < pageSize) {
        done = true;
      } else {
        page++;
      }
    }

    return allTopics;
  },

  buildStatusCounts(topics) {
    const counts = {};
    Object.keys(this.tagMap).forEach(tag => counts[tag] = 0);

    topics.forEach(topic => {
      const tags = topic.tags || [];
      tags.forEach(tag => {
        if (counts.hasOwnProperty(tag)) {
          counts[tag]++;
        }
      });
    });

    return counts;
  },

  getParentCategoryName(currentCategory) {
    if (!currentCategory || !currentCategory.parent_category_id) {
      return null;
    }
    
    const parentCategory = this.site.categories.find(cat => cat.id === currentCategory.parent_category_id);
    
    return parentCategory ? parentCategory.name : null;
  }
}); 