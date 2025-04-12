import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.8", (api) => {
  const enabledCategories = settings.enabled_categories
    ? settings.enabled_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    : [];
    
  const enabledTags = settings.enabled_tags
    ? settings.enabled_tags.split("|").map(tag => tag.trim()).filter(tag => tag.length > 0)
    : [];

  const getCurrentCategoryInfo = () => {
    const discoveryService = api.container.lookup("service:discovery");
    if (!discoveryService?.category) return null;
    const category = discoveryService.category;
    return enabledCategories.includes(category.id) ? category : null;
  };
  
  const isEnabledTagPage = () => {
    if (enabledTags.length === 0) return false;
    
    // Check if we're on a tag page
    const currentRoute = api.container.lookup("service:router").currentRouteName;
    // Check for both "tags.show" and "tag.show" route patterns
    if (!currentRoute.includes("tag")) return false;
    
    // Get the current tag
    let currentTag;
    
    // Try both controllers since different Discourse versions might use different patterns
    const tagsShowController = api.container.lookup("controller:tags.show");
    const tagShowController = api.container.lookup("controller:tag.show");
    
    if (tagsShowController && tagsShowController.tag) {
      currentTag = tagsShowController.tag;
    } else if (tagShowController && tagShowController.tag) {
      currentTag = tagShowController.tag;
    } else {
      // Last resort: try to extract tag from URL
      const path = window.location.pathname;
      const tagMatch = path.match(/\/tag\/([^\/]+)/);
      if (tagMatch && tagMatch[1]) {
        currentTag = tagMatch[1];
      }
    }
    
    if (!currentTag) return false;
    
    return enabledTags.includes(currentTag);
  };
  
  const shouldEnableComponent = () => {
    // Check if we're on either an enabled category page or an enabled tag page
    return getCurrentCategoryInfo() !== null || isEnabledTagPage();
  };

  api.modifyClass("component:composer-title", {
    didInsertElement() {
      this._super(...arguments);
      
      if (shouldEnableComponent()) {
        const titleInput = this.element.querySelector('#reply-title');
        if (titleInput) {
          titleInput.placeholder = "Enter the title of your idea here...";
        }
      }
    }
  });

  api.modifyClass("component:category-chooser", {
    pluginId: "netwrix-ideas-category-filter",
  
    get content() {
      const allCategories = this.site.categories || [];
  
      if (!shouldEnableComponent()) {
        return allCategories;
      }
  
      const enabledCategoryIds = settings.enabled_categories
        ? settings.enabled_categories
            .split("|")
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id))
        : [];
  
      return allCategories.filter(cat => enabledCategoryIds.includes(cat.id));
    }
  });
  
  // Add a mutation observer to hide the first three badge-category__wrapper spans
  api.onPageChange(() => {
    if (!shouldEnableComponent()) return;
    
    // Function to process category-status elements
    const processCategoryElements = () => {
      const categoryStatusDivs = document.querySelectorAll('.category-status');
      
      categoryStatusDivs.forEach(statusDiv => {
        const wrappers = statusDiv.querySelectorAll('.badge-category__wrapper');
        
        // Keep track of which ones we've seen
        let count = 0;
        
        // Hide the first, second, and third wrappers (keep only the fourth)
        wrappers.forEach(wrapper => {
          count++;
          if (count <= 3) {
            wrapper.style.display = 'none';
          }
        });
      });
    };
    
    // Run once on page load
    processCategoryElements();
    
    // Set up a mutation observer to handle dynamically loaded content
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          processCategoryElements();
        }
      }
    });
    
    // Start observing the document with the configured parameters
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Store the observer to disconnect it later
    window.categoryBadgeObserver = observer;
  });
  
  // Clean up the observer when the page changes
  api.cleanupStream(() => {
    if (window.categoryBadgeObserver) {
      window.categoryBadgeObserver.disconnect();
      window.categoryBadgeObserver = null;
    }
  });
});