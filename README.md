# Discourse Ideas Portal Theme Component

A theme component for Discourse that transforms categories into idea portals with features like:

- Status visualization chart for ideas
- Tag-based filtering and categorization
- Custom navigation links
- Mobile-responsive design

## Structure

The component is organized into:

- **Services** - Data handling and API calls
- **Components** - UI components
- **Controllers** - State management
- **Templates** - Handlebars templates
- **Styles** - Modular CSS

## Styles

Styles are organized following the Discourse theme component standard:

- `common/` - Base styles, visualizations, and tag filters
- `desktop/` - Desktop-specific styles
- `mobile/` - Mobile-specific styles

## Configuration

In the theme settings, configure:

- `ideas_portal_categories` - IDs of categories to transform into idea portals (comma-separated)

## Status Tags

The component recognizes the following status tags:

- `new` - New ideas
- `under-review` - Ideas under review 
- `planned` - Planned ideas
- `in-progress` - Ideas in progress
- `completed` - Completed ideas
- `not-planned` - Ideas not planned for implementation
- `already-exists` - Ideas that already exist