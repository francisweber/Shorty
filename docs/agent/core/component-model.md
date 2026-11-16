# Shorty Component Model

This document explains how an external agent must understand, locate, create, and modify components in a Shorty 2.0 project. It distinguishes implemented contracts from future design ideas.

## 1. What a component is

A Shorty component is a registered, reusable implementation unit. It owns its Twig template, SCSS source, technical metadata, and data contract. It may also own a JavaScript module and component-specific assets.

A component is not the same thing as a page, a particular use of a component on a page, an unregistered Twig partial, a visual design reference, or a prebuilt UI element supplied by Shorty.

Shorty 2.0 initializes a neutral project. Customer projects define their own components and visual systems.

## 2. Component directory contract

Every component lives in its own directory directly under the configured components directory. The directory name is the component type ID.

Example:

    components/
    ├── navigation/
    │   ├── navigation.json
    │   ├── navigation.tpl
    │   ├── navigation.scss
    │   └── navigation.js
    └── gallery/
        ├── gallery.json
        ├── gallery.tpl
        ├── gallery.scss
        └── assets/

For a component type ID of gallery, the required files are:

| File | Requirement | Responsibility |
|---|---|---|
| gallery.json | Required | Technical metadata and embedded dataSchema |
| gallery.tpl | Required | Twig markup |
| gallery.scss | Required | Component styles |
| gallery.js | Optional | Native JavaScript ES module |
| assets/ | Optional | Files intrinsic to this component |

The required template and stylesheet must be regular, non-empty files. Metadata must be valid JSON and conform to component metadata v1. Its embedded data schema must be a valid JSON Schema Draft 2020-12 document.

Do not add files with different basenames, invent a separate component ID field, or create a central manual registration list. The directory name is the identity; the metadata filename uses the same basename.

## 3. Component type IDs and instance IDs

These identifiers represent different things and must never be conflated.

### Component type ID

Identifies the reusable implementation. It is derived from the component directory name.

Example: gallery

### Component instance ID

Identifies one concrete use of that type on one page. It is stable, meaningful, and unique within the page's instance-data namespace.

Examples: gallery-main, gallery-references

The instance ID is the basename of the JSON file containing that instance's editorial data. It is not randomly generated at render time and does not automatically become an HTML id attribute.

One component type can be used multiple times on the same page:

    {{ component('gallery', 'gallery-main') }}
    {{ component('gallery', 'gallery-references') }}

Each invocation resolves a different page-local JSON file while reusing the same registered implementation.

## 4. Page composition and instance data

Page structure is authored directly in the page's Twig template. The template determines which components appear and in which order.

With the current default paths:

    pages/
    └── home/
        └── home.tpl

    data/
    └── pages/
        └── home/
            ├── page.json
            └── components/
                ├── gallery-main.json
                └── gallery-references.json

The component invocations in home.tpl identify the component type and instance ID explicitly. The helper resolves the component type, loads the matching JSON file in the active page context, validates it against the component's dataSchema, and passes an explicit data context to the component template.

Important boundaries:

- The page template owns composition and order.
- page.json contains page-level context/metadata.
- Each component instance JSON contains editorial data for that use.
- The reusable component implementation does not own page-specific editorial content.
- A JSON array of component instances is not the page composition mechanism.
- Resolve actual project paths from shorty.config.json; the paths above show defaults.

## 5. Metadata and data contract

The component-named JSON file is a technical contract, not the instance's editorial content.

The implemented metadata v1 envelope requires:

| Property | Meaning |
|---|---|
| metadataVersion | Integer constant 1 |
| name | Non-empty human-readable name |
| description | Non-empty description |
| category | Non-empty category |
| dataSchema | JSON Schema Draft 2020-12 object |

The authoritative envelope is schemas/component-metadata.schema.json in the Shorty platform repository. It rejects unknown top-level properties (additionalProperties: false). The dataSchema property contains the schema for each component instance's JSON data.

A minimal illustrative metadata document:

    {
      "metadataVersion": 1,
      "name": "Gallery",
      "description": "Displays a collection of images.",
      "category": "media",
      "dataSchema": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "images": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["src", "alt"],
              "properties": {
                "src": { "type": "string" },
                "alt": { "type": "string" }
              },
              "additionalProperties": false
            }
          }
        },
        "required": ["images"],
        "additionalProperties": false
      }
    }

This example is illustrative, not a prescribed Gallery component shipped by Shorty. Define fields to match the actual component's requirements. The schema and template must agree: do not add a required schema field that the implementation cannot use, and do not make the template depend on undocumented fields.

Do not silently add metadata properties such as figmaComponentId. The current metadata schema rejects unknown top-level properties, and the Figma source-ID question is an explicit contract gap recorded in ADR-0015. It needs a deliberate schema/ADR decision before an agent may persist such a property.

