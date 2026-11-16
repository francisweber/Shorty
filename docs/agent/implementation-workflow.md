# Implementation Workflow

This document defines how an external development agent plans and implements changes in a Shorty project after completing [Project Discovery](project-discovery.md).

It is shared guidance for different agents and customer projects. It does not prescribe a particular design system, component library, Figma file, or agent runtime.

## 1. Purpose and entry conditions

Implementation begins only after the agent understands the target project well enough to make a safe change.

Before proceeding, the agent should know:

- the requested outcome and acceptance criteria;
- the target project root and installed Shorty version;
- the relevant configuration and resolved source paths;
- the existing pages, layouts, components, data, and styles involved;
- the validation and build commands available in the environment;
- any existing user changes that must be preserved.

If a missing fact could materially change the implementation, ask a focused question rather than inventing an answer.

## 2. Translate the request into an implementation brief

Restate the task as an implementation brief with:

- **Outcome:** what should be different when the work is complete.
- **Scope:** which page, component, behavior, or project area is involved.
- **Acceptance criteria:** observable conditions that define success.
- **Constraints:** Shorty contracts, existing project conventions, browser/runtime requirements, and user requirements.
- **Out of scope:** nearby improvements that are not required.

For visual tasks, distinguish structural requirements from visual styling and interactive behavior. For design-source tasks, distinguish what is explicitly represented in the source from behavior that must be inferred or clarified.

Do not turn a broad visual reference into an unbounded redesign.

## 3. Map the implementation before editing

Identify the source files that own each part of the requested behavior.

Typical responsibilities include:

| Concern | Likely source |
| --- | --- |
| Page composition and component order | Page Twig template |
| Shared page shell | Layout Twig template |
| Reusable component markup | Component .tpl |
| Component metadata and data contract | Component <id>.json |
| Editorial content for a component instance | Page-local component instance JSON |
| Component styling | Component .scss |
| Component interaction | Optional component .js |
| Shared styles and assets | Configured project asset sources |
| Project-wide data | Appropriate project-level data files |

These are conventions, not permission to assume a path. Resolve paths from the target project's configuration and inspect the actual files before editing.

Trace dependencies in both directions where useful: what the target file uses, and what pages or components depend on it.

## 4. Decide whether to reuse, extend, or create

For each requested element, make an explicit choice.

### Reuse an existing component

Reuse when an existing component already provides the required semantic structure and behavior, and its data contract can represent the requested content without distortion.

Prefer supplying a new component instance with its own stable instance ID and page-local data over duplicating the component implementation.

### Extend an existing component

Extend when the new requirement is a natural responsibility of the existing component and can be expressed without making its purpose unclear or breaking existing instances.

Before changing a data schema or template, inspect all relevant instances and identify compatibility implications. Preserve existing behavior and content unless the task explicitly requires changing them.

### Create a new component

Create a new component when the requested element has a distinct reusable responsibility or cannot be represented cleanly by an existing component.

Follow the current Shorty component convention:

- one directory per component type directly under the configured components directory;
- directory name is the stable component type ID;
- metadata filename matches the directory name;
- required metadata JSON, Twig template (.tpl), and SCSS (.scss);
- optional JavaScript (.js) and component-owned assets.

Use the supported shorty component:create command when available and appropriate. Inspect its generated output rather than assuming it matches every desired implementation detail.

Do not create a global component catalogue or runtime dependency on the Shorty platform repository. Components belong to the active customer project.

## 5. Respect the component and page data model

Shorty distinguishes reusable component types from concrete component instances.

- A **component type ID** identifies the implementation and is derived from its component directory.
- A **component instance ID** identifies one use of that type in a page context.
- The instance ID is used in the page-local JSON filename and is passed explicitly when invoking the component.

Page composition is authored in Twig templates. Component instance JSON supplies content data; it is not a page-composition manifest.

For example, a page template may invoke a component type and a named instance:

    {{ component('gallery', 'gallery-main') }}

The matching page-local data file supplies the content for that instance.

Do not:

- duplicate a component type just to display different content;
- use random or render-time instance identifiers;
- put page composition into a JSON array instead of the established Twig structure;
- make a component silently depend on undeclared parent-template variables;
- treat an instance ID as an HTML id attribute automatically.

## 6. Define the data contract before writing markup

For a new or extended component, identify the data the component needs before implementing its template.

The component metadata file contains the component's data schema. The current metadata v1 contract requires:

- metadataVersion;
- name;
- description;
- category;
- dataSchema.

The checked-in schemas/component-metadata.schema.json is authoritative for the metadata envelope. The embedded dataSchema uses JSON Schema Draft 2020-12.

Design the data contract deliberately:

- use clear, stable property names;
- choose appropriate JSON types;
- distinguish required from optional data;
- define array item structures explicitly;
- constrain values where the requirement is clear;
- reject unexpected properties where appropriate;
- keep editorial content separate from implementation details.

