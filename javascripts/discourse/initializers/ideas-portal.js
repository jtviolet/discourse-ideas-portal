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

  // Helper function with extensive logging
  const getCurrentCategoryInfo = () => {
    const discoveryService = api.container.lookup("service:discovery");
    
    console.log("Ideas Portal: Discovery Service exists:", !!discoveryService);
    
    if (!discoveryService) {
      console.error("Ideas Portal: Could not find discovery service");
      return null;
    }
    
    console.log("Ideas Portal: Current category from service:", discoveryService.category);
    
    if (!discoveryService.category) {
      console.error("Ideas Portal: Not on a category page");
      return null;
    }
    
    const categoryId = discoveryService.category?.id;
    
    console.log("Ideas Portal: Current Category ID:", categoryId);
    console.log("Ideas Portal: Enabled Categories:", enabledCategories);
    
    if (!categoryId || !enabledCategories.includes(categoryId)) {
      console.error(`Ideas Portal: Category ${categoryId} not in enabled list`);
      return null;
    }
    
    return discoveryService.category;
  };

  // Comprehensive logging for page change
  api.onPageChange(() => {
    console.log("Ideas Portal: Page changed");
    
    const currentCategory = getCurrentCategoryInfo();
    
    console.log("Ideas Portal: Current Category Details:", currentCategory);
    
    if (!currentCategory) {
      console.error("Ideas Portal: No valid category found");
      document.body.classList.remove("ideas-portal-category");
      return;
    }
    
    document.body.classList.add("ideas-portal-category");
    console.log("Ideas Portal: Added ideas-portal-category class");
  });
});
