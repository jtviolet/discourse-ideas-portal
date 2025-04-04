// javascripts/discourse/initializers/ideas-portal.js

import { apiInitializer } from "discourse/lib/api";
import IdeasService from "../services/ideas-service";
import IdeasPortalController from "../controllers/ideas-portal-controller";

export default apiInitializer("0.11.1", (api) => {
  // Register service
  api.container.register("service:ideas-service", IdeasService);
  
  // Register controller for route
  api.container.register("controller:ideas-portal", IdeasPortalController);
  
  // Customize navigation links text
  api.onPageChange(() => {
    // Use requestAnimationFrame to ensure the DOM is fully loaded
    requestAnimationFrame(() => {
      const currentCategory = api.container.lookup("service:ideas-service").getCurrentCategoryInfo();
      if (!currentCategory) return;
      
      // Define an array of objects with the class and new text for each link
      const navLinks = [
        { className: "top", newText: "Most Active" },
        { className: "latest", newText: "Recent Ideas" },
        { className: "new", newText: "New Ideas" }
      ];
      
      // Apply the changes to each nav link
      navLinks.forEach(({ className, newText }) => {
        const link = document.querySelector(`.ideas-portal-category .nav-pills .${className} a`);
        if (link) {
          link.innerText = newText;
        }
      });
      
      // Add the ideas-portal-category class to the body when in an ideas category
      document.body.classList.add("ideas-portal-category");
      
      // Inject the visualization component above the topic list
      if (document.querySelector(".topic-list") && !document.querySelector(".ideas-status-visualization")) {
        const visualizationContainer = document.createElement("div");
        visualizationContainer.className = "ideas-status-visualization";
        const topicList = document.querySelector(".topic-list");
        
        if (topicList && topicList.parentNode) {
          topicList.parentNode.insertBefore(visualizationContainer, topicList);
          
          // Create the visualization component using our Ember components
          const ideasService = api.container.lookup("service:ideas-service");
          const ideasController = api.container.lookup("controller:ideas-portal");
          
          // Let Ember render our components
          api.renderInOutlet("before-topic-list", "components/ideas-visualization", {
            model: {
              topics: ideasController.topics
            }
          });
          
          // Render the tag filters
          api.renderInOutlet("before-topic-list", "components/ideas-tag-filters", {
            model: {
              tagMap: ideasService.tagMap,
              onTagSelected: (tag) => ideasController.send("filterByTag", tag)
            }
          });
        }
      }
      
      // Add the class when leaving the ideas category
      api.cleanupStream(() => {
        document.body.classList.remove("ideas-portal-category");
      });
    });
  });
});
