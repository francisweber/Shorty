# 6. Machine-readable component and CLI contracts

**Status:** Initial interface proposal for review  
**Scope:** Shorty 2.0 v1  
**Purpose:** Define the minimum stable interfaces used by Shorty itself, developers, and external tools/AI agents.

This document turns the architectural requirements in [ADR-0013](decisions/ADR-0013-external-ai-agent-compatibility.md) into a concrete starting contract. It deliberately separates decisions that can be made now from details that still need implementation validation.

## 6.1 Contract principles

1. A component has one authoritative, machine-readable metadata file.
2. JSON Schema is the authoritative definition of valid component-instance data.
3. Component identity is derived from its project path, not duplicated in metadata.
4. The CLI exposes the same operations to humans and external tools.
5. Machine-readable output has a documented structure and stable diagnostic codes.
6. Validation is available independently of rendering and building.
7. Human-readable output remains the default; machine-readable output is explicitly requested.
8. A contract change must be deliberate and versioned. Unknown major contract versions must not be silently interpreted as the current version.

## 6.2 Component identity and files

A component lives in a directory directly below `components/`. The directory name is its stable component type ID and must follow the existing kebab-case naming convention.

Example:

```text
components/
└── feature-grid/
    ├── feature-grid.json
    ├── feature-grid.tpl
    ├── feature-grid.scss
    ├── feature-grid.js       # optional
    └── assets/               # optional
```

The metadata filename is the component ID plus `.json`. The ID is derived from the directory name and is exposed by discovery results. It is not repeated as an editable `id` property in the metadata file.

The required files and their roles are:

| File | Requirement | Purpose |
|---|---|---|
| `<id>.json` | Required | Machine-readable component metadata and data contract |
| `<id>.tpl` | Required | Twig component template |
| `<id>.scss` | Required | Component styles |
| `<id>.js` | Optional | Component behaviour |
| `assets/` | Optional | Component-owned assets |

The metadata filename and required-file convention are authoritative. A component with missing required files or invalid metadata is not registered as valid.

## 6.3 Metadata document — initial v1 shape

The metadata document uses JSON and contains these required properties:

| Property | Type | Meaning |
|---|---|---|
| `metadataVersion` | integer | Version of the metadata contract; initially `1` |
| `name` | string | Human-readable component name |
| `description` | string | Short explanation of the component's purpose |
| `category` | string | Project-defined component category |
| `dataSchema` | object | JSON Schema for the component-instance data |

The metadata document is validated against the checked-in platform schema at `schemas/component-metadata.schema.json`. This schema is the authoritative definition of the metadata v1 envelope. The embedded `dataSchema` is a separate JSON Schema document; the runtime validates it against the JSON Schema Draft 2020-12 meta-schema before using it to validate component instances.

The initial shape is intentionally small. The component ID comes from the directory name. The metadata does not repeat file paths that can be derived from the component convention.

Example:

```json
{
  "metadataVersion": 1,
  "name": "Feature Grid",
  "description": "Displays a group of features in a responsive grid.",
  "category": "content",
  "dataSchema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "headline": {
        "type": "string",
        "description": "Optional heading displayed above the grid."
      },
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "text": { "type": "string" }
          },
          "required": ["title", "text"],
          "additionalProperties": false
        }
      }
    },
    "required": ["items"],
    "additionalProperties": false
  }
}
```

### Validation rules

- Metadata must be valid JSON and conform to `schemas/component-metadata.schema.json`.
- `metadataVersion` must be supported by the running Shorty version.
- Required string properties must not be empty or whitespace-only.
- `dataSchema` must be a valid JSON Schema using the JSON Schema 2020-12 dialect.
- Component-instance JSON is validated against `dataSchema`.
- Unknown metadata properties are rejected in v1.
- The component ID is derived from the directory name; a conflicting manually declared ID is not possible because the metadata shape does not contain one.

The exact allowed category vocabulary is project-defined in v1. Shorty may display categories in the Inspector but must not require a global fixed list of categories.

## 6.4 Component discovery result

Discovery returns a normalized registry entry. Consumers must use this result rather than independently reconstructing component information from directory contents.

A valid entry contains:

- `id`: directory-derived component type ID.
- `name`, `description`, and `category`: metadata values.
- `directory`: project-relative component directory.
- `files`: normalized project-relative paths for metadata, template, stylesheet, and optional JavaScript.
- `dataSchema`: the parsed JSON Schema.
- `variants` and `dependencies`: omitted until their contract is defined.

Discovery reports invalid components as diagnostics. It must not silently skip them or expose them as valid registry entries. Whether discovery continues after finding an invalid component is a command-level policy; the diagnostics must retain every detected issue.

## 6.5 Instance data contract

A component instance is identified by its stable instance ID within its page context. Its JSON file remains in the page's component data directory, as defined in the component-system documentation.

The component type's `dataSchema` validates every instance of that type. The instance ID and page ID are contextual identifiers; they are not required to be embedded in the editorial JSON document.

Validation must be possible without rendering Twig. A validation result identifies the component type, instance ID, page ID, language (when applicable), source file, and JSON Schema location for each error where that information is available.

