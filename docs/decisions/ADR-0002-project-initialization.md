# ADR-0002: Initialize independent customer projects from Shorty releases

- **Status:** Accepted
- **Date:** 2026-11-09
- **Decision clarified:** 2026-11-10

## Context

Shorty is the development and build tool used to create customer websites. Each customer project is intended to be a complete, independent project with its own Git repository and lifecycle.

The generated website is static output. Once deployed, it does not execute Shorty, PHP, Node.js, or a database. A later change or defect in the Shorty Core therefore has no effect on a website that has already been generated and deployed.

Customer projects are commonly completed and then left running for long periods. Further development, rebuilds, or maintenance happen when the customer commissions additional work. There is no need for automatic platform updates or a general mechanism for backporting every Core change into every existing project.

## Decision

Use the CLI command: `shorty init [project-directory]`.

The optional directory is the target project directory. Without an argument, initialization targets the current directory. The display name is derived from the target directory name; initialization is non-interactive.

Initialization creates the project configuration, standard directories, and editable starter files from the selected Shorty commit. It creates the project's npm files and installs Shorty as a local dependency from the private GitHub repository.

The generated customer project:

- Records the Shorty version from which it was initialized.
- Can be placed in its own Git repository and independent history. `shorty init` does not run `git init`.
- Owns its source templates, components, content, configuration, and build setup.
- Uses its local Shorty dependency for development and builds; the generated static website does not depend on the Shorty repository at runtime.
- Does not automatically receive future Shorty platform changes.

A completed static website is independent of subsequent Shorty development. A Core defect is relevant to a customer project only if and when that project is actively developed or rebuilt and the defect affects that work. There is no obligation to update or repair an already deployed website because the platform has changed.

If a customer later commissions new work, the developer can use the project's existing source and decide which fixes or improvements are relevant. Maintenance, migration, and rebuild work are separate commissioned services.

## Consequences

- The Shorty repository remains the platform's source of truth for new projects.
- Each customer project is initialized from a known Shorty commit and keeps its own source and local Shorty dependency.
- New projects can start from newer stable releases.
- Existing projects remain unchanged unless deliberately worked on.
- No automatic update, synchronization, or mass backport mechanism is required.
- The source Shorty version is retained for traceability, not as an update obligation.
- The bootstrap selects an immutable full Git commit; creating the website project's Git repository remains a separate developer action.
- CLI command naming and argument syntax follow ADR-0003.

## Distribution and execution clarification — 2026-11-12

The initial npm distribution proposal below has been superseded for installation and execution by [ADR-0014](ADR-0014-docker-only-standard-environment.md). Shorty is installed only as a project-local dependency from the private GitHub repository. It is not published to the public npm registry, and no global Shorty installation is used. PHP, Composer, Twig, Sass, and the build runtime live in the explicitly built Docker image.

For new projects, `package.json` records the Shorty version and an exact Git commit; `package-lock.json` records the resolved private Git dependency. New projects do not create a second authoritative `shorty.lock.json`. The existing lock-file compatibility path remains for projects initialized before this change.

`shorty init` creates the npm project files and starter structure without overwriting existing package or project configuration. It installs Shorty locally from the same immutable Git commit used to invoke the bootstrap. Building the Runtime image remains a separate explicit `shorty image build` action.

## Details still to be specified

- Future changes to the private GitHub distribution or release-selection workflow, if required.

## Initial npm distribution proposal — historical, superseded by ADR-0014

The original proposal was to distribute a versioned `shorty-cli` npm package and record its version in `shorty.lock.json`. That proposal was not published and is no longer the supported distribution model. The private Git dependency and its package-manager lock are now authoritative for new projects.

## Distribution update (2026-11-14)

The private GitHub distribution described above was the original development setup. The separately prepared public Core repository uses HTTPS; see [ADR-0017](ADR-0017-public-shorty-core-repository.md). The private development repository remains unchanged.
