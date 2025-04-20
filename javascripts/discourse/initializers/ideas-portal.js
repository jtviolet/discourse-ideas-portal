// javascripts/discourse/initializers/ideas-portal.js

import { apiInitializer } from "discourse/lib/api";
import {
  parseCategories,
  parseTags,
  getCurrentCategory,
  getCurrentTag,
  shouldEnable
} from "../lib/ideas-portal-utils";

export default apiInitializer("0.11.1", (api) => {
  const enabledCategories = parseCategories();
  const enabledTags = parseTags();

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
    const pageSize = 30;
    let page = 0;
    let allTopics = [];
    let done = false;
  
    while (!done && page < 100) {
      const response = await fetch(`/tag/${tagName}.json?page=${page}`);
      if (!response.ok) break;
  
      const data = await response.json();
      const topics = data?.topic_list?.topics || [];
  
      console.log(`Fetched tag page ${page}, got ${topics.length} topics`);
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
  
    const header = document.createElement('div');
    header.className = 'ideas-visualization-header';
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
  
    // Ensure all statuses are included, even with a count of 0
    Object.keys(tagMap).forEach(status => {
      labels.push(tagMap[status]);  // Add label for every status
      data.push(statusCounts[status] || 0);  // Add count (0 if no topics for this status)
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
    // Using scriptable options for dynamic theme colors; no returnPrimaryColor helper needed
  
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
            // Scriptable color to adapt to theme
            color: (ctx) => getComputedStyle(ctx.chart.canvas).getPropertyValue("--primary").trim(),
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
            display: false,
            // optional scriptable grid color
            color: (ctx) => getComputedStyle(ctx.chart.canvas).getPropertyValue("--primary").trim(),
          },
          ticks: {
            color: (ctx) => getComputedStyle(ctx.chart.canvas).getPropertyValue("--primary").trim(),
              font: {
                size: 16
              }
            }
          },
        y: {
          beginAtZero: true,
          grid: {
            color: (ctx) => getComputedStyle(ctx.chart.canvas).getPropertyValue("--primary").trim(),
          },
          ticks: {
            precision: 0,
            color: (ctx) => getComputedStyle(ctx.chart.canvas).getPropertyValue("--primary").trim(),
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
  



  api.onPageChange(async () => {
    const shouldEnablePortal = shouldEnable(api);
    const existingFilters = document.querySelector('.ideas-tag-filters');

    // Hide categories nav on enabled tag pages
    if (getCurrentTag(api)) {
      const navItem = document.querySelector('.nav-item_categories');
      if (navItem) {
        navItem.style.display = 'none';
      }
    }

    if (!shouldEnablePortal) {
      document.body.classList.remove("ideas-portal-category");
      currentCategoryId = null;
      if (existingFilters) existingFilters.remove();
      if (window.ideasStatusChart) {
        window.ideasStatusChart.destroy();
        window.ideasStatusChart = null;
      }
      return;
    }

    const currentCategory = getCurrentCategory(api);
    
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

        // Reorder status tags first in the topic list
        const statusTags = [
          "new",
          "under-review",
          "planned",
          "in-progress",
          "completed",
          "not-planned",
          "already-exists"
        ];
    
        requestAnimationFrame(() => {
          document.querySelectorAll("tr.topic-list-item").forEach(row => {
            const tagRow = row.querySelector(".discourse-tags");
            if (!tagRow) return;
        
            const statusTags = [
              "new", "under-review", "planned",
              "in-progress", "completed", "not-planned", "already-exists"
            ];
        
            // Get all tag <a> elements
            const tagElements = Array.from(tagRow.querySelectorAll("a.discourse-tag"));
        
            if (tagElements.length < 2) return; // no need to sort
        
            // Create a map of tagName -> original <a> element
            const tagMap = new Map(tagElements.map(el => [el.dataset.tagName, el]));
        
            // Sort tag names by status-first
            const sortedTagNames = [...tagMap.keys()].sort((a, b) => {
              const aIsStatus = statusTags.includes(a);
              const bIsStatus = statusTags.includes(b);
              if (aIsStatus && !bIsStatus) return -1;
              if (!aIsStatus && bIsStatus) return 1;
              return 0;
            });
        
            // Clear the container
            tagRow.innerHTML = "";
        
            // Append tags with correct spacing
            sortedTagNames.forEach((tagName, index) => {
              const el = tagMap.get(tagName);
              if (el) tagRow.appendChild(el);
            });
          });
        });
        
    
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

  // Setup chart update on theme changes (OS preference and Discourse theme toggles)
  const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function updateChart() {
    console.log('IdeasPortal: updateChart() called; data-theme=',
      document.documentElement.getAttribute('data-theme'),
      'prefers-color-scheme dark=', darkMediaQuery.matches);
    if (window.ideasStatusChart) {
      window.ideasStatusChart.update();
    }
  }
  // Initial log to confirm load
  console.log('IdeasPortal: initial data-theme=',
    document.documentElement.getAttribute('data-theme'),
    'prefers-color-scheme dark=', darkMediaQuery.matches);
  // Listen for OS-level preference changes
  function handlePrefersChange(e) {
    console.log('IdeasPortal: prefers-color-scheme change, matches dark=', e.matches);
    updateChart();
  }
  if (darkMediaQuery.addEventListener) {
    darkMediaQuery.addEventListener('change', handlePrefersChange);
    api.cleanupStream(() => darkMediaQuery.removeEventListener('change', handlePrefersChange));
  } else if (darkMediaQuery.addListener) {
    darkMediaQuery.addListener(handlePrefersChange);
    api.cleanupStream(() => darkMediaQuery.removeListener(handlePrefersChange));
  }
  
  // Observe theme stylesheet changes and <link> toggles (e.g., theme toggle) to refresh chart
  const headObserver = new MutationObserver(mutations => {
    console.log('IdeasPortal: headObserver saw mutations', mutations);
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.tagName === 'LINK') {
            console.log('IdeasPortal: headObserver added LINK', node.href);
            updateChart();
          }
        });
      } else if (m.type === 'attributes' && m.target.tagName === 'LINK' && m.attributeName === 'disabled') {
        console.log('IdeasPortal: headObserver LINK disabled toggled', m.target.href, 'disabled=', m.target.disabled);
        updateChart();
      }
    }
  });
  headObserver.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  api.cleanupStream(() => headObserver.disconnect());
  // Observe attribute changes on <html> (e.g., data-theme) to refresh chart on Discourse theme toggle
  const htmlObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.attributeName === 'data-theme') {
        updateChart();
        break;
      }
    }
  });
  htmlObserver.observe(document.documentElement, { attributes: true });
  api.cleanupStream(() => htmlObserver.disconnect());
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
