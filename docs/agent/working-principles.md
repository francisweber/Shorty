# Agent Working Principles

This document defines the shared working principles for external development agents operating on Shorty projects.

It complements the [Shorty Agent Knowledge overview](README.md). It describes how an agent should approach work; it does not replace Shorty's implemented behavior, JSON Schemas, CLI, or accepted architecture decisions.

## 1. Establish the actual project state first

Before proposing or making changes, an agent must establish what is actually present in the target project.

At minimum:

- identify the Shorty version or pinned revision used by the project;
- inspect the project configuration and configured source directories;
- inspect the relevant templates, components, metadata, data files, styles, and scripts;
- identify the available CLI commands and the project's supported validation/build workflow;
- distinguish tracked source files from generated output;
- check whether the working tree contains existing user changes, where the environment exposes that information.

Do not assume that a project has the same structure, components, conventions, or capabilities as another Shorty project.

Do not assume that documentation for a newer Shorty version describes the version used by the target project. When version-specific behavior matters, verify it against the project's pinned version and actual implementation.

## 2. Treat existing project work as authoritative context

Existing project files may contain deliberate decisions that are not described in the shared documentation.

Before changing an existing implementation:

- understand how it is used and what depends on it;
- inspect related component instances, templates, styles, scripts, and data contracts;
- preserve behavior that is outside the requested change;
- identify assumptions that cannot be verified from the available project.

Do not overwrite, delete, rename, or broadly reformat unrelated files merely to make the project conform to a preferred pattern.

When a requested change appears to conflict with an existing project decision, explain the conflict and seek clarification if it materially affects the result.

## 3. Follow the Shorty architecture and contracts

Shorty project conventions are defined by its architecture, accepted ADRs, schemas, and implemented tooling.

Agents must:

- follow the component identity and discovery model defined by Shorty;
- use the project's configured paths rather than assuming default paths;
- respect the distinction between component types and component instances;
- keep page composition in the appropriate templates and instance content in the appropriate data files;
- validate metadata and data against the applicable schemas;
- use the supported Shorty CLI and build workflow.

Do not invent metadata fields, schema properties, CLI options, file types, or runtime capabilities.

If the requested implementation requires a capability that is not currently supported, describe the gap. Do not simulate support by adding undocumented conventions that other Shorty tools cannot understand.

## 4. Plan before implementing

For work that affects multiple files or architectural boundaries, first produce a concise implementation plan.

The plan should identify:

- the requested outcome and acceptance criteria;
- the relevant existing files and components;
- the proposed files to create or change;
- dependencies and likely side effects;
- applicable validation steps;
- unresolved questions or assumptions.

Keep the plan proportional to the task. A small, isolated correction does not need a lengthy design document.

If inspection reveals that the requested approach is unsafe, conflicts with a contract, or would cause unnecessary architectural change, explain the issue before proceeding.

## 5. Prefer the smallest coherent change

Make the smallest set of changes that fully satisfies the task while preserving the architecture.

In particular:

- reuse an existing component when it already represents the required behavior;
- extend an existing component only when the extension is consistent with its responsibility;
- create a new component when it represents a distinct reusable responsibility;
- avoid duplicating markup, styles, scripts, or data structures without a clear reason;
- avoid introducing dependencies or abstractions that are not needed;
- keep project-specific implementation out of Shorty Core.

Do not optimize for the shortest generated code at the expense of clarity, maintainability, or consistency.

## 6. Keep source and generated output separate

Treat project source files as the editable implementation and generated build output as a build artifact.

Use the configured source and output paths. Do not hand-edit generated output as a substitute for changing its source.

Do not remove or replace a previous successful build output manually unless the task explicitly concerns output management and the consequences are understood.

A build must be run through the supported Shorty process so that the result reflects the actual project configuration and runtime.

## 7. Validate changes; never claim unverified success

After implementation, run the applicable checks supported by the target project and environment.

Depending on the change, this may include:

- component validation;
- project validation;
- schema validation of relevant data;
- a complete static build;
- inspection of generated output and referenced assets;
- relevant automated tests.

Report exactly what was run and whether it passed.

If a check cannot be run because a dependency, runtime, environment, or capability is unavailable, state that limitation. Do not imply that an unrun check passed.

A successful file write is not proof that a component is valid, and a successful component validation is not proof that the complete site builds correctly.

## 8. Preserve working implementations during regeneration

When regenerating or replacing an existing implementation, keep the current working version intact until the replacement has been generated separately and passed the relevant validation.

Do not partially overwrite the current component while generation is still in progress.

If the replacement fails validation, report the failure and leave the previous implementation available.

The exact Figma synchronization, variant reconciliation, and manual-edit preservation policies remain subject to their own design decisions. Do not invent those policies during an individual task.

## 9. Make uncertainty and conflicts explicit

Distinguish clearly between:

- **verified facts** — confirmed by project files, schemas, implementation, or executed tooling;
- **inferences** — conclusions drawn from available evidence;
- **assumptions** — details that have not been confirmed;
- **proposals** — suggested changes that have not been accepted;
- **planned capabilities** — described in documentation or ADRs but not implemented.

When sources disagree, use this order as a starting point:

1. the target project's actual pinned implementation and executable contracts;
2. accepted Shorty architecture decisions relevant to that version;
3. current platform documentation and schemas;
4. shared agent guidance;
5. agent assumptions or preferences.

This ordering does not authorize silently ignoring a contradiction. Record material discrepancies and resolve them with the project owner or maintainers.

## 10. Keep changes reviewable

Changes produced by an agent must be understandable to another developer.

- Use clear, consistent names.
- Keep files focused on their responsibility.
- Avoid unrelated formatting churn.
- Explain non-obvious decisions in the appropriate project documentation or code comments.
- Do not conceal generated or agent-authored changes.
- Summarize changed files and relevant behavior at the end of the task.

Do not create commits, push branches, open pull requests, or publish releases unless the user or the applicable workflow explicitly authorizes that action.

## 11. Respect project boundaries and user intent

The target project is not a sandbox for unrelated refactoring.

Agents must:

- work only within the requested scope;
- preserve existing user changes;
- avoid exposing secrets or copying credentials into documentation, logs, or generated files;
- avoid changing deployment, infrastructure, or external service configuration unless requested;
- ask before making an irreversible or broadly consequential change when its intent is unclear.

If the task cannot be completed safely within the available information, stop at the point of uncertainty and explain what decision or information is needed.

## 12. Report the result

A useful completion report should state:

1. what was changed;
2. why the change was made;
3. which files were affected;
4. which validation commands or tests were run and their results;
5. what could not be verified;
6. any remaining decisions or follow-up work.

Keep the report factual. Do not describe a proposal as implemented or a planned capability as available.

## Related documentation

- [Shorty Agent Knowledge](README.md)
- [Project discovery workflow](project-discovery.md) — planned
- [Implementation workflow](implementation-workflow.md) — planned
- [Validation workflow](validation-workflow.md) — planned
- [ADR-0013: External AI-agent compatibility](../decisions/ADR-0013-external-ai-agent-compatibility.md)
- [ADR-0015: Figma-to-Shorty agent-independent design integration](../decisions/ADR-0015-figma-to-shorty-agent-independent-design-integration.md)
