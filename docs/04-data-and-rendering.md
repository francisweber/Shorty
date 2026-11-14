# 4. Data and rendering

## 4.1 Core rule

**Components must not need to know where their data comes from.**

A component receives a defined data structure. In v1, Shorty loads that data from the project's JSON files, validates it against the relevant schema, and passes it explicitly to the template. Components do not load external data sources themselves.

For example, a reference component may receive a title, description, location, service/category, date or period, main image, before/after images, and a link.

The source could change in a later, concrete integration, provided the normalized data structure remains compatible. For v1, JSON files are the only required content source; a generic provider framework is not a goal.

## 4.2 Initial source: JSON

The first implementation uses JSON as the content source.

Each page keeps its page template and its associated data together in one page directory. The template defines the page structure and component order. A page-level `page.json` stores general page metadata, while the `components/` subdirectory contains the editorial data for each concrete component instance.

For example:

```text
pages/
└── home/
    ├── home.tpl
    └── data/
        ├── page.json
        └── components/
            ├── gallery-main.json
            ├── gallery-references.json
            └── teaser-intro.json

components/
├── gallery/
│   ├── gallery.json
│   ├── gallery.tpl
│   └── gallery.scss
└── teaser/
    ├── teaser.json
    ├── teaser.tpl
    └── teaser.scss
```

The page template controls composition and order directly:

```twig
{% extends 'layouts/default.tpl' %}

{% block content %}
    {{ component('teaser', 'teaser-intro') }}
    {{ component('gallery', 'gallery-main') }}
    {{ component('gallery', 'gallery-references') }}
{% endblock %}
```

The second argument is the stable component instance ID and matches the JSON filename without the extension. The component helper resolves the component type and the corresponding instance data within the active page's data directory, validates the data against the component type's JSON Schema contract, and passes it explicitly to the component template.

The same component type can be used multiple times on a page with different instance IDs and data. Instance IDs are meaningful identifiers, not random values generated during rendering, and are not automatically used as HTML `id` attributes.

The `page.json` file contains page-level properties and configuration, such as the page title, selected layout, metadata, and SEO settings. It does not assemble the page from a JSON list of components; the page template remains authoritative for structure and order.

The page data structure is not a rigid, universally prescribed content model. Projects may extend it as their requirements evolve. Shorty defines and validates the technical conventions it needs, while project-specific properties remain possible. Content belongs where the project actually needs it, commonly in the relevant page or component instance. Page IDs, component type IDs, component instance IDs, and language identifiers must remain stable and meaningful so that developers and future tooling can locate the correct source data.

### Initial implemented build convention

The first platform build implementation uses `pages/<page-id>/<page-id>.tpl` for each page template and `data/pages/<page-id>/page.json` for its page context. Component instance files use `data/pages/<page-id>/components/<instance-id>.json`. The `shorty build` command discovers page directories, requires the matching template and page JSON, validates page metadata and component instances referenced by literal `component('<type>', '<instance>')` calls, and writes `<page-id>.html` files to the configured output directory. SCSS for used components is compiled into `assets/shorty.css`; their optional JavaScript modules are copied with local JavaScript dependencies and loaded from page-specific native ES-module entry points. The configured project `assets/` tree is copied under `assets/` in the configured output directory; non-partial SCSS files are compiled beside their source-relative paths there and linked into every page. Global JavaScript is copied with its relative files and may be included by page templates. The build also writes `sitemap.xml` to the configured output directory. Sitemap locations use the required absolute HTTP(S) `site.url` and each discovered page's existing `<page-id>.html` output path.

Optional shared data may be organized in a project-level data area when the same information is genuinely reused across pages. Its structure is chosen by the project rather than imposed by Shorty. The exact shared-data loading lifecycle remains to be defined.

### Sitemap and indexing

