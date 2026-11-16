# Safe Regeneration of Figma-Derived Shorty Components

## Purpose and status

This document defines safety principles and a proposed review workflow for later changes to Figma-derived Shorty implementations. It is **not** an implemented synchronization engine, automatic watcher, merge algorithm, or CLI command. The detailed identity, conflict-resolution, approval and replacement mechanisms remain open technical decisions under [ADR-0015](../../decisions/ADR-0015-figma-to-shorty-agent-independent-design-integration.md).

ADR-0015 establishes a default direction of **full regeneration** when a source Figma component changes, with the replacement generated and validated in isolation before replacing the current working component. Full regeneration is a candidate-generation strategy, **not permission for unattended overwriting**.

## 1. Preconditions and provenance

Before proposing regeneration, establish:

- the selected Figma file, component and exact source identity from accessible evidence;
- the currently mapped Shorty component type and its known usages;
- the last reviewed design reference or baseline, if available;
- current component metadata, Twig, SCSS, optional JavaScript and assets;
- affected pages, page-local instance JSON and data contracts;
- project configuration, Shorty version, Git status and existing manual changes.

Do not infer a persistent Figma-to-Shorty association from matching names alone. If source identity or the baseline is ambiguous, stop automatic replacement and request a mapping decision.

ADR-0015 requires recording a unique Figma component ID for imported components, but the current component metadata schema rejects unknown top-level fields and has no Figma ID property. The storage contract remains undecided. For planning, record observed IDs in a reviewable analysis/mapping artifact; do **not** add undocumented metadata fields or invent a persistent sidecar convention.

## 2. Detect and classify changes

Compare the available current Figma evidence against the last reviewed design evidence and current Shorty source. Where a reliable prior snapshot does not exist, describe the comparison as incomplete.

Classify relevant differences:

| Change | Potential impact |
| --- | --- |
| Copy or editorial media | Component instance data; avoid rewriting the reusable implementation unnecessarily |
| Colors, spacing, typography or decoration | Component/project styles and design tokens |
| Component structure or layout | Twig, SCSS, possibly component boundaries |
| Figma variant or property | Data schema, template, styles and/or runtime behavior |
| Interaction or state | Semantic HTML, optional JavaScript and accessibility |
| Responsive design | Layout rules and verification across widths |
| Component identity or removal | Mapping, usages and migration decision |

A Figma change does not automatically justify editing every file. Document whether the proposed full regenerated component actually changes each responsibility.

## 3. Protect existing source and manual work

Treat the checked-in Shorty implementation as valuable source, not disposable generated output.

Before creating a candidate:

1. Inspect the Git working tree and identify uncommitted or unrelated edits.
2. Preserve a recoverable baseline using the project's agreed Git workflow; do not silently commit, reset, stash or discard user changes.
3. Identify manual edits and project-specific deviations from the prior Figma implementation.
4. Identify consumers and schema compatibility requirements.
5. Establish the intended regeneration scope and explicit exclusions.

If manual edits cannot be distinguished reliably from generated content, flag the uncertainty. Never assume that all differences from Figma are accidental or safe to remove.

## 4. Generate a replacement candidate in isolation

Generate the proposed replacement **separately from the active working component**. Keep the existing source intact while preparing and validating the candidate.

Isolation may be implemented later using a dedicated worktree, temporary project copy or another safe approach; this document does not mandate an unimplemented staging API or a specific directory convention. The candidate must use actual Shorty contracts and resolve project paths from configuration.

Do not point the candidate at the live component directory in a way that overwrites source during generation. Do not modify the active output as a shortcut.

## 5. Compare candidate with the current implementation

Prepare a reviewable change summary covering:

- Figma evidence and which changes triggered regeneration;
- added, modified and removed files;
- component type identity and any proposed renaming;
- dataSchema changes and impact on existing instance JSON;
- Twig structure and semantic/accessibility changes;
- SCSS, responsive rules, assets and optional JavaScript changes;
- manual edits that would be preserved, migrated, replaced or lost;
- affected pages and component usages;
- unresolved design decisions and risks.

Do not automatically merge or discard manual modifications. Present explicit alternatives for conflicts, such as preserving the current behavior, applying the new design, or creating a deliberate hybrid implementation. The conflict policy and approval authority must be decided before implementing automatic reconciliation.

## 6. Validate the isolated candidate

Use the Shorty version and commands available in the target environment. The candidate should pass relevant component validation, project validation and a build exercising affected instances, for example:

    shorty component:validate <component-type>
    shorty validate
    shorty build

Because the candidate is isolated, validation must target that candidate's actual project context rather than accidentally validating the unchanged active project. The CLI currently emits human-readable output; do not assume structured JSON diagnostics or a special regeneration command.

Review visual output against available Figma evidence, including documented viewport sizes, representative states, interactions and accessibility implications. Build success alone does not establish visual fidelity or behavioral correctness.

If candidate validation fails, retain the current working component and report the failure. Do not promote a failing candidate.

## 7. Review and controlled replacement

A validated candidate is **eligible for review**, not automatically approved for replacement.

Before replacing a working component, resolve:

- whether design changes are accepted;
- how manual changes and conflicts are handled;
- whether schema migrations are complete and existing instances remain valid;
- whether visual and interaction review is sufficient;
- how rollback will work;
- who is authorized to approve replacement.

The exact approval and atomic source replacement mechanism is not yet specified. Do not claim an implemented automatic promotion, rollback or conflict-free merge process.

Once a project-specific replacement has been explicitly authorized and safely applied using supported source/Git operations, rerun relevant validation/build checks against the **active** project and inspect the final diff. Preserve the prior implementation in recoverable version history.

## 8. Failure behavior and idempotency goals

The safe default is **no replacement** when source identity, mapping, manual-change reconciliation, validation, approval or promotion safety is unresolved.

A future implementation should aim for repeatable results when the Figma source and approved decisions are unchanged, but this document does not guarantee deterministic generation or idempotent synchronization.

Never delete unrelated components, instance data, assets or user files as part of cleanup. Generated site output is managed by the existing Shorty build process; it is distinct from regenerating component **source**.

## 9. Regeneration report

Report:

- source Figma identity and evidence inspected;
- existing component and affected instances;
- detected differences and uncertainty about baseline;
- candidate scope and changed files;
- manual-edit conflicts and decisions;
- component/project/build results and visual checks actually performed;
- approval status and whether promotion occurred;
- unresolved risks and recovery path.

Clearly distinguish **candidate generated**, **candidate validated**, **replacement approved**, and **replacement applied**.

## Open technical decisions

Before an automated regeneration feature can be implemented, resolve and document:

1. persistent Figma component identity and source baseline storage compatible with Shorty metadata contracts;
2. reliable change detection and mapping when design components are renamed, moved or deleted;
3. manual code edit ownership and conflict/reconciliation policy;
4. candidate isolation and validation context;
5. approval, replacement and rollback mechanics;
6. variant and responsive behavior reconciliation;
7. repeatability guarantees and diagnostics.

These are future extension decisions, not implicit changes to Shorty Core. Under [ADR-0016](../../decisions/ADR-0016-shorty-2-release-scope-and-extensions.md), the optional Figma integration must not block the narrow Core release.

## Related guidance

- [Figma integration overview](overview.md)
- [Design analysis](design-analysis.md)
- [Component mapping](component-mapping.md)
- [Responsive design](responsive-design.md)
- [Variants and states](variants-and-states.md)
- [Implementation](implementation.md)
- [Shorty component model](../core/component-model.md)
- [General implementation workflow](../implementation-workflow.md)
