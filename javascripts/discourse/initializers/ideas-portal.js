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

// Use a slightly newer version number for this revision
export default apiInitializer("0.11.7-debug", (api) => { // Added -debug to version

  let currentChartInstance = null;

  // --- Fetching Functions (Unchanged) ---
  const fetchAllTopicsInCategory = async (categoryId) => { if (!categoryId) { return []; } console.debug(`[Ideas Portal Debug] Fetching topics for category ${categoryId}`); const pageSize = 100; let page = 0; let allTopics = []; let done = false; const MAX_PAGES = 20; while (!done && page < MAX_PAGES) { try { const response = await fetch(`/c/${categoryId}.json?page=${page}`); if (!response.ok) { console.warn(`Ideas Portal: Fetch failed for category ${categoryId}, page ${page}. Status: ${response.status}`); break; } const data = await response.json(); const topics = data?.topic_list?.topics || []; allTopics = allTopics.concat(topics); if (topics.length < pageSize) { done = true; } else { page++; } } catch (e) { console.error(`Ideas Portal: Error fetching category topics (page ${page}):`, e); done = true; } } if (page === MAX_PAGES) { console.warn(`Ideas Portal: Reached MAX_PAGES limit (${MAX_PAGES}) fetching topics for category ${categoryId}. Data might be incomplete.`); } console.debug(`[Ideas Portal Debug] Fetched ${allTopics.length} topics for category ${categoryId}.`); return allTopics; };
  const fetchAllTopicsForTag = async (tagName) => { if (!tagName) { return []; } console.debug(`[Ideas Portal Debug] Fetching topics for tag ${tagName}`); const pageSize = 30; let page = 0; let allTopics = []; let done = false; const MAX_PAGES = 30; while (!done && page < MAX_PAGES) { try { const response = await fetch(`/tag/${encodeURIComponent(tagName)}.json?page=${page}`); if (!response.ok) { console.warn(`Ideas Portal: Fetch failed for tag ${tagName}, page ${page}. Status: ${response.status}`); break; } const data = await response.json(); const topics = data?.topic_list?.topics || []; allTopics = allTopics.concat(topics); if (topics.length < pageSize) { done = true; } else { page++; } } catch(e) { console.error(`Ideas Portal: Error fetching tag topics (page ${page}):`, e); done = true; } } if (page === MAX_PAGES) { console.warn(`Ideas Portal: Reached MAX_PAGES limit (${MAX_PAGES}) fetching topics for tag ${tagName}. Data might be incomplete.`); } console.debug(`[Ideas Portal Debug] Fetched ${allTopics.length} topics for tag ${tagName}.`); return allTopics; };

  // --- Charting Functions (Unchanged) ---
  const buildStatusCounts = (topics) => { const counts = {}; Object.keys(TAG_MAP).forEach(tag => counts[tag] = 0); if (!Array.isArray(topics)) return counts; topics.forEach(topic => { const tags = topic?.tags; if (Array.isArray(tags)) { tags.forEach(tag => { if (TAG_MAP.hasOwnProperty(tag)) { counts[tag]++; } }); } }); return counts; };
  const loadChartJs = () => { return new Promise((resolve, reject) => { if (typeof Chart !== 'undefined') { return resolve(Chart); } console.debug("[Ideas Portal Debug] Loading Chart.js..."); const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js'; script.onload = () => { console.debug("[Ideas Portal Debug] Chart.js loaded."); resolve(Chart); }; script.onerror = (err) => { console.error("Ideas Portal: Failed to load Chart.js.", err); reject(new Error("Chart.js failed to load.")); }; document.head.appendChild(script); }); };
  const createStatusVisualization = async (statusCounts, container) => { if (!container) { return; } container.innerHTML = '<p>Loading visualization...</p>'; container.style.display = 'block'; try { const Chart = await loadChartJs(); container.innerHTML = ''; const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0); if (total === 0) { const noIdeasMessage = document.createElement('div'); noIdeasMessage.className = 'no-ideas-message'; noIdeasMessage.innerHTML = `<p>No ideas with status tags found.</p>`; container.appendChild(noIdeasMessage); return; } const chartContainer = document.createElement('div'); chartContainer.style.height = '250px'; chartContainer.style.width = '100%'; chartContainer.style.position = 'relative'; container.appendChild(chartContainer); const canvas = document.createElement('canvas'); const uniqueId = container.id || `ideas-chart-${Date.now()}`; canvas.id = `ideas-status-chart-${uniqueId}`; canvas.style.height = '100%'; canvas.style.width = '100%'; chartContainer.appendChild(canvas); const labels = [], data = [], backgroundColors = []; const statusColors = { 'new': 'rgba(0, 123, 255, 1)', 'planned': 'rgba(23, 162, 184, 1)', 'in-progress': 'rgba(253, 126, 20, 1)', 'already-exists': 'rgba(108, 117, 125, 1)', 'under-review': 'rgba(32, 201, 151, 1)', 'completed': 'rgba(40, 167, 69, 1)', 'not-planned': 'rgba(220, 53, 69, 1)', }; Object.keys(TAG_MAP).forEach(status => { labels.push(TAG_MAP[status]); data.push(statusCounts[status] || 0); backgroundColors.push(statusColors[status] || 'rgba(173, 181, 189, 1)'); }); if (currentChartInstance) { console.debug("[Ideas Portal Debug] Destroying previous chart."); currentChartInstance.destroy(); currentChartInstance = null; } createBarChart(Chart, canvas, labels, data, backgroundColors, total); } catch (error) { console.error("Ideas Portal: Failed to create status visualization:", error); container.innerHTML = `<p>Could not load visualization.</p>`; } };
  const createBarChart = (Chart, canvas, labels, data, backgroundColors, total) => { if (typeof Chart === 'undefined' || !Chart) { return; } const chartTitle = `${total} ${total === 1 ? 'Idea' : 'Ideas'} by Status`; const primaryColor = getComputedStyle(canvas).getPropertyValue("--primary").trim() || '#333333'; const ctx = canvas.getContext('2d'); if (!ctx) { return; } try { console.debug("[Ideas Portal Debug] Creating new chart instance."); currentChartInstance = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Idea Count', data, backgroundColor: backgroundColors, borderColor: backgroundColors.map(c => c.replace(/, *1\)/, ', 1)')), borderWidth: 1, borderRadius: 6, borderSkipped: false, }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'x', plugins: { legend: { display: false }, title: { display: true, text: chartTitle, font: { size: 18, weight: 'bold' }, color: primaryColor, padding: { top: 10, bottom: 20 } }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleFont: { size: 13 }, bodyFont: { size: 12 }, callbacks: { label: (context) => { const count = context.raw || 0; const totalIdeas = data.reduce((a, b) => a + b, 0); const percent = totalIdeas > 0 ? Math.round((count / totalIdeas) * 100) : 0; return `${count} ${count === 1 ? 'idea' : 'ideas'} (${percent}%)`; } } } }, scales: { x: { grid: { display: false }, ticks: { color: primaryColor, font: { size: 12 } } }, y: { beginAtZero: true, grid: { color: 'rgba(128, 128, 128, 0.2)' }, ticks: { precision: 0, color: primaryColor, font: { size: 12 } } } }, animation: { duration: 800, easing: 'easeOutQuart' } } }); } catch (e) { console.error("Ideas Portal: Error initializing Chart:", e); if (canvas.parentElement) { canvas.parentElement.innerHTML = `<p>Chart Error</p>`; } } };

  // --- DOM Manipulation Functions ---
  const updateNavLinks = () => { console.debug("[Ideas Portal Debug] Attempting to update nav links."); /* ... */ };
  const updateTopicListHeader = () => {
      console.debug("[Ideas Portal Debug] Attempting to update topic list header.");
      try {
        const headerElement = document.querySelector('table.topic-list th.topic-list-data.default span');
        if (headerElement) {
            console.debug("[Ideas Portal Debug] Found header element:", headerElement);
            if (headerElement.textContent?.trim() === "Topic") {
                headerElement.textContent = "Ideas";
                console.debug("[Ideas Portal Debug] Header text updated to 'Ideas'.");
            } else {
                 console.debug("[Ideas Portal Debug] Header text is not 'Topic', no update needed.");
            }
        } else {
             console.debug("[Ideas Portal Debug] Topic list header element not found.");
        }
      } catch (e) { console.warn("Ideas Portal: Could not update topic list header text.", e); }
  };
  const updateTagText = () => { console.debug("[Ideas Portal Debug] Updating tag text."); /* ... */ };
  const updateCategoryBannerTitle = (category, container) => { console.debug("[Ideas Portal Debug] Attempting to update category banner."); /* ... */ };
  const reorderTagsInTopicList = () => { console.debug("[Ideas Portal Debug] Attempting to reorder tags."); /* ... */ }; // Assuming this part works based on last feedback

  /**
   * Creates and injects the filters and status visualization elements.
   */
  const renderFiltersAndVisualization = async (container) => {
      if (!container || typeof container.lookup !== 'function') { return; }
      console.debug("[Ideas Portal Debug] Starting: renderFiltersAndVisualization"); // Log start

      const existingContainer = document.querySelector('.ideas-portal-controls');
      if (existingContainer) { existingContainer.remove(); }

      const category = getCurrentEnabledCategoryInfo(container);
      const tagName = getCurrentEnabledTagName(container);
      if (!category && !tagName) { console.debug("[Ideas Portal Debug] Neither category nor tag page detected in render function."); return; }

      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'ideas-portal-controls';

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

      console.debug("[Ideas Portal Debug] Fetching topics for chart...");
      if (category) {
           const parentSlug = getParentCategorySlug(container, category); baseHref = `/c/${parentSlug}${category.slug || category.id}/${category.id}`; intersectionPrefix = `/tags/c/${parentSlug}${category.slug || category.id}/${category.id}/`;
           try { topics = await fetchAllTopicsInCategory(category.id); } catch (e) { /* Handled */ }
      } else if (tagName) {
           const encodedTag = encodeURIComponent(tagName); baseHref = `/tag/${encodedTag}`; intersectionPrefix = `/tags/intersection/${encodedTag}/`;
           try { topics = await fetchAllTopicsForTag(tagName); } catch (e) { /* Handled */ }
      }
      console.debug(`[Ideas Portal Debug] Fetched ${topics.length} topics.`);

      // Build Filters
      const resetFilter = document.createElement('a'); resetFilter.href = baseHref; resetFilter.className = 'tag-filter tag-filter-reset'; resetFilter.textContent = 'Show All'; filterButtonsWrapper.appendChild(resetFilter);
      Object.keys(TAG_MAP).forEach(tag => { const filter = document.createElement('a'); filter.href = `${intersectionPrefix}${encodeURIComponent(tag)}`; filter.className = 'tag-filter'; filter.setAttribute('data-tag-name', tag); filter.textContent = TAG_MAP[tag]; filterButtonsWrapper.appendChild(filter); });

      filtersWrapper.appendChild(filterButtonsWrapper);
      controlsContainer.appendChild(filtersWrapper);

      // Inject into DOM
      const target = document.querySelector('.navigation-container');
      if (target) {
          target.insertAdjacentElement('afterend', controlsContainer);
          console.debug("[Ideas Portal Debug] Controls container injected after .navigation-container.");
      } else {
          console.warn("[Ideas Portal Debug] .navigation-container not found. Cannot inject controls.");
          // If the target isn't found, the rest of the visualization won't happen visually.
          return; // Stop if we can't inject
      }

       // Create Visualization
       console.debug("[Ideas Portal Debug] Building status counts...");
       const statusCounts = buildStatusCounts(topics);
       console.debug("[Ideas Portal Debug] Status counts:", statusCounts);
       console.debug("[Ideas Portal Debug] Creating visualization...");
       await createStatusVisualization(statusCounts, statusVisualization);

       // Final Text Updates After Injection
       updateTagText();
       console.debug("[Ideas Portal Debug] Finished: renderFiltersAndVisualization"); // Log end
  };


  // --- Main Execution Logic ---
  api.onPageChange(async (url, title) => {
    console.debug(`[Ideas Portal Debug] ----- onPageChange Start: ${url} -----`); // Log Page Change Start

    // Pass api.container to the activation check
    const shouldEnable = shouldEnableForCategoryOrTag(api.container);
    // Log detailed activation status
    const currentCat = getCurrentEnabledCategoryInfo(api.container);
    const currentTag = getCurrentEnabledTagName(api.container);
    console.debug(`[Ideas Portal Debug] Activation Check: shouldEnable=${shouldEnable} (Category=${currentCat?.slug || 'None'}, Tag=${currentTag || 'None'})`);

    const bodyClass = "ideas-portal-category";
    const controlsSelector = '.ideas-portal-controls';

    if (!shouldEnable) {
        if (document.body.classList.contains(bodyClass)) {
            console.debug("[Ideas Portal Debug] Not enabled on this page. Cleaning up.");
            document.body.classList.remove(bodyClass);
            const existingControls = document.querySelector(controlsSelector); if (existingControls) existingControls.remove();
            if (currentChartInstance) { currentChartInstance.destroy(); currentChartInstance = null; }
        }
        console.debug(`[Ideas Portal Debug] ----- onPageChange End (Not Enabled) -----`);
        return; // Exit early if not enabled
    }

    // Add body class
    if (!document.body.classList.contains(bodyClass)) {
        console.debug("[Ideas Portal Debug] Adding body class:", bodyClass);
        document.body.classList.add(bodyClass);
    } else {
         console.debug("[Ideas Portal Debug] Body class already present.");
    }

    // Hide Categories link
    try {
        const categoriesNavItem = document.querySelector('.nav-item_categories');
        if (categoriesNavItem) {
            const hideNav = isEnabledTagPage(api.container);
             console.debug(`[Ideas Portal Debug] Hide categories nav item? ${hideNav}`);
            categoriesNavItem.style.display = hideNav ? 'none' : '';
        }
    } catch (e) { console.warn("Ideas Portal: Error hiding categories nav item.", e); }

    // Perform DOM updates safely
    try {
        requestAnimationFrame(() => {
            console.debug("[Ideas Portal Debug] Running DOM updates in requestAnimationFrame.");
            updateNavLinks();
            updateTopicListHeader(); // Log inside this function now
            reorderTagsInTopicList();
            updateTagText();
            updateCategoryBannerTitle(getCurrentEnabledCategoryInfo(api.container), api.container);
            console.debug("[Ideas Portal Debug] DOM updates in requestAnimationFrame finished.");
        });
    } catch(e) { console.error("Ideas Portal: Error queueing DOM updates.", e); }

    // Render the filters and visualization section, passing container
    console.debug("[Ideas Portal Debug] Attempting to render filters and visualization...");
    try {
        await renderFiltersAndVisualization(api.container);
        console.debug("[Ideas Portal Debug] renderFiltersAndVisualization call finished.");
    } catch (e) {
        console.error("Ideas Portal: Error calling renderFiltersAndVisualization.", e);
        const existingControls = document.querySelector(controlsSelector);
        if (existingControls) { existingControls.innerHTML = '<p>Error loading controls.</p>'; }
    }

    console.debug(`[Ideas Portal Debug] ----- onPageChange End (Enabled) -----`); // Log Page Change End
  });

  // --- Cleanup ---
  api.cleanupStream(() => {
    console.debug("[Ideas Portal Debug] Cleanup stream called."); resetCache(); document.body.classList.remove("ideas-portal-category");
    const existingControls = document.querySelector('.ideas-portal-controls'); if (existingControls) existingControls.remove();
    if (currentChartInstance) { currentChartInstance.destroy(); currentChartInstance = null; }
  });

}); // End apiInitializer

// --- Full function bodies for unchanged functions ---
const fetchAllTopicsInCategory = async (categoryId) => { if (!categoryId) { return []; } console.debug(`[Ideas Portal Debug] Fetching topics for category ${categoryId}`); const pageSize = 100; let page = 0; let allTopics = []; let done = false; const MAX_PAGES = 20; while (!done && page < MAX_PAGES) { try { const response = await fetch(`/c/${categoryId}.json?page=${page}`); if (!response.ok) { console.warn(`Ideas Portal: Fetch failed for category ${categoryId}, page ${page}. Status: ${response.status}`); break; } const data = await response.json(); const topics = data?.topic_list?.topics || []; allTopics = allTopics.concat(topics); if (topics.length < pageSize) { done = true; } else { page++; } } catch (e) { console.error(`Ideas Portal: Error fetching category topics (page ${page}):`, e); done = true; } } if (page === MAX_PAGES) { console.warn(`Ideas Portal: Reached MAX_PAGES limit (${MAX_PAGES}) fetching topics for category ${categoryId}. Data might be incomplete.`); } console.debug(`[Ideas Portal Debug] Fetched ${allTopics.length} topics for category ${categoryId}.`); return allTopics; };
const fetchAllTopicsForTag = async (tagName) => { if (!tagName) { return []; } console.debug(`[Ideas Portal Debug] Fetching topics for tag ${tagName}`); const pageSize = 30; let page = 0; let allTopics = []; let done = false; const MAX_PAGES = 30; while (!done && page < MAX_PAGES) { try { const response = await fetch(`/tag/${encodeURIComponent(tagName)}.json?page=${page}`); if (!response.ok) { console.warn(`Ideas Portal: Fetch failed for tag ${tagName}, page ${page}. Status: ${response.status}`); break; } const data = await response.json(); const topics = data?.topic_list?.topics || []; allTopics = allTopics.concat(topics); if (topics.length < pageSize) { done = true; } else { page++; } } catch(e) { console.error(`Ideas Portal: Error fetching tag topics (page ${page}):`, e); done = true; } } if (page === MAX_PAGES) { console.warn(`Ideas Portal: Reached MAX_PAGES limit (${MAX_PAGES}) fetching topics for tag ${tagName}. Data might be incomplete.`); } console.debug(`[Ideas Portal Debug] Fetched ${allTopics.length} topics for tag ${tagName}.`); return allTopics; };
const buildStatusCounts = (topics) => { const counts = {}; Object.keys(TAG_MAP).forEach(tag => counts[tag] = 0); if (!Array.isArray(topics)) return counts; topics.forEach(topic => { const tags = topic?.tags; if (Array.isArray(tags)) { tags.forEach(tag => { if (TAG_MAP.hasOwnProperty(tag)) { counts[tag]++; } }); } }); return counts; };
// loadChartJs, createStatusVisualization, createBarChart are above with logs
const updateNavLinks = () => { console.debug("[Ideas Portal Debug] Attempting to update nav links."); const navLinksToUpdate = [ { className: "top", newText: "Most Active" }, { className: "votes", newText: "Most Voted" }, { className: "latest", newText: "Recently Active" }, ]; navLinksToUpdate.forEach(({ className, newText }) => { try { const listItem = document.querySelector(`.nav.nav-pills .nav-item.${className}`); if (listItem) { const link = listItem.querySelector("a"); const currentText = link?.textContent?.trim(); const expectedOldText = className.charAt(0).toUpperCase() + className.slice(1); if (link && currentText === expectedOldText) { link.textContent = newText; console.debug(`[Ideas Portal Debug] Updated nav link "${expectedOldText}" to "${newText}".`); } } } catch(e) { console.warn(`Ideas Portal: Could not update nav link for class "${className}".`, e); } }); };
// updateTopicListHeader is above with logs
const updateTagText = () => { console.debug("[Ideas Portal Debug] Updating tag text."); document.querySelectorAll('[data-tag-name]').forEach(el => { const tag = el.getAttribute('data-tag-name'); if (tag && TAG_MAP[tag] && el.textContent !== TAG_MAP[tag]) { el.textContent = TAG_MAP[tag]; } }); };
const updateCategoryBannerTitle = (category, container) => { console.debug("[Ideas Portal Debug] Attempting to update category banner."); if (!category || !container || typeof container.lookup !== 'function') return; try { const bannerTitle = document.querySelector(".custom-banner__title"); if (bannerTitle) { const originalTitle = bannerTitle.textContent.trim(); const parentSlug = getParentCategorySlug(container, category); let parentName = ""; if (category.parent_category_id) { const site = container.lookup("site:main"); const parentCategory = site?.categories?.find(cat => cat.id === category.parent_category_id); if (parentCategory?.name) parentName = parentCategory.name; } const expectedTitle = parentName ? `${parentName} › ${category.name}` : category.name; if (category.name && originalTitle !== expectedTitle) { bannerTitle.textContent = expectedTitle; console.debug(`[Ideas Portal Debug] Updated banner title to "${expectedTitle}".`); } } } catch (e) { console.warn("Ideas Portal: Could not update category banner title.", e); } };
const reorderTagsInTopicList = () => { const statusTagsOrder = Object.keys(TAG_MAP); console.debug("[Ideas Portal Debug] Attempting to reorder tags."); document.querySelectorAll("tr.topic-list-item").forEach((row, rowIndex) => { const tagContainer = row.querySelector(".discourse-tags"); if (!tagContainer) return; const originalTagElements = Array.from(tagContainer.querySelectorAll(":scope > a.discourse-tag[data-tag-name]")); if (originalTagElements.length < 2) return; const sortedTagElements = [...originalTagElements].sort((a, b) => { const tagA = a.dataset.tagName; const tagB = b.dataset.tagName; const indexA = statusTagsOrder.indexOf(tagA); const indexB = statusTagsOrder.indexOf(tagB); if (indexA !== -1 && indexB !== -1) return indexA - indexB; if (indexA !== -1) return -1; if (indexB !== -1) return 1; return tagA.localeCompare(tagB); }); tagContainer.innerHTML = ''; sortedTagElements.forEach((el, index) => { tagContainer.appendChild(el); if (index < sortedTagElements.length - 1) { tagContainer.appendChild(document.createTextNode(' ')); } }); }); console.debug("[Ideas Portal Debug] Finished tag reorder attempt."); };
// --- End full function bodies ---