# 2. Architecture

## 2.1 Architectural direction

Shorty 2.0 is an independent, project-agnostic frontend development environment. It provides the tooling, conventions, component system, rendering pipeline, and development workflow used to build standalone frontend projects.

Shorty is not a CMS, an all-in-one website platform, or a customer-specific application. It does not own customer content or depend on a particular customer project. Its purpose is to provide a predictable environment in which developers and external tools can create, validate, and build frontend projects.

The architecture separates the **Shorty platform** from every **generated project**:

- The **Shorty platform repository** contains the Core, CLI, technical project contracts, documentation, tooling, and project initializer.
- A **project repository** is initialized from a selected Shorty version. It contains its own configuration, templates, components, data, assets, and Git history.
- Once initialized, a project has its own lifecycle and does not depend on a live Shorty platform installation.
- A project does not automatically inherit changes from later Shorty versions. Updates are deliberate project-level decisions.
- Shorty itself must remain useful without any particular customer project being present in its repository.

Test projects are temporary validation environments. They may be created, replaced, archived, or discarded at any time. They are not permanent platform dependencies, architectural reference customers, or prerequisites for developing Shorty Core.

A Shorty development session operates in the context of one active project at a time. Shorty is not a multi-project workspace in which several customer projects are loaded and managed together. Switching projects means opening a different project repository and its own context.

Shorty 2.0 has one initial output target: a static website rendered through Twig. Twig syntax is part of the project source. A different template technology would require a deliberate migration and may belong in a future major version.

## 2.2 Shorty build flow

A project source tree contains project configuration, Twig page templates, registered components, JSON page and instance data, SCSS, JavaScript, fonts, and media.

The regular project-local entry point is `npm exec -- shorty`. The host launcher uses Node.js/npm and delegates validation, builds, and the development server to the Docker runtime. The Runtime image is built locally and explicitly with `shorty image build`; ordinary Shorty commands do not build or download an image.

1. The host launcher finds the website project and its pinned Shorty Git dependency.
2. Docker runs the selected Shorty Runtime image with the website project mounted from the host.
3. The Container CLI loads the project configuration and discovers its components.
4. JSON content is loaded and validated against JSON Schema.
5. Twig templates are rendered through PHP inside the container.
6. SCSS, JavaScript, and required assets are processed inside the container.
7. Shorty writes static HTML, CSS, JavaScript, assets, and an XML sitemap into the configured output directory in the host project. The sitemap uses discovered page data and the configured `site.url`; it is independent of navigation.

The project source remains in the developer's working tree and is edited with the normal editor or IDE. PHP and Composer are not host prerequisites. The generated output can be deployed as a standalone CMS-free website. It does not require Mise, Docker, Shorty, PHP, Node.js, or a database at runtime.

The build flow must be deterministic and explicit: given the same project source and pinned Shorty Runtime image, the build should produce equivalent output. Diagnostics must identify the relevant project file, component, or data instance wherever practical.

### 2.2.1 Project configuration and path resolution

Every project has a root-level `shorty.config.json`. It identifies the project and may override the standard managed directory paths. The configuration contract and its JSON Schema are defined in [Project configuration](07-project-configuration.md) and [shorty-config.schema.json](../schemas/shorty-config.schema.json).

The standard paths are `components`, `pages`, `layouts`, `data`, `assets`, `schemas`, and `dist` (build output). Path overrides are optional and partial; omitted entries always use these defaults. New projects created by `shorty init` use the standard structure.

Shorty Core owns the complete configuration lifecycle: locating the project root, parsing and validating the configuration, merging defaults, resolving paths against the project root, and checking containment, collisions, and filesystem requirements. Paths never depend on the shell's current working directory. Absolute paths and traversal outside the project are rejected.

Core creates one normalized project context and passes it to all participating modules. No module may independently read the configuration, apply defaults, or resolve project paths. This keeps path semantics consistent across the CLI, component registry, data loader, renderer, and build pipeline.

The configuration describes project identity, the absolute HTTP(S) base URL in `site.url`, and directory layout. The base URL is required for validation and builds; initialization leaves it empty as an explicit placeholder, and Shorty never guesses a domain. Dependency manifests, tool versions, content, and component contracts remain in their respective files and systems.

## 2.3 Core responsibilities

Shorty Core owns the reusable project-level capabilities:

