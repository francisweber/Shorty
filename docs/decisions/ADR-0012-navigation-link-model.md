# ADR-0012: Navigation component and data model

- **Status:** Accepted
- **Date:** 2026-11-10

## Context

A Shorty project may use several navigation experiences: global site navigation, footer and service navigation, language selection, floating utility/navigation panels, page-specific sidebars or in-page jump links, and navigation embedded inside another component. These should not become separate technical systems. Navigation must remain independent of automatic page discovery and sitemap generation, support multiple languages, and allow each project to control presentation and interaction through its components.

## Decision

### Component model and data

- Navigation is a regular registered Shorty component.
- Navigation entries are authored explicitly; Shorty does not automatically generate menu entries from discovered pages.
- Each navigation instance has its own data. Shared navigation data may be stored once and reused rather than duplicated per page.
- Each item has a visible `label` and may have `page`, `url`, `children`, standard link attributes (`target`, `rel`, `title`, `download`), and optional `class` values.
- `page` refers to a stable logical internal page ID. `url` is used for external destinations or local public assets. An item may use one destination type, not both. With neither destination, it is a grouping item. An item may have a destination and children at the same time.
- `children` represents recursive nested navigation. The data model does not impose an arbitrary fixed nesting depth; the rendered presentation must remain usable and accessible.
- Optional `class` values may be set on a navigation instance and individual items. Shorty outputs them without interpreting them. CSS and JavaScript define their meaning. Shorty does not prescribe JSON settings for single/multiple submenu opening, hover/click behaviour, or responsive presentation.

### Inclusion locations

The same registered component is included at the appropriate level:

1. **Layout:** global navigation instances, including header, footer, service, language-selection, and floating/side-mounted navigation or utility panels.
2. **Page:** navigation used only on a particular page, included by that page's template.
3. **Component:** navigation that is part of another component, included by that component's template.

These are inclusion locations, not different navigation systems. Components may compose other registered components.

A layout configuration references global navigation instance IDs and assigns them to layout positions. It contains no menu content. Different layouts may reference different instances, and instances may be reused. Positions are optional; an absent position or reference renders nothing. The exact configuration file location and schema remain to be defined.

### Presentation, interaction, and accessibility

- Navigation template, styling, responsive presentation, and interaction behaviour belong to the navigation component.
- Desktop and mobile behaviour (including hover, click/tap, dropdown, off-canvas, and submenu interaction) is implemented by the component's template, CSS/SCSS, JavaScript, and classes, not by fixed Shorty JSON settings.
- The component must provide semantic and keyboard-accessible navigation. Relevant state/relationship attributes such as `aria-expanded` are generated as needed. Optional accessibility labels and descriptive attributes may be omitted without causing rendering or interaction failures.

### Navigation states

The component derives three presentation states from the current logical page and the navigation tree:

- `active`: the item's internal page is the current page;
- `active-parent`: the item is an ancestor of the current page in the menu tree;
- `default`: neither condition applies.

The state calculation is separate from visual styling.

### Multilingual behaviour

- Navigation data is language-specific. A logical navigation instance may have separate files for each language, for example `data/shared/components/navigation-main/de.json` and `en.json`.
- The layout references the logical navigation instance; Shorty loads the data for the active language.
- Menu structure and labels may differ between languages. Internal `page` references continue to use stable logical page IDs and are resolved against the active language.
- Not every logical page must exist in every language.
- If an internal target exists in the project but not in the active language, the menu item is omitted and an informational build-log message is emitted. The build continues. If the item has valid children, it remains as a non-linked grouping item; a grouping item with no valid destination and no remaining children is omitted. Sibling items are unaffected.
- External `url` destinations are retained; Shorty does not infer whether their content is translated.
- If the active language's navigation data file is missing, that navigation instance is omitted for that language and an informational message is logged. There is no warning, build failure, or silent fallback to another language.

### Diagnostics and optional values

Missing optional navigation positions, optional attributes, classes, and other optional data must not cause a build or rendering failure. Shorty distinguishes errors, warnings, and informational messages according to the consequence of the condition. Missing optional navigation language data and language-specific page targets are informational conditions. A reference to a logical page that does not exist anywhere in the project produces an actionable build diagnostic.

## Consequences

- A single navigation component supports global, page-specific, and component-internal use.
- Layouts can change global navigation instances without embedding menu data or rewriting navigation markup.
- The project controls appearance and interaction through component implementation and classes rather than a fixed set of Shorty-specific menu settings.
- Menus can vary by language while continuing to reference stable logical page identities.
- Missing optional language-specific content does not prevent a successful build and is never silently borrowed from another language.
- Navigation remains independent of page discovery and XML sitemap generation.
- The exact layout configuration schema, navigation JSON Schema, and detailed asset/component diagnostic policies remain implementation work.
