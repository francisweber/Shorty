# ADR-0014: Docker as the only standard Shorty execution environment

- **Status:** Accepted
- **Date:** 2026-11-12
- **Supersedes:** [ADR-0010](ADR-0010-project-local-toolchain-management.md)

## Context

Shorty targets macOS Apple Silicon, macOS Intel, Windows 10/11 x64, Linux x64, and Linux ARM64. Managing PHP, Composer, Node.js, npm, native dependencies, and filesystem behaviour consistently through host toolchains has proved difficult to reproduce across these systems. WP2b and WP2c demonstrated the main Docker build workflow on an Apple-Silicon Mac and exercised an AMD64 image under emulation. Native validation on the remaining target platforms is still required.

The generated website remains static. It must not require Shorty, Docker, PHP, Node.js, or a database at runtime.

## Decision

Docker is the only supported standard environment for Shorty runtime operations, validation, builds, and the development server. Mise is not a parallel standard solution and will not be developed further as one. The existing Mise configuration remains untouched during the migration and may be removed only after the Docker integration is implemented and the required native platform tests are documented.

The development environment is divided as follows:

- IDE, Git, Node.js/npm needed for the thin host launcher and private Git installation, and the Shorty launcher run on the host.
- PHP, Composer, Twig, Sass, and the Shorty build runtime run inside Docker.
- Composer is required only while building the Docker image; it is not a regular runtime command.
- Website project files remain on the host and are mounted into the container. They are not copied into the Shorty runtime image.
- Build output is written to the configured output directory in the host project.
- The generated website is static and does not depend on Shorty or its development environment.

The regular project-local command entry point is `npm exec -- shorty`. The Shorty package is installed from the private GitHub repository. It is not published to npm, and no private container registry is required.

`package-lock.json` is the authoritative installation lock for the Shorty dependency and its resolved Git commit. New projects do not use `shorty.lock.json` as a second authoritative version file. Existing `shorty.lock.json` files remain supported during a transition period.

Shorty Docker images are built locally through the explicit `shorty image build` command. Normal commands such as `validate` and `build` must not trigger an unrequested image build or download. Image tags include the Shorty version and Git commit. There is no automatic `latest` selection or image update.

Polling is the standard Live-Reload mechanism. Compose Watch is not maintained as a second, equivalent standard implementation.

## Consequences

- Docker is required to run Shorty development, validation, and build commands.
- The host requires Node.js `>=24` and npm `>=10.2.0`. The launcher checks these versions for valid CLI commands and checks Git before `shorty init`; help output does not run preflight checks. Git access to the private repository is required for initialization. Shorty does not install or update host tools. PHP and build dependencies do not need to be installed on the host.
- Project dependency installation and Shorty upgrades are deliberate operations. An existing project does not silently move to a newer Git tag, commit, or image.
- A local image is associated with the exact Shorty release and commit from which it was built. No registry is needed to distribute or refresh that image on a developer's machine.
- Image construction must exclude website projects and test fixtures. Only the runtime source and its locked dependencies belong in the Shorty image.
- The current Mise setup remains available only as a migration fallback until the acceptance tests and native platform matrix are complete; it is not a continuing supported workflow.
- Cross-platform claims must be limited to the platforms and architectures actually tested. The WP2 results do not prove native Windows, Linux, or Intel-Mac support.
- Shorty must not add telemetry, background communication, or paid external API dependencies. Network access is limited to explicitly required private Git and package/base-image downloads.

## Validation and transition requirements

Before removing the Mise configuration, the Docker implementation must pass the agreed CLI, build, Live-Reload, file-permission, and static-output checks, and native tests must be documented for macOS Apple Silicon, macOS Intel, Windows 10/11 x64, Linux x64, and Linux ARM64. Until then, Docker-only is the adopted target architecture, but support for an untested platform must not be claimed.

The existing `shorty.lock.json` compatibility path may be removed only after the migration policy for already initialized projects is documented and implemented.

## Pinned implementation and remaining work

- The current Docker Runtime implementation pins Node.js `24.22.2`, npm `12.2.2`, PHP `8.5.12`, Composer `2.11.1`, Twig `3.30.0`, AJV `8.20.0`, and Sass `1.108.2`; the Dockerfile pins its Node and PHP base-image digests. Final production qualification of these pins and native validation across the target platforms remain outstanding.
- The host Node.js/npm minimums and preflight behavior are implemented as Node.js `>=24` and npm `>=10.2.0`; broader platform validation of these host requirements remains part of the platform test matrix.
- The host CLI package is version `2.0.0`. The separate Runtime npm manifest remains `0.1.0`; image identity uses the host CLI version plus the full locked Git commit.
- Project configuration requires an absolute HTTP(S) `site.url` for validation and builds. `shorty init` leaves an explicit empty placeholder, and older projects must add their actual site URL before using these commands.
- How the project-local launcher is exposed consistently across shells without a global installation.
- Whether Docker Compose is needed internally or the launcher should use the Docker CLI directly.
- UID/GID and writable-mount behaviour on native Linux and Windows Docker Desktop.
- Whether `shorty update <version>` coordinates the dependency-lock change and local image build, or those remain separate explicit commands.
- The detailed compatibility period and eventual removal point for `shorty.lock.json`.
- Native test procedures and acceptance criteria for every target platform.

## Distribution update (2026-11-14)

This ADR originally selected the private GitHub repository as the source for project-local installation. The prepared public Core repository will use HTTPS from `francisweber/Shorty`; this distribution change is documented in [ADR-0017](ADR-0017-public-shorty-core-repository.md). The Docker-only runtime decision is unchanged.
