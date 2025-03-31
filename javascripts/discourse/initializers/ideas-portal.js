import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  // Parse enabled categories from settings
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

  // Change tag text to proper casing instead of hyphenated
  const tagMap = {
    'new': 'New',
    'under-review': 'Under Review',
    'planned': 'Planned',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'not-planned': 'Not Planned',
    'already-exists': 'Already Exists',
  };

  // When page changes, apply our customizations
  api.onPageChange(() => {
    // Check if we're on a category page
    const currentController = api.container.lookup("controller:navigation/category");
    const currentCategory = currentController?.category;
    
    if (!currentCategory) {
      // Not on a category page, remove class if it exists
      document.body.classList.remove("ideas-portal-category");
      return;
    }
    
    const categoryId = currentCategory.id;
    
    // Check if this category should have ideas portal features
    if (enabledCategories.includes(categoryId)) {
      // Add the class that enables CSS styling
      document.body.classList.add("ideas-portal-category");
      
      // Update the hero banner text to use the parent category name
      const mainContainer = document.querySelector("#main-container");
      if (mainContainer) {
        // Create a style element to override the content property
        let styleEl = document.getElementById('ideas-portal-custom-style');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'ideas-portal-custom-style';
          document.head.appendChild(styleEl);
        }
        
        // Get the parent category name if it exists, otherwise use the current category name
        let bannerText;
        if (currentCategory.parentCategory) {
          bannerText = `${currentCategory.parentCategory.name} Feature Requests`;
        } else {
          bannerText = `${currentCategory.name} Feature Requests`;
        }
        
        styleEl.textContent = `.ideas-portal-category #main-container::before { content: "${bannerText}"; }`;
      }
      
      // 1. Change tag text to proper casing
      document.querySelectorAll('[data-tag-name]').forEach(el => {
        const tag = el.getAttribute('data-tag-name');
        if (tag && tagMap[tag]) {
          el.textContent = tagMap[tag];
        }
      });
      
      // 2. Add tag filters if they don't exist yet
      if (document.querySelector('.ideas-tag-filters')) return;
      
      const categorySlug = currentCategory.slug;
      const parentSlug = currentCategory.parentCategory ? 
                        `${currentCategory.parentCategory.slug}/` : '';
      
      // Create filter container
      const container = document.createElement('div');
      container.className = 'ideas-tag-filters list-controls';
      
      // Add title
      const title = document.createElement('h3');
      title.className = 'ideas-filter-title';
      title.textContent = 'Filter by Status';
      container.appendChild(title);
      
      // Add reset filter
      const resetFilter = document.createElement('a');
      resetFilter.href = `/c/${parentSlug}${categorySlug}/${categoryId}`;
      resetFilter.className = 'tag-filter tag-filter-reset';
      resetFilter.textContent = 'Show All';
      container.appendChild(resetFilter);
      
      // Add status tag filters
      Object.keys(tagMap).forEach(tag => {
        const filter = document.createElement('a');
        filter.href = `/tags/c/${parentSlug}${categorySlug}/${categoryId}/${tag}`;
        filter.className = 'tag-filter';
        filter.setAttribute('data-tag-name', tag);
        filter.textContent = tagMap[tag];
        container.appendChild(filter);
      });
      
      // Insert the filter container after the navigation container
      const target = document.querySelector('.navigation-container');
      if (target) {
        target.insertAdjacentElement('afterend', container);
      }
    } else {
      // Not an enabled category, remove class if it exists
      document.body.classList.remove("ideas-portal-category");
    }
  });
});