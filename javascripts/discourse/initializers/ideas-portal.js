import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  console.log("Ideas Portal: Initializer started");

  // Parse enabled categories from settings
  const enabledCategories = settings.ideas_portal_categories
    ? settings.ideas_portal_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    : [];

  console.log("Ideas Portal: Enabled Categories Raw:", settings.ideas_portal_categories);
  console.log("Ideas Portal: Parsed Enabled Categories:", enabledCategories);

  if (!enabledCategories.length) {
    console.error("Ideas Portal: No categories configured");
    return;
  }

  // Change tag text to proper casing
  const tagMap = {
    'new': 'New',
    'under-review': 'Under Review',
    'planned': 'Planned',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'not-planned': 'Not Planned',
    'already-exists': 'Already Exists',
  };

  // Comprehensive category detection
  const getCurrentCategoryInfo = () => {
    const discoveryService = api.container.lookup("service:discovery");
    const router = api.container.lookup("service:router");
    
    console.log("Ideas Portal: Discovery Service:", discoveryService);
    console.log("Ideas Portal: Router:", router);
    console.log("Ideas Portal: Current Route:", router?.currentRouteName);
    
    // Try multiple methods to get category
    let category = null;
    
    if (discoveryService?.category) {
      category = discoveryService.category;
    } else if (router?.currentRoute?.params?.category) {
      const siteCategories = api.container.lookup("site:main").categories;
      category = siteCategories.find(
        cat => cat.slug === router.currentRoute.params.category
      );
    }
    
    console.log("Ideas Portal: Detected Category:", category);
    
    if (!category) {
      console.error("Ideas Portal: No category found");
      return null;
    }
    
    // Check if this category or its parent is in enabled categories
    const categoryId = category.id;
    const parentCategoryId = category.parent_category_id;
    
    console.log("Ideas Portal: Category ID:", categoryId);
    console.log("Ideas Portal: Parent Category ID:", parentCategoryId);
    console.log("Ideas Portal: Enabled Categories:", enabledCategories);
    
    if (enabledCategories.includes(categoryId) || 
        (parentCategoryId && enabledCategories.includes(parentCategoryId))) {
      return category;
    }
    
    console.error(`Ideas Portal: Category ${categoryId} not in enabled list`);
    return null;
  };

  // Full page change handler
  api.onPageChange((url) => {
    console.log("Ideas Portal: Page changed", url);
    
    const currentCategory = getCurrentCategoryInfo();
    
    if (!currentCategory) {
      document.body.classList.remove("ideas-portal-category");
      return;
    }
    
    document.body.classList.add("ideas-portal-category");
    
    // Change tag text to proper casing
    document.querySelectorAll('[data-tag-name]').forEach(el => {
      const tag = el.getAttribute('data-tag-name');
      if (tag && tagMap[tag]) {
        el.textContent = tagMap[tag];
      }
    });
    
    // Rest of your existing page change logic continues here...
  });
});
