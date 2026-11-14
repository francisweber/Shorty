# ADR-0017: Separate public Shorty Core repository

- **Status:** Accepted
- **Date:** 2026-11-14

## Context

The private development repository contains the EURODRY website and its history, along with local development material that must not be exposed as part of a public Shorty portfolio. The Shorty 2.0.0 Core source snapshot is identified by commit `015d8221033ce26102e469eaa594e1c5b889c5d1`.

## Decision

- Prepare a separate GitHub repository named `francisweber/Shorty` for the Shorty Core.
- Export only an explicit allowlist of Core source, runtime, schema, test, and documentation paths from the 2.0.0 source snapshot.
- Do not transfer the private repository's Git history. The new repository starts with one clean import commit; its commit SHA differs from the source commit.
- Exclude `projects/eurodry/`, personal/local development files, and generated or installed files.
- Keep `francisweber/Shorty-2.0` private and unchanged as the development repository.
- Use the public GitHub repository over HTTPS for project-local Git installation. Keep the npm package marked private to prevent npm publication.
- Recreate the annotated `v2.0.0` tag and GitHub Release on the clean import commit, preserving the release title and notes. The new tag targets the new repository's import commit, not the private source SHA.

## Consequences

- The public repository contains only the reviewed Shorty Core snapshot and has a new, single-commit history.
- The original private history, EURODRY history, and its commit metadata are not exposed through the public repository.
- Project lockfiles continue to pin the resolved Git commit; Docker image identity uses the public repository commit.
- The long-term synchronization process between the private development repository and the public Core repository remains to be defined before a subsequent release.
- No license is granted until the project owner selects and adds a license after confirming the rights to publish the Core and its included materials.
