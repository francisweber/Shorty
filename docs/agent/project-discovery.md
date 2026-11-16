# Project Discovery Workflow

This document defines how an external development agent establishes the actual state of a Shorty project before planning or implementing changes.

It complements the [Agent Working Principles](working-principles.md). The workflow is intended to be reusable across customer projects and must not assume a particular website, design system, or Figma file.

## 1. Objective

Before changing a project, the agent must build a reliable picture of:

- which project is active;
- which Shorty version is installed and how it is pinned;
- how the project is configured;
- where its source files and generated output live;
- which pages, layouts, components, and data contracts exist;
- which relevant capabilities are implemented and available;
- which existing project decisions or changes must be preserved.

Discovery is an inspection phase. Do not create, rename, delete, regenerate, or reformat project files as part of discovery.

## 2. Locate the active project

Shorty projects are identified by the root-level file:

`shorty.config.json`

The current Core project loader starts at the process working directory and searches that directory and its parents for this file. It does not infer a project from folders such as `components/`, `pages/`, or `layouts/`.

The agent should therefore:

1. Establish the working directory used for the task.
2. Locate the nearest applicable `shorty.config.json` using the same current-directory/parent-directory model.
3. Treat the directory containing that file as the project root.
4. If no configuration can be found, stop project-specific inspection and report that the active project could not be identified.

Do not silently choose a neighboring project or initialize a new one. If more than one project is relevant, ask which project is the target.

The authoritative behavior is implemented in `src/core/project/project-loader.js`, particularly `findProjectRoot()`.

## 3. Establish the installed Shorty version

Do not infer the installed version from documentation, a remembered project state, or the version of another checkout.

Inspect the target project's dependency declarations and installed dependency:

- `package.json`: identify the Shorty dependency and its declared Git reference or version;
- `package-lock.json`: inspect the resolved dependency source and commit where available;
- the installed Shorty package's `package.json`: identify the version actually present in the environment;
- `shorty.lock.json`, if present: treat it as a legacy compatibility file, not as the version authority for new projects.

Shorty 2.0 is installed as a project-local Git dependency. The exact selected Git commit and the package lock are important when determining the code that is actually in use.

If the installed dependency is missing, the package lock disagrees with the installed package, or the environment cannot establish the resolved revision, report the uncertainty. Do not assume that the repository's current default branch matches the target project's installed code.

The current Core loader validates a present legacy `shorty.lock.json` against the installed Shorty version. New projects do not create this file as a second version authority.

## 4. Read and validate project configuration

Read the complete `shorty.config.json` and inspect its structure.

The configuration is the authoritative entry point for project identity and managed directory paths. Validate the following:

- `configVersion` is supported;
- `project.name` identifies the project;
- `site.url` is an absolute HTTP or HTTPS base URL;
- optional `paths` overrides use supported relative paths;
- no configured path escapes the project root or collides with another managed path.

The default managed paths in the current v1 contract are:

| Configuration key | Default | Purpose |
| --- | --- | --- |
| `paths.components` | `components` | Component type directories |
| `paths.pages` | `pages` | Page templates and page definitions |
| `paths.layouts` | `layouts` | Shared page layouts |
| `paths.data` | `data` | Project, page, and component-instance data |
| `paths.assets` | `assets` | Source styles, scripts, fonts, and images |
| `paths.schemas` | `schemas` | Project-level JSON Schemas |
| `paths.output` | `dist` | Generated static website |

Omitted entries use their defaults. An agent must use the resolved configured paths throughout its work; it must not assume that a directory is at its default location.

Read [Project configuration](../07-project-configuration.md) and the checked-in `schemas/shorty-config.schema.json` for the exact contract. Do not invent configuration properties or silently repair invalid configuration during discovery.

## 5. Inspect the project structure

Inspect the configured source directories and relevant root files.

At minimum, establish:

- project configuration and package files;
- page templates and page data;
- shared layouts;
- component directories and their files;
- project-level and page-level data;
- project-level schemas;
- source assets, stylesheets, and JavaScript;
- generated output location, if it exists;
- relevant project documentation and existing agent instructions.

Do not assume every directory exists or contains files. Record absent, empty, or inaccessible directories as observations rather than creating them.

Do not treat generated output as editable source. Inspect it only when necessary to understand a build result or verify rendered output.

## 6. Inventory components

Use the configured components directory and Shorty's component conventions to understand the available component types.

For each discovered component, record:

- directory name and derived component type ID;
- presence of the required `<id>.json`, `<id>.tpl`, and `<id>.scss` files;
- presence of optional JavaScript and component-owned assets;
- metadata name, description, and category when readable;
- declared `dataSchema`;
- validation status and diagnostics, where the CLI or validator is available.

Keep component type IDs distinct from component instance IDs. A component type is the reusable implementation; an instance ID identifies one use on a page and corresponds to a page-local JSON data file.

The current CLI provides:

