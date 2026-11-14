
# 5. Roadmap

This roadmap is intentionally high-level. Phases are gates for discussion and validation, not fixed delivery dates.

Status markers describe repository evidence, not a release declaration: `[x]` means implemented and tested in the stated environment; `[~]` means implemented but missing validation on one or more target platforms; `[ ]` means still open. A platform test passing on macOS Apple Silicon does not establish native support on macOS Intel, Windows, or Linux.

Shorty 2.0 is developed as an independent, project-agnostic frontend development environment. It is not built around a particular customer project.

Test projects are temporary and replaceable validation environments. They may be created, changed, archived, or discarded at any time. No customer project is a permanent dependency of the Shorty platform.

## Shorty 2.0 Core release scope

The 2.0 Core release is a slim, CMS-independent development and build platform. Its scope includes the Docker-only runtime, host and container CLIs, project initialization, validation, Twig rendering, SCSS and asset processing, static builds, the development server with Live Reload, and sitemap generation under ADR-0011. Existing technical design foundations remain in Core; this does not define a ready-made visual system.

The 2.0 Core release excludes a prebuilt UI library, Visual Inspector, component-overview page, multilingual build pipeline, Figma-to-Shorty, and separately installable Starter Kits. The Visual Inspector and Figma-to-Shorty may be pursued as optional extensions after Shorty 2.0 is stabilized, tested, and release-ready. Starter Kits are separate installable packages, potentially maintained in separate repositories. No extension mechanism is implemented or implied by this plan.

The agreed initializer target is a neutral, functional project scaffold with one minimal example page and no Button or Form component examples. Host requirements are Node.js `>=24`, npm `>=10.2.0`, Git access to the private Shorty repository for initialization, and Docker for Runtime image builds and container-backed project commands. The stable Shorty 2.0 CLI package version is `2.0.0`; the separate Docker Runtime manifest retains its own version.

### Implemented 2.0 Core scope

- [x] Implement the Docker-only Runtime, Host CLI, and Container CLI; verify the workflow on macOS Apple Silicon.
- [x] Implement project initialization with the neutral scaffold and one minimal example page.
- [x] Implement configuration and component validation, Twig rendering, SCSS and asset processing, and the initial static build.
- [x] Implement XML sitemap generation according to ADR-0011.
- [x] Set host requirements to Node.js `>=24` and npm `>=10.2.0`, with Node.js/npm and Git preflight checks.
- [x] Set the stable Host CLI package version to `2.0.0`; retain the Runtime manifest's independent version `0.1.0` and derive image tags from the CLI version plus full Git commit.

### Remaining macOS Apple Silicon release acceptance

- [ ] Prepare the separate public Core repository from the reviewed 2.0.0 source snapshot, then verify a fresh project installation resolves its exact Git commit in `package-lock.json`.
- [ ] On that same release candidate, run the complete npm suite and Docker integration test, then verify `npm ci`, explicit image build, validate, build, serve, Live Reload, and preservation of the last successful output after a build error.

The current 2.0.0 release target is macOS Apple Silicon. Native tests for macOS Intel, Windows, and Linux are not release gates. Do not claim support for those platforms until they have been tested; they may be considered as later platform expansions.

## Phase 0 — Architecture foundation

- [x] Establish the Shorty 2.0 project repository.
- [x] Record the vision and core principles.
- [x] Decide on Twig as the fixed template engine for Shorty 2.0 and static output as the v1 target.
- [x] Initially select Mise as the project-local tool-version manager; this decision was later superseded by ADR-0014.
- [x] Separate the Shorty platform from independent customer project repositories.
- [x] Review and refine architecture documents against the implemented release scope.
- [ ] Identify unresolved design decisions and record them as ADRs where appropriate.
- [ ] Define the requirements for reliable developer and AI-agent interaction with Shorty.

**Exit condition:** The initial architecture, responsibilities, and scope are sufficiently clear to design the core implementation.

## Phase 1 — Technical proof of concept

Validate the most important architectural assumptions with small, isolated technical experiments.

