import { apiInitializer } from "discourse/lib/api";

/**
 * WARNING: This initializer adds global error handlers to catch and potentially suppress
 * specific errors, likely "Cannot read properties of undefined (reading 'id')".
 * This is a workaround and does not fix the underlying cause of the error.
 *
 * Suppressing errors can:
 * - Mask real problems in the application.
 * - Make debugging harder.
 * - Lead to unexpected behavior later on.
 *
 * The preferred solution is to identify and fix the root cause of the error this handler
 * targets. Use this handler only as a temporary measure if the error is causing significant
 * user disruption and cannot be immediately fixed.
 */
export default apiInitializer("0.9", (api) => {
  // Use a shared namespace if defined by another patch, otherwise create it
  window.discourseIdeasPortalPatches = window.discourseIdeasPortalPatches || {};
  window.discourseIdeasPortalPatches.windowErrors = window.discourseIdeasPortalPatches.windowErrors || [];

  const errorLog = window.discourseIdeasPortalPatches.windowErrors;
  const targetErrorMessage = "Cannot read properties of undefined (reading 'id')";
  let handlersAttached = false; // Prevent multiple attachments

  const errorHandler = function(event) {
    if (!event || !event.error) return;

    const error = event.error;
    const errorInfo = {
      timestamp: new Date().toISOString(),
      type: 'window.error',
      errorType: error.constructor ? error.constructor.name : typeof error,
      message: error.message || String(error),
      file: event.filename,
      lineNumber: event.lineno,
      columnNumber: event.colno,
      stack: error.stack ? error.stack.split('\n').slice(0, 5).join('\n') : 'no stack',
      suppressed: false
    };

    errorLog.push(errorInfo);

    // Check if the error message contains the specific string we want to suppress
    if (errorInfo.message && errorInfo.message.includes(targetErrorMessage)) {
      console.debug('Ideas Portal Error Handler: Intercepted window error:', errorInfo.message, { error });
      errorInfo.suppressed = true;

      // Prevent the default browser error logging for this specific error
      event.preventDefault();
      // Consider if you need to return true here depending on browser specifics
      // return true;
    }
  };

  const rejectionHandler = function(event) {
     if (!event || !event.reason) return;

     const reason = event.reason;
     const rejectionInfo = {
        timestamp: new Date().toISOString(),
        type: 'unhandled.promise',
        errorType: reason.constructor ? reason.constructor.name : typeof reason,
        message: reason.message || String(reason),
        stack: reason.stack ? reason.stack.split('\n').slice(0, 5).join('\n') : 'no stack',
        suppressed: false
     };

     errorLog.push(rejectionInfo);

     // Check if the rejection reason contains the specific string
     if (rejectionInfo.message && rejectionInfo.message.includes(targetErrorMessage)) {
        console.debug('Ideas Portal Error Handler: Intercepted promise rejection:', rejectionInfo.message, { reason });
        rejectionInfo.suppressed = true;

        // Prevent the default browser error logging for this specific rejection
        event.preventDefault();
        // Consider if you need to return true here
        // return true;
     }
  };

  // Attach handlers only once
  if (!handlersAttached) {
      // Use capture phase (true) to catch errors early
      window.addEventListener("error", errorHandler, true);
      window.addEventListener("unhandledrejection", rejectionHandler, true);
      handlersAttached = true;
      console.log("Ideas Portal: Global error handler initialized to track and potentially suppress specific errors.");

      // Ensure cleanup removes the *exact same* listeners
      api.cleanupStream(() => {
        window.removeEventListener("error", errorHandler, true);
        window.removeEventListener("unhandledrejection", rejectionHandler, true);
        handlersAttached = false; // Reset flag if needed for re-initialization scenarios
        console.log("Ideas Portal: Global error handler cleaned up.");
      });
  }

  // Expose a way to view the logged errors (if not already exposed by api-setup-patch)
  if (!window.viewIdeasPortalPatchErrors) {
      window.viewIdeasPortalPatchErrors = function() {
          const allErrors = (window.discourseIdeasPortalPatches?.errors || []).concat(window.discourseIdeasPortalPatches?.windowErrors || []);
          if(allErrors.length === 0) {
              console.log("Ideas Portal Patches & Handlers: No errors logged.");
          } else {
              console.table(allErrors);
          }
      };
  }
});