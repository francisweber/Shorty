# 7. Project configuration contract

**Status:** Initial v1 contract  
**Scope:** Shorty 2.0  
**Purpose:** Define the project entry point, configurable directory paths, defaults, and the rules used to resolve and validate project paths.

This document defines the configuration consumed by Shorty Core when it opens one active project. The machine-readable schema is [shorty-config.schema.json](../schemas/shorty-config.schema.json).

## 7.1 Contract principles

1. Every Shorty project has one root-level `shorty.config.json`.
2. The configuration is the authoritative entry point for project identity and managed directory paths.
3. Standard directory names are the default and expected convention. Most projects should not need path overrides.
4. Individual paths may be overridden for integration with an existing project structure.
5. Omitted path entries are resolved to the documented defaults by Shorty Core.
6. All configured paths are relative to the project root, never to the shell's current working directory or the Shorty installation.
7. Path resolution and validation are centralized in Core. Individual modules receive an already resolved project context.
8. Unknown configuration properties and unsupported configuration versions are errors, not silently ignored.

## 7.2 Configuration file location

The file is named exactly:

```text
shorty.config.json
```

It lives at the root of the active project. Shorty commands resolve the project root by locating this file according to the CLI's project-discovery rules. Once the root is known, every configured path is resolved against that root.

The initial project-discovery behaviour is deliberately explicit: Shorty must not guess a project from the presence of arbitrary folders such as `components/` or `pages/`. If no project configuration can be found, the CLI reports an actionable error and points to `shorty init`.

Shorty is installed as a project-local dependency from the public GitHub repository. The website's `package.json` records the selected Shorty version and exact Git commit; `package-lock.json` records npm's resolved Git commit. New projects do not create `shorty.lock.json` as a second version authority. Existing `shorty.lock.json` files are read only for transition compatibility. Shorty is not installed globally or from the public npm registry.

For npm 12 Git dependency approval, a new project's `.npmrc` contains `allow-git=root`. Git and HTTPS access to the public GitHub repository is required for installation. Node.js `>=24` and npm `>=10.2.0` are required on the host. The launcher checks these versions before valid commands and verifies Git before `shorty init`, before creating project files. Help output does not require the checks. Shorty does not install or update host tools. Docker is required to build the Runtime image and run project commands that use containers; PHP and Composer are provided inside the Shorty runtime image, not required on the host.

The legacy lock file has this initial shape:

```json
{
  "lockVersion": 1,
  "shortyVersion": "2.0.0"
}
```

Its machine-readable contract is [shorty-lock.schema.json](../schemas/shorty-lock.schema.json). It is not generated for new projects. When present in an existing project, Shorty validates it and checks it against the installed Shorty version. Projects without this file remain accepted without legacy-lock version enforcement.

## 7.3 Minimal configuration shape

```json
{
  "configVersion": 1,
  "project": {
    "name": "my-project"
  },
  "site": {
    "url": "https://example.com/"
  }
}
```

The `site.url` property is required: it is the absolute HTTP or HTTPS base URL used to generate sitemap locations. Use the actual canonical site URL for the project. Shorty does not infer or create a domain. `shorty init` writes an empty value as a deliberate placeholder; replace it before running `shorty validate` or `shorty build`. Existing projects created before `site.url` was introduced must add this property before they can validate or build with this version. The `paths` object is optional. A project that follows the standard structure does not need to declare any paths.

## 7.4 Standard paths

Shorty Core applies these defaults when the corresponding override is omitted:

| Configuration key | Default path | Purpose |
|---|---|---|
| `paths.components` | `components` | Component type directories |
| `paths.pages` | `pages` | Page templates and page definitions |
| `paths.layouts` | `layouts` | Shared page layouts |
| `paths.data` | `data` | Project, page, and component-instance data |
| `paths.assets` | `assets` | Source assets such as SCSS, JavaScript, fonts, and images |
| `paths.schemas` | `schemas` | Project-level JSON Schemas |
| `paths.output` | `dist` | Generated static website |

Defaults are part of the v1 configuration contract. A future change to a default that changes where an existing project reads source files or writes output is a compatibility change and must be versioned and documented deliberately.

## 7.5 Path overrides

Projects may override any subset of the standard paths. Unspecified entries retain their defaults.

Example:

```json
{
  "configVersion": 1,
  "project": {
    "name": "my-project"
  },
  "site": {
    "url": "https://example.com/"
  },
  "paths": {
    "assets": "frontend/assets",
    "output": "public"
  }
}
```

In this example, components, pages, layouts, data, and schemas continue to use their standard locations. Only the assets source directory and generated output directory change.

Path overrides are intended for exceptional integration needs, not as a reason to invent a different directory convention for every project. New projects created by `shorty init` should use the standard paths.

## 7.6 Path syntax and safety

Configured paths must:

