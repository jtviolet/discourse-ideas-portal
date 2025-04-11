// javascripts/discourse/initializers/ideas-portal.js

import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  const enabledCategories = settings.enabled_categories
    ? settings.enabled_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    : [];
    
  const enabledTags = settings.enabled_tags
    ? settings.enabled_tags.split("|").map(tag => tag.trim()).filter(tag => tag.length > 0)
    : [];

  let currentCategoryId = null;

  const tagMap = {
    'new': 'New',
    'under-review': 'Under Review',
    'planned': 'Planned',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'not-planned': 'Not Planned',
    'already-exists': 'Already Exists',
  };


  api.registerValueTransformer('topic-list-tags', ({ value: tags, context }) => {
    // If no tags or not on a list page, return original tags
    if (!tags || !context.listView) return tags;

    // Convert tags to array if it's not already
    const tagsArray = Array.isArray(tags) ? tags : [tags];

    // Separate status tags and non-status tags
    const statusTagsList = tagsArray.filter(tag => tagMap[tag]);
    console.log("Status tags:", statusTagsList);
    const otherTags = tagsArray.filter(tag => !tagMap[tag]);
    console.log("Other tags:", otherTags);

    // Sort status tags by a predefined order (you can adjust this order)
    const statusTagOrder = [
      'new', 
      'under-review', 
      'planned', 
      'in-progress', 
      'completed', 
      'not-planned', 
      'already-exists'
    ];

    const sortedStatusTags = statusTagsList.sort((a, b) => 
      statusTagOrder.indexOf(a) - statusTagOrder.indexOf(b)
    );

    // Combine sorted status tags first, then other tags
    return [...sortedStatusTags, ...otherTags];
  });

  const fetchAllTopicsInCategory = async (categoryId) => {
    const pageSize = 100;
    let page = 0;
    let allTopics = [];
    let done = false;

    while (!done) {
      const response = await fetch(`/c/${categoryId}.json?page=${page}`);
      if (!response.ok) break;

      const data = await response.json();
      const topics = data.topic_list.topics || [];

      allTopics = allTopics.concat(topics);
      if (topics.length < pageSize) {
        done = true;
      } else {
        page++;
      }
    }

    return allTopics;
  };
  
  const fetchAllTopicsForTag = async (tagName) => {
    const pageSize = 100;
    let page = 0;
    let allTopics = [];
    let done = false;

    while (!done) {
      const response = await fetch(`/tag/${tagName}.json?page=${page}`);
      if (!response.ok) break;

      const data = await response.json();
      const topics = data.topic_list.topics || [];

      allTopics = allTopics.concat(topics);
      if (topics.length < pageSize) {
        done = true;
      } else {
        page++;
      }
    }

    return allTopics;
  };

  const buildStatusCounts = (topics) => {
    const counts = {};
    Object.keys(tagMap).forEach(tag => counts[tag] = 0);

    topics.forEach(topic => {
      const tags = topic.tags || [];
      tags.forEach(tag => {
        if (counts.hasOwnProperty(tag)) {
          counts[tag]++;
        }
      });
    });

    return counts;
  };

  const createStatusVisualization = (statusCounts, container) => {
    if (!container) return;

    container.innerHTML = '';
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      const noIdeasMessage = document.createElement('div');
      noIdeasMessage.className = 'no-ideas-message';
      noIdeasMessage.innerHTML = `
        <p>It looks like there are no ideas with this status yet.</p>
        <p>Be the first to submit an idea!</p>
      `;
      noIdeasMessage.style.textAlign = 'center';
      noIdeasMessage.style.padding = '20px';
      noIdeasMessage.style.color = 'var(--primary-medium)';
      noIdeasMessage.style.fontStyle = 'italic';
      container.appendChild(noIdeasMessage);
      container.style.display = 'block';
      return;
    } else {
      container.style.display = 'block';
    }

    // Function to get parent category name
    const getParentCategoryName = () => {
      const currentCategory = getCurrentCategoryInfo();
      if (!currentCategory || !currentCategory.parent_category_id) {
        return null;
      }
      
      const siteCategories = api.container.lookup("site:main").categories;
      const parentCategory = siteCategories.find(cat => cat.id === currentCategory.parent_category_id);
      
      return parentCategory ? parentCategory.name : null;
    };

    // Then update your header creation code
    const header = document.createElement('div');
    header.className = 'ideas-visualization-header';

    // Get parent category name
    // {n} ideas for {parentCategoryName} or {n} ideas for Total

    const chartContainer = document.createElement('div');
    chartContainer.style.height = '250px';
    chartContainer.style.width = '100%';
    chartContainer.style.position = 'relative';
    container.appendChild(chartContainer);

    const canvas = document.createElement('canvas');
    canvas.id = 'ideas-status-chart';
    canvas.style.height = '100%';
    canvas.style.width = '100%';
    chartContainer.appendChild(canvas);

    const labels = [], data = [], backgroundColors = [];

    Object.keys(statusCounts).forEach(status => {
      if (statusCounts[status] > 0) {
        labels.push(tagMap[status]);
        data.push(statusCounts[status]);
        let color;
        switch(status) {
          case 'new': color = 'rgba(0, 123, 255, 1)'; break;
          case 'planned': color = 'rgba(23, 162, 184, 1)'; break;
          case 'in-progress': color = 'rgba(253, 126, 20, 1)'; break;
          case 'already-exists': color = 'rgba(108, 117, 125, 1)'; break;
          case 'under-review': color = 'rgba(32, 201, 151, 1)'; break;
          case 'completed': color = 'rgba(40, 167, 69, 1)'; break;
          case 'not-planned': color = 'rgba(220, 53, 69, 1)'; break;
          default: color = 'rgba(173, 181, 189, 1)';
        }
        backgroundColors.push(color);
      }
    });

    if (window.ideasStatusChart) {
      window.ideasStatusChart.destroy();
      window.ideasStatusChart = null;
    }

    if (typeof Chart === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = () => createBarChart(canvas, labels, data, backgroundColors, total);
      document.head.appendChild(script);
    } else {
      createBarChart(canvas, labels, data, backgroundColors, total);
    }
  };

  const createBarChart = (canvas, labels, data, backgroundColors, total) => {
    const chartTitle = `${total} ${total === 1 ? 'idea' : 'ideas'}`;
    const returnPrimaryColor = () => {
      const primaryColor = getComputedStyle(canvas).getPropertyValue("--primary");
      return primaryColor;
    };
  
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    window.ideasStatusChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(c => c.replace('0.7', '1')),
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: chartTitle,
            font: {
              size: 20,
              weight: 'bold'
            },
            color: returnPrimaryColor(),
            padding: {
              bottom: 10
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            callbacks: {
              label: (context) => {
                const count = context.raw;
                const percent = Math.round((count / data.reduce((a, b) => a + b, 0)) * 100);
                return `${count} ideas (${percent}%)`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: returnPrimaryColor(),
              font: {
                size: 16
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: returnPrimaryColor()
            },
            ticks: {
              precision: 0,
              color: returnPrimaryColor(),
              font: {
                size: 16
              }
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        }
      }
    });
  };
  

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
    // Check if we're on either an enabled category page or an enabled tag page
    return getCurrentCategoryInfo() !== null || isEnabledTagPage();
  };


  api.onPageChange(async () => {
    const shouldEnable = shouldEnableComponent();
    const existingFilters = document.querySelector('.ideas-tag-filters');

    if(isEnabledTagPage()) {
      document.querySelector('.nav-item_categories').style.display = 'none';
    }

    if (!shouldEnable) {
      document.body.classList.remove("ideas-portal-category");
      currentCategoryId = null;
      if (existingFilters) existingFilters.remove();
      if (window.ideasStatusChart) {
        window.ideasStatusChart.destroy();
        window.ideasStatusChart = null;
      }
      return;
    }

    const currentCategory = getCurrentCategoryInfo();
    
    // Use requestAnimationFrame to ensure the DOM is fully loaded
    requestAnimationFrame(() => {
      // Define an array of objects with the class and new text for each link
      const navLinks = [
        { className: "top", newText: "Most Active" },
        { className: "votes", newText: "Most Voted" },
        { className: "latest", newText: "Recently Active" },
      ];

      navLinks.forEach(({ className, newText }) => {
        // Select the <li> element with the specified class
        const listItem = document.querySelector(`li.${className}`);

        if (listItem) {
          // Select the <a> tag within the list item
          const link = listItem.querySelector("a");

          // Ensure the <a> tag exists and contains the expected text
          if (link && link.textContent.trim() === className.charAt(0).toUpperCase() + className.slice(1)) {
            link.textContent = newText;
          }
        }
      });

      // Replace "Topic" with "Ideas" in the topic list header
      const headerElement = document.querySelector('table.topic-list th.topic-list-data.default span');
      if (headerElement) {
        headerElement.textContent = "Ideas";
      }
    });

    if (existingFilters) {
      existingFilters.remove();
    }
    
    // Only set currentCategoryId if we're on a category page
    if (currentCategory) {
      currentCategoryId = currentCategory.id;
    }
    
    document.body.classList.add("ideas-portal-category");

    // Apply tagMap text updates
    document.querySelectorAll('[data-tag-name]').forEach(el => {
      const tag = el.getAttribute('data-tag-name');
      if (tag && tagMap[tag]) {
        el.textContent = tagMap[tag];
      }
    });

    // Rest of the existing code for category pages
    if (currentCategory) {
      // Update banner title
      const bannerTitle = document.querySelector(".custom-banner__title");
      if (bannerTitle) {
        const originalTitle = bannerTitle.textContent.trim();
        let parentName = "";
        if (currentCategory.parent_category_id) {
          const siteCategories = api.container.lookup("site:main").categories;
          const parentCategory = siteCategories.find(cat => cat.id === currentCategory.parent_category_id);
          if (parentCategory) parentName = parentCategory.name;
        }
        if (parentName && !originalTitle.includes(currentCategory.name)) {
          bannerTitle.textContent = `${parentName} ${currentCategory.name}`;
        }
      }
    }

    // Render filters and chart
    const container = document.createElement('div');
    container.className = 'ideas-tag-filters';
    const title = document.createElement('h3');
    title.className = 'ideas-filter-title';
    container.appendChild(title);

    const statusVisualization = document.createElement('div');
    statusVisualization.className = 'ideas-status-visualization';
    container.appendChild(statusVisualization);

    // Create the div to wrap all filter buttons
    const filtersWrapper = document.createElement('div');
    filtersWrapper.className = 'filter-buttons';

    if (currentCategory) {
      // Category-specific code
      const categorySlug = currentCategory.slug;
      let parentSlug = "";
      if (currentCategory.parent_category_id) {
        const siteCategories = api.container.lookup("site:main").categories;
        const parentCategory = siteCategories.find(cat => cat.id === currentCategory.parent_category_id);
        if (parentCategory) parentSlug = `${parentCategory.slug}/`;
      }

      const resetFilter = document.createElement('a');
      resetFilter.href = `/c/${parentSlug}${categorySlug}/${currentCategory.id}`;
      resetFilter.className = 'tag-filter tag-filter-reset';
      resetFilter.textContent = 'Show All';
      container.appendChild(resetFilter);
      filtersWrapper.appendChild(resetFilter);

      Object.keys(tagMap).forEach(tag => {
        const filter = document.createElement('a');
        filter.href = `/tags/c/${parentSlug}${categorySlug}/${currentCategory.id}/${tag}`;
        filter.className = 'tag-filter';
        filter.setAttribute('data-tag-name', tag);
        filter.textContent = tagMap[tag];
        filtersWrapper.appendChild(filter);
      });
      
      // Try to fetch topics and create visualization
      try {
        const topics = await fetchAllTopicsInCategory(currentCategory.id);
        const statusCounts = buildStatusCounts(topics);
        createStatusVisualization(statusCounts, statusVisualization);
      } catch (e) {
        console.error("Ideas Portal: Failed to load topics for static chart:", e);
      }
    } else {
      // Tag page specific code
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
      
      if (currentTag) {
        const resetFilter = document.createElement('a');
        resetFilter.href = `/tag/${currentTag}`;
        resetFilter.className = 'tag-filter tag-filter-reset';
        resetFilter.textContent = 'Show All';
        container.appendChild(resetFilter);
        filtersWrapper.appendChild(resetFilter);

        Object.keys(tagMap).forEach(tag => {
          const filter = document.createElement('a');
          filter.href = `/tags/intersection/${currentTag}/${tag}`;
          filter.className = 'tag-filter';
          filter.setAttribute('data-tag-name', tag);
          filter.textContent = tagMap[tag];
          filtersWrapper.appendChild(filter);
        });
        
        // Fetch and display visualization for tag page
        try {
          const topics = await fetchAllTopicsForTag(currentTag);
          const statusCounts = buildStatusCounts(topics);
          createStatusVisualization(statusCounts, statusVisualization);
        } catch (e) {
          console.error("Ideas Portal: Failed to load topics for tag chart:", e);
          // Show fallback message if chart creation fails
          const fallbackMessage = document.createElement('div');
          fallbackMessage.className = 'no-tag-visualization';
          fallbackMessage.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--primary-medium); font-style: italic;">
            Unable to load ideas visualization for this tag.
          </p>`;
          statusVisualization.appendChild(fallbackMessage);
        }
      }
    }
    
    container.appendChild(filtersWrapper);

    const target = document.querySelector('.navigation-container');
    if (target) {
      target.insertAdjacentElement('afterend', container);
    }
  });

  api.cleanupStream(() => {
    if (window.ideasPortalObserver) {
      window.ideasPortalObserver.disconnect();
      window.ideasPortalObserver = null;
    }
    if (window.ideasStatusChart) {
      window.ideasStatusChart.destroy();
      window.ideasStatusChart = null;
    }
    document.body.classList.remove("ideas-portal-category");
    const existingFilters = document.querySelector('.ideas-tag-filters');
    if (existingFilters) existingFilters.remove();
  });
});
