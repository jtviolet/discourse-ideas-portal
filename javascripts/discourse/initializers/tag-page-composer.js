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
    // Check ONLY if we're on an enabled tag page
    return isEnabledTagPage();
  };

  // Filter the categories in the category chooser ONLY on enabled tag pages
  api.modifyClass("component:category-chooser", {
    pluginId: "netwrix-ideas-category-filter",
  
    get content() {
      // Only filter categories if we're on an enabled tag page
      if (!shouldEnableComponent()) {
        return this.site.categories || [];
      }
  
      const enabledCategoryIds = settings.enabled_categories
        ? settings.enabled_categories
            .split("|")
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id))
        : [];
  
      return (this.site.categories || []).filter(cat => enabledCategoryIds.includes(cat.id));
    }
  });
  
  // Add a class to the body element when on an enabled tag page
  api.onPageChange(() => {
    if (shouldEnableComponent()) {
      document.body.classList.add("ideas-hide-category-badges");
    } else {
      document.body.classList.remove("ideas-hide-category-badges");
    }
  });
  
  // Clean up when navigating away
  api.cleanupStream(() => {
    document.body.classList.remove("ideas-hide-category-badges");
  });
});