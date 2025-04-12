import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.9", (api) => {
  // Add a global window error handler that specifically targets the error we're seeing
  const errorHandler = function(event) {
    // Check if the error matches our pattern
    if (event && event.error && 
        event.error.toString && 
        event.error.toString().includes("Cannot read properties of undefined (reading 'id')")) {
      
      // Prevent the error from appearing in console
      event.preventDefault();
      return true; // Signal that we've handled the error
    }
  };
  
  // Add a handler for unhandled promise rejections too
  const rejectionHandler = function(event) {
    // Check if the rejection reason matches our pattern
    if (event && event.reason &&
        event.reason.toString && 
        event.reason.toString().includes("Cannot read properties of undefined (reading 'id')")) {
      
      // Prevent the error from appearing in console
      event.preventDefault();
      return true;
    }
  };
  
  // Add the error handlers
  window.addEventListener("error", errorHandler, true);
  window.addEventListener("unhandledrejection", rejectionHandler, true);
  
  // Clean up when navigating away
  api.cleanupStream(() => {
    window.removeEventListener("error", errorHandler, true);
    window.removeEventListener("unhandledrejection", rejectionHandler, true);
  });
});