- Loading and validating the configuration of one active project.
- Providing the active project context to other modules.
- Reading the Shorty version metadata recorded in the project.
- Component discovery and registration.
- Page and layout orchestration.
- Component metadata and data-contract access.
- JSON data loading and schema validation.
- Useful diagnostics for invalid configuration, templates, and component data.
- Static build orchestration and output generation.
- Version metadata for projects initialized from a Shorty release.

Core modules must not contain customer-specific content, components, templates, or assumptions. They must be testable without a particular customer project.

Project initialization from a Shorty release belongs to the platform's project-initialization workflow. Once a project has been created, it has its own repository and lifecycle.

The Core's project, component, and data-management modules should not depend on PHP. Twig-specific rendering and PHP process handling belong in a clearly organized internal rendering module.

The CLI is the user-facing command interface to Shorty capabilities. It should coordinate commands and expose stable operations without duplicating Core business logic.

## 2.4 Template rendering with Twig

Twig is the fixed template engine for Shorty 2.0. Page templates, layouts, component templates, and internal partials use Twig syntax and the `.tpl` file extension. The Core uses a clearly organized internal Twig rendering module; this is not a pluggable renderer contract.

The internal Twig rendering module should cover at least:

- Render a page/layout using a named template and explicit context.
- Resolve registered component templates and internal partials.
- Resolve a component type together with a named page-local instance-data file.
- Report template errors with useful source locations where possible.
- Apply consistent escaping and strict-variable policies.
- Support development and production rendering modes where needed.

The host launcher runs on the website project's Node.js installation. PHP and Twig run only in the Shorty Docker Runtime, whose exact Node.js, npm, PHP, Composer, and dependency versions are pinned in the Runtime Dockerfile and lockfiles; a website project does not declare a separate PHP toolchain. The current renderer invokes one PHP worker per page, not per component. Twig rendering remains an internal implementation boundary, not a pluggable renderer contract.

## 2.5 Content data and contracts

For v1, the Core loads project, page, and component-instance data from JSON files and validates it against the relevant schemas. API access may be added later for a concrete use case. Shorty does not need a generic provider framework for hypothetical databases, headless CMSs, and other sources before they are required.

Component metadata and JSON Schemas are machine-readable contracts. They define the inputs a component accepts and provide a shared source of truth for validation, tooling, documentation, and external agent workflows.

Stable identifiers must make it possible to locate a page, component type, and component instance without relying on visual guesswork or fragile filename inference.

## 2.6 Output targets

### Static HTML target — v1

The first target produces complete HTML, CSS, JavaScript, and asset files. The output must be deployable to ordinary static hosting and must not need Shorty, PHP, Node.js, Mise, Docker, or a database at runtime.

### Integration into frontend frameworks

A generated static frontend can be used as the visual and structural reference when integrating a project into React, Vue, Angular, or another application. The integrator implements the target-specific components, data bindings, and runtime behaviour. Native framework output is not a v1 requirement and does not justify a pluggable renderer architecture now.

## 2.7 Build-time and runtime data

These modes must be kept conceptually separate:

- **Build-time retrieval:** an API/provider is queried during a build. Changes become visible after another build.
- **Runtime retrieval:** a generated application queries an API while it is running and updates its UI. This requires a runtime-capable output target and is outside the static-only v1 scope.

## 2.8 Optional Visual Inspector extension

The Visual Inspector is not part of the Shorty 2.0 Core release. It may be developed as an optional extension after Core stabilization. This explicitly supersedes the earlier Vision and Architecture wording that described the Inspector as a Core feature; the earlier product rationale is retained as future direction.

Initial expectations:

- Discover registered components and their variants automatically.
- Render components together in a component overview using the actual component templates.
- Provide a right-side panel with component checkboxes.
- Checking or unchecking a component changes the actual rendered Inspector page; excluded component markup is removed rather than merely hidden with CSS.
- Excluding a component also prevents its component-specific JavaScript from being included or initialized.
- Inspector inclusion/exclusion must not affect normal website builds.
- Normal website CSS may remain centrally bundled even if a component is omitted from the Inspector. A filtered Inspector-only CSS build can be considered later.

If implemented, the extension should exercise the same component contracts and rendering behaviour as a regular project build. It should not rely on separately maintained demo markup that can drift from the real component implementation. Extension loading and distribution are not yet designed.