The proof of concept is not a customer project and does not define the permanent structure of Shorty. Its purpose is exclusively to test technical approaches and identify risks before implementing the reusable platform core.

### Validated

- [x] Node.js build orchestration.
- [x] Twig rendering through PHP.
- [x] Communication between Node.js and the PHP rendering process.
- [x] Component discovery and registration.
- [x] JSON Schema-based component data validation.
- [x] SCSS compilation and integration into generated output.
- [x] Generation of static HTML output.

### Current implementation evidence

- [x] Nested page layouts, nested components, and explicit page/component data contexts are covered by build tests.
- [x] Missing and invalid component data produce build errors; Twig HTML autoescaping is covered by build tests.
- [~] Twig strict variables are enabled in the renderer; a dedicated regression test for undefined variables remains desirable.
- [x] Serve, file watching, browser refresh, and signal shutdown are exercised by the local serve test and Docker integration test on macOS Apple Silicon.
- [~] The build emits static files on the host and the Docker integration verifies them there; native platform validation remains open.

The same-template Inspector workflow and Inspector inclusion/exclusion lifecycle are deferred with the optional Inspector extension; they are not open proof-of-concept work or 2.0 release gates.

**Exit condition:** The technical assumptions relevant to the core architecture have been sufficiently validated. The proof of concept itself is not a production implementation and does not need to become part of the platform.

## Phase 2 — Shorty Core foundation

Implement the reusable, project-independent foundation of Shorty.

- [x] Define the initial core module structure and responsibilities.
- [x] Implement project loading and configuration.
- [x] Implement component discovery and registry.
- [x] Implement metadata handling, the component metadata JSON Schema, and component definitions.
- [x] Implement project/page configuration and component metadata/file validation through the CLI.
- [x] Implement JSON page and component-instance loading and schema-based component data validation during build.
- [x] Implement initial page/layout orchestration.
- [x] Implement the internal Twig rendering module.
- [x] Implement SCSS and asset orchestration.
- [x] Establish initial build output and development workflow.
- [x] Establish module boundaries and exercise core behaviour in project-neutral temporary test projects.
- [x] Establish stable project, page, component, and instance identifiers and the initial machine-readable component contracts.
- [ ] Complete the proposed machine-readable CLI JSON result and diagnostic contracts.

The core must not contain project-specific components, templates, content, or assumptions about a particular customer's website.

**Exit condition:** Shorty Core can load an independent project, discover its components, validate its data, render its pages, and generate static output.

## Phase 3 — CLI and project workflow

Develop the CLI into the central interface for using Shorty.

- [x] Establish the initial CLI package.
- [x] Implement the initial component generator.
- [x] Implement project initialization (`shorty init`).
- [x] Implement development workflow (`shorty serve`) with local static serving, watched source rebuilds, and browser reload.
- [x] Implement the initial static production build (`shorty build`); the broader complete-site scope remains open in Phase 5.
- [x] Implement component management commands (`component:create`, `component:validate`, and `component:list`).
- [x] Implement explicit local Runtime image management (`shorty image build`).
- [x] Provide human-readable command output, actionable errors, and tested exit-code behaviour for implemented commands.
- [x] Developer workflows are exercised on macOS Apple Silicon. Native validation on macOS Intel, Windows, and Linux is outside the 2.0.0 release target; broader external-agent interoperability remains future work.
- [~] Document the implemented command surface and core exit-code contracts; the proposed JSON output contract remains open.

The CLI should provide a stable and predictable interface to Shorty's capabilities. It should not require users or AI agents to understand internal implementation details.

**Exit condition:** A project can be initialized, developed, validated, and built through a consistent CLI workflow.

## Phase 4 — Optional Inspector extension (after the 2.0 Core release)

This phase is outside the 2.0 Core release scope. It may be considered as an optional extension after Core stabilization.

- [ ] Implement automatic component and variant discovery.
- [ ] Build a component overview using the actual component templates.
- [ ] Implement inclusion and exclusion controls.
- [ ] Implement the correct component JavaScript lifecycle.
- [ ] Provide useful diagnostics for markup, data, styling, and behaviour.
- [ ] Validate components in combined and global contexts.
- [ ] Ensure that the Inspector reflects the actual output of the project build system.

