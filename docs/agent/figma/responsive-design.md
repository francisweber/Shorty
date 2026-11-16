# Responsive Design Interpretation for Figma-to-Shorty

## Purpose and status

This document describes how an external agent should interpret responsive evidence in selected Figma designs before proposing or implementing a Shorty solution. It is agent-independent guidance for a planned integration, not an implemented responsive importer, breakpoint engine, or new Shorty Core contract.

Figma is the source for observed design intent. The customer project's established responsive conventions and Shorty's existing Twig/SCSS/component contracts govern implementation. Never turn a guessed breakpoint or mobile layout into a claimed Figma requirement.

## 1. Establish the available evidence

For every selected design scope, record:

- exact Figma file, frame and node references;
- frame widths and heights and whether frames represent desktop, tablet, mobile or another intended context;
- available auto-layout properties, sizing modes, constraints, alignment, spacing and grids;
- component variants or properties explicitly tied to viewport behavior;
- visible differences in hierarchy, content, navigation, media and interactions across frames;
- source limitations, such as screenshots without inspectable constraints or missing device sizes.

Classify every relevant statement as **observed**, **inferred**, **unknown** or **approved decision**, as defined in [design analysis](design-analysis.md). A frame width is evidence about that frame, not automatically a CSS breakpoint.

## 2. Compare frames structurally

When multiple viewport designs exist, compare the same design region across them:

| Aspect | Questions |
| --- | --- |
| Composition | Do sections change order, disappear, appear or move between regions? |
| Containers | Are widths fixed, fluid, capped, full-bleed or constrained by a grid? |
| Layout | Do rows wrap, columns stack, alignment change or gaps adjust? |
| Typography | Do font sizes, line lengths, line heights or heading hierarchy change? |
| Media | Are assets cropped, resized, swapped or given different aspect ratios? |
| Navigation | Does its presentation or interaction model change? |
| Content | Is content identical, shortened, replaced or intentionally omitted? |
| Components | Is the same responsibility presented differently, or is it a distinct unit? |

Record which differences are explicitly visible and which require an implementation decision. Do not assume hidden content is intentionally removed just because it is absent from a cropped frame.

## 3. Infer behavior conservatively

Use inspected auto-layout and constraints to propose fluid behavior between documented widths. Distinguish a design observation (for example, a two-column desktop layout and a one-column mobile layout) from the inferred transition point.

Prefer intrinsic layout behavior when it meets the evidence: flexible sizing, wrapping, sensible minimum widths, content-driven layout and accessible reflow. Do not manufacture a large collection of device-specific breakpoints or hardcode each Figma frame width as a media query.

When a breakpoint is needed, first inspect existing project SCSS conventions, tokens and breakpoints. Propose the smallest justified change. The exact transition width is a project implementation decision unless Figma or an approved specification explicitly establishes it.

## 4. When only a desktop design exists

A desktop-only Figma file does not define a complete responsive specification. The agent should:

1. Identify the actual desktop evidence, including constraints and sizing modes when inspectable.
2. Check whether the project already defines responsive behavior for equivalent components.
3. Propose a conservative mobile/tablet interpretation that preserves meaning, content order and usability.
4. Mark all proposed layout transitions, navigation changes, asset swaps and breakpoints as **inferred**.
5. Request approval for consequential choices, especially mobile navigation, content hiding, complex grids and interaction changes.
6. Carry approved decisions into component mapping and implementation; leave unresolved requirements visible.

Do not silently create a hamburger menu, remove content, rearrange semantically dependent information or claim a particular mobile design was supplied.

If the missing decision blocks a correct implementation, stop that part of the work and ask for clarification rather than fabricating a design.

## 5. Component boundaries and responsive variants

A responsive presentation change usually belongs to the same Shorty component when its semantic role and data contract remain the same. Do not create separate registered component types merely because Figma has desktop and mobile frames.

Consider separate components only when the responsibilities or behavior are genuinely distinct and the mapping review supports that choice. Keep page composition in page Twig and editorial content in page-local instance JSON. Avoid duplicating the same content into unrelated component instances solely to support a viewport.

Figma variants can provide evidence, but Shorty Core has no agreed universal variant contract. Do not invent a platform-wide variant property or runtime to represent responsive designs. Consult [component mapping](component-mapping.md) and the planned [variants and states](variants-and-states.md) guidance.

## 6. Accessibility and content integrity

Responsive proposals must preserve:

- meaningful reading and focus order, even when visual order changes;
- usable navigation and controls at small widths;
- keyboard access and focus visibility for interactive changes;
- readable text and sensible zoom/reflow behavior;
- text alternatives and semantic relationships;
- essential content unless intentional omission is explicitly supported.

Do not equate visual pixel similarity with responsive correctness. When a proposed layout requires DOM reordering or duplicated markup, explicitly review accessibility and maintenance consequences.

## 7. Mapping and implementation handoff

For each affected page or component, produce a responsive decision record containing:

| Field | Required information |
| --- | --- |
| Source evidence | Figma frames/nodes, observed widths, constraints and visible differences |
| Existing conventions | Relevant project breakpoints, layout utilities and component behavior |
| Proposed behavior | Fluid sizing, wrapping, stacking, media treatment and navigation |
| Breakpoints | Explicit design values or proposed implementation decisions, clearly labeled |
| Content/semantics | Any order, visibility, accessibility or interaction implications |
| Confidence | Observed facts versus inferences and unknowns |
| Approval | Decisions requiring confirmation and decisions already accepted |
| Verification | Widths and behaviors to inspect after build |

This is a reviewable conceptual record, not a new mandatory JSON file, schema or Shorty API.

## 8. Validation and review

After implementation, use the existing Shorty validation/build workflow and inspect the rendered result at documented Figma frame widths and relevant intermediate/narrow widths. Review:

- overflow, clipping and horizontal scrolling;
- layout transitions, alignment and spacing;
- content and reading order;
- images, typography and text wrapping;
- navigation and interactive controls;
- keyboard and zoom/reflow behavior where relevant.

A successful build does not prove visual or responsive fidelity. Report separately what was checked in source, what was built and what was visually verified. If no browser-based comparison was performed, do not claim pixel-perfect or responsive verification.

## Exit criteria

Responsive interpretation is ready for implementation when available evidence is traceable, the existing project conventions have been checked, inferred behavior is clearly marked, consequential gaps have an explicit decision or remain blocked, and a concrete verification plan exists.

## Related documents

- [Figma design analysis](design-analysis.md)
- [Figma component mapping](component-mapping.md)
- [Shorty component model](../core/component-model.md)
- [Shorty project structure](../core/project-structure.md)
- [Implementation workflow](../implementation-workflow.md)
