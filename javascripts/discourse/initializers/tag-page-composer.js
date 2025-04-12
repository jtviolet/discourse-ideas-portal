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
    },
    
    didInsertElement() {
      this._super(...arguments);
      
      if (shouldEnableComponent()) {
        try {
          // Wait for the component to be fully rendered
          setTimeout(() => {
            // Find the header element with the placeholder text
            const placeholderEl = this.element.querySelector('.category-dropdown-header h3.category-name');
            if (placeholderEl && placeholderEl.textContent.trim() === "Category") {
              placeholderEl.textContent = "Choose a product...";
            }
            
            // Also try to find the placeholder in ComboBox
            const comboBoxPlaceholder = this.element.querySelector('.select-kit-header .select-kit-header-wrapper .select-kit-selected-name');
            if (comboBoxPlaceholder && comboBoxPlaceholder.textContent.trim() === "Category...") {
              comboBoxPlaceholder.textContent = "Choose a product...";
            }
          }, 0);
        } catch (e) {
          console.error("Error updating category placeholder:", e);
        }
      }
    }
  });
  
  // Add a class to the body element when the component should be enabled
  api.onPageChange(() => {
    if (shouldEnableComponent()) {
      document.body.classList.add("ideas-hide-category-badges");
      
      // Update any existing category dropdown placeholders
      setTimeout(() => {
        document.querySelectorAll('.category-chooser').forEach(chooser => {
          const placeholderEl = chooser.querySelector('.category-dropdown-header h3.category-name');
          if (placeholderEl && placeholderEl.textContent.trim() === "Category") {
            placeholderEl.textContent = "Choose a product...";
          }
          
          const comboBoxPlaceholder = chooser.querySelector('.select-kit-header .select-kit-header-wrapper .select-kit-selected-name');
          if (comboBoxPlaceholder && comboBoxPlaceholder.textContent.trim() === "Category...") {
            comboBoxPlaceholder.textContent = "Choose a product...";
          }
        });
      }, 100);
    } else {
      document.body.classList.remove("ideas-hide-category-badges");
    }
  });
  
  // Clean up when navigating away
  api.cleanupStream(() => {
    document.body.classList.remove("ideas-hide-category-badges");
  });
});