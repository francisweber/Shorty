# Implementing Approved Figma Designs in Shorty

## Purpose and status

This document defines a proposed, agent-independent implementation procedure for translating **approved** Figma analysis and component mapping into an existing Shorty customer project. It does not implement a Figma connector, import command, extension loader or agent runtime. The general [implementation workflow](../implementation-workflow.md) and Shorty's actual schemas, CLI and source contracts remain authoritative.

The objective is a maintainable, validated Shorty implementation—not a literal export of Figma layers to HTML.

## 1. Required inputs and stop conditions

Before editing, establish:

- the requested page(s), component(s) and acceptance criteria;
- inspected Figma source references and [design analysis](design-analysis.md);
- approved [component mapping](component-mapping.md): reuse, extend, create or compose;
- [responsive decisions](responsive-design.md), [variants and states](variants-and-states.md), and unresolved questions;
- the actual Shorty version, project configuration, source paths, component inventory and Git status;
- available source assets and any usage restrictions.

Do not claim to have inspected Figma properties or downloaded assets unless the environment actually supplied them. If source access is unavailable, work only from clearly identified supplied evidence.

Pause the affected implementation when a missing decision materially changes component responsibility, data contracts, content, behavior or accessibility. Do not silently turn an inference into a requirement.

## 2. Create a bounded implementation plan

For each mapped unit, identify its owner in existing Shorty source:

| Responsibility | Existing Shorty target |
| --- | --- |
| Page-level section order and composition | Page Twig template |
| Shared page shell | Layout Twig template |
| Reusable component markup | Component .tpl |
| Component metadata and instance data contract | Component-named .json metadata and embedded dataSchema |
| Content for one concrete component use | Page-local component instance JSON |
| Component appearance and responsive rules | Component .scss and existing project styling conventions |
| Component interaction | Optional component .js and semantic HTML |
| Component-intrinsic versus editorial assets | Component assets versus project assets, as appropriate |

Resolve all actual paths from the project configuration; the table does not establish literal directories. Identify affected existing instances before extending a shared component. Record which files will change and which are deliberately out of scope.

## 3. Implement in dependency order

### A. Reuse existing components first

Where mapping approved reuse, create or update only the required page composition and instance data. Use stable, page-unique instance IDs. Do not copy a component implementation to accommodate different text, imagery or other supported content.

### B. Define new or extended component contracts

For an approved new component, follow the current Shorty directory identity and required matching files: metadata JSON, Twig template and SCSS. Use the supported component creation command when appropriate and inspect its result.

For an approved extension, inspect every affected use and preserve compatibility where feasible. Define or update the embedded JSON Schema Draft 2020-12 dataSchema before relying on new fields in Twig. Keep metadataVersion, name, description and category consistent with the implemented metadata schema.

Do not add a Figma ID or variants field to the metadata envelope without a separately approved platform contract. Current metadata rejects unknown top-level properties. Record design provenance in the reviewable implementation notes pending a source-identity decision.

### C. Implement semantic Twig and page composition

Build component markup from the approved design role and data contract, not the raw Figma layer tree. Use appropriate semantic HTML and existing project Twig patterns.

Keep component type identity distinct from instance identity. Place top-level component calls in page Twig and editorial content in the corresponding page-local JSON files. Header and footer may be registered components just like hero and content sections; their markup belongs to their own component templates, not the page template. Registered components may compose other registered components (for example, header → navigation) using existing Shorty conventions. Inspect actual runtime and page-context/instance-data resolution before relying on nested calls, and validate nested rendering with a focused test. Internal template fragments may be partials; they do not automatically become registered components.

### D. Apply visual styles and responsive behavior

Reuse the project's established colors, typography, spacing conventions, assets and breakpoints where they meet the design. Implement fluid behavior and the explicitly approved responsive transitions. Do not treat Figma frame widths as automatic CSS breakpoints.

Keep styles scoped and avoid introducing a competing design system. Preserve visual hierarchy without reproducing unnecessary wrappers or absolute positioning merely because Figma uses them.

