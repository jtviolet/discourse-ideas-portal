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

  // Function to update sidebar category names with parent category names
  const updateSidebarCategoryNames = () => {
    // Get all categories from Discourse
    const siteCategories = api.container.lookup("site:main").categories;
    if (!siteCategories || !siteCategories.length) {
      console.log("Ideas Portal: No categories found in site");
      return;
    }
    
    // Find all sidebar category links
    const sidebarCategoryLinks = document.querySelectorAll(".sidebar-section-link-wrapper a.sidebar-section-link");
    
    sidebarCategoryLinks.forEach(link => {
      // Get the span that contains the category name
      const nameSpan = link.querySelector(".sidebar-section-link-content-text");
      if (!nameSpan) return;
      
      // Check if this is an "Ideas" category (by name)
      const currentText = nameSpan.textContent.trim();
      if (currentText !== "Ideas") return;
      
      // Extract category ID from the link's href attribute
      const href = link.getAttribute("href");
      if (!href || !href.includes("/c/")) return;
      
      const match = href.match(/\/c\/(?:.*\/)?(\d+)/);
      if (!match || !match[1]) return;
      
      const categoryId = parseInt(match[1], 10);
      
      // Check if this is one of our enabled categories
      if (!enabledCategories.includes(categoryId)) return;
      
      // Find the category in the site categories
      const category = siteCategories.find(cat => cat.id === categoryId);
      if (!category) return;
      
      // Check if it has a parent category
      if (!category.parent_category_id) return;
      
      // Find the parent category
      const parentCategory = siteCategories.find(cat => cat.id === category.parent_category_id);
      if (!parentCategory) return;
      
      // Update the name to include the parent category name
      nameSpan.textContent = `${parentCategory.name} Ideas`;
      console.log(`Ideas Portal: Updated sidebar category name to "${nameSpan.textContent}"`);
    });
  };
  const getCurrentCategoryInfo = () => {
    // Use the discovery service instead of the deprecated controller
    const discoveryService = api.container.lookup("service:discovery");
    if (!discoveryService) {
      console.log("Ideas Portal: Could not find discovery service");
      return null;
    }
    
    // Get the current category from the discoveryService
    const category = discoveryService.category;
    if (!category) {
      console.log("Ideas Portal: No category found in discovery service");
      return null;
    }
    
    // Check if this category is in our enabled list
    if (!enabledCategories.includes(category.id)) {
      console.log(`Ideas Portal: Category ${category.id} not in enabled list`);
      return null;
    }
    
    console.log(`Ideas Portal: Found enabled category: ${category.name} (${category.id})`);
    return category;
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

  // Watch for DOM changes to update sidebar category names when sidebar is loaded or changed
  api.onAppEvent("page:changed", () => {
    // Small delay to ensure sidebar is fully rendered
    setTimeout(updateSidebarCategoryNames, 500);
  });
  
  // Also run once on initialization
  setTimeout(updateSidebarCategoryNames, 1000);
  api.onPageChange(() => {
    // Get current category info
    const currentCategory = getCurrentCategoryInfo();
    
    if (!currentCategory) {
      // Not on an enabled category page, remove class if it exists
      document.body.classList.remove("ideas-portal-category");
      return;
    }
    
    // Add the class that enables CSS styling
    document.body.classList.add("ideas-portal-category");
    
    // Find the custom banner title element
    const bannerTitle = document.querySelector(".custom-banner__title");
    if (bannerTitle) {
      // Get the current title text (this is usually the parent category name)
      const originalTitle = bannerTitle.textContent.trim();
      
      // If the current banner text doesn't already include the category name, append it
      if (!originalTitle.includes(currentCategory.name)) {
        bannerTitle.textContent = `${originalTitle} ${currentCategory.name}`;
        console.log(`Ideas Portal: Updated banner title to "${bannerTitle.textContent}"`);
      }
    } else {
      console.log("Ideas Portal: Custom banner title element not found");
    }
    
    // Update sidebar category names to include parent category
    updateSidebarCategoryNames();
    
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
    let parentSlug = "";
    
    // Get parent category info if available
    if (currentCategory.parent_category_id) {
      const siteCategories = api.container.lookup("site:main").categories;
      const parentCategory = siteCategories.find(cat => cat.id === currentCategory.parent_category_id);
      if (parentCategory) {
        parentSlug = `${parentCategory.slug}/`;
      }
    }
    
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
    resetFilter.href = `/c/${parentSlug}${categorySlug}/${currentCategory.id}`;
    resetFilter.className = 'tag-filter tag-filter-reset';
    resetFilter.textContent = 'Show All';
    container.appendChild(resetFilter);
    
    // Add status tag filters
    Object.keys(tagMap).forEach(tag => {
      const filter = document.createElement('a');
      filter.href = `/tags/c/${parentSlug}${categorySlug}/${currentCategory.id}/${tag}`;
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
  });
});