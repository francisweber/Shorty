# ADR-0010: Project-local toolchain management with Mise

- **Status:** Superseded by [ADR-0014](ADR-0014-docker-only-standard-environment.md)
- **Date:** 2026-11-10

## Context

Shorty must support agency workflows in which developers work on multiple customer projects with different toolchain requirements. A project may need a newer Node.js/PHP toolchain while an older customer project must remain buildable with its original versions for a small maintenance change.

The build environment must therefore be defined per customer project rather than inherited accidentally from the developer's global machine setup. At the same time, the initial Shorty 2.0 development workflow should remain lightweight and quick to establish.

Mise can select and install project-specific tool versions from a committed `mise.toml`. It manages language runtimes and development tools, but it does not isolate the operating system or all native system dependencies. Docker provides stronger environment isolation and may be useful for legacy projects or projects with special system requirements.

The generated customer website remains static and has no build-tool runtime dependency.

## Decision

Mise is the standard tool-version manager for the initial Shorty 2.0 development and build workflow.

Each customer project pins the required tool versions in its own committed configuration. The initial project toolchain is expected to include:

- Node.js for the Shorty Core, CLI, and build orchestration.
- PHP for the official Twig implementation.
- Composer for PHP dependencies.
- Dart Sass and the required frontend build tooling, where managed as Mise tools or project dependencies.

Project-specific tool versions must be explicit and must not be silently upgraded. A developer installs and activates the versions declared by the project before running its commands.

Docker is retained as a possible additional execution backend for a later phase. It may be introduced when a project needs stronger isolation from the host operating system, native libraries, or legacy system dependencies. This is not a commitment to make Docker mandatory for all Shorty projects or to introduce a separate Shorty major version.

The Shorty Core and build orchestration must not be hard-coupled to Mise or Docker. The project configuration describes the required toolchain and build workflow; the mechanism used to provide that environment is an execution concern.

Docker is therefore not part of the initial proof of concept. The first proof of concept uses the local Mise-managed toolchain on the developer machine.

The generated static website must not require Mise, Docker, Shorty, PHP, Node.js, or a database at runtime.

## Consequences

- The initial setup is native and lightweight; developers do not need Docker for the standard Shorty 2.0 workflow.
- Each customer project can pin its own Node.js, PHP, and other supported tool versions independently.
- The project configuration and lockfiles must be committed so that the intended toolchain and dependencies are documented and reproducible.
- Mise manages tool versions but does not guarantee that old projects remain executable when they depend on obsolete operating-system libraries or native components.
- Projects with such requirements may later use a Docker-based environment without changing the static output contract.
- The CLI and build orchestration must not assume that Mise itself is the only way tools can be made available.
- Toolchain upgrades are deliberate project changes; existing customer projects must not silently inherit newer versions.
- Cross-platform setup must be documented and tested on macOS, Windows, and Linux.
- Generated output remains independent of all build-time environment managers and runtimes.

## Proof-of-concept requirements

The technical proof of concept must demonstrate:

1. Installing and activating the project-pinned toolchain with Mise.
2. Running Node.js build orchestration locally.
3. Rendering Twig through PHP using the official Twig implementation.
4. Rendering a page layout with nested components and JSON data.
5. Returning useful Twig diagnostics to the Node.js process.
6. Writing static HTML output to the project output directory.
7. Rebuilding after a source change and verifying browser refresh/live reload.
8. Confirming that the generated output runs without Mise, Docker, PHP, or Node.js.

## Open implementation details

- Exact Node.js, PHP, Composer, and Sass versions for the proof of concept.
- Which tools are installed through Mise and which are locked as project dependencies.
- CLI bootstrap and dependency-installation strategy.
- Node.js/PHP communication mechanism and PHP process lifecycle.
- Cross-platform setup and shell activation details.
- Criteria for introducing a Docker execution backend for projects with legacy system dependencies.