## 6.6 CLI output modes

Human-readable output is the default. Commands that support machine-readable output accept:

```bash
shorty <command> --format json
```

The `--format` option is a global output-format option. The initial supported values are:

- `text`: readable terminal output; default.
- `json`: one JSON document written to standard output.

When JSON mode is selected:

- Standard output contains only the JSON result document; no banners, progress messages, prompts, or decorative formatting.
- Progress and non-result logging go to standard error.
- Commands must not prompt interactively. Missing required input is reported as a usage diagnostic.
- The process exit code remains meaningful and agrees with the top-level `ok` result.

## 6.7 JSON result envelope

Every command that supports JSON output uses the same top-level envelope:

```json
{
  "schemaVersion": 1,
  "ok": true,
  "command": "component:list",
  "data": {},
  "diagnostics": []
}
```

Properties:

| Property | Type | Meaning |
|---|---|---|
| `schemaVersion` | integer | Version of the CLI result envelope; initially `1` |
| `ok` | boolean | Whether the requested operation completed successfully |
| `command` | string | Canonical command name |
| `data` | object or array or null | Command-specific successful result |
| `diagnostics` | array | Structured warnings, errors, and informational messages |

A command may return partial `data` when it can safely do so, but `ok` is false if the requested operation failed or validation errors prevent its intended result. The presence of warnings alone does not make `ok` false.

## 6.8 Diagnostic contract

Each diagnostic uses this shape:

```json
{
  "severity": "error",
  "code": "SHORTY_COMPONENT_SCHEMA_INVALID",
  "message": "Component instance data does not match its schema.",
  "file": "data/pages/home/components/feature-grid-home.json",
  "line": null,
  "column": null,
  "pointer": "/items/0/title",
  "componentId": "feature-grid",
  "instanceId": "feature-grid-home",
  "pageId": "home",
  "language": "en"
}
```

Required properties are `severity`, `code`, and `message`. Other properties are optional and omitted when they cannot be determined.

- `severity`: `error`, `warning`, or `info`.
- `code`: stable, documented machine-readable identifier. Consumers must not parse the human-readable message to determine error type.
- `message`: concise human-readable explanation.
- `file`: project-relative path where applicable.
- `line` and `column`: source position where available.
- `pointer`: JSON Pointer to the invalid value where applicable.
- `componentId`, `instanceId`, `pageId`, and `language`: contextual identifiers where applicable.

Diagnostic codes are stable API. Wording in `message` may improve over time without changing the code's meaning.

## 6.9 Exit codes

The initial process exit-code convention is:

| Exit code | Meaning |
|---|---|
| `0` | Command completed successfully; no errors |
| `1` | Operation failed, including validation or build errors |
| `2` | Invalid command usage or arguments |
| `3` | Required project schema is missing |

Warnings and informational diagnostics do not by themselves cause a non-zero exit code. A command that cannot complete because of an error must return a non-zero code.

## 6.10 Initial command surface

The following commands define the intended public interface. The implementation status below distinguishes commands already available in the current CLI from commands that remain planned.

| Command | Purpose | Machine-readable result |
|---|---|---|
| `shorty component:list` | Discover and list registered components | Text output implemented; JSON output planned |
| `shorty component:validate <id>` | Validate one component's metadata, files, and contract | Text output implemented; JSON output planned |
| `shorty validate` | Validate project configuration, existing page-level sitemap properties, and component metadata/file structure | Text output implemented; page-property and metadata schemas validated; template-referenced component instance traversal and JSON output not implemented |
| `shorty init [directory]` | Create the neutral project scaffold and pin its public Shorty dependency | Text output implemented; JSON output planned |
| `shorty build` | Generate static HTML pages, assets, and sitemap | Twig HTML, page/component instance schema validation, component/global SCSS, copied project assets, component ES modules, and XML sitemap implemented; JSON output not implemented |
| `shorty serve [port]` | Build, serve locally, and rebuild on source changes | Text output implemented; JSON output planned |
| `shorty component:create <id>` | Create a component scaffold | Text output implemented; JSON output planned |
| `shorty image build` | Build and verify the local Shorty Runtime image explicitly | Implemented; no implicit build or download from ordinary project commands |

Existing command names remain subject to ADR-0003. Adding JSON output must not change the meaning of existing text-mode commands.

## 6.11 Compatibility and evolution

- Metadata and CLI result envelopes are independently versioned.
- Adding an optional property is normally a compatible change.
- Removing or changing the meaning/type of a required property is a breaking contract change.
- Diagnostic codes are stable; message text is not a machine interface.
- Unsupported major contract versions produce an actionable error rather than best-effort interpretation.
- External tools should tolerate unknown optional properties and should not assume undocumented fields.



## 6.13 Current CLI implementation — component commands

The first implemented CLI milestone covers component scaffolding, component validation, and component discovery. The current implementation uses the metadata contract and central schema described above.

### Implemented commands

```bash
node bin/shorty.js component:create <id>
node bin/shorty.js component:create <id> --with-js
node bin/shorty.js component:validate <id>
node bin/shorty.js component:list
node bin/shorty.js --help
```

