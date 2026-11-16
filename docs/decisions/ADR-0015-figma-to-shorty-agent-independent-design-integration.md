# ADR-0015: Figma-to-Shorty: Agent-independent design integration

- **Status:** Accepted
- **Date:** 2026-11-13
- **Scope clarification:** 2026-11-16 — full-page design translation and phased delivery
- **Related:** [ADR-0013](ADR-0013-external-ai-agent-compatibility.md)

## Context

Shorty is intended to bridge AI-assisted frontend development, design sources and maintainable HTML output while remaining usable without AI tooling. The integration must support translating **complete Figma page designs**, not just isolated design components, into ordinary Shorty project source. Shared Shorty conventions must remain agent-independent.

This decision records the agreed direction for future planning. It does not authorize or describe a current implementation.

## Decision

- Figma is the initial planned design source.
- The integration will use available Figma interfaces, including Figma MCP, subject to actual access and permissions.
- Codex and Claude Code are equally supported clients. The design must not depend on either agent exclusively.
- Shorty remains fully usable without AI agents. Shorty will not include its own AI agent or agent orchestration.
- Shared Shorty rules, project conventions and technical component knowledge belong centrally in the repository and must be agent-independent.
- Agent-specific configuration is a thin integration layer, not the authoritative home of Shorty conventions.
- The **first useful integration target is translation of a complete selected Figma page design** into a maintainable Shorty project page, including reuse or creation of components, Twig page composition, instance JSON, styling and applicable assets/behavior.
- Translation must preserve the existing Shorty project contracts and must not mechanically export Figma layer trees as HTML.

## Phased delivery

1. **Component proof of concept:** inspect one selected Figma component, map it against the target project's inventory and implement it using existing Shorty component contracts. Validate and compare the output.
2. **First useful integration — complete page:** inspect one bounded Figma page design, reuse/extend/create components as appropriate, compose the page in Twig and supply instance data, styles, assets and responsive behavior supported by evidence. Validate and review the rendered page.
3. **Later extension — controlled regeneration:** detect subsequent design changes and generate isolated replacement candidates for review, without overwriting working source or manual changes automatically.

The first two stages do not require automatic Figma-to-Shorty synchronization. Stage three is deferred until its provenance, conflict, approval and replacement contracts are resolved.

## Component and page mapping

- Figma components are design evidence and may map to existing or new standalone Shorty component types, component instances, internal partials, styling rules or other appropriate project structures.
- A selected Figma page/frame may map to Shorty page Twig composition, a shared layout, multiple reusable components, page-local component instance JSON and project assets. A Figma page or frame is not automatically one registered Shorty component.
- Shorty does not prescribe a domain-specific or product-specific component library. The external agent first inspects and reuses the customer project's existing components where suitable.
- Shorty component type IDs and page-local instance IDs remain separate from Figma identities. The agent must record traceable Figma source references for imported designs.
- The intended provenance relationships may include Figma file to project, page/frame to Shorty page, source component to component type, and Figma instance to Shorty instance. These are not necessarily one-to-one.
- The storage format and placement of design-source identity and mappings remain undecided. The current component metadata schema does not accept an undocumented Figma field; this ADR does **not** introduce a metadata field or sidecar format.

## Regeneration and safety

- By default, a later change to a mapped Figma component leads to a proposal for full regeneration of that component's implementation, subject to the applicable scope and mapping.
- Regeneration is isolated: the agent creates a candidate separately and validates it before any replacement of working source.
- A validated candidate is not automatically authorized for promotion. Manual code edits, compatibility, approval, rollback and source-to-page synchronization require further decisions.
- Existing working implementations remain in place when candidate generation, validation or required approval is incomplete.
- Full-page regeneration and its handling of shared components, page composition and instance content are not yet specified.

## Consequences

- Shared design integration knowledge must cover page analysis, component mapping, responsive behavior, variants, implementation and safe regeneration.
- Agents must produce ordinary, editable Shorty source using the project's established Twig, metadata/data schema, SCSS, optional JavaScript and assets.
- Figma source identity must be traceable at both page and component levels for review; persistent storage and automated synchronization require a separate technical decision.
- The integration should be assessed using real component and page proof-of-concept exercises, with technical validation and explicit visual review.
- Shorty Core remains independent of Figma connectivity and agent orchestration. Whether optional design provenance belongs in Core metadata or project-level integration data is not decided by this ADR.
- The optional integration must not block the Shorty 2.0 Core release scope under [ADR-0016](ADR-0016-shorty-2-release-scope-and-extensions.md).

## Out of scope

- Implementing a Figma connection or configuring Figma MCP in this ADR.
- Choosing a concrete design-source mapping schema or persistence location.
- Choosing detailed synchronization, variant-mapping or manual-edit reconciliation behavior.
- Building an AI agent, agent orchestrator or agent-specific component library.
- Automatically importing arbitrary Figma files without explicit scope, review and validation.
