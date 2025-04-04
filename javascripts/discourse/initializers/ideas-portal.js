// javascripts/discourse/initializers/ideas-portal.js

import { apiInitializer } from "discourse/lib/api";
import { initAPI } from "../api/index";
import IdeasVisualization from "../components/ideas-visualization";
import IdeasTagFilters from "../components/ideas-tag-filters";

export default apiInitializer("0.11.1", (api) => {
  // Initialize our API
  const { ideasService } = initAPI(api);
  
  // Register connector class
  api.registerConnectorClass("before-topic-list", "ideas-portal-components", {
    setupComponent(attrs, component) {
      // Set up component properties
      component.set("ideasVisualization", IdeasVisualization);
      component.set("ideasTagFilters", IdeasTagFilters);
      component.set("ideasService", ideasService);
    }
  });
  
  // Customize navigation links text
  api.onPageChange(() => {
    // Use requestAnimationFrame to ensure the DOM is fully loaded
    requestAnimationFrame(() => {
      const currentCategory = ideasService.getCurrentCategoryInfo();
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
      
      // Clean up when leaving the category
      api.cleanupStream(() => {
        document.body.classList.remove("ideas-portal-category");
      });
    });
  });
});
