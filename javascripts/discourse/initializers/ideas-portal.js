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

  // Function to create a beautiful status visualization using Chart.js
  const createStatusVisualization = (statusCounts, container) => {
    if (!container) return;
    
    // Clear the container
    container.innerHTML = '';
    
    // Calculate total
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    
    // If no data, show a message instead of the chart
    if (total === 0) {
      const emptyStateMessage = document.createElement('div');
      emptyStateMessage.className = 'ideas-empty-state';
      emptyStateMessage.innerHTML = `
        <p>There are currently no new ideas for this category. You could be the first to submit one!</p>
        <button class="btn btn-primary create-topic">Submit an Idea</button>
      `;
      container.appendChild(emptyStateMessage);
      
      // Add click event to the button
      const createButton = emptyStateMessage.querySelector('.create-topic');
      if (createButton) {
        createButton.addEventListener('click', () => {
          const composerController = api.container.lookup('controller:composer');
          if (composerController) {
            const categoryId = getCurrentCategoryInfo()?.id;
            if (categoryId) {
              composerController.open({
                action: 'createTopic',
                categoryId: categoryId
              });
            }
          }
        });
      }
      
      return;
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

  // Function to properly count topics by tag using the Discourse API
  const getTopicsWithTagCounts = async (categoryId) => {
    // Initialize counts to zero
    const statusCounts = {};
    Object.keys(tagMap).forEach(tag => {
      statusCounts[tag] = 0;
    });
    
    // Get topics from the current discovery model
    const discoveryService = api.container.lookup("service:discovery");
    if (!discoveryService || !discoveryService.topics) {
      console.log("Ideas Portal: No topics found in discovery service");
      return statusCounts;
    }
    
    const topics = discoveryService.topics || [];
    console.log(`Ideas Portal: Found ${topics.length} topics in discovery service`);
    
    // Count topics with each tag
    topics.forEach(topic => {
      if (!topic.tags) return;
      
      topic.tags.forEach(tag => {
        if (statusCounts.hasOwnProperty(tag)) {
          statusCounts[tag]++;
        }
      });
    });
    
    console.log("Ideas Portal: Tag counts from topic model:", statusCounts);
    return statusCounts;
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
    statusVisualization.innerHTML = '<div class="ideas-loading">Loading status counts...</div>';
    container.appendChild(statusVisualization);
    
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
      filter.textContent = tagMap[tag]; // Just the name without count
      container.appendChild(filter);
    });
    
    // Insert the filter container after the navigation container
    const target = document.querySelector('.navigation-container');
    if (target) {
      target.insertAdjacentElement('afterend', container);
      
      // Asynchronously get topic counts and update visualization
      setTimeout(async () => {
        try {
          // Get topic counts
          const statusCounts = await getTopicsWithTagCounts(currentCategory.id);
          
          // Update the visualization
          createStatusVisualization(statusCounts, statusVisualization);
        } catch (error) {
          console.error("Ideas Portal: Error updating visualization:", error);
          statusVisualization.innerHTML = '<div class="ideas-error">Error loading status counts</div>';
        }
      }, 500); // Small delay to ensure topics are loaded
    }
  });
});