- `shorty component:list` to list discovered components and their valid, incomplete, or invalid status;
- `shorty component:validate <component-name>` to inspect one component;
- `shorty validate` to validate the project configuration and components.

Use these commands when the installed version supports them. The CLI currently provides human-readable output; do not assume that a stable JSON output mode exists.

If the CLI is unavailable, inspect the files and schemas directly, and clearly distinguish manual inspection from a successful Shorty validation command.

See [Component system](../03-component-system.md) and [ADR-0004: Component identity and discovery](../decisions/ADR-0004-component-identity-and-discovery.md).

## 7. Understand page composition and data relationships

Shorty page composition is authored in Twig templates. JSON files provide content data for concrete component instances; they are not a general page-composition manifest.

Inspect the relevant page templates and trace component invocations such as:

`{{ component('gallery', 'gallery-main') }}`

For each relevant invocation, identify:

- the component type ID;
- the instance ID;
- the corresponding page-local data file;
- the component's declared data schema;
- any nested component use or relevant template dependency.

Do not assume that every JSON file in a project is a component instance. Use its location and the actual template/helper conventions to establish its role.

Do not move editorial content into component templates or page composition into JSON merely to simplify an agent workflow.

## 8. Inspect design and project conventions

When the task concerns visual implementation or Figma, inspect existing design-related source before proposing new conventions.

Look for:

- existing design tokens, variables, and global styles;
- typography, spacing, color, breakpoint, and grid conventions;
- component naming and CSS class patterns;
- existing responsive behavior;
- interaction patterns and JavaScript conventions;
- existing mappings or references to design-source components, if any.

Record what is actually present. Do not assume that a project has a complete design system or that a Figma design is already synchronized with its Shorty implementation.

Project-specific visual decisions belong to the project context, not to the shared Shorty Core rules.

## 9. Check working-tree state and preserve existing changes

When the environment exposes Git state, inspect it before editing:

- current branch and commit;
- modified, staged, and untracked files;
- relevant recent changes where they clarify current work.

Do not discard, overwrite, reset, stash, or reformat existing user changes.

If Git metadata is unavailable, say so. Do not claim that the working tree is clean.

A repository checkout and a deployed or installed project may represent different revisions. Establish which copy is the target before making changes.

## 10. Check available tooling without changing the environment

Identify which Shorty commands and validation steps are available in the target environment.

The current CLI help documents:

- `shorty init`
- `shorty validate`
- `shorty build`
- `shorty serve`
- `shorty component:create`
- `shorty component:validate`
- `shorty component:list`

Check relevant host/runtime prerequisites and whether Docker is available when the task requires container-based commands.

Do not install, upgrade, downgrade, or reconfigure dependencies as part of discovery unless the user explicitly asks for environment setup.

Do not run a build merely as a discovery shortcut if it would overwrite generated output or otherwise change project state. If a build is needed to establish behavior, explain the side effect and obtain authorization when appropriate.

## 11. Record findings and unresolved questions

At the end of discovery, prepare a concise project snapshot containing:

| Area | Record |
| --- | --- |
| Project identity | Root path and configured project name |
| Shorty version | Installed version and resolved/pinned revision, or uncertainty |
| Configuration | Config version, site URL status, resolved managed paths |
| Source structure | Relevant pages, layouts, components, data, schemas, and assets |
| Component inventory | Relevant component IDs, instances, and validation status |
| Design conventions | Existing tokens, styles, breakpoints, and interaction patterns |
| Environment | Available CLI, Node/npm, Docker/runtime status as relevant |
| Working tree | Branch and existing changes, if observable |
| Open questions | Missing information, contract conflicts, or unsupported requirements |

Keep the snapshot focused on the task. Do not dump the entire repository tree when only a small part is relevant.

Do not copy secrets, access tokens, credentials, or private environment values into the snapshot or project documentation.

## 12. Discovery exit criteria

Discovery is complete when the agent can answer, with evidence:

1. Which project is the target?
2. Which Shorty implementation is actually installed?
3. Which configuration and paths govern the project?
4. Which existing components and page structures are relevant?
5. Which validation/build operations are available?
6. Which existing changes must be preserved?
7. What is still unknown or contradictory?

If any answer materially affects the requested implementation and cannot be established, do not guess. Ask a focused clarification or explain the limitation before proceeding.

## Related documentation

- [Shorty Agent Knowledge](README.md)
- [Agent Working Principles](working-principles.md)
- [Implementation workflow](implementation-workflow.md) — planned
- [Validation workflow](validation-workflow.md) — planned
- [Project configuration](../07-project-configuration.md)
- [Component system](../03-component-system.md)
- [Machine-readable tooling contracts](../06-machine-readable-tooling-contracts.md)
- [ADR-0004: Component identity and discovery](../decisions/ADR-0004-component-identity-and-discovery.md)
- [ADR-0013: External AI-agent compatibility](../decisions/ADR-0013-external-ai-agent-compatibility.md)
