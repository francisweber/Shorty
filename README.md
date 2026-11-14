# Shorty 2.0

**Shorty** is a CMS-independent development and build platform for building project-authored frontends and static websites.

Shorty is a focused frontend development and build tool, not a CMS or all-in-one website platform. Shorty 2.0 uses Twig and generates complete static websites.

## Project status

Shorty 2.0 provides a project-local Host CLI, a Docker-based Container CLI, project initialization and validation, component scaffolding and validation, Twig rendering, asset processing, a static build, a development server with Live Reload, and automatic XML sitemap generation. The CLI package is version `2.0.0`; native validation beyond macOS Apple Silicon remains open, so platform support claims are limited to tested environments.

The Shorty 2.0 Core release scope is defined in [ADR-0016](docs/decisions/ADR-0016-shorty-2-release-scope-and-extensions.md). The static build, local development server, and automatic XML sitemap generation are implemented. Set the absolute HTTP(S) base URL in `site.url` in `shorty.config.json` before validating or building; Shorty does not invent a domain. Pages are included by default, `sitemap: false` excludes a page, and `noindex: true` adds a robots directive and excludes it from the sitemap. A visual Inspector and multilingual build pipeline are outside the 2.0 Core scope and may be developed later as optional extensions.

## Prerequisites

- Node.js **24.22.2** for the commands below. The Host CLI requires Node.js `>=24` and npm `>=10.2.0`.
- Mise is used in the commands below to run Node.js 24.22.2 through `mise exec`.
- Git access to the public GitHub repository `francisweber/Shorty`. The bootstrap uses HTTPS; SSH setup is not required.
- A running Docker Engine; on macOS, this is usually Docker Desktop.

Shorty's build runtime, including PHP, Twig, and Sass, runs in Docker. Composer is used inside Docker when building the runtime image to install PHP dependencies. PHP and Composer are not host requirements. Build the runtime image locally and explicitly with `shorty image build`.

## Quick Start: Shorty 2.0.0

Each website installs Shorty as a local dependency. For a new, empty project, first create a temporary bootstrap checkout of the public Shorty repository at the release commit. Git must be installed; the public repository is fetched over HTTPS.

Run these steps in a terminal:

```sh
export SHORTY_BOOTSTRAP_DIR="$(mktemp -d)"
git clone --no-checkout https://github.com/francisweber/Shorty.git "$SHORTY_BOOTSTRAP_DIR"
git -C "$SHORTY_BOOTSTRAP_DIR" checkout --detach v2.0.0

mkdir -p "$HOME/Sites"
mkdir "$HOME/Sites/my-shorty-site"
mise exec node@24.22.2 -- node "$SHORTY_BOOTSTRAP_DIR/bin/shorty.js" init "$HOME/Sites/my-shorty-site"
cd "$HOME/Sites/my-shorty-site"
```

`mkdir` stops if the example project directory already exists. `init` creates the neutral project scaffold and installs Shorty locally; `package.json` selects the release commit and `package-lock.json` records npm's resolved Git commit.

Open `shorty.config.json` and replace the empty `site.url` value with the website's actual canonical HTTP(S) URL. Shorty does not invent a domain; validation and builds need this URL to generate the sitemap.

Run the following commands **from the website project directory**. Docker Desktop or another Docker Engine must be running:

```sh
mise exec node@24.22.2 -- npm ci
mise exec node@24.22.2 -- npm exec -- shorty image build
mise exec node@24.22.2 -- npm exec -- shorty validate
mise exec node@24.22.2 -- npm exec -- shorty build
mise exec node@24.22.2 -- npm exec -- shorty serve
```

