import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  // Parse enabled categories from settings
  const enabledCategories = settings.ideas_portal_categories
    ? settings.ideas_portal_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    : [];

  // Log enabled categories for debugging!
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
        switch (status) {
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
              label: function (context) {
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

  let initialStatusCounts = null; // Store initial counts
  let chartInitialized = false;

  // When page changes, apply our customizations
  api.onPageChange(() => {
    console.log("Ideas Portal: Page changed");

    // Get current category info
    const discoveryService = api.container.lookup("service:discovery");
    const currentCategory = discoveryService?.category;

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

    const categoryId = currentCategory?.id;
    // We're in an enabled category, add the class
    if (enabledCategories.includes(categoryId)) {
      document.body.classList.add("ideas-portal-category");
    } else {
      document.body.classList.remove("ideas-portal-category");
      if (existingFilters) {
        existingFilters.remove();
      }
      return;
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

    try {
      // Get the topic list model from the route
      const topicListController = api.container.lookup("controller:discovery/topics");
      const topicList = topicListController?.model; // Use optional chaining

      console.log("Ideas Portal: Topic list model:", topicList);

      // If we have a topic list, count the tags on each topic
      if (topicList && topicList.topics) {
        topicList.topics.forEach(topic => {
          topic.tags?.forEach(tag => {
            if (statusCounts.hasOwnProperty(tag)) {
              statusCounts[tag]++;
            }
          });
        });
      }

      console.log("Ideas Portal: Status counts:", statusCounts);
    } catch (e) {
      console.error("Ideas Portal: Error counting statuses:", e);
    }

    // Store initial counts if not already stored and chart not initialized
    if (!initialStatusCounts && !chartInitialized) {
      initialStatusCounts = { ...statusCounts }; // Deep copy
    }

    // Create the status visualization after we have the counts
    if (!chartInitialized) {
      createStatusVisualization(initialStatusCounts, statusVisualization);
      chartInitialized = true; // set the flag
    } else {
      //if the chart is already initialized, just update the topic count.
      const header = document.querySelector('.ideas-visualization-header');
      if(header){
        const total = Object.values(initialStatusCounts).reduce((sum, count) => sum + count, 0);
        header.textContent = `${total} Total Ideas`;
      }
    }

    // Add status tag filters without counts
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