## 2.9 Build and development environment

ADR-0014 makes Docker the standard environment for Shorty validation, builds, and the development server. The host requires Node.js `>=24`, npm `>=10.2.0`, Git access to the public repository for `init`, and Docker for Runtime image builds and project commands that use containers. The host launcher checks Node.js and npm for valid commands, checks Git before `init`, and skips toolchain checks for help output. It does not install or update host tools. PHP, Composer, Twig, and Sass run inside the Docker Runtime; PHP and Composer are not host prerequisites.

Each website project pins Shorty through its public GitHub dependency and `package-lock.json`. The local Runtime image is associated with that Shorty version and Git commit. The developer builds or refreshes it explicitly with `shorty image build`; `validate`, `build`, and `serve` do not trigger an automatic image build or pull. Website files stay on the host and are mounted into the container, and build output is written back to the host project.

Mise was the initial toolchain decision and remains as a migration artifact; it is not an alternative standard workflow. The Shorty 2.0.0 release target is macOS Apple Silicon, where the Docker implementation has been exercised. Native support for macOS Intel, Windows, and Linux has not been established; those platforms are possible later expansions and must not be presented as supported before testing. Apache and a database are not required for the static-site workflow. The generated website is independent of Shorty and the development environment at runtime.

## 2.10 Developer and AI-agent interface

Shorty is designed to be used by developers and by external AI agents. AI-agent compatibility is an architectural requirement; Shorty does not need to include or operate its own AI agent.

The same documented project structure and interfaces must be usable by both. An external agent should be able to discover what exists, understand what inputs are required, make a bounded change, validate that change, and report the result without depending on undocumented internal knowledge.

This requires:

- A predictable and documented project directory structure.
- Stable identifiers for pages, component types, and component instances.
- Machine-readable component metadata and JSON Schemas.
- Explicit configuration and data contracts.
- CLI commands with documented arguments, expected inputs and outputs, and meaningful exit codes.
- Actionable diagnostics that identify the source file and relevant component or data instance.
- Repeatable validation and build commands.
- A clear distinction between source files and generated output.
- No hidden dependence on a particular customer project or developer machine.

External agents are tools operating on a project; they are not part of Shorty Core. They must use the same validation and build mechanisms as a human developer. Changes should be reviewable, and publication must remain an explicit project workflow rather than an implicit side effect of editing.

## 2.11 Decisions still open beyond the 2.0.0 Core release

The following items do not describe missing pieces of the implemented 2.0.0 Core workflow:

- Component variants and variant discovery, if required by a future extension.
- Optional extension discovery, installation, compatibility, and versioning.
- Visual Inspector rendering lifecycle and development-server integration, if that extension is pursued.
- A deliberate convenience workflow such as `shorty update <version>`; existing projects can select and install a version explicitly through their package manifest and lockfile.
- Broader machine-readable CLI output and diagnostic contracts for external tools and agents.
- Native platform validation and file-permission behaviour before support is claimed for macOS Intel, Windows, or Linux.

The current Core already has a PHP/Twig worker lifecycle, asset processing, a Docker Runtime, separate Host and Container CLIs, a static build, and sitemap generation. These implemented capabilities are described in the sections above and are not unresolved architecture decisions.

## 2.12 Project initialization

A new project is initialized from a selected stable Shorty release using the Shorty CLI.

The intended command convention is:

```bash
shorty init [project-directory]
```

- `shorty init my-project` — initialize the supplied project directory.
- `shorty init` — initialize the current directory.

Square brackets in documentation indicate an optional argument; they are not typed in the actual command.

Initialization creates the project configuration and source structure, installs Shorty as a local dependency from the selected private Git commit, and writes a neutral, working scaffold with one minimal example page and a small base stylesheet. It does not generate a styleguide, prebuilt UI components, or a Starter Kit.

The resulting project:

- Has its own project configuration and source files.
- Records the Shorty version from which it was initialized.
- Can be maintained in its own Git repository and independent history; `shorty init` does not create that Git repository.
- Uses the project-local Shorty dependency and its npm lockfile; it does not require PHP or Composer on the host.
- Does not require the Shorty platform repository at runtime.
- Does not automatically receive changes when the Shorty platform evolves.

The 2.0 scaffold is a neutral working project with one minimal example page. A separately installable Starter Kit is outside the Core initializer.
