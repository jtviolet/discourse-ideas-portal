// javascripts/discourse/initializers/composer-error-handler.js
import { apiInitializer } from "discourse/lib/api";

/**
 * WARNING: This initializer adds global error handlers to catch and potentially suppress
 * specific errors, likely "Cannot read properties of undefined (reading 'id')".
 * This is a workaround and does not fix the underlying cause of the error.
 * Suppressing errors can mask real problems. Use only as a temporary measure.
 */
export default apiInitializer("0.9", (api) => { // Keep original version or manage separately
  window.discourseIdeasPortalPatches = window.discourseIdeasPortalPatches || {};
  window.discourseIdeasPortalPatches.windowErrors = window.discourseIdeasPortalPatches.windowErrors || [];

  const errorLog = window.discourseIdeasPortalPatches.windowErrors;
  const targetErrorMessage = "Cannot read properties of undefined (reading 'id')";
  let handlersAttached = false;

  const errorHandler = function(event) { /* ... Error handling logic ... */ };
  errorHandler = function(event) {
    if (!event || !event.error) return;
    const error = event.error;
    const errorInfo = { timestamp: new Date().toISOString(), type: 'window.error', errorType: error.constructor ? error.constructor.name : typeof error, message: error.message || String(error), file: event.filename, lineNumber: event.lineno, columnNumber: event.colno, stack: error.stack ? error.stack.split('\n').slice(0, 5).join('\n') : 'no stack', suppressed: false };
    errorLog.push(errorInfo);
    if (errorInfo.message && errorInfo.message.includes(targetErrorMessage)) { console.debug('Ideas Portal Error Handler: Intercepted window error:', errorInfo.message); errorInfo.suppressed = true; event.preventDefault(); }
  };

  const rejectionHandler = function(event) { /* ... Rejection handling logic ... */ };
  rejectionHandler = function(event) {
     if (!event || !event.reason) return;
     const reason = event.reason;
     const rejectionInfo = { timestamp: new Date().toISOString(), type: 'unhandled.promise', errorType: reason.constructor ? reason.constructor.name : typeof reason, message: reason.message || String(reason), stack: reason.stack ? reason.stack.split('\n').slice(0, 5).join('\n') : 'no stack', suppressed: false };
     errorLog.push(rejectionInfo);
     if (rejectionInfo.message && rejectionInfo.message.includes(targetErrorMessage)) { console.debug('Ideas Portal Error Handler: Intercepted promise rejection:', rejectionInfo.message); rejectionInfo.suppressed = true; event.preventDefault(); }
  };

  if (!handlersAttached) {
      window.addEventListener("error", errorHandler, true);
      window.addEventListener("unhandledrejection", rejectionHandler, true);
      handlersAttached = true;
      console.log("Ideas Portal: Global error handler initialized.");

      api.cleanupStream(() => {
        window.removeEventListener("error", errorHandler, true);
        window.removeEventListener("unhandledrejection", rejectionHandler, true);
        handlersAttached = false;
        console.log("Ideas Portal: Global error handler cleaned up.");
      });
  }

  // Expose error viewing function if it doesn't exist
  if (!window.viewIdeasPortalPatchErrors) {
      window.viewIdeasPortalPatchErrors = function() {
          const allErrors = (window.discourseIdeasPortalPatches?.errors || []).concat(window.discourseIdeasPortalPatches?.windowErrors || []);
          if(allErrors.length === 0) { console.log("Ideas Portal Patches & Handlers: No errors logged."); }
          else { console.table(allErrors); }
      };
   }
});