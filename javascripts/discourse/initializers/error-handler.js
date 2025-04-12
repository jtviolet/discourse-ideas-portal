import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  // Add a global error handler to suppress specific errors in the console
  const originalError = console.error;
  console.error = function(...args) {
    // Check if this is the specific error we want to suppress
    if (args[0] instanceof Error && 
        args[0].message && 
        args[0].message.includes("Cannot read properties of undefined (reading 'id')")) {
      // Suppress this specific error
      return;
    }
    
    // Call the original console.error for all other errors
    originalError.apply(console, args);
  };

  // Ensure we restore the original error handler on cleanup
  api.cleanupStream(() => {
    console.error = originalError;
  });
  
  // Patch errors in the decorateCooked method (which processes post content)
  if (typeof api.decorateCooked === 'function') {
    const originalDecorateCooked = api.decorateCooked;
    api.decorateCooked = function(callback, options) {
      const safeCallback = (element, helper) => {
        try {
          // Make sure the helper has all necessary properties before using it
          if (helper && helper.getModel && typeof helper.getModel === 'function') {
            callback(element, helper);
          }
        } catch (e) {
          // Silently ignore the specific error we're targeting
          if (!e.message || !e.message.includes("Cannot read properties of undefined (reading 'id')")) {
            throw e;
          }
        }
      };
      
      return originalDecorateCooked.call(this, safeCallback, options);
    };
  }
});
