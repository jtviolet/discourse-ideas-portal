import { withPluginApi } from "discourse/lib/plugin-api";
import { ajax } from "discourse/lib/ajax";
import { api } from "discourse/lib/api";
import Chart from "chart.js/auto"; // Import Chart.js

export default {
  setupComponent(attrs, component) {
    component.set("ideas", []);
    component.set("filteredIdeas", []);
    component.set("selectedStatus", "all");
    component.set("statusCounts", {});
    component.set("newIdeaTitle", "");
    component.set("newIdeaText", "");

    component.loadIdeas = () => {
      ajax("/latest.json?category=1")
        .then((result) => {
          const ideas = result.topic_list.topics.map((topic) => ({
            id: topic.id,
            title: topic.title,
            tags: topic.tags,
            views: topic.views,
            posts_count: topic.posts_count,
            last_posted_at: topic.last_posted_at,
            voted: false,
          }));
          component.set("ideas", ideas);
          component.set("filteredIdeas", ideas);
          component.updateStatusCounts(ideas);
          component.renderChart();
        })
        .catch((error) => {
          console.error("Error loading ideas:", error);
        });
    };

    component.updateStatusCounts = (ideas) => {
      const counts = {
        new: 0,
        "under-review": 0,
        planned: 0,
        "in-progress": 0,
        completed: 0,
        "not-planned": 0,
        "already-exists": 0,
      };

      ideas.forEach((idea) => {
        idea.tags.forEach((tag) => {
          if (counts.hasOwnProperty(tag)) {
            counts[tag]++;
          }
        });
      });

      component.set("statusCounts", counts);
    };

    component.filterIdeas = (status) => {
      component.set("selectedStatus", status);
      if (status === "all") {
        component.set("filteredIdeas", component.get("ideas"));
      } else {
        const filtered = component
          .get("ideas")
          .filter((idea) => idea.tags.includes(status));
        component.set("filteredIdeas", filtered);
      }
    };

    component.renderChart = () => {
      const statusCounts = component.get("statusCounts");
      const labels = Object.keys(statusCounts);
      const data = Object.values(statusCounts);

      const ctx = document.getElementById("ideasChart").getContext("2d");
      if (ctx) {
        new Chart(ctx, { // Corrected Chart instantiation
          type: "bar",
          data: {
            labels: labels,
            datasets: [
              {
                label: "Ideas by Status",
                data: data,
                backgroundColor: [
                  "rgba(255, 99, 132, 0.2)",
                  "rgba(54, 162, 235, 0.2)",
                  "rgba(255, 206, 86, 0.2)",
                  "rgba(75, 192, 192, 0.2)",
                  "rgba(153, 102, 255, 0.2)",
                  "rgba(255, 159, 64, 0.2)",
                  "rgba(0, 128, 0, 0.2)",
                ],
                borderColor: [
                  "rgba(255, 99, 132, 1)",
                  "rgba(54, 162, 235, 1)",
                  "rgba(255, 206, 86, 1)",
                  "rgba(75, 192, 192, 1)",
                  "rgba(153, 102, 255, 1)",
                  "rgba(255, 159, 64, 1)",
                  "rgba(0, 128, 0, 1)",
                ],
                borderWidth: 1,
              },
            ],
          },
          options: {
            scales: {
              y: {
                beginAtZero: true,
              },
            },
          },
        });
      }
    };

    component.createIdea = () => {
      const ideaTitle = component.get("newIdeaTitle");
      const ideaText = component.get("newIdeaText");

      if (!ideaTitle || !ideaText) {
        alert("Please enter a title and description.");
        return;
      }

      api.create("/posts", { raw: ideaText, title: ideaTitle, category: 1 })
        .then((result) => {
          component.set("newIdeaTitle", "");
          component.set("newIdeaText", "");
          component.loadIdeas();
        })
        .catch((error) => {
          console.error("Error creating idea:", error);
          alert("Failed to create idea. Please try again.");
        });
    };

    component.voteIdea = (idea) => {
      idea.voted = true;
      component.loadIdeas();
    };

    component.didInsertElement = () => {
      component.loadIdeas();
    };
  },
};