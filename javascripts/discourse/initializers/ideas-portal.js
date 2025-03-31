import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  const enabledCategories = settings.ideas_portal_categories
    .split("|")
    .map((id) => parseInt(id, 10))
    .filter((id) => id);

  // Log enabled categories for debugging
  console.log("Ideas Portal: Enabled for categories:", enabledCategories);

  if (!enabledCategories.length) {
    console.log("Ideas Portal: No categories configured");
    return;
  }

  // Helper function to check if current category is enabled
  const isCurrentCategoryEnabled = () => {
    const currentController = api.container.lookup("controller:navigation/category");
    const currentCategoryId = currentController?.category?.id;
    
    if (!currentCategoryId) return false;
    
    return enabledCategories.includes(currentCategoryId);
  };

  // When category pages load, check if we should add the filters
  api.onPageChange(() => {
    if (!isCurrentCategoryEnabled()) return;
    
    // Add tag filters if they don't exist yet
    const filtersExist = document.querySelector(".ideas-tag-filters");
    if (filtersExist) return;
    
    // Wait for DOM to be ready
    setTimeout(() => {
      // Find a good insertion point
      const insertPoint = document.querySelector(".list-controls");
      if (!insertPoint) return;
      
      // Create the filter container
      const filterContainer = document.createElement("div");
      filterContainer.className = "ideas-tag-filters";
      
      // Add title
      const title = document.createElement("h3");
      title.className = "ideas-filter-title";
      title.textContent = "Filter by Status";
      filterContainer.appendChild(title);
      
      // Add tag filters
      const tagNames = [
        "new", 
        "planned", 
        "in-progress", 
        "under-review", 
        "already-exists", 
        "completed", 
        "not-planned"
      ];
      
      // Base URL for the current category
      const baseUrl = window.location.pathname.split("?")[0];
      
      // Add reset filter
      const resetFilter = document.createElement("a");
      resetFilter.href = baseUrl;
      resetFilter.className = "tag-filter tag-filter-reset";
      resetFilter.textContent = "All";
      filterContainer.appendChild(resetFilter);
      
      // Add tag filters
      tagNames.forEach(tag => {
        const filter = document.createElement("a");
        filter.href = `${baseUrl}?tags=${tag}`;
        filter.className = `tag-filter ${tag}`;
        filter.dataset.tagName = tag; // Use data attribute to apply styling
        filter.textContent = tag.replace(/-/g, " ");
        filterContainer.appendChild(filter);
      });
      
      // Insert before list controls
      insertPoint.parentNode.insertBefore(filterContainer, insertPoint);
    }, 100);
  });
});