- `component:create` creates the required `<id>.json`, `<id>.tpl`, and `<id>.scss` files.
- The optional `--with-js` flag also creates `<id>.js`.
- The metadata scaffold is validated before files are written. If creation fails partway through, the command attempts to remove the files it created.
- `component:validate` checks the component name, required files, metadata JSON, the metadata envelope schema, and the embedded JSON Schema Draft 2020-12 meta-schema.
- `component:list` inspects component directories and reports each component as `valid`, `incomplete`, or `invalid`, including detected diagnostics.
- Required `.tpl` and `.scss` files must exist as regular, non-empty files. The metadata file must exist and contain valid JSON.
- The metadata envelope and embedded data schema are validated with AJV 8 using its Draft 2020-12 implementation.

### Component creation and listing behaviour

The current scaffold and listing commands follow these rules:

- Component IDs must use lowercase kebab-case: start with a lowercase letter and contain lowercase letters, digits, and single hyphen-separated segments.
- `component:create` creates the three required files in the configured components directory. It must not overwrite an existing component directory.
- `--with-js` adds the optional JavaScript scaffold; without the flag, no JavaScript file is created.
- Unknown options and extra positional arguments are usage errors (exit code `2`).
- `component:list` sorts component directories by ID and reports each component as `valid`, `incomplete`, or `invalid`. It includes per-component diagnostics and a total status summary.
- An incomplete or invalid component does not make the listing operation itself fail; use `component:validate` or `validate` to obtain a validation exit code.

The CLI integration tests cover scaffold contents, optional JavaScript generation, invalid names, duplicate creation, sorted status reporting, empty component directories, and argument errors.

### Current exit-code behavior

| Exit code | Current component CLI meaning |
|---|---|
| `0` | Command succeeded; validation passed |
| `1` | Component validation or operation failed |
| `2` | Invalid command usage or arguments |
| `3` | Central component metadata schema is missing |

### Current scope and limitations

The implemented commands currently provide human-readable terminal output. Project-wide `validate`, static-site `build`, and explicit Runtime image management are implemented as listed in the command table above. Component metadata and page sitemap properties are schema-validated; component-instance data is checked during build. The `--format json` output mode and the versioned JSON result envelope in sections 6.6–6.8 remain contract targets and are not yet implemented.

## 6.12 Deliberately deferred

The following are not fixed by this initial contract:

- Component variants and their schema.
- Preview/default data format and whether it lives in metadata or a separate file.
- Dependency declarations and asset dependency graphs.
- A fixed category taxonomy.
- Exact discovery continuation policy after invalid components.
- Complete diagnostic code catalogue.
- Exact command-specific `data` payloads.
- Whether JSON output is supported by every command in the first implementation.

These details should be resolved through implementation and tests, without weakening the stable principles and envelope defined here.

## 6.14 Current CLI implementation — project initialization

The initial project initializer is available as:

```bash
shorty init
shorty init <project-directory>
```

- Without an argument, the current working directory is initialized.
- With a directory argument, the target is resolved relative to the current working directory.
- The project name is derived from the target directory name.
- The initializer creates `shorty.config.json` and all seven standard directories defined by the project configuration contract.
- The initializer creates a private local npm project and installs `shorty-cli` from the public GitHub repository using the full immutable Git commit of the currently installed Shorty version.
- `package.json` records the Shorty version and exact Git commit; npm creates `package-lock.json` from the actual installation. New projects do not create `shorty.lock.json` as a second version authority.
- `.npmrc` contains `allow-git=root` for npm 12 Git dependency approval. Existing compatible `.npmrc` settings are preserved.
- `init` runs on the host because it creates static files and performs the local npm installation. It does not require Docker or the runtime image.
- If package files already exist, `init` proceeds only when they already bind the same Shorty version and commit and that package is installed. A mismatched or partial package setup is not overwritten.
- The initializer adds a neutral base layout, one minimal example page with page data, and a small base SCSS file. It does not add UI components, a styleguide, design tokens, or a Starter Kit.
- Existing standard directories are preserved.
- An existing `shorty.config.json` is never overwritten.
- An existing `shorty.lock.json` is never overwritten.
- Existing files at any starter-file path are never overwritten; initialization stops before writing if one is present.
- If a standard directory path is occupied by a regular file, initialization stops before writing the configuration.
- The initializer writes the supported v1 configuration shape with `site.url` intentionally empty as a placeholder. The user must set an actual HTTP(S) base URL before `validate` or `build`; existing projects without `site.url` must migrate their configuration. Project validation runs inside the Docker Runtime.

The first invocation in an empty directory uses a temporary clean checkout selected by full commit: clone the public Git repository without checking out a moving branch, detach at the selected commit, then run its `bin/shorty.js init` with Node. The initializer installs the matching dependency into the website project and verifies npm's resolved lock entry. It does not publish to npm, install Shorty globally, build or download the Docker image, or automatically update an existing Shorty version. After initialization, `npm exec -- shorty image build` explicitly builds the local runtime image. The starter files are ordinary editable project source, not a centrally maintained component library.
