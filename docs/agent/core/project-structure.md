# Shorty Project Structure

This document describes how an external agent should identify and navigate a Shorty 2.0 customer project. It documents current Core contracts, not an idealized or future layout.

## 1. Platform repository versus customer project

Keep these repositories separate:

- The Shorty platform repository contains Core, CLI, Runtime, schemas, documentation, tooling, and the project initializer.
- A customer project is an independent website project initialized from a selected Shorty release. It contains its own configuration, pages, layouts, components, data, assets, and generated output.
- A customer project uses a project-local Shorty dependency pinned through its package manifest and lockfile. It does not load components or content from the platform repository at runtime.
- A customer project does not automatically inherit later Shorty changes. Updates are deliberate project-level operations.

Do not treat a test project, the platform repository, or another customer project as the active project unless the task explicitly identifies it.

## 2. Find the project root

The project root is the directory containing the project's shorty.config.json.

Before editing:

1. Locate shorty.config.json and confirm that it belongs to the intended project.
2. Read and validate its contents against the supported configuration contract.
3. Inspect the Git repository and working tree.
4. Identify the installed Shorty version and the dependency commit selected by the project.
5. Resolve managed paths from the configuration.

Do not infer a project root merely because a directory contains components, pages, or dist. Do not use the current shell directory as a substitute for the discovered root.

## 3. Standard project tree

A project using the default paths follows this structure:

    my-project/
    ├── shorty.config.json
    ├── package.json
    ├── package-lock.json
    ├── .npmrc
    ├── .gitignore
    ├── components/
    │   └── <component-type-id>/
    ├── pages/
    │   └── <page-id>/
    │       └── <page-id>.tpl
    ├── layouts/
    ├── data/
    │   └── pages/
    │       └── <page-id>/
    │           ├── page.json
    │           └── components/
    │               └── <component-instance-id>.json
    ├── assets/
    ├── schemas/
    └── dist/

This is a map of standard conventions, not a requirement that every directory already exists. Do not create empty directories merely to make the tree look complete.

## 4. Configuration and resolved paths

The root-level shorty.config.json defines project identity, canonical site URL, and optional managed-directory overrides.

| Configuration key | Default | Purpose |
|---|---|---|
| paths.components | components | Component type directories |
| paths.pages | pages | Page directories and Twig templates |
| paths.layouts | layouts | Shared page layouts |
| paths.data | data | Page and component-instance JSON data |
| paths.assets | assets | Project-level source assets |
| paths.schemas | schemas | Project-level JSON Schemas |
| paths.output | dist | Generated static website |

Path overrides are partial: omitted entries retain defaults. Resolve every path against the project root, not the shell's current working directory. Never hardcode a default path in an agent workflow when the project may override it.

The site.url value must be the real absolute HTTP(S) canonical URL. shorty init leaves an empty placeholder. Shorty does not guess the domain; replace the placeholder before project validation or a build.

Configured paths are relative to the project root and subject to Core validation. Do not introduce absolute paths, traversal segments, or overlapping source/output directories.

See [Project configuration](../../07-project-configuration.md) and [shorty-config.schema.json](../../../schemas/shorty-config.schema.json).

## 5. Pages and page data

A page has a stable logical page ID. In the current implemented build convention:

- Page directory: <configured-pages>/<page-id>/
- Twig template: <configured-pages>/<page-id>/<page-id>.tpl
- Page context: <configured-data>/pages/<page-id>/page.json
- Component instance data: <configured-data>/pages/<page-id>/components/
- Generated page: <page-id>.html in the configured output directory

Example using default paths:

    pages/
    └── home/
        └── home.tpl

    data/
    └── pages/
        └── home/
            ├── page.json
            └── components/
                ├── teaser-intro.json
                └── gallery-main.json

The page template controls structure and component order. JSON data does not act as a component list or page-builder manifest.

The page ID, component type ID, and component instance ID are different identifiers. Do not derive a page ID from its output URL or assume that a component instance ID is an HTML id.

Multilingual page data and URL handling are not part of the current Shorty 2.0 Core build contract. Do not create language directory conventions or imply multilingual build support unless a later project-specific extension defines them.

## 6. Components

The configured component directory contains one directory per component type. Each directory is named after its stable component type ID.

A registered component requires three files sharing the component ID as basename: JSON metadata, a Twig .tpl template, and an SCSS stylesheet. An optional JavaScript module and optional assets directory may be present.

Components are discovered from the active customer project's configured component directory. There is no global component catalogue and no runtime lookup in the Shorty platform repository. See [Component model](component-model.md).

## 7. Layouts, assets, and schemas

- Layouts provide shared page-level template structure. Inspect actual layout files and references before changing them.
- Project assets live in the configured assets directory. This can include global SCSS, JavaScript, fonts, images, and other source files.
- Component assets belong to the component that requires them and live inside that component's assets directory.
- Project-level JSON Schemas live in the configured schemas directory where needed. Component data schemas are embedded in component metadata under dataSchema.

Do not assume a design-token file, global stylesheet name, JavaScript entry point, or layout filename. Discover the actual project files and follow established conventions.

## 8. Generated output

The configured output directory (dist by default) contains generated static files, including HTML, CSS, JavaScript, copied assets, and sitemap.xml.

Treat this directory as build output, not source:

- Do not implement changes by editing generated HTML, CSS, or JavaScript.
- Do not use generated output as the only source of truth for page composition or component data.
- Do not delete the previous successful output before a build.
- If a build fails, preserve the previous output and inspect diagnostics.
- Use the configured output path, not an assumed dist path.

The generated website is static and does not require Shorty, Node.js, PHP, Docker, or a database at runtime.

## 9. Project-local Shorty installation

A customer project installs Shorty locally from the public GitHub repository. package.json selects the Shorty version/commit and package-lock.json records the resolved dependency commit. .npmrc contains Git dependency approval required by the documented npm workflow.

Do not assume a global Shorty installation or a public npm package. Do not modify dependency pins or rebuild the Runtime image as an incidental part of an unrelated content task.

The optional legacy shorty.lock.json is retained only for transition compatibility; it is not a second version authority for newly initialized projects.

## 10. Agent discovery checklist

Before making a change, establish:

- [ ] The intended customer project and its root configuration.
- [ ] The actual Shorty version and pinned Git dependency.
- [ ] The configured paths, including overrides.
- [ ] The target page ID and page template, if a page is involved.
- [ ] The component type ID and metadata/schema, if a component is involved.
- [ ] The component instance ID and JSON data file, if instance content is involved.
- [ ] The relevant layout, styles, scripts, and assets.
- [ ] The generated output path.
- [ ] The current Git state and any unrelated user changes.

If any of these facts are unknown, inspect the project rather than guessing.

## Related documents

- [Agent knowledge architecture](../README.md)
- [Project discovery workflow](../project-discovery.md)
- [Component model](component-model.md)
- [Shorty project configuration](../../07-project-configuration.md)
- [Architecture](../../02-architecture.md)
- [Component system](../../03-component-system.md)
- [Data and rendering](../../04-data-and-rendering.md)
- [ADR-0004: Component identity and discovery](../../decisions/ADR-0004-component-identity-and-discovery.md)
- [ADR-0005: Twig page composition and JSON content](../../decisions/ADR-0005-twig-page-composition-and-json-content.md)
- [ADR-0008: Component instances and page-local content](../../decisions/ADR-0008-component-instances-and-page-local-content.md)
