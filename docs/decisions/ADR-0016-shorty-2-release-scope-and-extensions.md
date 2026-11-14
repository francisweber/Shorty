# ADR-0016: Shorty 2.0 release scope and optional extensions

- **Status:** Accepted
- **Date:** 2026-11-13
- **Related:** [ADR-0011](ADR-0011-automatic-xml-sitemap-generation.md), [ADR-0013](ADR-0013-external-ai-agent-compatibility.md), [ADR-0014](ADR-0014-docker-only-standard-environment.md), [ADR-0015](ADR-0015-figma-to-shorty-agent-independent-design-integration.md)

## Context

The initial Shorty vision described a visual Inspector as a central Core capability and the roadmap included a broad first usable frontend environment. The first stable Shorty 2.0 release is now defined more narrowly: it is a slim, CMS-independent development and build platform, not a prebuilt website or UI kit.

This release-scope decision changes the earlier target in the Vision and Architecture documents that treated the visual Inspector as a Core feature. The historical rationale remains useful for a future extension, but it is not a 2.0 Core release requirement.

## Decision: Shorty 2.0 Core release

Shorty 2.0 Core includes:

- The Docker-only runtime and the host and container CLIs.
- Project initialization and project/component validation.
- Twig rendering, SCSS processing, asset processing, static build output, and the development server with Live Reload.
- XML sitemap generation as specified by ADR-0011, now implemented in the standard build and covered by unit and Docker integration tests.
- Existing asset-processing foundations. The neutral initializer does not prescribe design tokens, a grid, or a visual system.

The 2.0 Core does not include:

- A prebuilt UI or domain component library, including standard hero, navigation, footer, button, or form libraries.
- A visual Inspector or generated component-overview page.
- A multilingual build pipeline.
- Figma-to-Shorty integration.
- Starter-Kit products.

`shorty init` provides a neutral, working project scaffold with one minimal example page. It does not generate button or form components. Those examples are not archived or turned into a Starter Kit.

The generated website remains static. It must not need Shorty, Docker, PHP, Node.js, or an AI service at runtime. AI tools are not required to use Shorty.

## Future extensions and packages

- The Visual Inspector is an optional extension and is not part of the Shorty 2.0 Core release.
- Figma-to-Shorty is an optional extension, planned under ADR-0015 after Shorty 2.0 is stabilized, tested, and release-ready.
- Core and initially internally developed extensions may live in the shared Shorty repository. Extensions must not make their services or AI dependencies mandatory for Core users.
- Starter Kits are separate, installable packages. They may be maintained in separate Git repositories as that distribution model becomes useful.
- Extension discovery, installation, compatibility, and versioning mechanisms are not defined by this ADR and must be decided before implementation.

## Compatibility with existing decisions

- ADR-0011 remains in force: sitemap generation belongs to the standard build and is part of the 2.0 release scope.
- ADR-0013 remains in force: external AI-agent compatibility is an architectural quality, but Shorty does not provide or require an AI agent.
- ADR-0012's language-aware navigation model is a future design direction. It does not mean that a multilingual build pipeline ships in Shorty 2.0.
- ADR-0014 remains the standard runtime architecture.
- ADR-0015 remains the design direction for the optional future Figma-to-Shorty extension.

## Release configuration

- The stable Shorty 2.0 CLI package version is `2.0.0`. It is independent of the Docker Runtime manifest version `0.1.0`; Runtime image tags use the CLI version and full Git commit.
- The host package requires Node.js `>=24` and npm `>=10.2.0`; the Host CLI checks these requirements and checks Git before project initialization.
- `shorty init` now generates the agreed neutral scaffold with one minimal example page and no Button or Form examples. The change is part of Core project initialization, not an additional Starter Kit.
- The neutral initializer contains one minimal example page and a small base stylesheet, but no design tokens, grid, UI components, or visual design system.

## Consequences

- Sitemap implementation and its requested build and integration tests are complete. The broader cross-platform and release acceptance matrix remains a separate release gate.
- The Inspector, language-aware build processing, Figma integration, and Starter-Kit packages must not block the 2.0 Core release.
- Vision, Architecture, README, Component System, and Roadmap documentation must distinguish the 2.0 Core from future extensions and packages.
- No extension host or package-management mechanism is implied to exist until separately designed and implemented.
