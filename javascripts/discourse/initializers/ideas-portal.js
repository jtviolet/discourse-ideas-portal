import { apiInitializer } from "discourse/lib/api";
import Chart from "chart.js/auto";

export default apiInitializer("0.11.1", (api) => {
  const enabledCategories = settings.ideas_portal_categories
    ? settings.ideas_portal_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    : [];

  const tagMap = {
    'new': 'New',
    'under-review': 'Under Review',
    'planned': 'Planned',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'not-planned': 'Not Planned',
    'already-exists': 'Already Exists',
  };

  const createStatusVisualization = (statusCounts, container) => {
    if (!container) return;
    container.innerHTML = '';
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    if (total === 0) {
      container.style.display = 'none';
      return;
    } else {
      container.style.display = 'block';
    }
    const header = document.createElement('div');
    header.className = 'ideas-visualization-header';
    header.textContent = `${total} Total Ideas`;
    container.appendChild(header);
    const chartContainer = document.createElement('div');
    chartContainer.style.height = '200px';
    chartContainer.style.width = '100%';
    chartContainer.style.position = 'relative';
    container.appendChild(chartContainer);
    const canvas = document.createElement('canvas');
    canvas.id = 'ideas-status-chart';
    canvas.style.height = '100%';
    canvas.style.width = '100%';
    chartContainer.appendChild(canvas);
    const labels = [];
    const data = [];
    const backgroundColors = [];
    Object.keys(statusCounts).forEach(status => {
      if (statusCounts[status] > 0) {
        labels.push(tagMap[status]);
        data.push(statusCounts[status]);
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
    if (window.ideasStatusChart) {
      window.ideasStatusChart.destroy();
    }
    window.ideasStatusChart = new Chart(canvas.getContext('2d'), {
      type: 'polarArea',
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

  const getCurrentCategoryInfo = () => {
    const discoveryService = api.container.lookup("service:discovery");
    if (!discoveryService) return null;
    if (!discoveryService.category) return null;
    const category = discoveryService.category;
    const categoryId = category?.id;
    if (!categoryId) return null;
    if (!enabledCategories.includes(categoryId)) return null;
    return category;
  };

  api.onPageChange(() => {
    const currentCategory = getCurrentCategoryInfo();
    const existingFilters = document.querySelector('.ideas-tag-filters');
    if (!currentCategory) {
      document.body.classList.remove("ideas-portal-category");
      if (existingFilters) existingFilters.remove();
      return;
    }
    document.body.classList.add("ideas-portal-category");
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
    document.querySelectorAll('[data-tag-name]').forEach(el => {
      const tag = el.getAttribute('data-tag-name');
      if (tag && tagMap[tag]) el.textContent = tagMap[tag];
    });
    if (existingFilters) return;
    const categorySlug = currentCategory.slug;
    let parentSlug = "";
    if (currentCategory.parent_category_id) {
      const siteCategories = api.container.lookup("site:main").categories;
      const parentCategory = siteCategories.find(cat => cat.id === currentCategory.parent_category_id);
      if (parentCategory) parentSlug = `${parentCategory.slug}/`;
    }
    const container = document.createElement('div');
    container.className = 'ideas-tag-filters list-controls';
    const title = document.createElement('h3');
    title.className = 'ideas-filter-title';
    title.textContent = 'Filter by Status';
    container.appendChild(title);
    const statusVisualization = document.createElement('div');
    statusVisualization.className = 'ideas-status-visualization';
    container.appendChild(statusVisualization);
    const resetFilter = document.createElement('a');
    resetFilter.href = `/c/${parentSlug}${categorySlug}/${currentCategory.id}`;
    resetFilter.className = 'tag-filter tag-filter-reset';
    resetFilter.textContent = 'Show All';
    container.appendChild(resetFilter);
    const statusCounts = {};
    Object.keys(tagMap).forEach(tag => {
      statusCounts[tag] = 0;
    });
    try {
      const topicListController = api.container.lookup("controller:discovery/topics");
      const topicList = topicListController.get("model");
      if (topicList && topicList.topics) {
        topicList.topics.forEach(topic => {
          topic.tags?.forEach(tag => {
            if (statusCounts.hasOwnProperty(tag)) statusCounts[tag]++;
          });
        });
      }
      createStatusVisualization(statusCounts, statusVisualization);
    } catch (e) {
      console.error("Ideas Portal: Error counting statuses:", e);
    }
    Object.keys(tagMap).forEach(tag => {
      const filter = document.createElement('a');
      filter.href = `/tags/c/${parentSlug}${categorySlug}/${currentCategory.id}/${tag}`;
      filter.className = 'tag-filter';
      filter.setAttribute('data-tag-name', tag);
      filter.textContent = tagMap[tag];
      container.appendChild(filter);
    });
    const target = document.querySelector('.navigation-container');
    if (target) {
      target.insertAdjacentElement('afterend', container);
      setTimeout(() => {
        const viz = document.querySelector('.ideas-status-visualization');
        if (viz) viz.style.display = 'block';
      }, 100);
    }
  });
});