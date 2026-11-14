# ADR-0001: Use Twig as the template engine for Shorty 2.0

- **Status:** Accepted
- **Date:** 2026-11-09
- **Decision updated:** 2026-11-10

## Current execution environment — 2026-11-12

The decision in this ADR remains that Twig is Shorty 2.0's fixed template engine. Earlier wording in this record that describes PHP as running "locally" or being required in the local/build environment reflects the original execution assumption; it is superseded only as to execution location by [ADR-0014](ADR-0014-docker-only-standard-environment.md). PHP, Composer, Twig, and Sass run inside the Docker Runtime. The host needs Node.js and npm for the project-local launcher and private Git installation, but does not need PHP or Composer. Runtime images are built explicitly with `shorty image build`; ordinary commands do not build or download images. Generated websites remain static and require none of these tools at runtime.

## Context

Shorty needs a template engine for its static HTML build workflow. The project is a focused frontend development and build system, not a CMS or a universal framework intended to support every possible rendering technology.

Twig is familiar to the project owner and supports the required template features: layout inheritance, partials, loops, nested components, and explicit data contexts. Twig runs in PHP, while the Shorty Core and build orchestration use Node.js. This requires a deliberate Node.js/PHP integration.

Earlier architecture notes considered keeping the Core renderer-independent so that other template engines could be substituted. The project has since clarified that this flexibility would add abstraction and complexity without solving a current requirement. Template syntax is part of the project source; changing engines later would require deliberate template migration in any case.

## Decision

Use **Twig as the fixed template engine for Shorty 2.0**.

- Page templates, layouts, component templates, and internal partials use Twig syntax.
- Template files use the .tpl extension.
- Node.js owns project management, component discovery, data loading and validation, build orchestration, and asset processing. The reference to inspection reflects the original Core scope and is superseded by ADR-0016, which defers the Visual Inspector to an optional extension.
- PHP executes Twig locally and during the build. This records the original execution assumption; the execution location was superseded by ADR-0014, which places PHP/Twig in Docker.
- Generated static websites must not require PHP, Node.js, Shorty, or a database at runtime.
- The Twig integration should be kept in a clearly defined internal module/service for code organization. This is not a pluggable renderer abstraction and does not promise drop-in replacement by another engine.

A future fundamental change of template technology can be considered as part of a new major Shorty version, with a deliberate migration plan for existing templates. Automatic conversion is not assumed.

## Consequences

### Positive

- The initial implementation focuses on one concrete template technology.
- The project owner can use a familiar template language.
- No general-purpose renderer abstraction is needed for hypothetical alternatives.
- The Core can remain organized without spreading PHP/Twig process details across unrelated modules.
- The generated website remains completely independent of the build environment.

### Costs and constraints

- The Node.js Core needs a reliable bridge to the PHP/Twig renderer.
- Development, error handling, and process lifecycle across that boundary need to be designed and tested.
- PHP was required in the original local/build environment assumption; the current host does not require PHP or Composer (see ADR-0014).
- A future engine change would require template migration and may justify a new major version.

## What this decision does not mean

- Twig is not the Shorty Core or the content model.
- Twig does not provide automatic React, Vue, or Angular integration.
- Shorty does not generate target-platform CMS templates automatically.
- API-backed dynamic applications are not part of the v1 scope.
- This decision does not prevent a future Shorty major version from adopting a different template technology.

## Initial proof-of-concept validation criteria — historical

The technical proof of concept should test layout inheritance, registered components and internal partials, nested component composition, repeatable JSON arrays, explicit context isolation, strict-variable diagnostics, HTML escaping, inspector rendering and exclusion behaviour, the Node.js/PHP process boundary, and static output that runs without PHP or Node.js.
