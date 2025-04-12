import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0", (api) => {
  // Track if we've applied our safety patch
  window.discourseIdeasPortalSafetyPatches = window.discourseIdeasPortalSafetyPatches || {
    apiSetupPatchApplied: false,
    errors: []
  };
  
  // Only apply once
  if (window.discourseIdeasPortalSafetyPatches.apiSetupPatchApplied) {
    return;
  }
  
  // Find the plugin API instance
  const pluginApiInstance = api.container.lookup("service:plugin-api");
  if (!pluginApiInstance) {
    console.warn("Could not find plugin-api service to apply safety patch");
    return;
  }
  
  // Find the decorateCookedPlugin
  const cookedPlugin = pluginApiInstance.decorateCookedPlugin;
  if (!cookedPlugin) {
    console.warn("Could not find decorateCookedPlugin to apply safety patch");
    return;
  }
  
  // Patch the _decorateCookedElement method which is causing our issue
  try {
    const originalDecorateCooked = cookedPlugin._decorateCookedElement;
    
    // Override with a safety-patched version
    cookedPlugin._decorateCookedElement = function(post, helper) {
      try {
        // Add safety checks to avoid the undefined id error
        if (!helper || !helper.getModel) {
          return;
        }
        
        const model = helper.getModel();
        if (!model || typeof model.id === 'undefined') {
          // This is the specific case that's causing our error
          console.debug('Ideas Portal: Prevented ID undefined error by skipping decoration for model:', model);
          return;
        }
        
        // Call original with all safety checks passed
        return originalDecorateCooked.apply(this, arguments);
      } catch (e) {
        // Log but don't propagate the error
        console.debug('Ideas Portal: Safely caught error in _decorateCookedElement:', e);
        window.discourseIdeasPortalSafetyPatches.errors.push({
          timestamp: new Date().toISOString(),
          source: '_decorateCookedElement patch',
          error: e.toString(),
          stack: e.stack
        });
      }
    };
    
    window.discourseIdeasPortalSafetyPatches.apiSetupPatchApplied = true;
    console.log("Ideas Portal: Successfully applied safety patch to _decorateCookedElement");
  } catch (e) {
    console.warn("Ideas Portal: Failed to apply safety patch:", e);
  }
  
  // Expose a way to view any errors caught by our patch
  window.viewIdeasPortalPatchErrors = function() {
    console.table(window.discourseIdeasPortalSafetyPatches.errors);
  };
});