### E. Implement states and interactions

Distinguish content configuration from runtime state. Prefer native HTML and CSS behavior; add component JavaScript only when required and follow the project's actual module conventions. Make multiple instances work independently.

Review keyboard operation, focus, disabled/error/expanded states and accessible naming as relevant. Do not claim that prototype frames alone define interaction behavior.

### F. Integrate assets

Use retrieved, authorized assets; do not invent export URLs, fonts or file paths. Put component-intrinsic assets with their component where appropriate and instance-specific/editorial media in project assets and data. Keep source references and note missing exports.

## 4. Validate the technical result

Use the commands available in the installed Shorty version and project environment, typically:

    shorty component:validate <component-type>
    shorty validate
    shorty build

Validate each created or modified component where applicable, validate the project, and build pages that exercise the changed instances. The CLI currently emits human-readable output; do not assume a machine-readable result format.

Review component metadata/schema agreement, page Twig calls, stable instance IDs, referenced instance JSON, assets and affected existing uses. A successful project validation command alone does not prove that every component instance was rendered; the build checks referenced instance data in supported component calls.

Do not modify generated output instead of source. Follow the project's safe build/output workflow.

## 5. Review visual and behavioral fidelity

Where inspection tools and a reliable reference are available, compare the built page/component with the inspected Figma design:

- hierarchy, composition, spacing, typography, colors and assets;
- the explicitly supplied viewport sizes plus intermediate/narrow widths;
- documented variants, interaction states and responsive transitions;
- content order, overflow, text wrapping and image behavior;
- keyboard/focus/accessibility behavior where relevant.

Record discrepancies and whether they are defects, intentional semantic adaptations, approved design deviations or unresolved requirements. A passing build does not prove pixel-perfect fidelity or accessibility. Never claim a visual comparison that was not actually performed.

## 6. Review scope, compatibility and provenance

Before proposing completion:

1. Inspect the source diff and remove task-specific temporary artifacts.
2. Confirm unrelated files and user edits were preserved.
3. Verify that existing component instances still satisfy changed data contracts.
4. Record the Figma references used, but do not invent persistent component-to-Figma metadata storage.
5. Identify any required migration or breaking change explicitly.
6. Keep new source changes reviewable in Git; do not auto-merge or overwrite unrelated work without authorization.

Do not modify Shorty Core, shared schemas or platform architecture as a workaround for a customer project's design implementation. Such changes require a separate decision.

## 7. Handoff report

A completed implementation report should include:

- selected Figma sources and which evidence was actually inspected;
- Shorty components reused, extended or created, and mapping rationale;
- page composition, instance data, styles, scripts and assets changed;
- responsive and state decisions implemented, with unresolved assumptions;
- commands run and their actual results;
- visual/interaction checks performed and discrepancies found;
- compatibility impacts, open questions and next steps.

Distinguish **implemented**, **validated**, **built** and **visually reviewed**; these are not interchangeable claims.

## 8. Safe follow-up changes

A later Figma change is not permission to overwrite a working component. Follow the planned [regeneration](regeneration.md) process: inspect differences, preserve existing source, create a separate candidate, validate it, review manual changes and only then consider replacement under an explicit decision. The precise synchronization, manual-change reconciliation and source-identity persistence contracts remain unresolved under ADR-0015.

## Exit criteria

Implementation is ready for handoff when approved mapping has been applied to the correct Shorty source files, contracts and referenced instance data are consistent, applicable validation and build checks have been run and reported, and any missing visual verification or design decision is clearly disclosed.

## Related guidance

- [Figma integration overview](overview.md)
- [Design analysis](design-analysis.md)
- [Component mapping](component-mapping.md)
- [Responsive design](responsive-design.md)
- [Variants and states](variants-and-states.md)
- [Shorty component model](../core/component-model.md)
- [General implementation workflow](../implementation-workflow.md)
- [ADR-0015](../../decisions/ADR-0015-figma-to-shorty-agent-independent-design-integration.md)
