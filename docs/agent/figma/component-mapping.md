# Mapping Figma Designs to Shorty Components

## Purpose and status

This document defines a proposed, agent-independent decision process for translating analyzed Figma design structures into existing Shorty project concepts. It does not implement a Figma connector, importer, synchronization mechanism, or new Shorty component contract.

Use the evidence and unresolved questions from [design analysis](design-analysis.md), the actual project inventory, and the implemented [Shorty component model](../core/component-model.md). Figma is authoritative for the design; Shorty contracts are authoritative for implementation.

## 1. Inspect the target project before mapping

Resolve the project root and configured paths. Inspect:

- existing registered component types, metadata, data schemas, Twig, SCSS, optional JavaScript and assets;
- existing pages, Twig composition, instance IDs and page-local instance JSON;
- project-specific design tokens, naming, responsive conventions and reusable patterns;
- existing usages of candidate components, including any compatibility constraints;
- Git state and unrelated edits that must remain untouched.

Do not assume that the neutral Shorty scaffold ships with a design system or a ready-made UI component library.

## 2. Choose the correct implementation level

A Figma object is not necessarily a Shorty component. Decide which existing Shorty concept fits its responsibility:

| Design structure | Likely Shorty responsibility | Decision criterion |
| --- | --- | --- |
| Complete page or screen | Page Twig composition, layout and page data | Defines ordering and arrangement of multiple independent regions |
| Reusable self-contained design unit | Registered Shorty component | Has a stable responsibility, meaningful data contract and expected reuse |
| Repeated use of a component with different text or media | Component instance with page-local JSON | Same implementation, different editorial content |
| Internal repeated markup inside one component | Twig partial or internal template structure | Reuse is internal; no independent component contract needed |
| Shared color, type or spacing value | Existing project styling/token conventions | Visual property, not a renderable component |
| Decorative or editorial image | Component asset or project asset, according to ownership | Intrinsic implementation asset versus instance-specific content |
| Interaction or state | Existing component implementation and optional JavaScript | Behavior is evidenced and fits the component's responsibility |

This table is guidance, not an automatic Figma-node-to-file conversion rule. Figma frames, groups and nested instances may span multiple Shorty responsibilities.

## 3. Decide: reuse, extend, create, or compose

For each candidate design unit, evaluate in this order.

### A. Reuse an existing component

Prefer reuse when its semantic role, supported data contract, layout and behavior satisfy the design without breaking existing usages. Differences in text, imagery or other supported fields usually require another instance, not a new component type.

Confirm that the current schema can represent the required instance data. Do not force content into unrelated fields merely to avoid a new component.

### B. Extend an existing component

Consider extension when the candidate shares a stable responsibility with an existing component but needs a coherent additional capability. Review all current usages and the effect on metadata, data schema, template, styles and JavaScript.

Prefer backward-compatible additions where possible. A design difference alone does not justify extending a generic component into an unrelated collection of features. Do not invent a universal Shorty variants API; component-specific data or styling choices must follow implemented contracts and explicit project decisions.

### C. Create a new registered component

Create a new component when the design represents an independently meaningful unit that cannot be implemented cleanly by reuse or a justified extension. Define its role, data fields, semantics, assets and behavior before choosing a component type ID.

The registered type must follow the existing directory and file contracts: a component directory with matching metadata JSON, Twig template and SCSS; optional JS/assets only when needed.

### D. Compose or use a partial

If the design describes a whole page, arrange components in page Twig rather than creating a monolithic component solely because Figma has one top-level frame. For internal markup shared only within a component, consider a partial rather than creating another registered type.

A nested Figma component does not automatically require a nested registered Shorty component. Conversely, a repeated region can deserve a registered component even if the Figma file did not define it as one.

## 4. Keep type, instance and content separate

- **Component type ID:** project-local registered implementation, derived from its component directory name.
- **Component instance ID:** stable identifier for one use on one page.
- **Instance JSON:** editorial data for that use, validated against the component's dataSchema.
- **Page Twig:** composition, order and placement.
- **Figma component/node identity:** design provenance, not a replacement for a Shorty type or instance ID.

One Figma design component may map to one reusable Shorty type used across many instances. Several design nodes may map to one component; one complex Figma frame may map to several components and page composition. Record these relationships explicitly without assuming one-to-one identity.

## 5. Evaluate visual differences and variants

Distinguish:

1. content differences handled by instance JSON;
2. layout or appearance differences supported by existing project conventions;
3. real behavior/state differences requiring implementation work;
4. genuinely different responsibilities requiring separate components.

Inspect Figma variants and properties as evidence, but do not assume a Shorty Core variant mechanism exists. The representation of variants and states is a separate design topic in [variants and states](variants-and-states.md) (planned).

A mobile design is not automatically a separate component. Prefer one coherent responsive implementation where the evidence and component responsibility support it. Missing breakpoints or mobile behavior must remain explicit questions; see [responsive design](responsive-design.md) (planned).

## 6. Preserve Figma provenance without inventing metadata

ADR-0015 requires every imported component to be associated with a unique Figma component ID. However, the current component metadata schema has additionalProperties set to false and defines no Figma ID property.

Therefore:

- record observed Figma IDs in the reviewable analysis/mapping artifact for planning;
- do **not** write a figmaComponentId property into current component metadata;
- do **not** invent a persistent sidecar mapping convention;
- flag persistent identity storage as a prerequisite for automated import and regeneration.

The eventual source-identity storage and synchronization contract require an explicit technical decision.

## 7. Mapping proposal format

For every proposed implementation unit, record:

| Field | Meaning |
| --- | --- |
| Design reference | Figma file/page/frame/node/component ID, when available |
| Evidence | Observed role, content, variants, layout, behavior and assets |
| Proposed Shorty level | Page/layout, registered component, instance, partial, styling or asset |
| Decision | Reuse, extend, create or compose |
| Target | Existing Shorty component type and affected instances, or proposed new type |
| Rationale | Why this is the smallest maintainable choice |
| Data and behavior | Required fields, states and interactions; existing schema compatibility |
| Impact | Affected pages, other component instances and potential breaking changes |
| Confidence and gaps | Observed facts, assumptions, missing evidence and approvals |
| Validation plan | Component validation, project validation, build and visual review as applicable |

This is a conceptual review format, not a mandated JSON schema or project file path.

## 8. Mapping review and exit criteria

Before implementation, verify that:

- the proposal is traceable to actual inspected Figma evidence;
- the current Shorty project inventory was examined;
- reuse was evaluated before creating new types;
- page composition, components, instances and partials are not conflated;
- instance data is separate from component implementation;
- proposed schema or behavior changes identify affected existing usages;
- uncertain responsive, state and interaction requirements are not presented as facts;
- source identity persistence and other unresolved platform contracts are not silently invented;
- each proposed change has a validation and review plan.

If a major mapping choice is ambiguous, present the alternatives and request a decision. Do not generate code from an unapproved, high-impact assumption.

## Next stage

Once the mapping is approved, follow [implementation workflow](../implementation-workflow.md) and the existing Shorty technical contracts. Detailed Figma-specific implementation and regeneration procedures remain planned, not implemented.