- Be non-empty strings.
- Be relative to the project root.
- Use forward slashes (`/`) as separators on every operating system.
- Use normalized path segments; `.` and `..` segments are not allowed.
- Not begin with a slash or a Windows drive prefix.
- Not contain backslashes, URL schemes, or traversal outside the project root.

Shorty Core resolves paths using platform-aware filesystem APIs after validating the portable path syntax. It must verify that the final resolved location remains inside the project root. This containment check is required even when the JSON Schema has accepted the string.

Core must also detect path collisions and unsafe overlaps before a build. In particular, the output directory must not overwrite or contain a configured source directory, and it must not be the project root itself. The exact diagnostic code catalogue belongs to the CLI diagnostic contract.

The configuration schema validates the shape and portable syntax of individual paths. Filesystem existence, containment after resolution, collisions, and directory-specific requirements are runtime checks performed by Core.

## 7.7 Configuration schema

The authoritative schema is:

```text
schemas/shorty-config.schema.json
```

It uses JSON Schema Draft 2020-12 and rejects unknown properties.

Required top-level properties:

| Property | Type | Meaning |
|---|---|---|
| `configVersion` | integer constant `1` | Version of this project configuration contract |
| `project` | object | Project identity |
| `site` | object | Site-level settings required for generated URLs |

The `project` object requires:

| Property | Type | Meaning |
|---|---|---|
| `name` | non-empty string | Human-readable project name |

The `site` object requires:

| Property | Type | Meaning |
|---|---|---|
| `url` | absolute HTTP(S) URL | Base URL for sitemap entries; credentials, query strings, and fragments are not accepted |

Optional top-level property:

| Property | Type | Meaning |
|---|---|---|
| `paths` | object | Partial set of path overrides |

Only the seven documented path keys are accepted in `paths`. Unknown top-level, project, or paths properties are rejected.

The schema validates configuration data. It does not mutate the configuration or insert defaults. Default merging and path resolution are explicit Core responsibilities.

## 7.8 Core loading and project context

Project configuration is loaded once at the start of a command that operates on a project. Core then:

1. Locates the project root and reads `shorty.config.json`.
2. Parses the JSON and validates it against the v1 schema.
3. Rejects unsupported `configVersion` values with an actionable diagnostic.
4. Merges the partial `paths` object with the standard defaults.
5. Resolves every path against the project root.
6. Performs containment, collision, and filesystem checks appropriate to the command.
7. Creates one normalized project context and passes it to the modules involved in the operation.

The project context contains the project root, project name, configuration version, original configuration, and resolved absolute/project-relative path information. Modules must consume this context rather than independently reading `shorty.config.json`, applying defaults, or resolving paths.

A command invoked from a project subdirectory must still resolve paths from the discovered project root. Changing the shell's current working directory must not change the meaning of a configured path.

## 7.9 Responsibility boundaries

The project configuration describes project identity and filesystem layout. It does not replace the package manager, toolchain manager, or content model.

| Concern | Authoritative location |
|---|---|
| Project name and managed directory paths | `shorty.config.json` |
| Project-local Shorty dependency, selected version, and resolved Git commit | Website `package.json` and `package-lock.json` |
| npm 12 approval for the public Git dependency | Website `.npmrc` |
| Shorty runtime tool versions | Shorty runtime Dockerfile and runtime lockfiles |
| PHP/Twig runtime dependencies | Composer manifests inside the Shorty package; installed during Docker image construction |
| Legacy Shorty release metadata | Optional `shorty.lock.json` during transition only |
| Component contracts | Component metadata and `dataSchema` |
| Page and editorial content | Project JSON data files |
| Build output | Resolved `paths.output` |

Tool versions, dependency declarations, page/component inventories, navigation, SEO content, design tokens, and customer-specific settings do not belong in this initial configuration contract.

## 7.10 Standard project structure

A project using the defaults follows this convention:

```text
my-project/
├── shorty.config.json
├── .npmrc
├── package.json
├── package-lock.json
├── .gitignore
├── components/
├── pages/
├── layouts/
├── data/
├── assets/
├── schemas/
└── dist/
```

`shorty.lock.json` may remain in an older project for transition compatibility; `shorty init` does not create it. Website projects do not need their own Composer project or Mise configuration for the standard Docker workflow. Composer manifests and PHP dependencies belong to Shorty's installed runtime package and Docker image.

Not every project must contain every directory at initialization time. Core reports missing directories when a command requires them; it does not silently create or relocate source directories during ordinary validation or build operations. The project initializer may create the standard structure for a new project.

## 7.11 Compatibility and evolution

- `configVersion` is independent of the Shorty release version and component `metadataVersion`.
- A Shorty release must explicitly declare which configuration versions it supports.
- Unsupported configuration versions are rejected; Core must not guess how to interpret them.
- Adding an optional property is normally compatible.
- Removing a property, changing its type or meaning, or changing a standard path default is a contract change and requires deliberate versioning.
- The configuration schema and this document must be updated together.
- A project initializer must generate a configuration accepted by the schema shipped with the corresponding Shorty release.
