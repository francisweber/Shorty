# Figma Variants, Properties, and States

## Purpose and status

This document defines an agent-independent approach to interpreting Figma component variants, component properties, and interactive states for a future Figma-to-Shorty workflow. It is design integration guidance, **not** a new Shorty Core variants API, an automatic Figma importer, or an implemented state-synchronization system.

Figma supplies observed design evidence. Shorty's existing project-specific components, Twig, JSON data schemas, SCSS, and optional JavaScript remain the implementation mechanisms. Apply [design analysis](design-analysis.md), [component mapping](component-mapping.md), and [responsive design](responsive-design.md) before implementation.

## 1. Inspect what Figma actually defines

For each selected Figma component set or component instance, record when accessible:

- file, page, component set, main component and instance references, including exact IDs;
- variant property names, values and combinations actually defined;
- component properties such as text, boolean, instance swap and other supported properties as exposed by the source;
- default appearance and differences in geometry, typography, colors, icons, content, layout and visibility;
- prototype interactions and transitions, if explicitly present;
- responsive differences supported by distinct frames or constraints;
- missing, inconsistent or uninspectable combinations.

Distinguish **observed** values from **inferred** behavior, **unknown** requirements, and **approved** implementation decisions. A Figma property name is not automatically a Shorty data field or CSS class name.

## 2. Classify each variation by responsibility

A Figma variant may represent different kinds of changes. Do not treat all variants alike.

| Variation | Typical interpretation | Possible existing Shorty mechanism |
| --- | --- | --- |
| Text, image or icon content | Editorial difference between instances | Page-local instance JSON, if supported by the component schema |
| Size or visual emphasis | Presentation option | Existing component SCSS conventions and explicitly designed component data fields where appropriate |
| Icon presence or placement | Content plus layout option | Existing template and data contract, when semantically justified |
| Hover, focus, active, disabled | Interactive or accessibility state | Semantic HTML, CSS pseudo-classes/attributes, and optional JS as needed |
| Loading, expanded, selected, error, success | Runtime or form state | Native semantics and component behavior; optional JS when necessary |
| Desktop/mobile presentation | Responsive adaptation | Existing responsive SCSS and component layout, not necessarily separate types |
| Different semantic purpose | Potentially different responsibility | Component mapping review: reuse, extend, create or compose |

The table is guidance, not an automatic property-to-code mapping. A visual state may need both presentation and behavior; a variant set may contain multiple independent axes.

## 3. Separate content, configuration, and runtime state

**Editorial content** belongs in page-local component instance data. Use the actual component dataSchema and avoid embedding page-specific copy in reusable templates.

**Stable component configuration** may be represented by existing documented data fields or a deliberate backward-compatible extension of a project component's schema and implementation. Choose field names and allowed values based on the component's semantic contract, not by copying every Figma label mechanically.

**Runtime state** (for example open/closed, focused, loading, validation error) is not necessarily editorial data. Implement it through appropriate native elements, attributes, CSS, and JavaScript behavior. Do not persist transient UI state in page content JSON solely because Figma depicts it as a variant.

**Responsive adaptation** follows [responsive design](responsive-design.md); viewport differences should not automatically become editorial variants.

## 4. Use native semantics and accessibility

Prefer real HTML behavior over visual simulation:

- buttons use button semantics and appropriate disabled behavior;
- navigation and links remain keyboard-operable;
- focus visibility must not be removed without an accessible replacement;
- expanded/selected/error states use appropriate native semantics or ARIA when needed;
- hover-only information must have a usable keyboard/touch path where relevant;
- contrast, touch targets, text scaling and reduced-motion needs must be reviewed where relevant.

A Figma hover frame does not prove an interaction has been implemented. A visual disabled state does not establish whether an action is actually unavailable. When semantics or behavior are missing, record a question or an explicit implementation proposal.

## 5. Avoid variant explosion

Before adding a new Shorty component type, ask whether the variation:

1. changes only instance content;
2. changes a supported presentation option while preserving the same responsibility;
3. changes runtime state of the same control;
4. reflects a responsive view of the same unit;
5. truly represents a separate semantic or functional responsibility.

Prefer one coherent component for variations of the same responsibility. Do not generate a separate registered type for every Figma variant combination. Equally, do not force unrelated behaviors into a single oversized component.

Inspect the project's existing components and usages before changing a schema. Any new project-specific field must be implemented consistently in metadata dataSchema, Twig, styles, affected instance JSON and optional JavaScript. There is no universal Shorty Core variant property or global variant registry.

## 6. Handle incomplete and conflicting Figma states

When Figma provides only a default state, do not invent a complete visual state matrix and claim it came from the design. Identify required implementation states and mark their proposed appearance or behavior as inferred.

When a variant exists visually but no prototype behavior is supplied, distinguish the visual appearance from the trigger and transition. For example, an expanded accordion frame does not specify whether it opens on click, whether multiple items can stay open, or how keyboard navigation works.

When combinations are missing or contradictory, document the gap. Do not generate arbitrary Cartesian products of all property values. Ask for decisions when the ambiguity materially affects behavior, accessibility, data contracts, or component boundaries.

## 7. Mapping record for variants and states

For each component candidate, record:

| Field | Meaning |
| --- | --- |
| Figma source | Component set/main component/instance references and IDs, if accessible |
| Property axis | Exact observed property name and observed values |
| Meaning | Content, stable configuration, runtime state, responsive change or separate responsibility |
| Visual evidence | Which inspected variants and frames support the interpretation |
| Behavior evidence | Actual prototype interactions versus assumptions |
| Shorty target | Existing component type, schema field, template, SCSS, JS or composition decision |
| Compatibility | Impact on existing instances and component usages |
| Accessibility | Semantic and keyboard/touch implications |
| Open decisions | Missing combinations, unclear behavior and approvals |
| Verification | Specific rendered states and interactions to inspect |

This is a conceptual review format, not a mandatory schema, metadata field or project file convention.

## 8. Implementation and validation handoff

After mapping approval:

1. Confirm the existing project component and data contracts.
2. Implement the smallest coherent changes using the supported Shorty mechanisms.
3. Keep source Figma identity references in the analysis/mapping record until a persistent provenance contract is agreed.
4. Validate affected components and the project using the actual available CLI commands, then build.
5. Review representative states, supported combinations, keyboard behavior and responsive transitions in rendered output.
6. Report separately which variants were inspected, implemented and visually/behaviorally verified.

A successful build alone does not establish visual parity, accessibility or interactive correctness. Do not claim automated variant testing where none was performed.

## 9. Explicit unresolved platform decisions

ADR-0015 requires recording unique Figma component IDs for imported components, but the current component metadata schema rejects unknown top-level properties and provides no Figma ID field. Do not add an undocumented figmaComponentId property or invent a persistent sidecar format.

The detailed contract for variant mapping, regeneration, source-to-component synchronization, manual edits and automated state comparisons is not settled. These require explicit decisions during later implementation; this document does not create those capabilities.

## Exit criteria

Variant and state interpretation is ready for implementation when the observed variant axes are traceable, content/configuration/runtime/responsive responsibilities are separated, the existing Shorty component inventory has been checked, significant unknowns are explicit, compatibility and accessibility impacts are reviewed, and a realistic validation plan exists.

## Related documents

- [Figma design analysis](design-analysis.md)
- [Figma component mapping](component-mapping.md)
- [Figma responsive design](responsive-design.md)
- [Shorty component model](../core/component-model.md)
- [Implementation workflow](../implementation-workflow.md)
- [ADR-0015](../../decisions/ADR-0015-figma-to-shorty-agent-independent-design-integration.md)
