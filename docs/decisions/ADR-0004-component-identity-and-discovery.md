# ADR-0004: Component identity and project-local discovery

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

Shorty needs automatic component discovery without a manually maintained import list. Every customer project is an independent copy with its own components and lifecycle.

A component needs a stable, unambiguous identifier within its project. The component's technical identity must also be distinct from each concrete use of it on a page.

## Decision

- Components are stored in individual directories directly below the active project's component directory.
- The directory name is the component type's technical ID.
- The ID is derived from the directory name; it is not duplicated as a separately maintained field in the metadata JSON.
- The component metadata file uses the same basename as the directory/component ID, e.g. \`gallery/gallery.json\`.
- The registry automatically discovers and registers components from the active customer project's component directory.
- The registry does not load components from a global catalogue or from the Shorty platform repository at runtime.
- A component must provide its required template (\`.tpl\`), component-named metadata JSON, and SCSS; its JavaScript module and \`assets/\` directory are optional.
- The `.tpl` extension is a consistent filename convention. All `.tpl` templates in Shorty 2.0 contain Twig syntax; the extension does not imply renderer independence or drop-in substitution.
- Discovery/registration validates component metadata and required files and reports invalid components with useful diagnostics.

A component type can be used multiple times on a page. Every use has a separate, stable component instance ID, such as \`gallery-main\` or \`gallery-references\`. The instance ID is not the component type ID and is not generated randomly at render time.

The instance ID is also the basename of the JSON file that contains the instance's editorial data. Those files are stored with the page's data, not in the component implementation directory.

Example:

\`\`\`text
components/
└── gallery/
    ├── gallery.json
    ├── gallery.tpl
    └── gallery.scss

data/
└── pages/
    └── home/
        └── components/
            ├── gallery-main.json
            └── gallery-references.json
\`\`\`

A template invokes the component type and names the data instance:

\`\`\`twig
{{ component('gallery', 'gallery-main') }}
{{ component('gallery', 'gallery-references') }}
\`\`\`

The instance ID does not automatically become an HTML \`id\` attribute. The component uses reusable CSS classes; an HTML ID is emitted only when explicitly required and must be unique in the document.

## Consequences

- Component type IDs are predictable from their paths.
- A component can be reused multiple times on a page without confusing its identity with the component type.
- Each instance has an explicit, traceable content file.
- Editorial content remains independent of reusable component implementation.
- Developers do not have to maintain a central import list.
- Customer projects remain self-contained.