Automatic XML sitemap generation is part of every successful build. The project configuration must provide an absolute HTTP(S) base URL as `site.url`; initialization deliberately uses an empty placeholder that must be replaced before validation or build. Shorty derives sitemap entries from discovered pages, not navigation, and uses the existing `<page-id>.html` paths. Each page is included by default. In `data/pages/<page-id>/page.json`, optional `sitemap: false` excludes that page, while `noindex: true` emits `<meta name="robots" content="noindex">` and excludes the page regardless of `sitemap`. The sitemap is written inside the build staging output and promoted with the rest of the output, so a failed build retains the last successful output. URL components are encoded and XML special characters escaped.

Navigation data is maintained separately from page discovery. Internal navigation destinations refer to stable page IDs and are resolved to output URLs during the build. Other destinations use URLs, which may point to external websites or local assets. Navigation menus are explicitly authored and are not generated automatically from the page list.


### Multilingual pages and page data

A logical page has a stable identity across language versions, while its content, URL/slug, and language-specific metadata may differ. A page does not have to exist in every configured language. The page template may be shared across language versions when the composition is the same; if a language genuinely needs a different composition, a language-specific template override may be considered. Missing content must not silently be copied from another language.

The page data organization must keep language-specific page properties and component-instance data associated with the relevant language. A representative structure is:

```text
pages/
└── services/
    └── services.tpl
data/
└── pages/
    └── services/
        ├── de/
        │   ├── page.json
        │   └── components/
        │       └── teaser-intro.json
        └── en/
            ├── page.json
            └── components/
                └── teaser-intro.json
```

The precise language configuration, URL strategy, canonical and hreflang generation, and multilingual sitemap details remain to be specified during implementation. The architecture must preserve the distinction between a logical page and its language-specific representation.

### Navigation data and language resolution

Navigation is a registered component and is included at the layout, page, or component level, depending on its purpose. Global navigation instances are referenced by the layout configuration; page-specific navigation is included by the page template; a component may include a navigation component as part of its own composition. All use the same component system.

A layout configuration identifies global navigation instances and their layout positions, rather than embedding menu content. Positions and navigation references are optional. If a position is not configured, Shorty renders nothing there. The same navigation instance may be reused by multiple layouts.

Navigation data is authored separately from the discovered page list. A shared instance can store language-specific data files, for example `data/shared/components/navigation-main/de.json` and `en.json`. Shorty chooses the file matching the active language. No fallback to another language is performed when the file is missing; the navigation is omitted for that language and an informational message is written to the build log. The build continues.

Navigation items may refer to stable logical page IDs or explicit URLs. An internal reference is resolved against the active language. If the logical page exists in the project but not in the active language, the item is omitted and an informational message is logged. If it has valid child items, it remains as a non-linked grouping item; empty groupings are omitted. If the page does not exist in the project at all, Shorty reports a build diagnostic. External URLs and local asset URLs are retained. Navigation and sitemap generation remain independent.

### Build diagnostics and resilient optional data

Shorty should distinguish between data that is required for a valid build and data that is optional. Missing optional values, optional component features, or optional navigation positions must not cause runtime template errors or stop the build. Components should use documented defaults where appropriate, omit optional markup when data is absent, or render a safe empty state.

Build diagnostics have different severities:

- **Error:** required or structurally invalid input prevents Shorty from producing a valid result. An error may stop the build when continuing would produce broken or misleading output.
- **Warning:** a problem should be reviewed, but the build can continue safely.
- **Information:** optional content or configuration is absent, or a recoverable condition is being handled. The build continues.

The severity must reflect the actual consequence, not merely the fact that a value or file is missing. For example, a missing optional navigation language file or an unconfigured optional layout navigation position is informational. An optional image that is absent should not produce a broken image element; whether its absence merits an informational message depends on the component's contract. A required asset or required data field that makes rendering invalid should produce an actionable diagnostic.

Diagnostics should identify the affected page, component type/instance, data file, or asset where possible, and explain what Shorty did or what the developer needs to correct. Exact policies for individual component fields and asset-processing cases will be specified with the relevant contracts and build features.

## 4.3 Future API data

