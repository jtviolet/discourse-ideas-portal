// javascripts/discourse/lib/ideas-portal-helper.js

// --- NO LONGER IMPORTING 'lookup' ---
// import { lookup } from "discourse/lib/container"; // REMOVED - Cannot import directly in themes

// --- Private cached variables ---
// Note: Caching siteCategories might be less reliable if accessed across different initializer scopes this way.
// Consider passing siteCategories object directly if needed consistently.
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
 * This function doesn't need the container.
 */
function parseSettings() {
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
 * Caches site categories using the provided container.
 * @param {object} container - The api.container object from the initializer.
 */
function getSiteCategories(container) {
    if (!container || typeof container.lookup !== 'function') {
        console.error("Ideas Portal Helper: Invalid container passed to getSiteCategories.");
        return []; // Return empty array if container is invalid
    }
    if (_siteCategories === null) {
        const site = container.lookup("site:main");
        _siteCategories = site?.categories || [];
    }
    return _siteCategories;
}

/**
 * Resets cached settings and categories.
 */
export function resetCache() {
  _enabledCategories = null;
  _enabledTags = null;
  _siteCategories = null;
}

/**
 * Gets the current category object if it's enabled in the settings.
 * @param {object} container - The api.container object from the initializer.
 * @returns {object | null} The category object or null.
 */
export function getCurrentEnabledCategoryInfo(container) {
  if (!container || typeof container.lookup !== 'function') return null; // Safety check
  parseSettings(); // Ensure settings are parsed

  const discoveryService = container.lookup("service:discovery");
  // Add defensive checks
  if (!discoveryService?.category) {
      // console.debug("Ideas Portal Helper: discoveryService or category not found.");
      return null;
  }
  const category = discoveryService.category;
  return _enabledCategories.includes(category.id) ? category : null;
}

/**
 * Gets the current tag name from the route or URL if it's an enabled tag.
 * @param {object} container - The api.container object from the initializer.
 * @returns {string | null} The tag name or null.
 */
export function getCurrentEnabledTagName(container) {
  if (!container || typeof container.lookup !== 'function') return null; // Safety check
  parseSettings(); // Ensure settings are parsed

  if (_enabledTags.length === 0) return null;

  const routerService = container.lookup("service:router");
  const currentRouteName = routerService?.currentRouteName;

  if (!currentRouteName || !currentRouteName.includes("tag")) return null;

  const tagsShowController = container.lookup("controller:tags.show");
  const tagShowController = container.lookup("controller:tag.show");
  let currentTag;

  // Add checks for controller existence before accessing properties
  if (tagsShowController && tagsShowController.tag) {
    currentTag = tagsShowController.tag;
  } else if (tagShowController && tagShowController.tag) {
    currentTag = tagShowController.tag;
  } else {
    const path = window.location.pathname;
    // Adjusted regex to be potentially more robust
    const tagMatch = path.match(/\/tag(?:s)?\/(?:intersection\/|c\/)?(?:[^\/]+\/)*([^\/]+)/);
    if (tagMatch && tagMatch[tagMatch.length - 1]) {
        try {
            currentTag = decodeURIComponent(tagMatch[tagMatch.length - 1]);
        } catch (e) {
             console.warn("Ideas Portal Helper: Failed to decode tag from URL", e);
             currentTag = null;
        }
    }
  }

  // Check if the resolved tag exists and is in the enabled list
  return currentTag && _enabledTags.includes(currentTag) ? currentTag : null;
}

/**
 * Checks if the current page is an enabled category page.
 * @param {object} container - The api.container object from the initializer.
 * @returns {boolean}
 */
export function isEnabledCategoryPage(container) {
    return getCurrentEnabledCategoryInfo(container) !== null;
}

/**
 * Checks if the current page is an enabled tag page.
 * @param {object} container - The api.container object from the initializer.
 * @returns {boolean}
 */
export function isEnabledTagPage(container) {
  return getCurrentEnabledTagName(container) !== null;
}

/**
 * Checks if the component should be active based on category OR tag settings.
 * @param {object} container - The api.container object from the initializer.
 * @returns {boolean}
 */
export function shouldEnableForCategoryOrTag(container) {
  parseSettings(); // Settings don't need container
  return isEnabledCategoryPage(container) || isEnabledTagPage(container);
}

/**
 * Checks if the component should be active based ONLY on tag settings.
 * @param {object} container - The api.container object from the initializer.
 * @returns {boolean}
 */
export function shouldEnableForTagOnly(container) {
  parseSettings(); // Settings don't need container
  return isEnabledTagPage(container);
}

/**
 * Gets the parent category slug for a given category.
 * @param {object} container - The api.container object from the initializer.
 * @param {object} category - The category object.
 * @returns {string} The parent slug prefix (e.g., "parent-slug/") or "".
 */
export function getParentCategorySlug(container, category) {
    if (!category?.parent_category_id) return "";

    const siteCategories = getSiteCategories(container); // Use container
    const parentCategory = siteCategories.find(cat => cat.id === category.parent_category_id);

    // Defensive check for parent category and its slug
    return parentCategory?.slug ? `${parentCategory.slug}/` : "";
}