`npm ci` performs a reproducible install from the lockfile created by `init`. `shorty image build` builds the runtime image for the installed Shorty version. The development server is available at [http://127.0.0.1:3000/](http://127.0.0.1:3000/) by default. Press `Ctrl+C` to stop it.

## Core principles

- **CMS-independent:** Shorty is not tied to TYPO3, WordPress, Magento, or another CMS.
- **Static-first:** The Core builds static output from project-authored pages and components.
- **Source-independent data:** Components consume defined data structures, not direct database or API connections.
- **Component-based:** Components own their markup, styles, optional behaviour, metadata, and data contracts.
- **Extensible:** Optional tools may build on Shorty's project structure and component contracts without becoming mandatory Core dependencies.
- **External AI-agent compatibility:** Stable IDs, machine-readable component contracts, predictable project structure, explicit CLI interfaces, validation, and diagnostics make customer projects usable by external agents from the beginning. Shorty does not include a built-in agent.
- **Independent customer projects:** Each customer project is a standalone Git repository created from a specific Shorty release and receives no automatic platform updates.
- **No CMS in Shorty:** No editorial backend, user management, database, or CMS workflow is part of the Shorty 2.0 Core scope.
- **No runtime dependency:** Generated static websites do not require Shorty, PHP, Node.js, or a database on their hosting environment.

## Initial technical direction

| Area | Initial direction |
|---|---|
| Host launcher and Container CLI/build orchestration | Node.js on the host for the launcher; Node.js in Docker for Shorty Core |
| HTML template engine | Twig, fixed for Shorty 2.0 |
| Template file extension | `.tpl` (Twig syntax) |
| Twig runtime | PHP inside the Docker Runtime; not required on the host |
| Styles | SCSS, compiled with Dart Sass |
| JavaScript | Native ES Modules |
| Content/data in Shorty 2.0 Core | JSON |
| Schema validation | JSON Schema |
| Dev/build tooling | Node.js Host CLI, Sass and asset processing in Docker, local development server exposed on the host |

The output is static HTML, CSS, JavaScript, assets, and `sitemap.xml`. It can be integrated into CMS or application projects, or deployed directly for small CMS-free websites. API-backed dynamic behaviour and a built-in AI agent are outside the Shorty 2.0 Core scope. External AI-agent compatibility is an architectural requirement from the beginning.

## CLI convention

- Main actions use short commands, e.g. `shorty init`, `shorty build`, `shorty serve`.
- Related subcommands use a colon, e.g. `shorty component:create` and `shorty component:validate`.
- Arguments are separated by spaces, e.g. `shorty init my-project`. A colon is not used to attach argument values.
- Square brackets in documentation mark optional arguments; they are not typed.

See [ADR-0003: CLI command and syntax convention](docs/decisions/ADR-0003-cli-convention.md).

`shorty init` creates a neutral project foundation with one minimal example page and a small base stylesheet. It does not create a styleguide, UI components, or a Starter Kit. Projects define their own visual system and components. Shorty is installed locally per website project from the public GitHub repository; there is no global Shorty installation or public npm package. New projects use `package.json` and `package-lock.json` for the explicit version and resolved commit; `shorty.lock.json` is retained only for transition compatibility.

## CLI commands

| Command | Function |
|---|---|
| `shorty init [project-directory]` | Creates a neutral website project and installs Shorty locally from the clean bootstrap checkout. |
| `shorty image build` | Explicitly builds and checks the local runtime image for the pinned Shorty version. |
| `shorty validate` | Validates project configuration, page data, and component structure and metadata in the container. Component instance data referenced by templates is validated during the build. |
| `shorty build` | Renders the static website into the configured output directory, `dist/` by default. |
| `shorty serve [port]` | Builds the project, starts the local development server, and watches source files for Live Reload. Default port: `3000`. |

Only `shorty image build` builds a runtime image. `validate`, `build`, and `serve` do not build or download the image automatically. To use a different port, run, for example, `mise exec node@24.22.2 -- npm exec -- shorty serve 4000`. The generated website is static and does not need Shorty, Docker, PHP, or Node.js at runtime.

## Documentation

- [Vision and goals](docs/01-vision-and-goals.md)
- [Architecture](docs/02-architecture.md)
- [Component system](docs/03-component-system.md)
- [Data and rendering](docs/04-data-and-rendering.md)
- [Roadmap](docs/05-roadmap.md)
- [Machine-readable component and CLI contracts](docs/06-machine-readable-tooling-contracts.md)
- [Component metadata JSON Schema](schemas/component-metadata.schema.json)
- [Project configuration contract](docs/07-project-configuration.md)
- [Page data JSON Schema](schemas/page-data.schema.json)
- [Project configuration JSON Schema](schemas/shorty-config.schema.json)
- [Shorty release lock JSON Schema](schemas/shorty-lock.schema.json)
- [ADR-0001: Template engine](docs/decisions/ADR-0001-template-engine.md)
- [ADR-0002: Project initialization](docs/decisions/ADR-0002-project-initialization.md)
- [ADR-0003: CLI convention](docs/decisions/ADR-0003-cli-convention.md)
- [ADR-0004: Component identity and discovery](docs/decisions/ADR-0004-component-identity-and-discovery.md)
- [ADR-0005: Twig page composition and JSON content](docs/decisions/ADR-0005-twig-page-composition-and-json-content.md)
- [ADR-0006: Template file extension](docs/decisions/ADR-0006-template-file-extension.md)
- [ADR-0007: External icon-font integration](docs/decisions/ADR-0007-external-icon-font-integration.md)
- [ADR-0008: Component instances and page-local content](docs/decisions/ADR-0008-component-instances-and-page-local-content.md)
- [ADR-0009: Historical Docker build proposal](docs/decisions/ADR-0009-dockerized-build-environment.md)
- [ADR-0010: Historical Mise decision, superseded by ADR-0014](docs/decisions/ADR-0010-project-local-toolchain-management.md)
- [ADR-0011: Automatic XML sitemap generation](docs/decisions/ADR-0011-automatic-xml-sitemap-generation.md)
- [ADR-0012: Navigation component and data model](docs/decisions/ADR-0012-navigation-link-model.md)
- [ADR-0013: External AI-agent compatibility](docs/decisions/ADR-0013-external-ai-agent-compatibility.md)
- [ADR-0014: Docker-only standard environment](docs/decisions/ADR-0014-docker-only-standard-environment.md)
- [ADR-0015: Figma-to-Shorty direction](docs/decisions/ADR-0015-figma-to-shorty-agent-independent-design-integration.md)
- [ADR-0016: Shorty 2.0 release scope and optional extensions](docs/decisions/ADR-0016-shorty-2-release-scope-and-extensions.md)
- [ADR-0017: Separate public Shorty Core repository](docs/decisions/ADR-0017-public-shorty-core-repository.md)

## License

A license has not yet been selected. This prepared copy is not ready for public distribution until the rights review is complete and the project owner adds the chosen license.

## Guiding rule

Twig is the fixed template engine for Shorty 2.0. Shorty focuses on frontend development and static generation; a fundamental template-technology change can be handled deliberately in a future major version.
