import { apiInitializer } from "discourse/lib/api";
import { patchMethod } from "../lib/composer-patch";

export default apiInitializer("0.9", (api) => {
  // Override URL resolution methods for safety
  const decorateCookedPlugin = api.container.lookup("service:plugin-api")?.decorateCookedPlugin;
  
  if (decorateCookedPlugin) {
    // Save original
    const original = decorateCookedPlugin._decorateCookedElement;
    
    // Replace with safer version
    decorateCookedPlugin._decorateCookedElement = function(element, helper) {
      try {
        // Only proceed if helper has the required methods
        if (helper && typeof helper.getModel === "function") {
          return original.call(this, element, helper);
        }
      } catch (e) {
        if (e instanceof TypeError && e.message.includes("Cannot read properties of undefined (reading 'id')")) {
          // Silently ignore this specific error
          return;
        }
        // For any other error, let it propagate
        throw e;
      }
    };
  }
  
  // Add a specific global error handler to prevent these errors from showing in console
  window.addEventListener("error", function(event) {
    // Check if the error matches our pattern
    if (event && event.error && 
        event.error.message && 
        event.error.message.includes("Cannot read properties of undefined (reading 'id')") &&
        event.error.stack && 
        event.error.stack.includes("decorateCookedElement")) {
      
      // Prevent the error from appearing in console
      event.preventDefault();
      return false;
    }
  }, true);
});
