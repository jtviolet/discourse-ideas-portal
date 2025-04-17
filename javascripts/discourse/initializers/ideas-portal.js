// javascripts/discourse/initializers/ideas-portal.js
import { apiInitializer } from "discourse/lib/api";
// Ensure helper path is correct for your theme structure
import {
  shouldEnableForCategoryOrTag,
  getCurrentEnabledCategoryInfo,
  getCurrentEnabledTagName,
  getParentCategorySlug,
  isEnabledTagPage,
  TAG_MAP,
  resetCache // Import resetCache if needed for cleanup
} from "../lib/ideas-portal-helper";

export default apiInitializer("0.11.3", (api) => { // Ensure version is unique

  let currentChartInstance = null; // Store chart instance locally

  /**
   * Fetches topics page by page for a category.
   * WARNING: Fetching ALL topics can be very slow and resource-intensive
   * on categories with many topics. Consider alternatives.
   */
  const fetchAllTopicsInCategory = async (categoryId) => {
    if (!categoryId) {
      console.warn("Ideas Portal: Invalid categoryId passed to fetchAllTopicsInCategory.");
      return [];
    }
    console.debug(`Ideas Portal: Starting fetch for all topics in category ${categoryId}`);
    const pageSize = 100; // Discourse category JSON page size
    let page = 0;
    let allTopics = [];
    let done = false;
    const MAX_PAGES = 20; // Safety break

    while (!done && page < MAX_PAGES) {
      try {
        // Ensure categoryId is valid before fetching
        const response = await fetch(`/c/${categoryId}.json?page=${page}`);
        if (!response.ok) {
          console.warn(`Ideas Portal: Fetch failed for category ${categoryId}, page ${page}. Status: ${response.status}`);
          break;
        }
        const data = await response.json();
        const topics = data?.topic_list?.topics || [];
        allTopics = allTopics.concat(topics);

        if (topics.length < pageSize) {
          done = true;
        } else {
          page++;
        }
      } catch (e) {
          console.error(`Ideas Portal: Error fetching category topics (page ${page}):`, e);
          done = true; // Stop fetching on error
      }
    }
    if (page === MAX_PAGES) {
         console.warn(`Ideas Portal: Reached MAX_PAGES limit (${MAX_PAGES}) fetching topics for category ${categoryId}. Data might be incomplete.`);
    }
    console.debug(`Ideas Portal: Fetched ${allTopics.length} topics for category ${categoryId} in ${page + 1} pages.`);
    return allTopics;
  };

  /**
   * Fetches topics page by page for a tag.
   * WARNING: Performance considerations similar to fetchAllTopicsInCategory apply.
   */
  const fetchAllTopicsForTag = async (tagName) => {
    if (!tagName) {
        console.warn("Ideas Portal: Invalid tagName passed to fetchAllTopicsForTag.");
        return [];
    }
    console.debug(`Ideas Portal: Starting fetch for all topics with tag ${tagName}`);
    const pageSize = 30; // Discourse tag JSON page size
    let page = 0;
    let allTopics = [];
    let done = false;
    const MAX_PAGES = 30; // Safety break

    while (!done && page < MAX_PAGES) {
       try {
        const response = await fetch(`/tag/${encodeURIComponent(tagName)}.json?page=${page}`); // Ensure tagName is encoded
        if (!response.ok) {
          console.warn(`Ideas Portal: Fetch failed for tag ${tagName}, page ${page}. Status: ${response.status}`);
          break;
        }
        const data = await response.json();
        const topics = data?.topic_list?.topics || [];
        console.debug(`Ideas Portal: Fetched tag page ${page}, got ${topics.length} topics for tag ${tagName}`);
        allTopics = allTopics.concat(topics);

        if (topics.length < pageSize) {
          done = true;
        } else {
          page++;
        }
      } catch(e) {
          console.error(`Ideas Portal: Error fetching tag topics (page ${page}):`, e);
          done = true;
      }
    }
     if (page === MAX_PAGES) {
         console.warn(`Ideas Portal: Reached MAX_PAGES limit (${MAX_PAGES}) fetching topics for tag ${tagName}. Data might be incomplete.`);
    }
    console.debug(`Ideas Portal: Fetched ${allTopics.length} topics for tag ${tagName} in ${page + 1} pages.`);
    return allTopics;
  };


  const buildStatusCounts = (topics) => {
    const counts = {};
    Object.keys(TAG_MAP).forEach(tag => counts[tag] = 0);

    if (!Array.isArray(topics)) return counts; // Safety check

    topics.forEach(topic => {
      const tags = topic?.tags; // Safely access tags
      if (Array.isArray(tags)) {
          tags.forEach(tag => {
            if (TAG_MAP.hasOwnProperty(tag)) {
              counts[tag]++;
            }
          });
      }
    });
    return counts;
  };

  // Function to load Chart.js dynamically if needed
  const loadChartJs = () => {
      return new Promise((resolve, reject) => {
          if (typeof Chart !== 'undefined') {
              return resolve(Chart); // Resolve with Chart object
          }
          console.debug("Ideas Portal: Loading Chart.js library...");
          const script = document.createElement('script');
          // Consider using a specific version or hosting it yourself
          script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
          script.onload = () => {
              console.debug("Ideas Portal: Chart.js loaded successfully.");
              resolve(Chart); // Resolve with Chart object
          };
          script.onerror = (err) => {
               console.error("Ideas Portal: Failed to load Chart.js library.", err);
               reject(new Error("Chart.js library failed to load."));
          };
          document.head.appendChild(script);
      });
  };


  const createStatusVisualization = async (statusCounts, container) => {
      if (!container) {
          console.warn("Ideas Portal: Invalid container provided for status visualization.");
          return;
      }

      container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--primary-medium);">Loading visualization...</p>';
      container.style.display = 'block';

      try {
          const Chart = await loadChartJs(); // Ensure Chart.js is loaded, get Chart constructor

          container.innerHTML = ''; // Clear loading message
          const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

          if (total === 0) {
              const noIdeasMessage = document.createElement('div');
              noIdeasMessage.className = 'no-ideas-message';
              noIdeasMessage.innerHTML = `
                  <p>It looks like there are no ideas with a status tag yet.</p>
                  <p>Ideas need a status tag (like 'new', 'planned', etc.) to appear here.</p>
              `;
              container.appendChild(noIdeasMessage);
              return;
          }

          const chartContainer = document.createElement('div');
          chartContainer.style.height = '250px';
          chartContainer.style.width = '100%';
          chartContainer.style.position = 'relative';
          container.appendChild(chartContainer);

          const canvas = document.createElement('canvas');
          // Generate a unique ID based on container's presence or timestamp
          const uniqueId = container.id || `ideas-chart-${Date.now()}`;
          canvas.id = `ideas-status-chart-${uniqueId}`;
          canvas.style.height = '100%';
          canvas.style.width = '100%';
          chartContainer.appendChild(canvas);

          const labels = [], data = [], backgroundColors = [];
          const statusColors = {
                'new': 'rgba(0, 123, 255, 1)', 'planned': 'rgba(23, 162, 184, 1)',
                'in-progress': 'rgba(253, 126, 20, 1)', 'already-exists': 'rgba(108, 117, 125, 1)',
                'under-review': 'rgba(32, 201, 151, 1)', 'completed': 'rgba(40, 167, 69, 1)',
                'not-planned': 'rgba(220, 53, 69, 1)',
          };

          Object.keys(TAG_MAP).forEach(status => {
              labels.push(TAG_MAP[status]);
              data.push(statusCounts[status] || 0);
              backgroundColors.push(statusColors[status] || 'rgba(173, 181, 189, 1)');
          });

          if (currentChartInstance) {
              console.debug("Ideas Portal: Destroying previous chart instance.");
              currentChartInstance.destroy();
              currentChartInstance = null;
          }

          // Pass Chart constructor to the creation function
          createBarChart(Chart, canvas, labels, data, backgroundColors, total);

      } catch (error) {
          console.error("Ideas Portal: Failed to create status visualization:", error);
          container.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--primary-medium); font-style: italic;">
              Could not load ideas visualization. ${error.message || ''}
          </p>`;
      }
  };


  // Updated to accept Chart constructor
  const createBarChart = (Chart, canvas, labels, data, backgroundColors, total) => {
      if (typeof Chart === 'undefined' || !Chart) {
          console.error("Ideas Portal: Chart constructor is not available.");
          return;
      }
      const chartTitle = `${total} ${total === 1 ? 'Idea' : 'Ideas'} by Status`;
      // Default fallback added for primary color
      const primaryColor = getComputedStyle(canvas).getPropertyValue("--primary").trim() || '#333333';

      const ctx = canvas.getContext('2d');
      if (!ctx) {
          console.error("Ideas Portal: Could not get canvas context for chart.");
          return;
      }

      try {
          console.debug("Ideas Portal: Creating new Chart instance.");
          currentChartInstance = new Chart(ctx, {
              type: 'bar',
              data: { /* ... data structure as before ... */
                  labels,
                  datasets: [{
                      label: 'Idea Count',
                      data,
                      backgroundColor: backgroundColors,
                      borderColor: backgroundColors.map(c => c.replace(/, *1\)/, ', 1)')),
                      borderWidth: 1,
                      borderRadius: 6,
                      borderSkipped: false,
                  }]
              },
              options: { /* ... options structure as before ... */
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'x',
                  plugins: {
                      legend: { display: false },
                      title: {
                          display: true, text: chartTitle,
                          font: { size: 18, weight: 'bold' }, color: primaryColor,
                          padding: { top: 10, bottom: 20 }
                      },
                      tooltip: {
                          backgroundColor: 'rgba(0,0,0,0.8)', titleFont: { size: 13 }, bodyFont: { size: 12 },
                          callbacks: {
                              label: (context) => {
                                  const count = context.raw || 0;
                                  const totalIdeas = data.reduce((a, b) => a + b, 0);
                                  const percent = totalIdeas > 0 ? Math.round((count / totalIdeas) * 100) : 0;
                                  return `${count} ${count === 1 ? 'idea' : 'ideas'} (${percent}%)`;
                              }
                          }
                      }
                  },
                  scales: {
                      x: { grid: { display: false }, ticks: { color: primaryColor, font: { size: 12 } } },
                      y: {
                          beginAtZero: true, grid: { color: 'rgba(128, 128, 128, 0.2)' },
                          ticks: { precision: 0, color: primaryColor, font: { size: 12 } }
                      }
                  },
                  animation: { duration: 800, easing: 'easeOutQuart' }
              }
          });
      } catch (e) {
          console.error("Ideas Portal: Error initializing Chart:", e);
          if (canvas.parentElement) {
              canvas.parentElement.innerHTML = `<p style="text-align: center; color: var(--danger);">Chart Error</p>`;
          }
      }
  };

  // --- DOM Manipulation Functions ---

  const updateNavLinks = () => {
    /* ... function definition as before ... */
    const navLinksToUpdate = [
      { className: "top", newText: "Most Active" },
      { className: "votes", newText: "Most Voted" },
      { className: "latest", newText: "Recently Active" },
    ];
    navLinksToUpdate.forEach(({ className, newText }) => {
      try {
        const listItem = document.querySelector(`.navigation-container .nav-item.${className}`);
        if (listItem) {
          const link = listItem.querySelector("a");
          const currentText = link?.textContent?.trim();
          const expectedOldText = className.charAt(0).toUpperCase() + className.slice(1);
          if (link && currentText === expectedOldText) {
            link.textContent = newText;
          }
        }
      } catch(e) {
          console.warn(`Ideas Portal: Could not update nav link for class "${className}".`, e);
      }
    });
  };

  const updateTopicListHeader = () => {
      /* ... function definition as before ... */
      try {
        const headerElement = document.querySelector('table.topic-list th.topic-list-data.default span');
        if (headerElement && headerElement.textContent?.trim() === "Topic") {
          headerElement.textContent = "Ideas";
        }
      } catch (e) {
          console.warn("Ideas Portal: Could not update topic list header text.", e);
      }
  };

   const updateTagText = () => {
       /* ... function definition as before ... */
       document.querySelectorAll('[data-tag-name]').forEach(el => {
           const tag = el.getAttribute('data-tag-name');
           if (tag && TAG_MAP[tag] && el.textContent !== TAG_MAP[tag]) {
               el.textContent = TAG_MAP[tag];
           }
       });
   };

  const reorderTagsInTopicList = () => {
      /* ... function definition as before ... */
      const statusTagsOrder = Object.keys(TAG_MAP);
      document.querySelectorAll("tr.topic-list-item").forEach(row => {
          const tagContainer = row.querySelector(".discourse-tags");
          if (!tagContainer) return;
          const tagElements = Array.from(tagContainer.querySelectorAll("a.discourse-tag[data-tag-name]"));
          if (tagElements.length < 2) return;
          tagElements.sort((a, b) => {
              const tagA = a.dataset.tagName; const tagB = b.dataset.tagName;
              const indexA = statusTagsOrder.indexOf(tagA); const indexB = statusTagsOrder.indexOf(tagB);
              if (indexA !== -1 && indexB !== -1) return indexA - indexB;
              if (indexA !== -1) return -1; if (indexB !== -1) return 1;
              return tagA.localeCompare(tagB);
          });
          tagElements.forEach(el => tagContainer.appendChild(el));
      });
  };

  // Updated to accept container
  const updateCategoryBannerTitle = (category, container) => {
      if (!category || !container || typeof container.lookup !== 'function') return; // Safety checks
      try {
          const bannerTitle = document.querySelector(".custom-banner__title"); // Adjust if needed
          if (bannerTitle) {
              const originalTitle = bannerTitle.textContent.trim();
              // Use helper, passing container
              const parentSlug = getParentCategorySlug(container, category);
              let parentName = "";
              if (category.parent_category_id) {
                  // Direct lookup here is fine, or use getSiteCategories(container)
                  const site = container.lookup("site:main");
                  const parentCategory = site?.categories?.find(cat => cat.id === category.parent_category_id);
                  if (parentCategory?.name) parentName = parentCategory.name; // Safely access name
              }

              if (parentName && category.name && !originalTitle.includes(category.name)) {
                   bannerTitle.textContent = `${parentName} › ${category.name}`;
              } else if (!parentName && category.name && originalTitle !== category.name) {
                   bannerTitle.textContent = category.name;
              }
          }
      } catch (e) {
          console.warn("Ideas Portal: Could not update category banner title.", e);
      }
  };

  // Updated to accept container
  const renderFiltersAndVisualization = async (container) => {
      if (!container || typeof container.lookup !== 'function') {
          console.error("Ideas Portal: Invalid container passed to renderFiltersAndVisualization.");
          return;
      }
      console.debug("Ideas Portal: Rendering filters and visualization.");

      const existingContainer = document.querySelector('.ideas-portal-controls');
      if (existingContainer) {
          console.debug("Ideas Portal: Removing existing controls container.");
          existingContainer.remove();
      }

      // Get category/tag info using the container
      const category = getCurrentEnabledCategoryInfo(container);
      const tagName = getCurrentEnabledTagName(container);

      // Exit if neither is active (shouldn't happen if called correctly, but safety check)
      if (!category && !tagName) {
          console.debug("Ideas Portal: Neither category nor tag page detected for rendering controls.");
          return;
      }

      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'ideas-portal-controls';

      const title = document.createElement('h3');
      title.className = 'ideas-filter-title';
      // Safely access category/tag names
      title.textContent = category ? `${category.name || 'Category'} Status & Filters` : `"${tagName || 'Tag'}" Status & Filters`;
      controlsContainer.appendChild(title);

      const statusVisualization = document.createElement('div');
      statusVisualization.className = 'ideas-status-visualization';
      controlsContainer.appendChild(statusVisualization);

      const filtersWrapper = document.createElement('div');
      filtersWrapper.className = 'ideas-tag-filters';
      const filterButtonsWrapper = document.createElement('div');
      filterButtonsWrapper.className = 'filter-buttons';

      let topics = [];
      let baseHref = '';
      let intersectionPrefix = '';

      if (category) {
          // Pass container to getParentCategorySlug
          const parentSlug = getParentCategorySlug(container, category);
          baseHref = `/c/${parentSlug}${category.slug || category.id}/${category.id}`; // Fallback to ID if slug missing
          intersectionPrefix = `/tags/c/${parentSlug}${category.slug || category.id}/${category.id}/`;
          try {
              topics = await fetchAllTopicsInCategory(category.id);
          } catch (e) { /* Error handled in fetch function */ }
      } else if (tagName) {
          const encodedTag = encodeURIComponent(tagName);
          baseHref = `/tag/${encodedTag}`;
          intersectionPrefix = `/tags/intersection/${encodedTag}/`;
          try {
              topics = await fetchAllTopicsForTag(tagName);
          } catch (e) { /* Error handled in fetch function */ }
      }

      // Build Filters
      const resetFilter = document.createElement('a');
      resetFilter.href = baseHref;
      resetFilter.className = 'tag-filter tag-filter-reset';
      resetFilter.textContent = 'Show All';
      filterButtonsWrapper.appendChild(resetFilter);

      Object.keys(TAG_MAP).forEach(tag => {
          const filter = document.createElement('a');
          // Ensure intersectionPrefix ends with a slash and tag is encoded if needed
          filter.href = `${intersectionPrefix}${encodeURIComponent(tag)}`;
          filter.className = 'tag-filter';
          filter.setAttribute('data-tag-name', tag);
          filter.textContent = TAG_MAP[tag];
          filterButtonsWrapper.appendChild(filter);
      });

      filtersWrapper.appendChild(filterButtonsWrapper);
      controlsContainer.appendChild(filtersWrapper);

      // Inject into DOM
      const target = document.querySelector('.navigation-container'); // Adjust selector if needed
      if (target) {
          target.insertAdjacentElement('afterend', controlsContainer);
          console.debug("Ideas Portal: Controls injected after .navigation-container.");
      } else {
          console.warn("Ideas Portal: Could not find .navigation-container. Appending controls to body as fallback.");
          document.body.insertBefore(controlsContainer, document.body.firstChild);
      }

       // Create Visualization (now uses fetched topics)
       const statusCounts = buildStatusCounts(topics);
       await createStatusVisualization(statusCounts, statusVisualization);

       // Final Text Updates After Injection
       updateTagText();
  };


  // --- Main Execution Logic ---
  api.onPageChange(async (url, title) => {
    console.debug(`Ideas Portal: onPageChange triggered for URL: ${url}`);
    // Pass api.container to the activation check
    const shouldEnable = shouldEnableForCategoryOrTag(api.container);
    console.debug(`Ideas Portal: shouldEnable evaluated to: ${shouldEnable}`);

    const bodyClass = "ideas-portal-category";
    const controlsSelector = '.ideas-portal-controls';

    if (!shouldEnable) {
      if (document.body.classList.contains(bodyClass)) {
          console.debug("Ideas Portal: Cleaning up - removing body class and controls.");
          document.body.classList.remove(bodyClass);
          const existingControls = document.querySelector(controlsSelector);
          if (existingControls) existingControls.remove();
          if (currentChartInstance) {
              currentChartInstance.destroy();
              currentChartInstance = null;
          }
      }
      return;
    }

    // Add body class if not already present
    if (!document.body.classList.contains(bodyClass)) {
        document.body.classList.add(bodyClass);
    }

    // Hide Categories link on enabled tag pages
    try {
        const categoriesNavItem = document.querySelector('.nav-item_categories');
        if (categoriesNavItem) {
            // Pass api.container
            categoriesNavItem.style.display = isEnabledTagPage(api.container) ? 'none' : '';
        }
    } catch (e) {
        console.warn("Ideas Portal: Error hiding categories nav item.", e);
    }

    // Perform DOM updates safely
    try {
        // Use requestAnimationFrame for updates that might affect layout
        requestAnimationFrame(() => {
            updateNavLinks();
            updateTopicListHeader();
            reorderTagsInTopicList();
            updateTagText(); // Update existing tags
            // Pass api.container when getting category info and updating banner
            updateCategoryBannerTitle(getCurrentEnabledCategoryInfo(api.container), api.container);
        });
    } catch(e) {
        console.error("Ideas Portal: Error during scheduled DOM updates.", e);
    }

    // Render the filters and visualization section, passing container
    try {
        await renderFiltersAndVisualization(api.container);
    } catch (e) {
        console.error("Ideas Portal: Error rendering filters and visualization.", e);
    }
  });

  // --- Cleanup ---
  api.cleanupStream(() => {
    console.debug("Ideas Portal: Cleanup stream called.");
    resetCache(); // Reset helper cache
    document.body.classList.remove("ideas-portal-category");
    const existingControls = document.querySelector('.ideas-portal-controls');
    if (existingControls) existingControls.remove();
    if (currentChartInstance) {
      currentChartInstance.destroy();
      currentChartInstance = null;
    }
  });
});