import { withPluginApi } from 'discourse/lib/plugin-api';
import { modifyClass } from 'discourse/lib/intercept-render';

// Status tags in preferred order
const STATUS_TAGS = [
  'new', 
  'under-review', 
  'planned', 
  'in-progress', 
  'completed', 
  'not-planned', 
  'already-exists'
];

// Mapping for display names (optional, but helpful)
const STATUS_TAG_NAMES = {
  'new': 'New',
  'under-review': 'Under Review',
  'planned': 'Planned',
  'in-progress': 'In Progress',
  'completed': 'Completed',
  'not-planned': 'Not Planned',
  'already-exists': 'Already Exists'
};

function prioritizeStatusTags(tags) {
  if (!tags || !Array.isArray(tags)) return tags;

  // Separate status and non-status tags
  const statusTags = tags.filter(tag => STATUS_TAGS.includes(tag));
  const otherTags = tags.filter(tag => !STATUS_TAGS.includes(tag));

  // Sort status tags by predefined order
  const sortedStatusTags = statusTags.sort((a, b) => 
    STATUS_TAGS.indexOf(a) - STATUS_TAGS.indexOf(b)
  );

  // Combine sorted status tags first, then other tags
  return [...sortedStatusTags, ...otherTags];
}

export default {
  name: 'ideas-portal-tag-prioritization',
  initialize() {
    withPluginApi('0.8', (api) => {
      // Modify the topic list item component to prioritize status tags
      modifyClass('component:topic-list-item', {
        didRender() {
          this._super(...arguments);
          
          // Find the tags container
          const tagsContainer = this.element.querySelector('.topic-list-tags');
          
          if (tagsContainer) {
            // Get current tags
            const tagElements = tagsContainer.querySelectorAll('.discourse-tag');
            const currentTags = Array.from(tagElements).map(el => el.dataset.tagName);
            
            // Prioritize tags
            const prioritizedTags = prioritizeStatusTags(currentTags);
            
            // If tags have changed, re-render
            if (JSON.stringify(currentTags) !== JSON.stringify(prioritizedTags)) {
              // Clear existing tags
              tagsContainer.innerHTML = '';
              
              // Re-add tags in new order
              prioritizedTags.forEach(tag => {
                const tagEl = document.createElement('a');
                tagEl.className = 'discourse-tag';
                tagEl.dataset.tagName = tag;
                tagEl.textContent = STATUS_TAG_NAMES[tag] || tag;
                tagsContainer.appendChild(tagEl);
              });
            }
          }
        }
      });
    });
  }
};