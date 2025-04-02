import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  // Parse enabled categories from settings
  const enabledCategories = settings.ideas_portal_categories
    ? settings.ideas_portal_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    : [];

  // Log enabled categories for debugging
  console.log("Ideas Portal: Enabled for categories:", enabledCategories);

  if (!enabledCategories.length) {
    console.log("Ideas Portal: No categories configured");
    return;
  }

  // Function to create the status visualization
  const createStatusVisualization = (statusCounts, container) => {
    if (!container) return;
    
    // Clear the container
    container.innerHTML = '';
    
    // Calculate total
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    if (total === 0) return; // No data to visualize
    
    // Create the visualization header
    const header = document.createElement('div');
    header.className = 'ideas-visualization-header';
    header.textContent = `${total} Total Ideas`;
    container.appendChild(header);
    
    // Create the visualization bar container
    const barContainer = document.createElement('div');
    barContainer.className = 'ideas-visualization-bars';
    container.appendChild(barContainer);
    
    // Add bars for each status
    Object.keys(statusCounts).forEach(status => {
      const count = statusCounts[status];
      const percentage = total > 0 ? (count / total) * 100 : 0;
      
      // Skip statuses with zero count
      if (count === 0) return;
      
      // Create bar element
      const bar = document.createElement('div');
      bar.className = 'ideas-visualization-bar';
      bar.setAttribute('data-status', status);
      bar.style.width = `${percentage}%`;
      bar.title = `${tagMap[status]}: ${count} ideas (${percentage.toFixed(1)}%)`;
      
      barContainer.appendChild(bar);
    });
    
    // Create the legend
    const legend = document.createElement('div');
    legend.className = 'ideas-visualization-legend';
    container.appendChild(legend);
    
    // Add legend items
    Object.keys(statusCounts).forEach(status => {
      const count = statusCounts[status];
      
      // Skip statuses with zero count
      if (count === 0) return;
      
      // Create legend item
      const item = document.createElement('div');
      item.className = 'ideas-visualization-legend-item';
      
      // Color dot
      const dot = document.createElement('span');
      dot.className = 'ideas-visualization-legend-dot';
      dot.setAttribute('data-status', status);
      item.appendChild(dot);
      
      // Text
      const text = document.createElement('span');
      text.textContent = `${tagMap[status]}: ${count}`;
      item.appendChild(text);
      
      legend.appendChild(item);
    });
  };

  // Helper function to get current category info using the discovery service
  const getCurrentCategoryInfo = () => {
    // Use the discovery service instead of the deprecated controller
    const discoveryService = api.container.lookup("service:discovery");
    if (!discoveryService) {
      console.log("Ideas Portal: Could not find discovery service");
      return null;
    }
    
    // Check if we're on a category route
    if (!discoveryService.category) {
      console.log("Ideas Portal: Not on a category page");
      return null;
    }
    
    // Get the current category from the discoveryService
    const category = discoveryService.category;
    const categoryId = category?.id;
    
    if (!categoryId) {
      console.log("Ideas Portal: No category ID found");
      return null;
    }
    
    console.log(`Ideas Portal: Current category ID: ${categoryId}, Enabled categories: ${enabledCategories}`);
    
    // Check if this category is in our enabled list
    if (!enabledCategories.includes(categoryId)) {
      console.log(`Ideas Portal: Category ${categoryId} not in enabled list`);
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

  // When page changes, apply our customizations
  api.onPageChange(() => {
    console.log("Ideas Portal: Page changed");
    
    // Get current category info
    const currentCategory = getCurrentCategoryInfo();
    
    // Find any existing ideas-tag-filters
    const existingFilters = document.querySelector('.ideas-tag-filters');
    
    // Remove ideas-portal-category class from body if we're not in an enabled category
    if (!currentCategory) {
      document.body.classList.remove("ideas-portal-category");
      
      // Clean up any existing filter elements if we're not in an ideas category
      if (existingFilters) {
        existingFilters.remove();
        console.log("Ideas Portal: Removed filter box when leaving ideas category");
      }
      return;
    }
    
    // We're in an enabled category, add the class
    document.body.classList.add("ideas-portal-category");
    
    // Find the custom banner title element
    const bannerTitle = document.querySelector(".custom-banner__title");
    if (bannerTitle) {
      // Get the current title text (this is usually the parent category name)
      const originalTitle = bannerTitle.textContent.trim();
      
      // Get parent category name if available
      let parentName = "";
      if (currentCategory.parent_category_id) {
        const siteCategories = api.container.lookup("site:main").categories;
        const parentCategory = siteCategories.find(cat => cat.id === currentCategory.parent_category_id);
        if (parentCategory) {
          parentName = parentCategory.name;
        }
      }
      
      // If we have a parent and the title doesn't already include both parent and category names
      if (parentName && !originalTitle.includes(currentCategory.name)) {
        // Set title to "Parent Category"
        bannerTitle.textContent = `${parentName} ${currentCategory.name}`;
        console.log(`Ideas Portal: Updated banner title to "${bannerTitle.textContent}"`);
      }
    }
    
    // 1. Change tag text to proper casing
    document.querySelectorAll('[data-tag-name]').forEach(el => {
      const tag = el.getAttribute('data-tag-name');
      if (tag && tagMap[tag]) {
        el.textContent = tagMap[tag];
      }
    });
    
    // 2. Add tag filters if they don't exist yet
    if (existingFilters) {
      console.log("Ideas Portal: Filter box already exists, not adding again");
      return;
    }
    
    console.log("Ideas Portal: Creating filter box for category", currentCategory.name);
    
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
    
    // Add status count visualization container
    const statusVisualization = document.createElement('div');
    statusVisualization.className = 'ideas-status-visualization';
    container.appendChild(statusVisualization);
    
    // Add reset filter
    const resetFilter = document.createElement('a');
    resetFilter.href = `/c/${parentSlug}${categorySlug}/${currentCategory.id}`;
    resetFilter.className = 'tag-filter tag-filter-reset';
    resetFilter.textContent = 'Show All';
    container.appendChild(resetFilter);
    
    // Add status tag filters and count topics with each tag
    const statusCounts = {};
    
    // Initialize counts to zero
    Object.keys(tagMap).forEach(tag => {
      statusCounts[tag] = 0;
    });
    
    // Count topics with each tag
    try {
      // Get all topic elements in the list
      const topicElements = document.querySelectorAll(".topic-list-item");
      
      console.log(`Ideas Portal: Found ${topicElements.length} topic elements`);
      
      // If we don't have any elements to count, use sample data for visualization
      if (topicElements.length === 0) {
        // Sample data for visualization demonstration
        statusCounts["new"] = 3;
        statusCounts["planned"] = 2;
        statusCounts["in-progress"] = 1;
        statusCounts["completed"] = 2;
        statusCounts["under-review"] = 1;
        console.log("Ideas Portal: Using sample data for visualization");
      } else {
        topicElements.forEach(topicEl => {
          const tagElements = topicEl.querySelectorAll("[data-tag-name]");
          
          tagElements.forEach(tagEl => {
            const tagName = tagEl.getAttribute("data-tag-name");
            if (tagName && statusCounts.hasOwnProperty(tagName)) {
              statusCounts[tagName]++;
            }
          });
        });
      }
      
      console.log("Ideas Portal: Status counts:", statusCounts);
    } catch (e) {
      console.error("Ideas Portal: Error counting statuses:", e);
    }
    
    // Add status tag filters with counts
    Object.keys(tagMap).forEach(tag => {
      const filter = document.createElement('a');
      filter.href = `/tags/c/${parentSlug}${categorySlug}/${currentCategory.id}/${tag}`;
      filter.className = 'tag-filter';
      filter.setAttribute('data-tag-name', tag);
      filter.textContent = `${tagMap[tag]} (${statusCounts[tag]})`;
      filter.setAttribute('data-count', statusCounts[tag]);
      container.appendChild(filter);
    });
    
    // Create the status visualization after we have the counts
    createStatusVisualization(statusCounts, statusVisualization);
    
    // Insert the filter container after the navigation container
    const target = document.querySelector('.navigation-container');
    if (target) {
      target.insertAdjacentElement('afterend', container);
      
      // Force visualization to be visible
      setTimeout(() => {
        const viz = document.querySelector('.ideas-status-visualization');
        if (viz) {
          viz.style.display = 'block';
          console.log("Ideas Portal: Visualization container is visible");
        }
      }, 100);
    }
  });
});