Do not add undocumented metadata fields. The current metadata schema rejects unknown root properties. If the task requires additional metadata such as a Figma source identifier, treat that as a contract gap requiring an explicit design decision; do not silently add the property or invent a sidecar format and claim it is standard.

Where possible, validate example instance data against the schema before implementing the full template.

## 7. Implement markup, styling, and behavior

Implement each responsibility in its appropriate source file.

### Twig template

- Use the project's established Twig conventions.
- Render the data defined by the component contract.
- Keep component markup focused on the component's responsibility.
- Use semantic HTML appropriate to the content and interaction.
- Handle optional data deliberately rather than relying on accidental truthiness.
- Keep reusable internal fragments as partials when they do not need independent component identity.

### SCSS

- Follow existing project naming and organization conventions.
- Reuse established design tokens and shared variables where they exist.
- Avoid introducing duplicate global tokens or competing styling systems.
- Scope component styles to the component and avoid unintended global effects.
- Implement responsive behavior based on known project conventions and verified requirements.

### JavaScript

- Add JavaScript only when the component requires client-side behavior.
- Follow the project's existing module and initialization patterns.
- Keep behavior scoped to the component and safe when multiple instances appear on one page.
- Do not add JavaScript merely to reproduce behavior that belongs in semantic HTML or CSS.
- Do not introduce a new runtime dependency without a clear need and approval where appropriate.

### Assets

- Keep component-owned assets with the component where that matches the project convention.
- Use shared project assets for genuinely shared resources.
- Preserve licensing and attribution requirements for supplied assets.
- Do not invent asset paths or assume that an external URL will remain available.

## 8. Implement visual references as evidence, not as hidden requirements

When a task uses Figma or another visual reference, separate observation from interpretation.

Record, where relevant:

- source frame or component identity;
- visible structure and hierarchy;
- dimensions and spacing values available from the source;
- typography and color values;
- variants and component properties;
- responsive frames or constraints;
- interactive states and transitions;
- assets and dependencies.

Do not assume that a single static frame defines responsive behavior, interaction states, accessibility behavior, or content edge cases.

If the source does not provide enough information, mark the behavior as unknown or propose a clearly identified assumption for review.

The detailed Figma inspection and mapping rules belong in the dedicated Figma knowledge documents, not in project-specific implementation shortcuts.

## 9. Keep changes coherent and bounded

Group changes by responsibility and avoid unrelated cleanup.

Before finishing implementation:

- check that every new file is necessary;
- remove temporary artifacts created during the task;
- verify references between templates, metadata, data, styles, scripts, and assets;
- ensure new instance IDs are unique in their page context;
- check that existing component instances remain compatible;
- avoid editing generated output as a substitute for source changes.

Do not change Shorty Core, platform schemas, or shared agent guidance as a workaround for a customer-project implementation problem. Platform-level changes require a separate, explicit task and the appropriate architectural review.

## 10. Handle breaking changes deliberately

A change is potentially breaking when it alters a component's required data, removes or renames a field, changes expected markup hooks, changes behavior relied on by existing pages, or changes a shared styling/API convention.

For a potentially breaking change:

1. Find all known uses of the affected component or contract.
2. Identify which instances or pages need migration.
3. Decide whether backward compatibility can be preserved.
4. Describe the migration before applying it.
5. Update all in-scope uses consistently.
6. Validate the affected components and the complete project.

Do not silently make a breaking schema change and leave existing instance data behind.

## 11. Prepare for validation

Implementation is not complete when files have been written.

Before handing over to the [Validation Workflow](validation-workflow.md), ensure:

- all intended source files are present;
- metadata and data contracts are internally consistent;
- references and file names match the component IDs and instance IDs;
- no required asset or script reference is missing;
- existing behavior outside the task scope has been preserved;
- the change is ready for the supported Shorty validation and build process.

If implementation cannot reach this point, report what remains incomplete and why.

## 12. Implementation summary

At the end of implementation, provide a concise summary containing:

- the components reused, extended, or created and why;
- the page/template/data relationships changed;
- the files created or modified;
- any data-contract or compatibility implications;
- assumptions and unresolved questions;
- the validation steps still required.

Do not claim that the implementation is complete or working until the applicable validation has been performed.

## Related documentation

- [Shorty Agent Knowledge](README.md)
- [Agent Working Principles](working-principles.md)
- [Project Discovery Workflow](project-discovery.md)
- [Validation workflow](validation-workflow.md) — planned
- [Component system](../03-component-system.md)
- [Project configuration](../07-project-configuration.md)
- [Machine-readable tooling contracts](../06-machine-readable-tooling-contracts.md)
- [ADR-0004: Component identity and discovery](../decisions/ADR-0004-component-identity-and-discovery.md)
- [ADR-0008: Component instances and page-local content](../decisions/ADR-0008-component-instances-and-page-local-content.md)
- [ADR-0015: Figma-to-Shorty agent-independent design integration](../decisions/ADR-0015-figma-to-shorty-agent-independent-design-integration.md)
