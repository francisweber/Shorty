# ADR-0009: Dockerized build environment

- **Status:** Historical; superseded by [ADR-0010](ADR-0010-project-local-toolchain-management.md), with the current Docker decision recorded in [ADR-0014](ADR-0014-docker-only-standard-environment.md)
- **Date:** 2026-11-10

## Context

Shorty is intended for agency workflows in which different developers may work on the same customer project using different computers and local development setups.

The build must not depend on incidental host installations or versions of Node.js, PHP, Composer, Sass, or other project tooling. A developer should be able to obtain a customer project, prepare its environment through a documented Shorty command, and work without manually assembling a compatible local toolchain.

The generated customer website has a different requirement: it is static output and must not depend on Docker, Shorty, PHP, Node.js, or a database at runtime.

## Earlier decision

This ADR originally selected Docker as the standard isolation and distribution mechanism for Shorty's build and development environment, with Docker Compose as the initial orchestration mechanism.

That decision was reconsidered before implementation. The initial Shorty 2.0 workflow will instead use Mise to manage project-specific tool versions. Docker remains a possible additional execution backend for projects that require operating-system or native-library isolation, especially legacy projects.

The decision to use Mise was recorded in ADR-0010. ADR-0014 now supersedes that decision and re-adopts Docker as the sole standard Shorty execution environment. This ADR remains a historical record of the original Docker proposal and its rationale.