## 6. Component versus partial

A registered component has its own component directory, metadata, data contract, template, and stylesheet.

A Twig partial is an internal template fragment used by another template. It is not automatically registered, independently discoverable, or a standalone component with a data contract.

For example, a gallery component may render each image using a private gallery-item partial. If the item must be reused independently across the project, consider whether it should become a registered component with its own contract.

Do not create a registered component merely because a Twig file is reusable internally.

## 7. Styling, JavaScript, and assets

### SCSS

Every component owns its required SCSS file. Component styles are compiled into the project's CSS output by the Shorty build. Follow the project's established class naming, tokens, breakpoints, and layering conventions; do not invent a competing design system.

### JavaScript

A component may provide a native ES module when it needs interactive behaviour. A component without behaviour does not need an empty JavaScript file.

Do not assume a particular initialization API or global JavaScript framework. Inspect existing components and current Shorty runtime behaviour before implementing interactions.

### Component assets

The optional component assets directory is for assets intrinsic to the component implementation. Editorial images and media belong in the project's central assets area and are referenced from instance data.

The build copies required component assets into component-specific output paths. Do not hardcode output locations without inspecting the current build contract.

## 8. Discovery and validation

Shorty automatically discovers component directories from the active project's configured components directory. There is no central import list and no global component catalogue.

Current relevant commands include:

    shorty component:list
    shorty component:validate <component-name>
    shorty validate
    shorty build

Their scopes differ:

- component:list reports discovered components, validity status, and diagnostics.
- component:validate inspects one component.
- validate checks project configuration, page data/metadata, and component structure and metadata. It does not traverse every Twig template to validate all component instances.
- build validates component-instance data referenced by supported component invocations and renders the static site.

The CLI currently presents human-readable output. Do not assume JSON output or undocumented flags.

A component with invalid or incomplete required files/metadata must not be treated as valid. Read diagnostics and fix the source contract rather than bypassing validation.

## 9. Implemented versus future capabilities

The following are not implemented as Shorty 2.0 Core contracts and must not be assumed:

- A built-in UI component library or Starter Kit.
- A Visual Inspector.
- A defined component variant model or variant discovery.
- A finalized defaults/preview-data contract.
- A component dependency graph contract.
- A Figma component ID field in metadata.
- Automatic Figma synchronization or regeneration.
- A built-in AI agent or machine-readable CLI output.

ADR-0015 records the intended agent-independent Figma-to-Shorty direction, but defers detailed mapping and metadata decisions. ADR-0016 keeps Figma integration and the Visual Inspector outside the narrow Core release scope.

## 10. Agent workflow for component changes

Before changing a component:

1. Discover the active project and resolve its configured component/data paths.
2. Read the component's metadata and embedded data schema.
3. Inspect the template, SCSS, optional JS, and assets.
4. Identify all pages and component instances that use the component.
5. Inspect the Git working tree and preserve unrelated changes.
6. Define the intended change and acceptance criteria.

When implementing:

1. Keep the existing component type ID unless a deliberate migration is required.
2. Keep required file basenames aligned with that ID.
3. Update the data schema and template together when the data contract changes.
4. Update affected instance JSON files when a contract change requires it.
5. Keep page-specific content in page-local instance files.
6. Avoid unrelated refactoring and generated-output edits.

After implementing:

1. Run shorty component:validate <component-name>.
2. Run shorty validate.
3. Run shorty build when the component or its data is used by pages.
4. Inspect rendered output when visual or interactive behaviour is in scope.
5. Review the final diff and report checks honestly.

For safe regeneration, create and validate a candidate in isolation before replacing a working component. See [Validation workflow](../validation-workflow.md).

## Related documents

- [Project structure](project-structure.md)
- [Project discovery workflow](../project-discovery.md)
- [Implementation workflow](../implementation-workflow.md)
- [Validation workflow](../validation-workflow.md)
- [Component system](../../03-component-system.md)
- [Data and rendering](../../04-data-and-rendering.md)
- [Component metadata schema](../../../schemas/component-metadata.schema.json)
- [ADR-0004: Component identity and discovery](../../decisions/ADR-0004-component-identity-and-discovery.md)
- [ADR-0005: Twig page composition and JSON content](../../decisions/ADR-0005-twig-page-composition-and-json-content.md)
- [ADR-0008: Component instances and page-local content](../../decisions/ADR-0008-component-instances-and-page-local-content.md)
- [ADR-0015: Figma-to-Shorty direction](../../decisions/ADR-0015-figma-to-shorty-agent-independent-design-integration.md)
- [ADR-0016: Shorty 2.0 release scope](../../decisions/ADR-0016-shorty-2-release-scope-and-extensions.md)