**Exit condition:** Components can be inspected, tested, and compared in a reliable environment without maintaining separate demo implementations.

## Phase 5 — Broader website and Starter-Kit work (not in the 2.0 Core release)

This phase describes broader frontend packages and workflows for later consideration. It must not be interpreted as a requirement to ship a UI component library, a Visual Inspector, or a Starter Kit in Shorty 2.0.

- [ ] Design any broader Starter-Kit package separately from the neutral `shorty init` Core scaffold.
- [ ] Extend technical design foundations where a later project package requires them; Core does not prescribe a visual system or UI library.
- [ ] Provide a base layout with header, navigation, and footer.
- [ ] Provide example pages and a component overview.
- [ ] Expand the static website workflow beyond the 2.0 Core baseline; the Visual Inspector and multilingual build processing are outside 2.0.
- [ ] Document project setup, development, validation, and production builds.
- [ ] Verify that a customer project remains independent of the Shorty platform after initialization.
- [ ] Verify the workflow with at least one neutral test project.

**Exit condition:** Shorty can be used to develop and build a complete, independent frontend project.

## Phase 6 — Reproducible environments and possible future portability

Docker is the adopted standard execution environment under ADR-0014. Runtime-image construction and container-backed CLI workflows are implemented and tested on macOS Apple Silicon. Native portability has not been established for macOS Intel, Windows, or Linux; testing those platforms is not part of the 2.0.0 release acceptance.

- [x] Introduce Docker-based execution.
- [x] Define a reproducible Docker development environment with pinned runtime dependencies.
- [~] Runtime versions and dependencies are pinned; native consistency remains unverified on the other target platforms.
- [x] Document the standard Docker workflow and its platform-validation limits.
- [x] Verify that the generated static output remains independent of the development environment.

Native platform tests are required before claiming support for macOS Intel, Windows 10/11, or Linux, and may be planned as later platform work. Docker must not introduce a runtime dependency into generated websites.

## WP4 — Figma-to-Shorty / AI Enablement

**Status:** Planned. WP4 may begin only after Shorty 2.0 is fully stabilized, tested, and release-ready. Completing Shorty 2.0 remains the sole development priority until then. See [ADR-0015](decisions/ADR-0015-figma-to-shorty-agent-independent-design-integration.md) for the agreed architecture direction.

The planned integration uses Figma as its initial design source and supports Codex and Claude Code equally through shared, agent-independent Shorty conventions. Shorty remains usable without AI and will not provide its own agent or orchestration. An agent translates Figma components into standalone Shorty components, records each source component's Figma ID, and prepares regenerated implementations separately for validation before replacement. Synchronization details, variants, and handling of manual edits remain open for the implementation work package.

Planning estimates, not commitments:

- First prototype: approximately 2–3 working days.
- First usable integration: approximately 3–4 working days.

## Later development — Capabilities to evaluate

These capabilities are not required for the first usable version, but should be considered in the architecture where appropriate.

- AI-assisted project work: external agents can locate structured JSON through stable page and component-instance IDs, understand component schemas, validate changes, run builds, and prepare previews for approval.
- Build-time REST/GraphQL data retrieval for concrete use cases.
- Runtime API behaviour only if a separate, justified application-oriented scope emerges.
- Visual regression and automated browser tests.
- Additional project templates and reusable component foundations.

AI-agent compatibility is an architectural requirement from the beginning. Shorty does not need to provide its own AI agent. External agents should be able to work with the environment through documented structures, stable interfaces, and predictable commands.

## Out of scope for v1

- A CMS or editorial backend.
- A drag-and-drop page builder.
- Runtime PHP, Node.js, or database requirements for generated static websites.
- Direct integration with one particular CMS.
- Automatic conversion of Twig templates into React, Vue, or Angular components.
- A general-purpose pluggable renderer architecture.
- A built-in AI agent.
- Uncontrolled AI-agent editing or automated publication without validation and approval.
