import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  // Parse enabled categories from settings
  const enabledCategories = settings.ideas_portal_categories
    ? settings.ideas_portal_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    : [];

  // Parse enabled tags from settings
  const enabledTags = settings.ideas_portal_tags
    ? settings.ideas_portal_tags.split("|")
    : [];

  // Log enabled categories and tags for debugging
  console.log("Ideas Portal: Enabled for categories:", enabledCategories);
  console.log("Ideas Portal: Enabled for tags:", enabledTags);

  if (!enabledCategories.length && !enabledTags.length) {
    console.log("Ideas Portal: No categories or tags configured");
    return;
  }

  // Helper function to check if we're on a tag page that should be enabled
  const isEnabledTagPage = () => {
    if (!enabledTags.length) return false;

    const router = api.container.lookup("service:router");
    const routeName = router.currentRouteName;
    
    // Check if we're on a tag route
    if (!routeName.includes('tag.show')) return false;
    
    // Get current tag from route params
    const controller = api.container.lookup("controller:tag-show");
    if (!controller) return false;
    
    const currentTag = controller.tag?.id;
    if (!currentTag) return false;
    
    console.log(`Ideas Portal: Current tag: ${currentTag}`);
    
    // Check if this tag is in our enabled list
    if (enabledTags.includes(currentTag)) {
      console.log(`Ideas Portal: Tag ${currentTag} is in enabled list`);
      return true;
    }
    
    return false;
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

  // Function to create a beautiful status visualization using Chart.js
  const createStatusVisualization = (statusCounts, container) => {
    if (!container) return;
    
    // Clear the container
    container.innerHTML = '';
    
    // Calculate total
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    
    // If no data, completely hide the container
    if (total === 0) {
      container.style.display = 'none';
      return;
    } else {
      container.style.display = 'block';
    }
    
    // Create the visualization header
    const header = document.createElement('div');
    header.className = 'ideas-visualization-header';
    header.textContent = `${total} Total Ideas`;
    container.appendChild(header);
    
    // Create a container with fixed height to prevent expansion
    const chartContainer = document.createElement('div');
    chartContainer.style.height = '200px'; // Increased height for radar/polar chart
    chartContainer.style.width = '100%';
    chartContainer.style.position = 'relative';
    container.appendChild(chartContainer);
    
    // Create a canvas for the chart
    const canvas = document.createElement('canvas');
    canvas.id = 'ideas-status-chart';
    canvas.style.height = '100%';
    canvas.style.width = '100%';
    chartContainer.appendChild(canvas);
    
    // Process data for Chart.js
    const labels = [];
    const data = [];
    const backgroundColors = [];
    
    Object.keys(statusCounts).forEach(status => {
      if (statusCounts[status] > 0) {
        labels.push(tagMap[status]);
        data.push(statusCounts[status]);
        
        // Get color based on status
        let color;
        switch(status) {
          case 'new': color = 'rgba(0, 123, 255, 0.7)'; break;
          case 'planned': color = 'rgba(23, 162, 184, 0.7)'; break;
          case 'in-progress': color = 'rgba(253, 126, 20, 0.7)'; break;
          case 'already-exists': color = 'rgba(108, 117, 125, 0.7)'; break;
          case 'under-review': color = 'rgba(32, 201, 151, 0.7)'; break;
          case 'completed': color = 'rgba(40, 167, 69, 0.7)'; break;
          case 'not-planned': color = 'rgba(220, 53, 69, 0.7)'; break;
          default: color = 'rgba(173, 181, 189, 0.7)';
        }
        backgroundColors.push(color);
      }
    });
    
    // Destroy existing chart if it exists
    if (window.ideasStatusChart) {
      window.ideasStatusChart.destroy();
    }
    
    // Load Chart.js from CDN if not already loaded
    if (typeof Chart === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = () => createPolarChart(canvas, labels, data, backgroundColors);
      document.head.appendChild(script);
    } else {
      createPolarChart(canvas, labels, data, backgroundColors);
    }
  };
  
  // Function to create a polar area chart once Chart.js is loaded
  const createPolarChart = (canvas, labels, data, backgroundColors) => {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Create a unique polar area chart for idea status distribution
    window.ideasStatusChart = new Chart(ctx, {
      type: 'polarArea', // More interesting than a bar chart!
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: {
                size: 11
              },
              boxWidth: 15
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleFont: {
              size: 13
            },
            bodyFont: {
              size: 12
            },
            callbacks: {
              label: function(context) {
                const count = context.raw;
                const percentage = Math.round((count / data.reduce((a, b) => a + b, 0)) * 100);
                return `${count} ideas (${percentage}%)`;
              }
            }
          }
        },
        scales: {
          r: {
            ticks: {
              display: false,
            },
            grid: {
              color: 'rgba(0,0,0,0.05)'
            },
            angleLines: {
              color: 'rgba(0,0,0,0.1)'
            }
          }
        },
        animation: {
          duration: 800,
          animateRotate: true,
          animateScale: true
        }
      }
    });
  };

  // When page changes, apply our customizations
  api.onPageChange(() => {
    console.log("Ideas Portal: Page changed");
    
    // Get current category info
    const currentCategory = getCurrentCategoryInfo();
    
    // Check if we're on an enabled tag page
    const onEnabledTagPage = isEnabledTagPage();
    
    // Find any existing ideas-tag-filters
    const existingFilters = document.querySelector('.ideas-tag-filters');
    
    // Remove ideas-portal-category class from body if we're not in an enabled category or tag
    if (!currentCategory && !onEnabledTagPage) {
      document.body.classList.remove("ideas-portal-category");
      document.body.classList.remove("ideas-portal-tag");
      
      // Clean up any existing filter elements if we're not in an ideas category or tag
      if (existingFilters) {
        existingFilters.remove();
        console.log("Ideas Portal: Removed filter box when leaving ideas category/tag");
      }
      return;
    }
    
    // We're in an enabled category or tag, add the appropriate class
    if (currentCategory) {
      document.body.classList.add("ideas-portal-category");
      document.body.classList.remove("ideas-portal-tag");
    } else if (onEnabledTagPage) {
      document.body.classList.add("ideas-portal-tag");
      document.body.classList.remove("ideas-portal-category");
    }
    
    // Find the custom banner title element
    const bannerTitle = document.querySelector(".custom-banner__title");
    if (bannerTitle && currentCategory) {
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
    
    const isTagPage = onEnabledTagPage;
    
    console.log(`Ideas Portal: Creating filter box for ${isTagPage ? 'tag page' : 'category'}`);
    
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
    
    // Prepare URL for reset filter based on whether we're on a category or tag page
    let resetUrl = '';
    
    if (currentCategory) {
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
      
      resetUrl = `/c/${parentSlug}${categorySlug}/${currentCategory.id}`;
    } else if (isTagPage) {
      // Get current tag from controller
      const tagController = api.container.lookup("controller:tag-show");
      const currentTag = tagController.tag?.id;
      
      resetUrl = `/tag/${currentTag}`;
    }
    
    // Add reset filter
    const resetFilter = document.createElement('a');
    resetFilter.href = resetUrl;
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
    
    // Add status tag filters
    Object.keys(tagMap).forEach(tag => {
      const filter = document.createElement('a');
      
      // Create appropriate URL based on whether we're on a category or tag page
      let filterUrl = '';
      
      if (currentCategory) {
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
        
        filterUrl = `/tags/c/${parentSlug}${categorySlug}/${currentCategory.id}/${tag}`;
      } else if (isTagPage) {
        // Get current tag from controller
        const tagController = api.container.lookup("controller:tag-show");
        const currentTag = tagController.tag?.id;
        
        filterUrl = `/tags/intersection/${currentTag}/${tag}`;
      }
      
      filter.href = filterUrl;
      filter.className = 'tag-filter';
      filter.setAttribute('data-tag-name', tag);
      filter.textContent = tagMap[tag]; // Just the name without count
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