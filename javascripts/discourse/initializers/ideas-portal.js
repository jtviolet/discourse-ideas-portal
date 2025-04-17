import { apiInitializer } from "discourse/lib/api";
// Assuming ideas-portal-helper.js is correctly imported or helpers are globally available
import {
  shouldEnableForCategoryOrTag,
  getCurrentEnabledCategoryInfo,
  getCurrentEnabledTagName,
  getParentCategorySlug,
  isEnabledTagPage,
  TAG_MAP,
  resetCache // Import resetCache if needed for cleanup
} from "../lib/ideas-portal-helper"; // Adjust path as needed

export default apiInitializer("0.11.2", (api) => { // Increment version if dependent on helper

  let currentChartInstance = null; // Store chart instance locally

  /**
   * Fetches topics page by page for a category.
   * WARNING: Fetching ALL topics can be very slow and resource-intensive
   * on categories with many topics. Consider alternatives:
   * - Using a Discourse API endpoint that provides aggregated counts directly (ideal).
   * - Implementing server-side aggregation via a plugin.
   * - Caching results client-side (e.g., sessionStorage).
   * - Limiting this feature (e.g., chart) to specific user groups.
   */
  const fetchAllTopicsInCategory = async (categoryId) => {
    console.debug(`Ideas Portal: Starting fetch for all topics in category ${categoryId}`);
    const pageSize = 100; // Discourse category JSON page size
    let page = 0;
    let allTopics = [];
    let done = false;
    const MAX_PAGES = 20; // Safety break to prevent infinite loops / excessive requests

    while (!done && page < MAX_PAGES) {
      try {
        const response = await fetch(`/c/${categoryId}.json?page=${page}`);
        if (!response.ok) {
          console.warn(`Ideas Portal: Fetch failed for category ${categoryId}, page ${page}. Status: ${response.status}`);
          break; // Stop fetching on error
        }
        const data = await response.json();
        const topics = data?.topic_list?.topics || [];
        allTopics = allTopics.concat(topics);

        if (topics.length < pageSize) {
          done = true; // Last page reached
        } else {
          page++;
        }
      } catch (e) {
          console.error(`Ideas Portal: Error fetching category topics (page ${page}):`, e);
          done = true; // Stop fetching on network/parse error
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
    console.debug(`Ideas Portal: Starting fetch for all topics with tag ${tagName}`);
    const pageSize = 30; // Discourse tag JSON page size
    let page = 0;
    let allTopics = [];
    let done = false;
    const MAX_PAGES = 30; // Safety break

    while (!done && page < MAX_PAGES) {
       try {
        const response = await fetch(`/tag/${tagName}.json?page=${page}`);
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
          done = true; // Stop fetching on network/parse error
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
    // Initialize all known statuses from TAG_MAP to 0
    Object.keys(TAG_MAP).forEach(tag => counts[tag] = 0);

    topics.forEach(topic => {
      const tags = topic.tags || [];
      tags.forEach(tag => {
        // Only increment if the tag is one of our known statuses
        if (TAG_MAP.hasOwnProperty(tag)) {
          counts[tag]++;
        }
      });
    });
    return counts;
  };

  // Function to load Chart.js dynamically if needed
  const loadChartJs = () => {
      return new Promise((resolve, reject) => {
          if (typeof Chart !== 'undefined') {
              return resolve(); // Already loaded
          }
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js'; // Use a specific version if possible
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
      });
  };


  const createStatusVisualization = async (statusCounts, container) => {
      if (!container) return;

      container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--primary-medium);">Loading visualization...</p>'; // Loading indicator
      container.style.display = 'block'; // Ensure container is visible

      try {
          await loadChartJs(); // Ensure Chart.js is loaded

          container.innerHTML = ''; // Clear loading message
          const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

          if (total === 0) {
              const noIdeasMessage = document.createElement('div');
              noIdeasMessage.className = 'no-ideas-message'; // Use class for styling
              noIdeasMessage.innerHTML = `
                  <p>It looks like there are no ideas with a status tag yet.</p>
                  <p>Ideas need a status tag (like 'new', 'planned', etc.) to appear here.</p>
              `;
              container.appendChild(noIdeasMessage);
              return;
          }

          // Create structure for the chart
          const header = document.createElement('div');
          header.className = 'ideas-visualization-header';
          // header.textContent = `${total} ${total === 1 ? 'Idea' : 'Ideas'} Status Overview`; // Title moved to chart options
          container.appendChild(header); // Add header if needed separately

          const chartContainer = document.createElement('div');
          chartContainer.style.height = '250px'; // Maintain desired height
          chartContainer.style.width = '100%';
          chartContainer.style.position = 'relative';
          container.appendChild(chartContainer);

          const canvas = document.createElement('canvas');
          canvas.id = `ideas-status-chart-${Date.now()}`; // Unique ID per instance
          canvas.style.height = '100%';
          canvas.style.width = '100%';
          chartContainer.appendChild(canvas);

          // Prepare data for Chart.js
          const labels = [], data = [], backgroundColors = [];
          const statusColors = { // Centralize colors
                'new': 'rgba(0, 123, 255, 1)',
                'planned': 'rgba(23, 162, 184, 1)',
                'in-progress': 'rgba(253, 126, 20, 1)',
                'already-exists': 'rgba(108, 117, 125, 1)',
                'under-review': 'rgba(32, 201, 151, 1)',
                'completed': 'rgba(40, 167, 69, 1)',
                'not-planned': 'rgba(220, 53, 69, 1)',
          };

          Object.keys(TAG_MAP).forEach(status => {
              labels.push(TAG_MAP[status]);
              data.push(statusCounts[status] || 0);
              backgroundColors.push(statusColors[status] || 'rgba(173, 181, 189, 1)'); // Fallback color
          });

          // Destroy previous chart instance if it exists
          if (currentChartInstance) {
              currentChartInstance.destroy();
              currentChartInstance = null;
          }

          // Create the chart
          createBarChart(canvas, labels, data, backgroundColors, total);

      } catch (error) {
          console.error("Ideas Portal: Failed to create status visualization:", error);
          container.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--primary-medium); font-style: italic;">
              Could not load ideas visualization. ${error.message || ''}
          </p>`; // Display error message
      }
  };


  const createBarChart = (canvas, labels, data, backgroundColors, total) => {
      const chartTitle = `${total} ${total === 1 ? 'Idea' : 'Ideas'} by Status`;
      const primaryColor = getComputedStyle(canvas).getPropertyValue("--primary").trim() || '#000000'; // Fallback color

      const ctx = canvas.getContext('2d');
      if (!ctx) {
          console.error("Ideas Portal: Could not get canvas context for chart.");
          return;
      }

      try {
          currentChartInstance = new Chart(ctx, {
              type: 'bar',
              data: {
                  labels,
                  datasets: [{
                      label: 'Idea Count', // Add a label for clarity
                      data,
                      backgroundColor: backgroundColors,
                      borderColor: backgroundColors.map(c => c.replace(/, *1\)/, ', 1)')), // Ensure alpha is 1 for border
                      borderWidth: 1,
                      borderRadius: 6,
                      borderSkipped: false,
                  }]
              },
              options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'x', // Ensure bars are vertical
                  plugins: {
                      legend: { display: false },
                      title: {
                          display: true,
                          text: chartTitle,
                          font: { size: 18, weight: 'bold' }, // Adjusted size
                          color: primaryColor,
                          padding: { top: 10, bottom: 20 } // Added top padding
                      },
                      tooltip: {
                          backgroundColor: 'rgba(0,0,0,0.8)',
                          titleFont: { size: 13 },
                          bodyFont: { size: 12 },
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
                      x: {
                          grid: { display: false },
                          ticks: { color: primaryColor, font: { size: 12 } } // Adjusted size
                      },
                      y: {
                          beginAtZero: true,
                          grid: { color: 'rgba(128, 128, 128, 0.2)' }, // Softer grid color
                          ticks: {
                              precision: 0, // Only whole numbers
                              color: primaryColor,
                              font: { size: 12 } // Adjusted size
                          }
                      }
                  },
                  animation: {
                      duration: 800, // Slightly faster animation
                      easing: 'easeOutQuart'
                  }
              }
          });
      } catch (e) {
          console.error("Ideas Portal: Error initializing Chart:", e);
          // Optionally update the container with an error message here too
          canvas.parentElement.innerHTML = `<p style="text-align: center; color: var(--danger);">Chart Error</p>`;
      }
  };

  // --- DOM Manipulation Functions ---

  /**
   * Updates navigation link text (e.g., "Top" to "Most Active").
   * WARNING: Relies on specific CSS classes and text content, which might change in Discourse.
   */
  const updateNavLinks = () => {
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
          // Check current text before changing to avoid repeated updates or changing unrelated links
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

  /**
   * Updates the main topic list header (e.g., "Topic" to "Ideas").
   * WARNING: Relies on specific CSS selectors, which might change.
   */
  const updateTopicListHeader = () => {
      try {
        const headerElement = document.querySelector('table.topic-list th.topic-list-data.default span');
        if (headerElement && headerElement.textContent?.trim() === "Topic") {
          headerElement.textContent = "Ideas";
        }
      } catch (e) {
          console.warn("Ideas Portal: Could not update topic list header text.", e);
      }
  };

  /**
   * Updates tag text content based on TAG_MAP.
   */
   const updateTagText = () => {
       document.querySelectorAll('[data-tag-name]').forEach(el => {
           const tag = el.getAttribute('data-tag-name');
           if (tag && TAG_MAP[tag] && el.textContent !== TAG_MAP[tag]) { // Avoid unnecessary updates
               el.textContent = TAG_MAP[tag];
           }
       });
   };

  /**
   * Reorders tags within each topic list row to prioritize status tags.
   * WARNING: Modifies DOM structure, might have minor performance impact on large lists.
   */
  const reorderTagsInTopicList = () => {
      const statusTagsOrder = Object.keys(TAG_MAP); // Get order from TAG_MAP keys

      document.querySelectorAll("tr.topic-list-item").forEach(row => {
          const tagContainer = row.querySelector(".discourse-tags");
          if (!tagContainer) return;

          const tagElements = Array.from(tagContainer.querySelectorAll("a.discourse-tag[data-tag-name]"));
          if (tagElements.length < 2) return; // No need to sort if 0 or 1 tag

          // Sort tags: status tags first (in defined order), then others alphabetically
          tagElements.sort((a, b) => {
              const tagA = a.dataset.tagName;
              const tagB = b.dataset.tagName;
              const indexA = statusTagsOrder.indexOf(tagA);
              const indexB = statusTagsOrder.indexOf(tagB);

              if (indexA !== -1 && indexB !== -1) return indexA - indexB; // Both are status tags, sort by predefined order
              if (indexA !== -1) return -1; // A is status, B is not -> A comes first
              if (indexB !== -1) return 1;  // B is status, A is not -> B comes first
              return tagA.localeCompare(tagB); // Neither are status tags, sort alphabetically
          });

          // Detach and re-append in sorted order
          tagElements.forEach(el => tagContainer.appendChild(el)); // Re-appending moves them to the end in the new order
      });
  };

  /**
   * Updates the category banner title if applicable.
   * WARNING: Relies on specific CSS class, might change.
   */
  const updateCategoryBannerTitle = (category) => {
      if (!category) return;
      try {
          const bannerTitle = document.querySelector(".custom-banner__title"); // Adjust selector if theme uses different banner class
          if (bannerTitle) {
              const originalTitle = bannerTitle.textContent.trim();
              const parentSlug = getParentCategorySlug(category); // Use helper
              let parentName = "";
              if (category.parent_category_id) {
                  const siteCategories = api.container.lookup("site:main").categories; // Use cached if available via helper
                  const parentCategory = siteCategories.find(cat => cat.id === category.parent_category_id);
                  if (parentCategory) parentName = parentCategory.name;
              }

              // Update only if parent name exists and title doesn't already seem correct
              if (parentName && !originalTitle.includes(category.name)) {
                  bannerTitle.textContent = `${parentName} › ${category.name}`; // Use separator
              } else if (!parentName && originalTitle !== category.name) {
                   bannerTitle.textContent = category.name; // Ensure simple category name is correct
              }
          }
      } catch (e) {
          console.warn("Ideas Portal: Could not update category banner title.", e);
      }
  };

  /**
   * Creates and injects the tag filter and status visualization elements.
   */
  const renderFiltersAndVisualization = async () => {
      // Remove existing elements first to prevent duplication
      const existingContainer = document.querySelector('.ideas-portal-controls');
      if (existingContainer) existingContainer.remove();

      const category = getCurrentEnabledCategoryInfo();
      const tagName = getCurrentEnabledTagName();

      // Create main container
      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'ideas-portal-controls'; // Use a more specific class name

      // Create elements
      const title = document.createElement('h3');
      title.className = 'ideas-filter-title';
      title.textContent = category ? `${category.name} Status & Filters` : `"${tagName}" Tag Status & Filters`;
      controlsContainer.appendChild(title);

      const statusVisualization = document.createElement('div');
      statusVisualization.className = 'ideas-status-visualization';
      controlsContainer.appendChild(statusVisualization); // Add vis container early

      const filtersWrapper = document.createElement('div');
      filtersWrapper.className = 'ideas-tag-filters'; // Keep this class for styling the inner filter area
      const filterButtonsWrapper = document.createElement('div');
      filterButtonsWrapper.className = 'filter-buttons'; // Wrapper for the buttons themselves

      let topics = [];
      let baseHref = '';
      let intersectionPrefix = '';

      // --- Configure based on category or tag page ---
      if (category) {
          baseHref = `/c/${getParentCategorySlug(category)}${category.slug}/${category.id}`;
          intersectionPrefix = `/tags/c/${getParentCategorySlug(category)}${category.slug}/${category.id}/`;
          try {
              topics = await fetchAllTopicsInCategory(category.id);
          } catch (e) {
              console.error("Ideas Portal: Failed to load topics for category chart:", e);
              statusVisualization.innerHTML = '<p style="text-align: center; color: var(--danger);">Error loading category topics.</p>';
          }
      } else if (tagName) {
          baseHref = `/tag/${tagName}`;
          intersectionPrefix = `/tags/intersection/${tagName}/`;
          try {
              topics = await fetchAllTopicsForTag(tagName);
          } catch (e) {
              console.error("Ideas Portal: Failed to load topics for tag chart:", e);
              statusVisualization.innerHTML = '<p style="text-align: center; color: var(--danger);">Error loading tag topics.</p>';
          }
      } else {
          return; // Should not happen if shouldEnable is true, but safety check
      }

      // --- Build Filters ---
      const resetFilter = document.createElement('a');
      resetFilter.href = baseHref;
      resetFilter.className = 'tag-filter tag-filter-reset';
      resetFilter.textContent = 'Show All';
      filterButtonsWrapper.appendChild(resetFilter);

      Object.keys(TAG_MAP).forEach(tag => {
          const filter = document.createElement('a');
          filter.href = `${intersectionPrefix}${tag}`;
          filter.className = 'tag-filter';
          filter.setAttribute('data-tag-name', tag); // Used for styling and potentially JS hooks
          filter.textContent = TAG_MAP[tag]; // Use mapped name
          filterButtonsWrapper.appendChild(filter);
      });

      filtersWrapper.appendChild(filterButtonsWrapper); // Add buttons to their wrapper
      controlsContainer.appendChild(filtersWrapper); // Add filters below visualization

      // --- Inject into DOM ---
      // Target element for insertion (adjust selector if needed)
      const target = document.querySelector('.navigation-container');
      if (target) {
          target.insertAdjacentElement('afterend', controlsContainer);
      } else {
          console.warn("Ideas Portal: Could not find .navigation-container to insert controls.");
          // Fallback: append to body or another known element?
          document.body.insertBefore(controlsContainer, document.body.firstChild);
      }

       // --- Create Visualization (after filters are added) ---
       const statusCounts = buildStatusCounts(topics);
       await createStatusVisualization(statusCounts, statusVisualization); // Pass the specific container

       // --- Final Text Updates After Injection ---
       updateTagText(); // Ensure newly added filter tags have correct text
  };


  // --- Main Execution Logic ---
  api.onPageChange(async (url, title) => {
    const shouldEnable = shouldEnableForCategoryOrTag(); // Use helper

    if (!shouldEnable) {
      document.body.classList.remove("ideas-portal-category");
      // Cleanup existing elements if navigating away
      const existingControls = document.querySelector('.ideas-portal-controls');
      if (existingControls) existingControls.remove();
      if (currentChartInstance) {
          currentChartInstance.destroy();
          currentChartInstance = null;
      }
      return;
    }

    // Add body class for general styling
    document.body.classList.add("ideas-portal-category");

    // Hide Categories link specifically on enabled tag pages
    const categoriesNavItem = document.querySelector('.nav-item_categories');
    if(categoriesNavItem) {
        categoriesNavItem.style.display = isEnabledTagPage() ? 'none' : ''; // Use helper
    }


    // Perform DOM updates - consider requestAnimationFrame if updates cause layout shifts
    // requestAnimationFrame(() => {
        updateNavLinks();
        updateTopicListHeader();
        reorderTagsInTopicList();
        updateTagText(); // Update existing tags on page
        updateCategoryBannerTitle(getCurrentEnabledCategoryInfo()); // Use helper
    // });

    // Render the filters and visualization section
    await renderFiltersAndVisualization();

  });

  // --- Cleanup ---
  api.cleanupStream(() => {
    console.debug("Ideas Portal: Cleaning up...");
    resetCache(); // Reset cached settings from helper
    document.body.classList.remove("ideas-portal-category");
    const existingControls = document.querySelector('.ideas-portal-controls');
    if (existingControls) existingControls.remove();
    if (currentChartInstance) {
      currentChartInstance.destroy();
      currentChartInstance = null;
    }
    // Restore original nav link text? (More complex, might not be needed)
  });
});