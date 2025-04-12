import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  // Create a debug log to track error handling
  const errorLog = [];
  window.viewErrorLog = function() {
    console.table(errorLog);
  };
  
  // Add a global error handler to suppress specific errors in the console
  const originalError = console.error;
  console.error = function(...args) {
    // Log all errors for debugging
    const errorInfo = {
      timestamp: new Date().toISOString(),
      errorType: args[0] && args[0].constructor ? args[0].constructor.name : typeof args[0],
      message: args[0] ? (args[0].message || args[0].toString()) : 'unknown',
      stack: args[0] && args[0].stack ? args[0].stack.split('\n').slice(0, 3).join('\n') : 'no stack'
    };
    
    // Check if this is the specific error we want to suppress
    if (args.length > 0 && 
        typeof args[0] === 'object' && 
        args[0] !== null &&
        args[0].toString && 
        args[0].toString().includes("Cannot read properties of undefined (reading 'id')")) {
      
      // Add suppression info
      errorInfo.suppressed = true;
      errorInfo.fullStack = args[0].stack;
      errorLog.push(errorInfo);
      
      // Log the full details to help debugging
      console.debug('Suppressed error details:', {
        error: args[0],
        stack: args[0].stack,
        url: window.location.href,
        source: 'console.error override'
      });
      
      // Suppress this specific error
      return;
    }
    
    // Log non-suppressed errors
    errorInfo.suppressed = false;
    errorLog.push(errorInfo);
    
    // Call the original console.error for all other errors
    originalError.apply(console, args);
  };

  // Ensure we restore the original error handler on cleanup
  api.cleanupStream(() => {
    console.error = originalError;
  });
  
  console.log("Error tracking initialized. Type 'window.viewErrorLog()' in console to see error details.");
});
