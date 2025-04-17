// javascripts/discourse/initializers/ideas-portal.js
import { apiInitializer } from "discourse/lib/api";
// Ensure helper path is correct
import {
  shouldEnableForCategoryOrTag,
  getCurrentEnabledCategoryInfo,
  getCurrentEnabledTagName,
  getParentCategorySlug,
  isEnabledTagPage,
  TAG_MAP,
  resetCache
} from "../lib/ideas-portal-helper";

export default apiInitializer("0.12.0", (api) => { // Final version number

  let currentChartInstance = null;

  // --- Fetching Functions ---
  const fetchAllTopicsInCategory = async (categoryId) => { if (!categoryId) { return []; } const pageSize = 100; let page = 0; let allTopics = []; let done = false; const MAX_PAGES = 20; while (!done && page < MAX_PAGES) { try { const response = await fetch(`/c/${categoryId}.json?page=${page}`); if (!response.ok) { break; } const data = await response.json(); const topics = data?.topic_list?.topics || []; allTopics = allTopics.concat(topics); if (topics.length < pageSize) { done = true; } else { page++; } } catch (e) { console.error(`Ideas Portal: Error fetching cat topics (page ${page}):`, e); done = true; } } return allTopics; };
  const fetchAllTopicsForTag = async (tagName) => { if (!tagName) { return []; } const pageSize = 30; let page = 0; let allTopics = []; let done = false; const MAX_PAGES = 30; while (!done && page < MAX_PAGES) { try { const response = await fetch(`/tag/${encodeURIComponent(tagName)}.json?page=${page}`); if (!response.ok) { break; } const data = await response.json(); const topics = data?.topic_list?.topics || []; allTopics = allTopics.concat(topics); if (topics.length < pageSize) { done = true; } else { page++; } } catch(e) { console.error(`Ideas Portal: Error fetching tag topics (page ${page}):`, e); done = true; } } return allTopics; };

  // --- Charting Functions ---
  const buildStatusCounts = (topics) => { const counts = {}; Object.keys(TAG_MAP).forEach(tag => counts[tag] = 0); if (!Array.isArray(topics)) return counts; topics.forEach(topic => { const tags = topic?.tags; if (Array.isArray(tags)) { tags.forEach(tag => { if (TAG_MAP.hasOwnProperty(tag)) { counts[tag]++; } }); } }); return counts; };
  const loadChartJs = () => { return new Promise((resolve, reject) => { if (typeof Chart !== 'undefined') { return resolve(Chart); } const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js'; script.onload = () => { resolve(Chart); }; script.onerror = (err) => { reject(new Error("Chart.js failed to load.")); }; document.head.appendChild(script); }); };
  const createStatusVisualization = async (statusCounts, container) => { if (!container) { return; } container.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--primary-medium);">Loading visualization...</p>'; container.style.display = 'block'; try { const Chart = await loadChartJs(); container.innerHTML = ''; const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0); if (total === 0) { const noIdeasMessage = document.createElement('div'); noIdeasMessage.className = 'no-ideas-message'; noIdeasMessage.innerHTML = `<p>It looks like there are no ideas with a status tag yet.</p><p>Ideas need a status tag (like 'new', 'planned', etc.) to appear here.</p>`; container.appendChild(noIdeasMessage); return; } const chartContainer = document.createElement('div'); chartContainer.style.height = '250px'; chartContainer.style.width = '100%'; chartContainer.style.position = 'relative'; container.appendChild(chartContainer); const canvas = document.createElement('canvas'); canvas.id = `ideas-chart-${Date.now()}`; canvas.style.height = '100%'; canvas.style.width = '100%'; chartContainer.appendChild(canvas); const labels = [], data = [], backgroundColors = []; const statusColors = { 'new': 'rgba(0, 123, 255, 1)', 'planned': 'rgba(23, 162, 184, 1)', 'in-progress': 'rgba(253, 126, 20, 1)', 'already-exists': 'rgba(108, 117, 125, 1)', 'under-review': 'rgba(32, 201, 151, 1)', 'completed': 'rgba(40, 167, 69, 1)', 'not-planned': 'rgba(220, 53, 69, 1)', }; Object.keys(TAG_MAP).forEach(status => { labels.push(TAG_MAP[status]); data.push(statusCounts[status] || 0); backgroundColors.push(statusColors[status] || 'rgba(173, 181, 189, 1)'); }); if (currentChartInstance) { currentChartInstance.destroy(); currentChartInstance = null; } createBarChart(Chart, canvas, labels, data, backgroundColors, total); } catch (error) { console.error("Ideas Portal: Failed to create status visualization:", error); container.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--primary-medium); font-style: italic;">Could not load ideas visualization.</p>`; } };
  const createBarChart = (Chart, canvas, labels, data, backgroundColors, total) => { if (typeof Chart === 'undefined' || !Chart) { return; } const chartTitle = `${total} ${total === 1 ? 'Idea' : 'Ideas'} by Status`; const primaryColor = getComputedStyle(canvas).getPropertyValue("--primary").trim() || '#333333'; const ctx = canvas.getContext('2d'); if (!ctx) { return; } try { currentChartInstance = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Idea Count', data, backgroundColor: backgroundColors, borderColor: backgroundColors.map(c => c.replace(/, *1\)/, ', 1)')), borderWidth: 1, borderRadius: 6, borderSkipped: false, }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'x', plugins: { legend: { display: false }, title: { display: true, text: chartTitle, font: { size: 18, weight: 'bold' }, color: primaryColor, padding: { top: 10, bottom: 20 } }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleFont: { size: 13 }, bodyFont: { size: 12 }, callbacks: { label: (context) => { const count = context.raw || 0; const totalIdeas = data.reduce((a, b) => a + b, 0); const percent = totalIdeas > 0 ? Math.round((count / totalIdeas) * 100) : 0; return `${count} ${count === 1 ? 'idea' : 'ideas'} (${percent}%)`; } } } }, scales: { x: { grid: { display: false }, ticks: { color: primaryColor, font: { size: 12 } } }, y: { beginAtZero: true, grid: { color: 'rgba(128, 128, 128, 0.2)' }, ticks: { precision: 0, color: primaryColor, font: { size: 12 } } } }, animation: { duration: 800, easing: 'easeOutQuart' } } }); } catch (e) { console.error("Ideas Portal: Error initializing Chart:", e); if (canvas.parentElement) { canvas.parentElement.innerHTML = `<p style="text-align: center; color: var(--danger);">Chart Error</p>`; } } };

  // --- DOM Manipulation Functions ---
  const updateNavLinks = () => { const navLinksToUpdate = [ { className: "top", newText: "Most Active" }, { className: "votes", newText: "Most Voted" }, { className: "latest", newText: "Recently Active" }, ]; navLinksToUpdate.forEach(({ className, newText }) => { try { const listItem = document.querySelector(`.nav.nav-pills .nav-item.${className}`); if (listItem) { const link = listItem.querySelector("a"); const currentText = link?.textContent?.trim(); const expectedOldText = className.charAt(0).toUpperCase() + className.slice(1); if (link && currentText === expectedOldText) { link.textContent = newText; } } } catch(e) { console.warn(`Ideas Portal: Could not update nav link for class "${className}".`, e); } }); };
  const updateTopicListHeader = () => { try { const headerElement = document.querySelector('table.topic-list th.topic-list-data.default span'); if (headerElement && headerElement.textContent?.trim() === "Topic") { headerElement.textContent = "Ideas"; } } catch (e) { console.warn("Ideas Portal: Could not update topic list header text.", e); } };
  const updateTagText = () => { document.querySelectorAll('[data-tag-name]').forEach(el => { const tag = el.getAttribute('data-tag-name'); if (tag && TAG_MAP[tag] && el.textContent !== TAG_MAP[tag]) { el.textContent = TAG_MAP[tag]; } }); };
  const updateCategoryBannerTitle = (category, container) => { if (!category || !container || typeof container.lookup !== 'function') return; try { const bannerTitle = document.querySelector(".custom-banner__title"); if (bannerTitle) { const originalTitle = bannerTitle.textContent.trim(); const parentSlug = getParentCategorySlug(container, category); let parentName = ""; if (category.parent_category_id) { const site = container.lookup("site:main"); const parentCategory = site?.categories?.find(cat => cat.id === category.parent_category_id); if (parentCategory?.name) parentName = parentCategory.name; } const expectedTitle = parentName ? `${parentName} › ${category.name}` : category.name; if (category.name && originalTitle !== expectedTitle) { bannerTitle.textContent = expectedTitle; } } } catch (e) { console.warn("Ideas Portal: Could not update category banner title.", e); } };
  const reorderTagsInTopicList = () => { const statusTagsOrder = Object.keys(TAG_MAP); document.querySelectorAll("tr.topic-list-item").forEach((row) => { const tagContainer = row.querySelector(".discourse-tags"); if (!tagContainer) return; const originalTagElements = Array.from(tagContainer.querySelectorAll(":scope > a.discourse-tag[data-tag-name]")); if (originalTagElements.length < 2) return; const sortedTagElements = [...originalTagElements].sort((a, b) => { const tagA = a.dataset.tagName; const tagB = b.dataset.tagName; const indexA = statusTagsOrder.indexOf(tagA); const indexB = statusTagsOrder.indexOf(tagB); if (indexA !== -1 && indexB !== -1) return indexA - indexB; if (indexA !== -1) return -1; if (indexB !== -1) return 1; return tagA.localeCompare(tagB); }); tagContainer.innerHTML = ''; sortedTagElements.forEach((el, index) => { tagContainer.appendChild(el); if (index < sortedTagElements.length - 1) { tagContainer.appendChild(document.createTextNode(' ')); } }); }); };

  // --- Render Function ---
  const renderFiltersAndVisualization = async (container) => {
    if (!container || typeof container.lookup !== 'function') { return; }
    const existingContainer = document.querySelector('.ideas-portal-controls');
    if (existingContainer) { existingContainer.remove(); }
    const category = getCurrentEnabledCategoryInfo(container);
    const tagName = getCurrentEnabledTagName(container);
    if (!category && !tagName) { return; }
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'ideas-portal-controls';
    const statusVisualization = document.createElement('div');
    statusVisualization.className = 'ideas-status-visualization';
    controlsContainer.appendChild(statusVisualization);
    const filtersWrapper = document.createElement('div');
    filtersWrapper.className = 'ideas-tag-filters';
    const filterButtonsWrapper = document.createElement('div');
    filterButtonsWrapper.className = 'filter-buttons';
    let topics = []; let baseHref = ''; let intersectionPrefix = '';
    if (category) {
      const parentSlug = getParentCategorySlug(container, category); baseHref = `/c/${parentSlug}${category.slug || category.id}/${category.id}`; intersectionPrefix = `/tags/c/${parentSlug}${category.slug || category.id}/${category.id}/`;
      topics = await fetchAllTopicsInCategory(category.id);
    } else if (tagName) {
      const encodedTag = encodeURIComponent(tagName); baseHref = `/tag/${encodedTag}`; intersectionPrefix = `/tags/intersection/${encodedTag}/`;
      topics = await fetchAllTopicsForTag(tagName);
    }
    const resetFilter = document.createElement('a'); resetFilter.href = baseHref; resetFilter.className = 'tag-filter tag-filter-reset'; resetFilter.textContent = 'Show All'; filterButtonsWrapper.appendChild(resetFilter);
    Object.keys(TAG_MAP).forEach(tag => { const filter = document.createElement('a'); filter.href = `${intersectionPrefix}${encodeURIComponent(tag)}`; filter.className = 'tag-filter'; filter.setAttribute('data-tag-name', tag); filter.textContent = TAG_MAP[tag]; filterButtonsWrapper.appendChild(filter); });
    filtersWrapper.appendChild(filterButtonsWrapper);
    controlsContainer.appendChild(filtersWrapper);
    const target = document.querySelector('.navigation-container');
    if (target) { target.insertAdjacentElement('afterend', controlsContainer); }
    else { console.warn("Ideas Portal: .navigation-container not found for injection."); document.body.insertBefore(controlsContainer, document.body.firstChild); }
    const statusCounts = buildStatusCounts(topics);
    await createStatusVisualization(statusCounts, statusVisualization);
    updateTagText();
  };

  // --- Main Execution Logic ---
  api.onPageChange(async (url, title) => {
    const shouldEnable = shouldEnableForCategoryOrTag(api.container);
    const bodyClass = "ideas-portal-category";
    const controlsSelector = '.ideas-portal-controls';

    if (!shouldEnable) {
      if (document.body.classList.contains(bodyClass)) { document.body.classList.remove(bodyClass); const existingControls = document.querySelector(controlsSelector); if (existingControls) existingControls.remove(); if (currentChartInstance) { currentChartInstance.destroy(); currentChartInstance = null; } } return;
    }
    if (!document.body.classList.contains(bodyClass)) { document.body.classList.add(bodyClass); }
    try { const categoriesNavItem = document.querySelector('.nav-item_categories'); if (categoriesNavItem) { categoriesNavItem.style.display = isEnabledTagPage(api.container) ? 'none' : ''; } } catch (e) { /* ignore */ }
    try { requestAnimationFrame(() => { updateNavLinks(); updateTopicListHeader(); reorderTagsInTopicList(); updateTagText(); updateCategoryBannerTitle(getCurrentEnabledCategoryInfo(api.container), api.container); }); } catch(e) { console.error("Ideas Portal: Error queueing DOM updates.", e); }
    try { await renderFiltersAndVisualization(api.container); } catch (e) { console.error("Ideas Portal: Error rendering filters/visualization.", e); }
  });

  // --- Cleanup ---
  api.cleanupStream(() => { resetCache(); document.body.classList.remove("ideas-portal-category"); const existingControls = document.querySelector('.ideas-portal-controls'); if (existingControls) existingControls.remove(); if (currentChartInstance) { currentChartInstance.destroy(); currentChartInstance = null; } });

});