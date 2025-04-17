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
  resetCache
} from "../lib/ideas-portal-helper";

export default apiInitializer("0.11.4", (api) => { // Increment version again

  let currentChartInstance = null;

  // --- Fetching Functions (unchanged from previous correction) ---
  const fetchAllTopicsInCategory = async (categoryId) => { /* ... as before ... */
    if (!categoryId) { return []; }
    console.debug(`Ideas Portal: Starting fetch for all topics in category ${categoryId}`);
    const pageSize = 100; let page = 0; let allTopics = []; let done = false; const MAX_PAGES = 20;
    while (!done && page < MAX_PAGES) {
      try {
        const response = await fetch(`/c/<span class="math-inline">\{categoryId\}\.json?page\=</span>{page}`);
        if (!response.ok) { console.warn(`Ideas Portal: Fetch failed for category ${categoryId}, page ${page}. Status: ${response.status}`); break; }
        const data = await response.json(); const topics = data?.topic_list?.topics || []; allTopics = allTopics.concat(topics);
        if (topics.length < pageSize) { done = true; } else { page++; }
      } catch (e) { console.error(`Ideas Portal: Error fetching category topics (page ${page}):`, e); done = true; }
    }
    if (page === MAX_PAGES) { console.warn(`Ideas Portal: Reached MAX_PAGES limit (${MAX_PAGES}) fetching topics for category ${categoryId}. Data might be incomplete.`); }
    console.debug(`Ideas Portal: Fetched ${allTopics.length} topics for category ${categoryId} in ${page + 1} pages.`);
    return allTopics;
   };
  const fetchAllTopicsForTag = async (tagName) => { /* ... as before ... */
    if (!tagName) { return []; }
    console.debug(`Ideas Portal: Starting fetch for all topics with tag ${tagName}`);
    const pageSize = 30; let page = 0; let allTopics = []; let done = false; const MAX_PAGES = 30;
    while (!done && page < MAX_PAGES) {
       try {
        const response = await fetch(`/tag/<span class="math-inline">\{encodeURIComponent\(tagName\)\}\.json?page\=</span>{page}`);
        if (!response.ok) { console.warn(`Ideas Portal: Fetch failed for tag ${tagName}, page ${page}. Status: ${response.status}`); break; }
        const data = await response.json(); const topics = data?.topic_list?.topics || [];
        console.debug(`Ideas Portal: Fetched tag page ${page}, got ${topics.length} topics for tag ${tagName}`); allTopics = allTopics.concat(topics);
        if (topics.length < pageSize) { done = true; } else { page++; }
      } catch(e) { console.error(`Ideas Portal: Error fetching tag topics (page ${page}):`, e); done = true; }
    }
     if (page === MAX_PAGES) { console.warn(`Ideas Portal: Reached MAX_PAGES limit (${MAX_PAGES}) fetching topics for tag ${tagName}. Data might be incomplete.`); }
    console.debug(`Ideas Portal: Fetched ${allTopics.length} topics for tag ${tagName} in ${page + 1} pages.`);
    return allTopics;
  };

  // --- Charting Functions (unchanged from previous correction) ---
  const buildStatusCounts = (topics) => { /* ... as before ... */
    const counts = {}; Object.keys(TAG_MAP).forEach(tag => counts[tag] = 0);
    if (!Array.isArray(topics)) return counts;
    topics.forEach(topic => { const tags = topic?.tags;
      if (Array.isArray(tags)) { tags.forEach(tag => { if (TAG_MAP.hasOwnProperty(tag)) { counts[tag]++; } }); }
    }); return counts;
   };
  const loadChartJs = () => { /* ... as before ... */
      return new Promise((resolve, reject) => {
          if (typeof Chart !== 'undefined') { return resolve(Chart); } console.debug("Ideas Portal: Loading Chart.js library...");
          const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
          script.onload = () => { console.debug("Ideas Portal: Chart.js loaded successfully."); resolve(Chart); };
          script.onerror = (err) => { console.error("Ideas Portal: Failed to load Chart.js library.", err); reject(new Error("Chart.js library failed to load.")); };
          document.head.appendChild(script); });
   };
  const createStatusVisualization = async (statusCounts, container) => { /* ... as before ... */
      if (!container) { console.warn("Ideas Portal: Invalid container provided for status visualization."); return; }
      container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--primary-medium);">Loading visualization...</p>'; container.style.display = 'block';
      try {
          const Chart = await loadChartJs(); container.innerHTML = ''; const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
          if (total === 0) { const noIdeasMessage = document.createElement('div'); noIdeasMessage.className = 'no-ideas-message';
              noIdeasMessage.innerHTML = `<p>It looks like there are no ideas with a status tag yet.</p><p>Ideas need a status tag (like 'new', 'planned', etc.) to appear here.</p>`;
              container.appendChild(noIdeasMessage); return; }
          const chartContainer = document.createElement('div'); chartContainer.style.height = '250px'; chartContainer.style.width = '100%'; chartContainer.style.position = 'relative'; container.appendChild(chartContainer);
          const canvas = document.createElement('canvas'); const uniqueId = container.id || `ideas-chart-${Date.now()}`; canvas.id = `ideas-status-chart-${uniqueId}`; canvas.style.height = '100%'; canvas.style.width = '100%'; chartContainer.appendChild(canvas);
          const labels = [], data = [], backgroundColors = []; const statusColors = { 'new': 'rgba(0, 123, 255, 1)', 'planned': 'rgba(23, 162, 184, 1)', 'in-progress': 'rgba(253, 126, 20, 1)', 'already-exists': 'rgba(108, 117, 125, 1)', 'under-review': 'rgba(32, 201, 151, 1)', 'completed': 'rgba(40, 167, 69, 1)', 'not-planned': 'rgba(220, 53, 69, 1)', };
          Object.keys(TAG_MAP).forEach(status => { labels.push(TAG_MAP[status]); data.push(statusCounts[status] || 0); backgroundColors.push(statusColors[status] || 'rgba(173, 181, 189, 1)'); });
          if (currentChartInstance) { console.debug("Ideas Portal: Destroying previous chart instance."); currentChartInstance.destroy(); currentChartInstance = null; }
          createBarChart(Chart, canvas, labels, data, backgroundColors, total);
      } catch (error) { console.error("Ideas Portal: Failed to create status visualization:", error); container.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--primary-medium); font-style: italic;">Could not load ideas visualization. ${error.message || ''}</p>`; }
  };
  const createBarChart = (Chart, canvas, labels, data, backgroundColors, total) => { /* ... as before ... */
      if (typeof Chart === 'undefined' || !Chart) { console.error("Ideas Portal: Chart constructor is not available."); return; }
      const chartTitle = `${total} ${total === 1 ? 'Idea' : 'Ideas'} by Status`; const primaryColor = getComputedStyle(canvas).getPropertyValue("--primary").trim() || '#333333'; const ctx = canvas.getContext('2d');
      if (!ctx) { console.error("Ideas Portal: Could not get canvas context for chart."); return; }
      try { console.debug("Ideas Portal: Creating new Chart instance.");
          currentChartInstance = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Idea Count', data, backgroundColor: backgroundColors, borderColor: backgroundColors.map(c => c.replace(/, *1\)/, ', 1)')), borderWidth: 1, borderRadius: 6, borderSkipped: false, }] },
              options: { responsive: true, maintainAspectRatio: false, indexAxis: 'x', plugins: { legend: { display: false }, title: { display: true, text: chartTitle, font: { size: 18, weight: 'bold' }, color: primaryColor, padding: { top: 10, bottom: 20 } }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleFont: { size: 13 }, bodyFont: { size: 12 }, callbacks: { label: (context) => { const count = context.raw || 0; const totalIdeas = data.reduce((a, b) => a + b, 0); const percent = totalIdeas > 0 ? Math.round((count / totalIdeas) * 100) : 0; return `${count} <span class="math-inline">\{count \=\=\= 1 ? 'idea' \: 'ideas'\} \(</span>{percent}%)`; } } } }, scales: { x: { grid: { display: false }, ticks: { color: primaryColor, font: { size: 12 } } }, y: { beginAtZero: true, grid: { color: 'rgba(128, 128, 128, 0.2)' }, ticks: { precision: 0, color: primaryColor, font: { size: 12 } } } }, animation: { duration: 800, easing: 'easeOutQuart' } } });
      } catch (e) { console.error("Ideas Portal: Error initializing Chart:", e); if (canvas.parentElement) { canvas.parentElement.innerHTML = `<p style="text-align: center; color: var(--danger);">Chart Error</p>`; } }
  };

  // --- DOM Manipulation Functions ---
  const updateNavLinks = () => { /* ... as before ... */ };
  const updateTopicListHeader = () => { /* ... as before ... */ };
  const updateTagText = () => { /* ... as before ... */ };
  const updateCategoryBannerTitle = (category, container) => { /* ... as before, passing container ... */ };

  /**
   * Reorders tags within each topic list row to prioritize status tags.
   * Corrected logic for clearing and re-appending with spacing.
   */
  const reorderTagsInTopicList = () => {
      const statusTagsOrder = Object.keys(TAG_MAP);

      document.querySelectorAll("tr.topic-list-item").forEach(row => {
          const tagContainer = row.querySelector(".discourse-tags");
          if (!tagContainer) return;

          // Select only direct children that are tag links
          const tagElements = Array.from(tagContainer.querySelectorAll(":scope > a.discourse-tag[data-tag-name]"));
          if (tagElements.length < 2) return; // No need to sort

          // Sort tags
          tagElements.sort((a, b) => {
              const tagA = a.dataset.tagName; const tagB = b.dataset.tagName;
              const indexA = statusTagsOrder.indexOf(tagA); const indexB = statusTagsOrder.indexOf(tagB);
              if (indexA !== -1 && indexB !== -1) return indexA - indexB;
              if (indexA !== -1) return -1; if (indexB !== -1) return 1;
              return tagA.localeCompare(tagB);
          });

          // --- Corrected Clearing and Re-appending ---
          // 1. Store the sorted elements temporarily
          const sortedTags = [...tagElements];

          // 2. Remove only the original tag elements from the container
          tagElements.forEach(el => tagContainer.removeChild(el));

          // 3. Append sorted tags back with spacing (a single space TextNode)
          sortedTags.forEach((el, index) => {
              tagContainer.appendChild(el);
              // Add a space after each tag except the last one
              if (index < sortedTags.length - 1) {
                  tagContainer.appendChild(document.createTextNode(' '));
              }
          });
          // --- End Correction ---
      });
  };


  // Updated to accept container & *REMOVED* the unwanted title element
  const renderFiltersAndVisualization = async (container) => {
      if (!container || typeof container.lookup !== 'function') { /* ... error handling ... */ return; }
      console.debug("Ideas Portal: Rendering filters and visualization.");

      const existingContainer = document.querySelector('.ideas-portal-controls');
      if (existingContainer) { /* ... remove existing ... */ }

      const category = getCurrentEnabledCategoryInfo(container);
      const tagName = getCurrentEnabledTagName(container);
      if (!category && !tagName) { /* ... safety exit ... */ return; }

      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'ideas-portal-controls';

      // --- TITLE ELEMENT REMOVED ---
      // const title = document.createElement('h3'); ... title.textContent = ...; controlsContainer.appendChild(title);

      const statusVisualization = document.createElement('div');
      statusVisualization.className = 'ideas-status-visualization';
      controlsContainer.appendChild(statusVisualization); // Add vis container early

      const filtersWrapper = document.createElement('div');
      filtersWrapper.className = 'ideas-tag-filters';
      const filterButtonsWrapper = document.createElement('div');
      filterButtonsWrapper.className = 'filter-buttons';

      let topics = [];
      let baseHref = '';
      let intersectionPrefix = '';

      if (category) { /* ... get category paths and fetch topics ... */
           const parentSlug = getParentCategorySlug(container, category); baseHref = `/c/<span class="math-inline">\{parentSlug\}</span>{category.slug || category.id}/${category.id}`; intersectionPrefix = `/tags/c/<span class="math-inline">\{parentSlug\}</span>{category.slug || category.id}/${category.id}/`;
           try { topics = await fetchAllTopicsInCategory(category.id); } catch (e) { /* Handled in fetch */ }
      } else if (tagName) { /* ... get tag paths and fetch topics ... */
           const encodedTag = encodeURIComponent(tagName); baseHref = `/tag/${encodedTag}`; intersectionPrefix = `/tags/intersection/${encodedTag}/`;
           try { topics = await fetchAllTopicsForTag(tagName); } catch (e) { /* Handled in fetch */ }
      }

      // Build Filters
      const resetFilter = document.createElement('a'); /* ... create reset filter ... */
      resetFilter.href = baseHref; resetFilter.className = 'tag-filter tag-filter-reset'; resetFilter.textContent = 'Show All'; filterButtonsWrapper.appendChild(resetFilter);

      Object.keys(TAG_MAP).forEach(tag => { /* ... create status filters ... */
          const filter = document.createElement('a'); filter.href = `<span class="math-inline">\{intersectionPrefix\}</span>{encodeURIComponent(tag)}`; filter.className = 'tag-filter'; filter.setAttribute('data-tag-name', tag); filter.textContent = TAG_MAP[tag]; filterButtonsWrapper.appendChild(filter);
      });

      filtersWrapper.appendChild(filterButtonsWrapper);
      controlsContainer.appendChild(filtersWrapper); // Add filters below visualization

      // Inject into DOM
      const target = document.querySelector('.navigation-container');
      if (target) { target.insertAdjacentElement('afterend', controlsContainer); /* ... debug log ... */ }
      else { /* ... fallback injection ... */ }

       // Create Visualization
       const statusCounts = buildStatusCounts(topics);
       await createStatusVisualization(statusCounts, statusVisualization);

       // Final Text Updates After Injection
       updateTagText();
  };


  // --- Main Execution Logic ---
  api.onPageChange(async (url, title) => {
    /* ... logging ... */
    // Pass api.container to the activation check
    const shouldEnable = shouldEnableForCategoryOrTag(api.container);
    /* ... logging ... */

    const bodyClass = "ideas-portal-category";
    const controlsSelector = '.ideas-portal-controls';

    if (!shouldEnable) { /* ... cleanup logic as before ... */
        if (document.body.classList.contains(bodyClass)) {
            console.debug("Ideas Portal: Cleaning up - removing body class and controls."); document.body.classList.remove(bodyClass);
            const existingControls = document.querySelector(controlsSelector); if (existingControls) existingControls.remove();
            if (currentChartInstance) { currentChartInstance.destroy(); currentChartInstance = null; }
        } return;
    }

    // Add body class if not already present
    if (!document.body.classList.contains(bodyClass)) { document.body.classList.add(bodyClass); }

    // Hide Categories link on enabled tag pages
    try { /* ... logic as before, passing api.container ... */
        const categoriesNavItem = document.querySelector('.nav-item_categories');
        if (categoriesNavItem) { categoriesNavItem.style.display = isEnabledTagPage(api.container) ? 'none' : ''; }
    } catch (e) { console.warn("Ideas Portal: Error hiding categories nav item.", e); }

    // Perform DOM updates safely
    try {
        requestAnimationFrame(() => { /* ... calls as before, passing api.container where needed ... */
            updateNavLinks(); updateTopicListHeader(); reorderTagsInTopicList(); updateTagText();
            updateCategoryBannerTitle(getCurrentEnabledCategoryInfo(api.container), api.container);
        });
    } catch(e) { console.error("Ideas Portal: Error during scheduled DOM updates.", e); }

    // Render the filters and visualization section, passing container
    try { await renderFiltersAndVisualization(api.container); }
    catch (e) { console.error("Ideas Portal: Error rendering filters and visualization.", e); }