API integration is a possible later capability, not a v1 requirement. It should be introduced only for a concrete use case. A future build-time integration could retrieve data from a REST or GraphQL API and normalize it into the existing component data contracts. Shorty does not need a broad provider framework for databases, headless CMS platforms, and hypothetical sources before it is needed.

## 4.4 Build-time API access versus runtime API access

These are different execution models.

### Build-time access

The provider fetches API data during the build. Twig renders the resulting data into static HTML. The hosting environment needs no runtime API integration unless the site separately uses client-side scripts.

New source data requires another build to appear in the generated output.

### Runtime access

A browser application fetches data from an API while the application is running. The UI updates based on the response.

This requires runtime JavaScript, including loading and error states, authentication where needed, caching, and data refresh behaviour. It is not part of the initial static-only output target. If dynamic application development becomes a substantial goal, it may be better served by a separate application-oriented tool or a later major version.

## 4.5 Data contracts and schemas

Component contracts should be source-independent and described using JSON Schema.

The schema should cover, as applicable: field names and types, required fields, nested objects and arrays, defaults, enumerations and allowed values, and descriptions for developers and future tooling.

Component metadata and embedded data schemas use JSON Schema Draft 2020-12. The component validator uses AJV 2020 to validate metadata and each embedded `dataSchema`; the build validates component-instance JSON against the corresponding component schema.

## 4.6 Rendering with Twig

Twig is the fixed template engine for Shorty 2.0. Page templates, layouts, component templates, and partials use Twig syntax and the .tpl extension.

Node.js owns the Core and build orchestration. PHP executes Twig during the build inside the Docker Runtime; PHP is not required on the host. The Twig integration should be a clearly organized internal module/service, not a pluggable renderer architecture.

Generated static sites must not require PHP. The Twig worker enables HTML autoescaping and strict-variable checks. These settings are part of the implemented rendering path. A future template-technology change may require deliberate template migration and is not assumed to be a drop-in replacement.

## 4.7 Future framework targets

Vue, React, and Angular targets will require framework-native components and runtime behaviour. They cannot be produced merely by swapping a Twig template extension.

The reusable inputs should be framework-neutral contracts and metadata. Each target will implement the component presentation and behaviour in its own technology.

Shorty 2.0 does not need to provide native framework output. The generated frontend can be used as the visual and structural reference when integrating into a framework. If native application output becomes a real requirement, evaluate it separately rather than adding a general renderer abstraction to v1.


## 4.8 AI-agent-compatible content structure

Shorty does not include a built-in AI agent. However, the project data model and development workflow must be usable by external AI agents from the beginning. Agent compatibility is an architectural requirement, not a promise to add automated editing to v1.

The source project must remain explicit and machine-readable:

- Stable logical page IDs identify pages independently of their output URLs.
- Component type IDs identify reusable implementations.
- Stable component instance IDs identify concrete uses of components.
- Language identifiers make the active language and language-specific data explicit.
- Predictable JSON file locations allow tools to find the source data without inspecting generated output.
- JSON Schema defines valid data structures and can validate proposed changes.
- Component metadata explains the purpose, inputs, and declared capabilities of each component.

An external agent should be able to follow a bounded workflow:

1. Inspect the project configuration and discover available pages and components.
2. Read the relevant component metadata and schema.
3. Locate the correct page- and language-specific instance data.
4. Propose a narrowly scoped change to structured source data.
5. Run explicit schema validation and the project build.
6. Interpret diagnostics and prepare the result for developer review.

The agent must not treat generated HTML, CSS, or JavaScript as the source of truth. Ordinary content changes should target the appropriate structured data. Template or component implementation changes should be made only when the task actually requires them.

Shorty must expose predictable commands and actionable diagnostics so external tools can operate without undocumented knowledge of internal modules. The exact CLI commands and machine-readable output formats remain to be specified in the CLI and architecture design.

Validation and build checks apply equally to human-authored and agent-authored changes. An agent must not bypass schemas, component contracts, or project build rules. Previewing and publishing remain explicit steps; editing source data must not implicitly publish a website.
