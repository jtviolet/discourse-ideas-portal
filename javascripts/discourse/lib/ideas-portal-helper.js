// javascripts/discourse/lib/ideas-portal-helper.js

let _enabledCategories = null;
let _enabledTags = null;
let _siteCategories = null;

// Define TAG_MAP - ensure it's defined before being used
export const TAG_MAP = {
  'new': 'New',
  'under-review': 'Under Review',
  'planned': 'Planned',
  'in-progress': 'In Progress',
  'completed': 'Completed',
  'not-planned': 'Not Planned',
  'already-exists': 'Already Exists',
};

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

function getSiteCategories(container) {
    if (!container || typeof container.lookup !== 'function') {
        console.error("Ideas Portal Helper: Invalid container passed to getSiteCategories.");
        return [];
    }
    // Avoid caching site categories this way as container scope might differ; lookup each time needed.
    // Consider passing site object if needed frequently across different initializers.
    const site = container.lookup("site:main");
    return site?.categories || [];
}

export function resetCache() {
    _enabledCategories = null;
    _enabledTags = null;
    // _siteCategories = null; // Don't reset if not reliably cached
}

export function getCurrentEnabledCategoryInfo(container) {
    if (!container || typeof container.lookup !== 'function') return null;
    parseSettings();
    const discoveryService = container.lookup("service:discovery");
    if (!discoveryService?.category) { return null; }
    const category = discoveryService.category;
    return _enabledCategories.includes(category.id) ? category : null;
}

export function getCurrentEnabledTagName(container) {
    if (!container || typeof container.lookup !== 'function') return null;
    parseSettings();
    if (_enabledTags.length === 0) return null;
    const routerService = container.lookup("service:router");
    const currentRouteName = routerService?.currentRouteName;
    if (!currentRouteName || !currentRouteName.includes("tag")) return null;
    const tagsShowController = container.lookup("controller:tags.show");
    const tagShowController = container.lookup("controller:tag.show");
    let currentTag;
    if (tagsShowController?.tag) {
        currentTag = tagsShowController.tag;
    } else if (tagShowController?.tag) {
        currentTag = tagShowController.tag;
    } else {
        const path = window.location.pathname;
        const tagMatch = path.match(/\/tag(?:s)?\/(?:intersection\/|c\/)?(?:[^\/]+\/)*([^\/]+)/);
        if (tagMatch && tagMatch[tagMatch.length - 1]) {
            try { currentTag = decodeURIComponent(tagMatch[tagMatch.length - 1]); } catch (e) { currentTag = null; }
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

export function shouldEnableForTagOnly(container) {
    parseSettings();
    return isEnabledTagPage(container);
}

export function getParentCategorySlug(container, category) {
    if (!category?.parent_category_id) return "";
    const siteCategories = getSiteCategories(container); // Look up fresh
    const parentCategory = siteCategories.find(cat => cat.id === category.parent_category_id);
    return parentCategory?.slug ? `${parentCategory.slug}/` : "";
}