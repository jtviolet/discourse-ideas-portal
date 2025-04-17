import { apiInitializer } from "discourse/lib/api";

/**
 * WARNING: This initializer applies a low-level patch to Discourse's internal
 * `_decorateCookedElement` method. This is a workaround for a specific error,
 * likely "Cannot read properties of undefined (reading 'id')", encountered
 * under certain conditions (potentially related to specific post types or rendering scenarios).
 *
 * Patches like this are inherently risky:
 * - They can break silently with Discourse core updates.
 * - They might mask the underlying problem instead of fixing it.
 *
 * The preferred solution is to identify the root cause of the error and fix it,
 * either in this component, another plugin/component, or by reporting a bug to Discourse core.
 *
 * Use this patch only if the root cause cannot be immediately addressed and the error
 * significantly disrupts functionality. Monitor Discourse updates closely.
 */
export default apiInitializer("1.0", (api) => {
  // Use a namespace to store patch status and logged errors
  window.discourseIdeasPortalPatches = window.discourseIdeasPortalPatches || {
    apiSetupPatchApplied: false,
    errors: []
  };

  // Only apply the patch once
  if (window.discourseIdeasPortalPatches.apiSetupPatchApplied) {
    console.debug("Ideas Portal: _decorateCookedElement patch already applied.");
    return;
  }

  try {
    const pluginApiInstance = api.container.lookup("service:plugin-api");
    if (!pluginApiInstance) {
      console.warn("Ideas Portal: Could not find plugin-api service to apply _decorateCookedElement patch.");
      return;
    }

    const cookedPlugin = pluginApiInstance.decorateCookedPlugin;
    if (!cookedPlugin || typeof cookedPlugin._decorateCookedElement !== 'function') {
      console.warn("Ideas Portal: Could not find decorateCookedPlugin._decorateCookedElement to apply patch.");
      return;
    }

    const originalDecorateCooked = cookedPlugin._decorateCookedElement;

    // Override with a safety-patched version
    cookedPlugin._decorateCookedElement = function(post, helper) {
      try {
        // Safety check: Ensure helper and getModel exist before proceeding
        if (!helper || typeof helper.getModel !== 'function') {
          console.debug('Ideas Portal Patch: Skipping decoration, invalid helper.', { post, helper });
          return; // Skip decoration if helper is invalid
        }

        const model = helper.getModel();
        // Safety check: Ensure model exists and has an 'id' property
        if (!model || typeof model.id === 'undefined') {
          // This check prevents the "Cannot read properties of undefined (reading 'id')" error
          console.debug('Ideas Portal Patch: Prevented potential ID undefined error by skipping decoration for model:', model);
          return; // Skip decoration if model or model.id is missing
        }

        // If all checks pass, call the original method
        return originalDecorateCooked.apply(this, arguments);

      } catch (e) {
        // Log errors occurring within the patched function, but prevent them from stopping execution
        console.warn('Ideas Portal Patch: Safely caught error within patched _decorateCookedElement:', e);
        window.discourseIdeasPortalPatches.errors.push({
          timestamp: new Date().toISOString(),
          source: '_decorateCookedElement patch internal catch',
          error: e.toString(),
          stack: e.stack
        });
        // Decide if you need to return something specific here or just let it be undefined
      }
    };

    window.discourseIdeasPortalPatches.apiSetupPatchApplied = true;
    console.log("Ideas Portal: Successfully applied safety patch to _decorateCookedElement.");

  } catch (e) {
    // Log errors occurring during the patch application process itself
    console.error("Ideas Portal: Failed to apply _decorateCookedElement safety patch:", e);
    window.discourseIdeasPortalPatches.errors.push({
        timestamp: new Date().toISOString(),
        source: '_decorateCookedElement patch application',
        error: e.toString(),
        stack: e.stack
      });
  }

  // Expose a helper function in the console to view any errors caught by the patch
  window.viewIdeasPortalPatchErrors = function() {
    if (window.discourseIdeasPortalPatches.errors.length === 0) {
      console.log("Ideas Portal Patch: No errors caught.");
    } else {
      console.table(window.discourseIdeasPortalPatches.errors);
    }
  };
});