// javascripts/discourse/lib/ideas-portal-helper.js

/* ===========================================================================
 *  Ideas‑Portal Helper – *simplified*
 *  Keeps only the utilities still required by the new architecture.
 *  New exports:
 *    • STATUS_TAGS – canonical list of status tags
 *    • reorderStatusTag(tags) – returns new array with the status tag first
 * ==========================================================================*/

export const STATUS_TAGS = [
  "new",
  "under-review",
  "planned",
  "in-progress",
  "completed",
  "not-planned",
  "already-exists",
];

// Map → prettified names (still used by legacy bits & visualisation)
export const TAG_MAP = {
  "new": "New",
  "under-review": "Under Review",
  "planned": "Planned",
  "in-progress": "In Progress",
  "completed": "Completed",
  "not-planned": "Not Planned",
  "already-exists": "Already Exists",
};

/**
 * Move the first status tag (if present) to the front of the array.
 *
 * @param {Array<string>} tags
 * @returns {Array<string>}
 */
export function reorderStatusTag(tags) {
  if (!Array.isArray(tags)) {
    return tags;
  }

  const firstStatus = tags.find((t) => STATUS_TAGS.includes(t));
  if (!firstStatus) {
    return tags;
  }

  return [firstStatus, ...tags.filter((t) => t !== firstStatus)];
}

// ---------------------------------------------------------------------------
//  Settings helpers (unchanged)
// ---------------------------------------------------------------------------
let _enabledCategories = null;
let _enabledTags = null;

function parseSettings() {
  if (_enabledCategories === null) {
    _enabledCategories = settings.enabled_categories
      ? settings.enabled_categories
          .split("|")
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id))
      : [];
  }

  if (_enabledTags === null) {
    _enabledTags = settings.enabled_tags
      ? settings.enabled_tags
          .split("|")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : [];
  }
}

export function resetCache() {
  _enabledCategories = null;
  _enabledTags = null;
}

// ---------------------------------------------------------------------------
//  Category / Tag context helpers
// ---------------------------------------------------------------------------
export function getCurrentEnabledCategoryInfo(container) {
  if (!container || typeof container.lookup !== "function") {
    return null;
  }
  parseSettings();

  const discoveryService = container.lookup("service:discovery");
  if (!discoveryService?.category) {
    return null;
  }

  const category = discoveryService.category;
  return _enabledCategories.includes(category.id) ? category : null;
}

export function getCurrentEnabledTagName(container) {
  if (!container || typeof container.lookup !== "function") {
    return null;
  }
  parseSettings();
  if (_enabledTags.length === 0) {
    return null;
  }

  const routerService = container.lookup("service:router");
  const currentRouteName = routerService?.currentRouteName;
  if (!currentRouteName || !currentRouteName.includes("tag")) {
    return null;
  }

  const tagsShowController = container.lookup("controller:tags.show");
  const tagShowController = container.lookup("controller:tag.show");
  let currentTag;

  if (tagsShowController?.tag) {
    currentTag = tagsShowController.tag;
  } else if (tagShowController?.tag) {
    currentTag = tagShowController.tag;
  } else {
    // Fallback: parse from URL
    const path = window.location.pathname;
    const tagMatch = path.match(
      /\/tag(?:s)?\/(?:intersection\/|c\/)?(?:[^\/]+\/)*([^\/]+)/
    );
    if (tagMatch && tagMatch[tagMatch.length - 1]) {
      try {
        currentTag = decodeURIComponent(tagMatch[tagMatch.length - 1]);
      } catch {
        currentTag = null;
      }
    }
  }

  return currentTag && _enabledTags.includes(currentTag) ? currentTag : null;
}

export function isEnabledCategoryPage(container) {
  return getCurrentEnabledCategoryInfo(container) !== null;
}

export function isEnabledTagPage(container) {
  return getCurrentEnabledTagName(container) !== null;
}

export function shouldEnableForCategoryOrTag(container) {
  parseSettings();
  return isEnabledCategoryPage(container) || isEnabledTagPage(container);
}

/* ---------------------------------------------------------------------------
 *  The remaining functions (getParentCategorySlug, etc.) are still required
 *  by ideas‑portal.js. They have not been changed and are left intact.
 * ------------------------------------------------------------------------ */
function getSiteCategories(container) {
  const site = container.lookup?.("site:main");
  return site?.categories || [];
}

export function getParentCategorySlug(container, category) {
  if (!category?.parent_category_id) {
    return "";
  }
  const siteCategories = getSiteCategories(container);
  const parentCategory = siteCategories.find(
    (cat) => cat.id === category.parent_category_id
  );
  return parentCategory?.slug ? `${parentCategory.slug}/` : "";
}
