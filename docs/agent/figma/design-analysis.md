# Figma Design Analysis

## Purpose and status

This guide defines how an external agent should inspect a **selected** Figma design before proposing Shorty components or generating code. It is a planned integration workflow; it does not imply that Figma MCP, API access, or automated inspection is already configured.

Analysis describes the design as evidence. Decisions about Shorty component reuse, files and code belong to later mapping and implementation stages.

## 1. Establish scope and provenance

Record, when available:
- Figma file reference, selected page(s), frame(s), node/component IDs and version or retrieval time;
- the requested output (one component, a section, a page, or several templates);
- which views, variants and states are actually available;
- which source material was directly inspected versus supplied indirectly (for example, a screenshot).

Do not infer hidden layers, constraints, variants or interactions from a static screenshot. If the source cannot be accessed, identify the limitation and request the minimum missing evidence.

## 2. Inspect the design from outside inward

Analyze in this order:

1. **Page and frame structure:** overall sections, ordering, hierarchy and repeated regions.
2. **Layout:** auto-layout direction, alignment, padding, gaps, sizing, constraints, grids and relationships among elements, where available.
3. **Components:** instances, source component IDs, nested instances, shared patterns and explicit Figma component properties.
4. **Visual system:** typography styles, colors, effects, radii, borders, spacing scales and available variables/styles.
5. **Content and assets:** text, images, icons, logos and their source references; distinguish real content from placeholders.
6. **Behavior:** prototype links, interactions, state changes, menus, forms, hover/focus/disabled states, when explicitly documented.
7. **Responsive evidence:** frames at different widths, constraints, resizing rules and evidence of layout transitions.

A visible repetition does not automatically mean a reusable Shorty component. A Figma group or frame does not automatically correspond to a DOM wrapper or Twig partial.

## 3. Distinguish evidence from interpretation

For every significant finding, classify it:

- **Observed:** directly visible in retrieved Figma properties, variants, frames or other inspected source.
- **Inferred:** a plausible interpretation based on the observed design, not an explicit requirement.
- **Unknown:** unavailable, contradictory or ambiguous information.
- **Decision:** an interpretation approved for implementation, including who or what established it.

For example: “Desktop frame width 1440 px” may be observed; “the layout switches to one column at 768 px” must remain inferred or unknown unless supported by source evidence or an explicit decision.

Include node references or equivalent source pointers for important observations where available. Do not invent exact pixel values, variable names, IDs or asset URLs.

## 4. Analyze components without committing to code

For each candidate design unit, capture:
- visual role and position in the page;
- source Figma component identity, if present;
- repeated occurrences and meaningful differences;
- content fields that appear variable;
- explicit properties, variants and states;
- nested components and dependencies;
- potential accessibility or interaction requirements;
- unresolved behavior.

Mark the unit as a **candidate**, not a confirmed new Shorty component. Later mapping must compare it with the actual project inventory before selecting reuse, extension or creation.

## 5. Responsive and interaction uncertainty

When only desktop frames exist:
- record the available viewport widths and layout constraints;
- identify elements likely to require reflow, but label proposals as inferences;
- avoid silently inventing mobile navigation, breakpoints or content omission;
- ask for missing designs or document an explicit approved fallback before implementation.

When interaction details are absent:
- do not infer working behavior from visual appearance alone;
- record open questions for buttons, navigation, forms, menus, dialogs and state transitions;
- include keyboard and focus behavior in implementation questions where relevant.

## 6. Assets, tokens and content

Prefer explicit Figma variables and styles over manually approximated values. Preserve original design references in the analysis notes, but do not assume that Figma token names map directly to existing SCSS variable names.

For images and icons, note their role, source node, export availability, expected formats and any unresolved rights or quality concerns. Do not substitute guessed assets without approval.

Separate editable content from presentational structure. Page-specific text or imagery should not be treated as fixed component behavior merely because it appears in a design instance.

## 7. Analysis deliverable

Produce a reviewable design brief with these sections:

### Source and scope
Exact file/page/frame/node references, inspected material, retrieval context and exclusions.

### Observed design structure
Section hierarchy, layout relationships, repeated patterns, visual tokens and available assets.

### Component candidates
Each candidate's role, source identity, instances, properties, variable content and dependencies.

### Responsive and behavior evidence
Available viewport variants, resizing constraints, interactions and states; explicitly distinguish observations from hypotheses.

### Questions and decisions
Missing evidence, conflicts, accessibility concerns, assumptions requiring approval and already approved choices.

### Mapping readiness
A concise statement of what can safely proceed to Shorty component mapping and what must be resolved first.

The deliverable is an analysis artifact, not an instruction to create new schema properties or write Shorty source files. Its storage location and machine-readable format remain undecided.

## 8. Exit criteria

Analysis is ready for component mapping when:
- the exact Figma scope is traceable;
- observed facts and assumptions are clearly separated;
- reusable patterns and component candidates are identified;
- significant responsive and interaction gaps are visible;
- no inaccessible Figma detail is presented as verified.

Unresolved questions can remain, but must be carried forward explicitly and must not be converted into silent implementation assumptions.

## Next step

Use [component mapping](component-mapping.md) when that guidance is defined, together with the actual [Shorty component model](../core/component-model.md) and the project's existing component inventory.
