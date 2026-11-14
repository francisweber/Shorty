# ADR-0005: Twig page composition with JSON content data

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

Shorty uses Twig as its initial HTML template renderer. The frontend developer should retain direct control over page markup and composition. JSON is intended to keep editorial data separate from component templates, not to replace template authoring.

## Decision

- Page structure is authored directly in template files using the initial Twig renderer.
- Developers decide in the page template which components appear on a page and in which order.
- Pages are not assembled from a JSON array or manifest of component instances.
- JSON supplies content data consumed by concrete component instances, including scalar fields and repeatable arrays.
- Editorial data is organized by page and component instance, not by component type. Reusing a component type requires a distinct instance ID and a distinct JSON file for each use.
- The component instance ID is the basename of its JSON file, stored under the active page's data directory.
- The template invokes the registered component type and names its data instance explicitly, for example \`{{ component('gallery', 'gallery-main') }}\`.
- The component helper resolves the component type and instance data, validates the data against the component contract, and passes an explicit context to the component template.
- Component templates remain reusable and receive explicit data contexts.
- Component instance IDs are stable and meaningful; they are not generated randomly at render time and do not automatically become HTML \`id\` attributes.
- Shorty v1 does not include a visual page editor.
- Template files use the consistent \`.tpl\` extension as defined in ADR-0006.

## Consequences

- Frontend developers work with familiar template composition.
- Page markup and ordering remain visible and explicit in the templates.
- Long editorial content stays out of page templates and can be split into manageable JSON files.
- The same component type can be used repeatedly on a page with independent content.
- The complete page/global data loading lifecycle and exact page-template naming remain implementation details to define.
- A future visual editor would require a deliberate additional design; it is not implied by this decision.
