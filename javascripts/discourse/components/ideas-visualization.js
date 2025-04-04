import Component from "@ember/component";
import { inject as service } from "@ember/service";
import { computed } from "@ember/object";

export default Component.extend({
  classNames: ["ideas-status-visualization"],
  ideasService: service("ideas-service"),
  
  topics: null,
  chartInstance: null,
  
  didInsertElement() {
    this._super(...arguments);
    
    if (this.topics) {
      this.renderChart();
    }
  },
  
  didUpdateAttrs() {
    this._super(...arguments);
    
    if (this.topics) {
      this.renderChart();
    }
  },
  
  willDestroyElement() {
    this._super(...arguments);
    
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  },
  
  statusCounts: computed("topics.[]", function() {
    if (!this.topics) return {};
    return this.ideasService.buildStatusCounts(this.topics);
  }),
  
  renderChart() {
    const statusCounts = this.statusCounts;
    const container = this.element;
    
    if (!container) return;
    
    // Clear previous content
    container.innerHTML = "";
    
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    
    if (total === 0) {
      this._renderEmptyState(container);
      return;
    }
    
    const chartContainer = document.createElement("div");
    chartContainer.style.height = "250px";
    chartContainer.style.width = "100%";
    chartContainer.style.position = "relative";
    container.appendChild(chartContainer);
    
    const canvas = document.createElement("canvas");
    canvas.id = "ideas-status-chart";
    canvas.style.height = "100%";
    canvas.style.width = "100%";
    chartContainer.appendChild(canvas);
    
    this._loadChartLibraryAndRender(canvas, statusCounts, total);
  },
  
  _renderEmptyState(container) {
    const noIdeasMessage = document.createElement("div");
    noIdeasMessage.className = "no-ideas-message";
    noIdeasMessage.innerHTML = `
      <p>It looks like there are no ideas with this status yet.</p>
      <p>Be the first to submit an idea!</p>
    `;
    noIdeasMessage.style.textAlign = "center";
    noIdeasMessage.style.padding = "20px";
    noIdeasMessage.style.color = "var(--primary-medium)";
    noIdeasMessage.style.fontStyle = "italic";
    container.appendChild(noIdeasMessage);
  },
  
  _loadChartLibraryAndRender(canvas, statusCounts, total) {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
    
    if (typeof Chart === "undefined") {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js";
      script.onload = () => this._createPolarChart(canvas, statusCounts, total);
      document.head.appendChild(script);
    } else {
      this._createPolarChart(canvas, statusCounts, total);
    }
  },
  
  _createPolarChart(canvas, statusCounts, total) {
    const tagMap = this.ideasService.tagMap;
    const labels = [], data = [], backgroundColors = [];
    
    Object.keys(statusCounts).forEach(status => {
      if (statusCounts[status] > 0) {
        labels.push(tagMap[status]);
        data.push(statusCounts[status]);
        let color;
        switch(status) {
          case "new": color = "rgba(0, 123, 255, 1)"; break;
          case "planned": color = "rgba(23, 162, 184, 1)"; break;
          case "in-progress": color = "rgba(253, 126, 20, 1)"; break;
          case "already-exists": color = "rgba(108, 117, 125, 1)"; break;
          case "under-review": color = "rgba(32, 201, 151, 1)"; break;
          case "completed": color = "rgba(40, 167, 69, 1)"; break;
          case "not-planned": color = "rgba(220, 53, 69, 1)"; break;
          default: color = "rgba(173, 181, 189, 1)";
        }
        backgroundColors.push(color);
      }
    });
    
    const chartTitle = `${total} ${total === 1 ? "idea" : "ideas"}`;
    const returnPrimaryColor = () => {
      const primaryColor = getComputedStyle(canvas).getPropertyValue("--primary");
      return primaryColor;
    };
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    this.chartInstance = new Chart(ctx, {
      type: "polarArea",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(c => c.replace("0.7", "1")),
          borderWidth: 1,
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
              weight: "bold"
            },
            color: returnPrimaryColor(),
            padding: {
              bottom: 10
            }
          },
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.8)",
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
          r: {
            ticks: {
              display: false
            },
            grid: { color: returnPrimaryColor() },
            angleLines: { color: returnPrimaryColor() },
            pointLabels: {
              display: true,
              centerPointLabels: true,
              color: returnPrimaryColor(),
              font: {
                size: 14
              }
            }
          }
        },
        animation: {
          easing: "easeInBounce",
          duration: 1000,
          animateRotate: true,
          animateScale: true
        }
      }
    });
  }
}); 