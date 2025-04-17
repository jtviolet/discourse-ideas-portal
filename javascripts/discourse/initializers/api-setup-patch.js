// javascripts/discourse/initializers/api-setup-patch.js
import { apiInitializer } from "discourse/lib/api";

/**
 * WARNING: This initializer applies a low-level patch to Discourse's internal
 * `_decorateCookedElement` method. This is a workaround for a specific error,
 * likely "Cannot read properties of undefined (reading 'id')", encountered
 * under certain conditions (potentially related to specific post types or rendering scenarios).
 * Patches like this are inherently risky and may break with Discourse core updates.
 * The preferred solution is to identify and fix the root cause of the error.
 * Use this patch only if the root cause cannot be immediately addressed.
 */
export default apiInitializer("1.0", (api) => { // Keep original version or manage separately
  window.discourseIdeasPortalPatches = window.discourseIdeasPortalPatches || {
    apiSetupPatchApplied: false,
    errors: []
  };

  if (window.discourseIdeasPortalPatches.apiSetupPatchApplied) { return; }

  try {
    const pluginApiInstance = api.container.lookup("service:plugin-api");
    if (!pluginApiInstance) { return; }

    const cookedPlugin = pluginApiInstance.decorateCookedPlugin;
    if (!cookedPlugin || typeof cookedPlugin._decorateCookedElement !== 'function') { return; }

    const originalDecorateCooked = cookedPlugin._decorateCookedElement;

    cookedPlugin._decorateCookedElement = function(post, helper) {
      try {
        if (!helper || typeof helper.getModel !== 'function') { return; }
        const model = helper.getModel();
        if (!model || typeof model.id === 'undefined') {
          console.debug('Ideas Portal Patch: Prevented potential ID undefined error for model:', model);
          return;
        }
        return originalDecorateCooked.apply(this, arguments);
      } catch (e) {
        console.warn('Ideas Portal Patch: Safely caught error within patched _decorateCookedElement:', e);
        window.discourseIdeasPortalPatches.errors.push({ timestamp: new Date().toISOString(), source: '_decorateCookedElement patch internal', error: e.toString(), stack: e.stack });
      }
    };

    window.discourseIdeasPortalPatches.apiSetupPatchApplied = true;
    console.log("Ideas Portal: Applied safety patch to _decorateCookedElement.");

  } catch (e) {
    console.error("Ideas Portal: Failed to apply _decorateCookedElement safety patch:", e);
    window.discourseIdeasPortalPatches.errors.push({ timestamp: new Date().toISOString(), source: '_decorateCookedElement patch apply', error: e.toString(), stack: e.stack });
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