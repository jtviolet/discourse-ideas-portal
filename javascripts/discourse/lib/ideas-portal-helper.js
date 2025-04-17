// javascripts/discourse/lib/ideas-portal-helper.js
import { lookup } from "discourse/lib/container"; // Helper to get services/controllers/site

// --- Private cached variables ---
let _enabledCategories = null;
let _enabledTags = null;
let _siteCategories = null;

// --- Constants ---
export const TAG_MAP = {
  'new': 'New',
  'under-review': 'Under Review',
  'planned': 'Planned',
  'in-progress': 'In Progress',
  'completed': 'Completed',
  'not-planned': 'Not Planned',
  'already-exists': 'Already Exists',
};

// --- Helper Functions ---

/**
 * Parses and caches enabled categories and tags from settings.
 */
function parseSettings() {
  // Cache settings to avoid repeated parsing per request lifecycle
  if (_enabledCategories === null) {
    _enabledCategories = settings.enabled_categories
      ? settings.enabled_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
      : [];
  }
  if (_enabledTags === null) {
    _enabledTags = settings.enabled_tags
      ? settings.enabled_tags.split("|").map(tag => tag.trim()).filter(tag => tag.length > 0)
      : [];
  }
}

/**
 * Caches site categories.
 */
function getSiteCategories() {
    if (_siteCategories === null) {
        const site = lookup("site:main");
        _siteCategories = site?.categories || [];
    }
    return _siteCategories;
}

/**
 * Resets cached settings and categories. Call this on cleanup if necessary.
 */
export function resetCache() {
  _enabledCategories = null;
  _enabledTags = null;
  _siteCategories = null;
}

/**
 * Gets the current category object if it's enabled in the settings.
 * @returns {object | null} The category object or null.
 */
export function getCurrentEnabledCategoryInfo() {
  parseSettings();
  const discoveryService = lookup("service:discovery");
  if (!discoveryService?.category) return null;
  const category = discoveryService.category;
  return _enabledCategories.includes(category.id) ? category : null;
}

/**
 * Gets the current tag name from the route or URL if it's an enabled tag.
 * @returns {string | null} The tag name or null.
 */
export function getCurrentEnabledTagName() {
  parseSettings();
  if (_enabledTags.length === 0) return null;

  const routerService = lookup("service:router");
  const currentRouteName = routerService?.currentRouteName;

  // Check if we're on a tag page (handle variations like 'tags.show' or 'tag.show')
  if (!currentRouteName || !currentRouteName.includes("tag")) return null;

  // Prefer getting tag from controllers
  const tagsShowController = lookup("controller:tags.show");
  const tagShowController = lookup("controller:tag.show");
  let currentTag;

  if (tagsShowController?.tag) {
    currentTag = tagsShowController.tag;
  } else if (tagShowController?.tag) {
    currentTag = tagShowController.tag;
  } else {
    // Fallback: try to extract tag from URL path
    const path = window.location.pathname;
    const tagMatch = path.match(/\/tag(?:s)?\/(?:intersection\/|c\/)?(?:[^\/]+\/)*([^\/]+)/);
    if (tagMatch && tagMatch[tagMatch.length - 1]) { // Get last capture group
      currentTag = decodeURIComponent(tagMatch[tagMatch.length - 1]);
    }
  }

  // Return the tag only if it's in our enabled list
  return currentTag && _enabledTags.includes(currentTag) ? currentTag : null;
}

/**
 * Checks if the current page is an enabled category page.
 * @returns {boolean}
 */
export function isEnabledCategoryPage() {
    return getCurrentEnabledCategoryInfo() !== null;
}

/**
 * Checks if the current page is an enabled tag page.
 * @returns {boolean}
 */
export function isEnabledTagPage() {
  return getCurrentEnabledTagName() !== null;
}

/**
 * Checks if the component should be active based on category OR tag settings.
 * @returns {boolean}
 */
export function shouldEnableForCategoryOrTag() {
  // Ensures settings are parsed before checking
  parseSettings();
  return isEnabledCategoryPage() || isEnabledTagPage();
}

/**
 * Checks if the component should be active based ONLY on tag settings.
 * @returns {boolean}
 */
export function shouldEnableForTagOnly() {
  // Ensures settings are parsed before checking
  parseSettings();
  return isEnabledTagPage();
}

/**
 * Gets the parent category slug for a given category.
 * @param {object} category The category object.
 * @returns {string} The parent slug prefix (e.g., "parent-slug/") or "".
 */
export function getParentCategorySlug(category) {
    if (!category?.parent_category_id) return "";

    const siteCategories = getSiteCategories();
    const parentCategory = siteCategories.find(cat => cat.id === category.parent_category_id);
    return parentCategory ? `${parentCategory.slug}/` : "";
}