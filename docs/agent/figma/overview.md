# Figma-to-Shorty Integration Overview

## Status and purpose

This document describes a **planned**, agent-independent design translation workflow. It is guidance for future integration work, not evidence that Figma connectivity, automatic component import, or synchronization already exists.

Figma is the initial design source. Shorty is the implementation target. An external agent (for example Codex or Claude Code) interprets the design and produces reviewable Shorty project source using existing Shorty contracts. No agent runtime is embedded in Shorty.

This document follows [ADR-0015](../../decisions/ADR-0015-figma-to-shorty-agent-independent-design-integration.md) and the [agent knowledge principles](../README.md).

## Boundaries

- **Figma:** source of design facts, component identities, variants, frames, visual constraints, tokens and available assets.
- **Shorty:** source of technical truth for project structure, components, Twig composition, JSON data, SCSS, assets, validation and builds.
- **External agent:** analysis, interpretation, mapping, implementation proposal and reporting. Agent-specific instructions must only point to shared knowledge.
- **Customer project:** its own design system, existing Shorty component inventory, selected Figma sources and approved decisions.

Do not copy the Figma node hierarchy mechanically into HTML. Prefer a semantic, maintainable implementation that reuses the project's existing components and design conventions.

## Proposed translation stages

1. **Discover the project.** Establish Shorty version, configuration, component inventory, source/output boundaries and working tree state using [project discovery](../project-discovery.md).
2. **Acquire selected design evidence.** Identify the exact Figma file, page, frames and component nodes in scope. Use supported Figma interfaces when available, including Figma MCP. Do not claim access to nodes or assets that were not retrieved.
3. **Analyze the design.** Record observed structure, typography, spacing, colors, assets, variants, constraints and responsive evidence. Separate facts from interpretations and unknowns using [design analysis](design-analysis.md).
4. **Map to Shorty.** Compare design elements with existing project components. Propose reuse, extension or creation; distinguish component definitions from page-level composition and instance data. See planned [component mapping](component-mapping.md).
5. **Resolve gaps.** Obtain or explicitly document decisions for ambiguous behavior, missing mobile layouts, states, accessibility and content before implementing assumptions with significant consequences.
6. **Implement in source.** Apply approved mapping through the existing Shorty component, Twig, data, styling and asset contracts. No parallel design runtime or unapproved metadata convention.
7. **Validate and review.** Use the project's available Shorty validation/build commands; inspect the output visually against Figma when a reliable comparison method is available. Report what was and was not checked.
8. **Handle later changes safely.** Treat design updates as a separate reviewable operation. Any replacement candidate must be isolated and validated before replacing a working component.

These are proposed process stages, not a claim of a fully automated pipeline.

## Expected handoff between stages

The analysis stage should provide a structured, human-readable design brief containing:
- exact source references and inspected scope;
- observed design structure and available component identities;
- design tokens and assets with source references where obtainable;
- responsive and interaction evidence;
- explicit assumptions, unknowns and questions;
- proposed implementation units, without prematurely assigning Shorty files.

Component mapping then records proposed Shorty reuse/extension/creation and a rationale for each decision. Implementation must not begin by treating unverified interpretations as established design requirements.

No mandatory machine-readable Figma analysis format or project context filename is established here.

## Open decisions and implementation dependencies

- **Source identity:** ADR-0015 requires unique Figma component IDs to be recorded for imported components. The current Shorty component metadata schema rejects unknown top-level fields and does not define a Figma ID field. Storage and schema evolution require a separate decision; do not invent a field or sidecar format.
- **Variants and responsive rules:** no universal Shorty variants contract or automatic breakpoint inference has been agreed.
- **Regeneration:** isolated candidate generation and validation are required in principle, but comparison, conflict resolution, manual edits and replacement approval are not yet specified.
- **Tool access:** available Figma interfaces and their permissions must be established per environment. The documentation itself provides no connection.
- **Automation:** a complete machine-readable CLI contract and extension lifecycle are not yet implemented.

These decisions must not delay the Core release; the integration remains an optional future extension under [ADR-0016](../../decisions/ADR-0016-shorty-2-release-scope-and-extensions.md).

## Related guidance

- [Design analysis](design-analysis.md)
- [Core project structure](../core/project-structure.md)
- [Core component model](../core/component-model.md)
- [Implementation workflow](../implementation-workflow.md)
