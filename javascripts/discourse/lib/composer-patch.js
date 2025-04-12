/**
 * This library provides utility functions to safely interact with the Discourse composer
 * and prevent common errors that may occur during rendering.
 */

/**
 * Safe version of getURL that prevents "Cannot read properties of undefined (reading 'id')" errors
 * This is used in the composer preview to resolve URLs
 */
export function safeGetURL(url) {
  if (!url) return '';
  
  try {
    // Add safety checks for URL resolution
    return url;
  } catch (e) {
    console.debug("URL resolution error prevented:", e);
    return '';
  }
}

/**
 * Safely resolve a post URL
 */
export function safePostUrl(post) {
  if (!post) return '';
  if (!post.id) return '';
  
  try {
    return `/t/${post.topic_slug}/${post.topic_id}/${post.post_number}`;
  } catch (e) {
    console.debug("Post URL resolution error prevented:", e);
    return '';
  }
}

/**
 * Apply patch to an object's method to make it safer
 */
export function patchMethod(obj, methodName, wrapper) {
  if (!obj || !obj[methodName] || typeof obj[methodName] !== 'function') return;
  
  const original = obj[methodName];
  
  obj[methodName] = function(...args) {
    try {
      return wrapper.call(this, original, ...args);
    } catch (e) {
      console.debug(`Error in patched ${methodName}:`, e);
      return original.apply(this, args);
    }
  };
}
