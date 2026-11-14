# ADR-0008: Component instances and page-local content

- **Status:** Accepted
- **Date:** 2026-11-10

## Context

A reusable component type can appear more than once on the same page, with different editorial content each time. The component type identifier alone cannot identify an individual use of that component or its content.

Page composition must remain authored directly in templates. JSON provides content data and must not become a page-level manifest that controls component order. Large page-content files should also remain manageable.

## Decision

- Distinguish the **component type ID** from the **component instance ID**.
- The component type ID is derived from the component directory, e.g. \`gallery\`.
- Every use of a component type on a page has its own stable, meaningful instance ID, e.g. \`gallery-main\` or \`gallery-references\`.
- The instance ID is the basename of the JSON file containing that instance's editorial data.
- Instance data files live with the active page's data, under \`data/pages/<page>/components/\`; they do not live inside the reusable component implementation.
- The page template controls composition and invokes the component type with its instance ID, for example:

  \`\`\`twig
  {{ component('gallery', 'gallery-main') }}
  {{ component('gallery', 'gallery-references') }}
  \`\`\`

- The component helper resolves the registered component type, loads the matching page-local JSON file, validates it against the component type's data contract, and passes an explicit data context to the component template.
- Instance IDs are stable and meaningful. They are not randomly generated at render time.
- A component instance ID does not automatically become an HTML \`id\` attribute. Reusable CSS classes identify the component styling; an HTML ID is added only when required and must be unique in the rendered document.
- Component metadata uses a file named after the component directory/type ID, e.g. \`components/gallery/gallery.json\`.

## Consequences

- A component type can be reused multiple times on one page with independent content.
- The template makes the relationship between a component invocation and its content file explicit.
- Editorial content stays page-local and independent of the reusable component implementation.
- The same data contract can validate every instance of a component type.
- The complete page/global data loading lifecycle and exact page-template naming remain implementation details to define.
