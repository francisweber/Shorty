# 3. Component system

This document describes the component model and future design directions; it is not a claim that every capability is implemented in Shorty 2.0. The 2.0 Core does not include a Visual Inspector, multilingual build processing, or a prebuilt UI component library. The Inspector is an optional future extension (ADR-0016). The language-aware navigation model below is a future target and does not ship as a 2.0 build capability.

## 3.1 Component definition

A Shorty component is a registered, reusable unit with:

- Its own template file (\`.tpl\`).
- Its own SCSS source.
- An optional JavaScript module.
- A component-named JSON metadata file containing technical metadata and its data contract.
- Optional variants and dependencies, to be defined in the component model.
- Optional component-specific assets.

Example:

\`\`\`text
components/
├── navigation/
│   ├── navigation.json
│   ├── navigation.tpl
│   ├── navigation.scss
│   └── navigation.js       # optional
├── gallery/
│   ├── gallery.json
│   ├── gallery.tpl
│   ├── gallery.scss
│   └── assets/             # optional
└── teaser/
    ├── teaser.json
    ├── teaser.tpl
    └── teaser.scss
\`\`\`

Shorty 2.0 uses Twig as its fixed template engine. The .tpl extension is the consistent filename convention for Twig templates; it does not make template syntax renderer-independent.

## 3.2 Component identity and automatic discovery

Every component lives in its own directory directly below the active project's component directory.

The directory name is the component type's unique technical ID. For example, \`components/gallery/\` has the ID \`gallery\`.

The ID is derived from the directory name. The component metadata file uses the same name, for example \`gallery/gallery.json\`; the ID is not duplicated as a separately maintained field inside that file.

Shorty discovers component directories automatically and registers valid components. Developers do not maintain a central manual import list.

The registry is project-local: it scans the component directory of the one active customer project. Components are part of that independent project; there is no runtime lookup in the Shorty platform repository or a global component catalogue.

At discovery/registration time, Shorty requires `<id>.json`, `<id>.tpl`, and `<id>.scss` in each component directory. The template and stylesheet must be regular, non-empty files. The metadata file must be valid JSON, conform to the component metadata v1 schema, and contain a valid Draft 2020-12 data schema. Missing required files are reported as an incomplete component; malformed or invalid metadata is reported as invalid. `component:list` reports these statuses and diagnostics, while `component:validate` runs the same inspection for one component. The component CLI tests exercise creation and listing valid, incomplete, and invalid components; they do not cover every validator branch. Discovery provides the project-local component entries used by the build and CLI; a machine-readable CLI result for external tools is not implemented. A future optional Inspector extension may consume the same component information.

Registered components become available to page templates and nested composition. A future optional Inspector extension may consume the same registry.

## 3.3 Component type versus component instance

A component type and a concrete use of that component on a page are different things:

- **Component type ID:** identifies the reusable implementation, e.g. \`gallery\`.
- **Component instance ID:** identifies one particular use of that component on a page, e.g. \`gallery-main\` or \`gallery-references\`.

The same component type can appear multiple times on one page. Each use must have its own stable, unique instance ID. Instance IDs are meaningful project/page identifiers, not random values generated at render time.

The instance ID is also the basename of the JSON file containing that instance's editorial data. For example:

\`\`\`text
data/
└── pages/
    └── home/
        └── components/
            ├── gallery-main.json
            └── gallery-references.json
\`\`\`

A page template invokes the component type and names the data instance explicitly:

\`\`\`twig
{{ component('gallery', 'gallery-main') }}
{{ component('gallery', 'gallery-references') }}
\`\`\`

The Shorty component helper resolves the registered component type, loads the corresponding instance data in the active page context, validates it against the component's data contract, and renders the component template with that explicit data.

The instance ID is not automatically written as an HTML \`id\` attribute. Component markup uses reusable CSS classes such as \`component-gallery\`. An HTML \`id\` is only added when the markup actually needs one, and must then be unique in the rendered document.

## 3.4 Component versus partial

These concepts must remain distinct:

- **Component:** registered reusable unit with metadata, a data contract, and its own assets.
- **Partial:** internal template fragment used by a component. A partial is not necessarily registered or independently available in the inspector.

Example: a gallery is a component with a wrapper, title, and list. A gallery-item partial can be repeated for each item in its array.

If an item needs to be reusable independently in other parts of a site, it may instead be a registered component.

## 3.5 Page structure and content data

The page structure is authored directly in templates. The developer decides in the page template which components appear on a page and in which order. Shorty does not require pages to be assembled from a JSON list of component instances.

JSON supplies editorial/content data to concrete component instances. Page-specific data is stored with the page, not inside the reusable component implementation. Global/shared content can live in a separate project-level data area.

This separation means the same component type can be used multiple times on one page or across different pages, with a separate data file for every instance.

A future visual editor is not part of v1 and must not be assumed by this decision.

## 3.6 Explicit data contracts

Components receive explicit data. They should not silently depend on variables inherited from a parent template.

Each component instance receives the data from its explicitly named JSON file. Shorty validates that data against the component type's JSON Schema contract before rendering. Validation must be available as an explicit operation, not only as an incidental side effect of rendering, so developers and external tools can check proposed changes before a build.

## 3.7 Editorial data versus technical metadata

The component-named JSON file inside the component directory (for example, \`components/gallery/gallery.json\`) describes the component technically: its category, description, data schema, defaults, variants, and dependencies.

Editorial content belongs in page-specific instance JSON files, not in the component metadata or component template. This includes labels such as “Kontakt aufnehmen” when they are content that should vary by project or page.

Invariant technical markup and implementation details can remain in templates.

## 3.8 Repeatable content

Arrays are used to represent repeatable content structures inside an instance's data file, such as gallery images, team members, accordion entries, testimonials, references, and feature or service lists.

The developer defines fields and presentation. A future editor may add, remove, edit, and reorder entries while staying within that defined structure.

Shorty v1 does not include a CMS-style content editor or a built-in AI agent. Stable page IDs, component type IDs, component instance IDs, and predictable JSON file locations are required from the beginning so developers and external AI agents can locate and validate content reliably.

## 3.9 Variants and defaults

Components may define visual or behavioural variants, along with sample/default data for development and inspection.

The precise format and relationship between component defaults, project data, and inspector preview data remain open. A separate \`preview.json\` has been considered for inspector sample data, but this is not yet a final decision.

## 3.10 Styling and behaviour

Each component owns its SCSS source. Styles are expected to be compiled into a central CSS output by default, with shared design tokens available across components.

A component may provide a JavaScript ES module if it needs behaviour. Components without behaviour do not need an empty JavaScript file.

Component-specific JavaScript should only be included/initialized when the component is present in the relevant output.

## 3.11 Component assets

A component may optionally contain an \`assets/\` directory for files intrinsic to its design or implementation. These files are part of the component source and are removed with the component.

Editorial images and media do not belong in component directories. They are stored in the project's central asset area and referenced by the relevant page-instance JSON data.

During a build, Shorty copies required component assets into the public output under a component-specific path. The public output is regenerated on a full build so assets from removed components do not remain as stale files.

## 3.12 Future Inspector extension: reuse the same component markup

If developed, the Inspector extension should use the same component template as the actual website. It should not require a second, simplified template just for the component overview.

This keeps the inspector representative of the real output and reduces divergence.

## 3.13 Future direction: project icon-font integration

An icon-font workflow is not implemented in Shorty 2.0 Core. If a project adopts one, it may use font files generated outside Shorty with an external tool or service, for example Fontello. Shorty does not generate font files itself.

In such a project, generated font files can be placed in its `fonts/` directory and the project can maintain an icon map from semantic names to glyph code points. Automated CSS-class generation and a styleguide icon overview are future tooling ideas, not current Shorty behaviour.

The integration therefore consists of three separate parts:

- externally generated font files;
- project-maintained semantic icon-to-glyph definitions;
- Optional future CSS-class generation and styleguide output based on those definitions.

The exact external generator and font file formats are not fixed. Shorty must not be coupled to Fontello specifically.


## 3.14 Navigation component

A project may implement navigation as a regular registered Shorty component. Shorty does not ship a navigation component in its neutral Core scaffold. In a project-authored implementation, markup, styling, responsive presentation, and interaction behaviour belong to the component; menu structure and labels belong to its component-instance JSON data.

### Navigation data and destinations

Navigation data is authored explicitly and independently of page discovery and sitemap generation. Shorty must not automatically turn every discovered page into a menu entry. A project may define multiple navigation instances, such as a primary site navigation, footer navigation, service navigation, sidebar navigation, in-page jump navigation, or a floating utility/navigation panel.

Each navigation item has a visible `label` and may have:

- `page`: a reference to an internal Shorty page by its stable logical page ID; Shorty resolves it to the current language's output URL during the build;
- `url`: a URL for an external destination or a project asset such as a PDF or image;
- `children`: nested navigation items;
- standard link attributes such as `target`, `rel`, `title`, and `download`, where applicable;
- `class`: optional project-defined CSS and/or JavaScript hook classes.

An item uses either `page` or `url`, not both. If neither is present, the item is a grouping/parent item without its own link destination. An item may have a destination and children at the same time. A parent may therefore link to its own overview page while also containing submenu entries.

The optional `class` field may be provided on the navigation instance and, where useful, on individual menu items. Shorty outputs these classes without interpreting them. CSS and JavaScript in the component/project define their meaning. There are no built-in JSON switches such as single-open/multiple-open or hover/click modes; these are presentation and interaction decisions implemented by the component. If no class is provided, the component's default presentation and behaviour apply.

The `target` attribute supports normal link behaviour, including `_blank`; `download` may be used for downloadable assets. These attributes are independent of the destination type.

### Navigation state and interaction

The component derives the following states from the current logical page and the navigation tree:

- `active`: the item's internal page is the current page;
- `active-parent`: the item is an ancestor of the current page in the navigation tree;
- `default`: neither of the above.

These states are independent of visual styling. The component may expose them through CSS classes or other appropriate markup.

The component owns its interaction and responsive presentation. Desktop hover behaviour, click/tap behaviour, submenu presentation, mobile off-canvas or dropdown layouts, and other responsive variants are implemented through the component's template, CSS/SCSS, and JavaScript. Shorty does not prescribe a particular visual pattern or hard-code these behaviours into navigation JSON. The same navigation data can therefore be presented differently by different component designs.

Navigation markup and interaction must use appropriate semantic HTML and support keyboard operation. Where applicable, the component provides correct relationships and state attributes such as `aria-expanded`, supports keyboard focus and activation, and allows an open submenu to be closed with Escape. Optional accessibility labels or descriptive attributes may be omitted; their absence must not make the navigation fail to render or operate.

### Where navigation components are included

The same registered navigation component can be used at different levels:

1. **Layout-level/global navigation:** Navigation instances that belong to the overall site experience are included by the layout. This is not limited to a single “main navigation”; examples include header, footer, service, language-selection, and floating/side-mounted navigation or utility panels.
2. **Page-level navigation:** A navigation needed only on particular pages is included directly in that page's template.
3. **Component-level navigation:** A navigation that belongs to a particular component may be included from that component's template.

These are different inclusion locations, not separate navigation systems. Navigation remains an ordinary registered component in all three cases. Components may compose other registered components where appropriate.

A layout declares which global navigation instances it uses and the layout positions in which they are rendered. The layout configuration references navigation instance IDs; it does not contain the menu entries themselves. Different layouts may reference different navigation instances, and the same instance may be reused by more than one layout. Positions are optional: an omitted position or instance means that nothing is rendered there, not that an empty placeholder is required. The exact configuration file location and final schema remain implementation details to be specified.

### Future direction: multilingual navigation (not in Shorty 2.0)

Navigation data is language-specific. A shared navigation instance may have one data file per language, for example:

```text
data/
└── shared/
    └── components/
        └── navigation-main/
            ├── de.json
            ├── en.json
            └── fr.json
```

The layout references the logical navigation instance; Shorty selects the data for the active language. This keeps layout configuration independent of language while allowing labels, menu structure, and destinations to differ between language versions. The same language-aware data principle applies to navigation components included by pages or nested components.

Internal `page` references use stable logical page IDs, not language-specific URLs. Shorty resolves each reference against the page available in the active language. Not every logical page is required to exist in every language.

If a referenced internal page does not exist in the active language, that menu item is omitted and a build-log information message is emitted. The build continues. If the item has valid children, it remains as a non-linked grouping item so those children remain reachable. If filtering leaves a grouping item with no valid children and it has no valid destination, it is omitted. Other sibling items are unaffected. External `url` destinations are retained; Shorty does not infer whether an external destination is translated.

If the navigation data file for the active language is missing, that navigation instance is not rendered for that language and Shorty emits an informational build-log message only. It does not stop the build, issue a warning, or silently fall back to another language's labels or menu data.

### Future direction: validation and sitemap independence

Shorty validates internal page references during the build. A reference to a page that does not exist in the project at all is a diagnostic; a page that exists in other languages but not the active language follows the informational omission behaviour described above. Sitemap generation remains independent of navigation data and menu structure.

## 3.15 Machine-readable component contracts

Component metadata and its JSON Schema form the machine-readable contract for a registered component. They are not merely descriptive documentation.

The contract must allow Shorty and external tools to determine, without inspecting template source:

- The component's stable type ID and human-readable name/description.
- Its category and any supported variants.
- Which files belong to the component and which are optional.
- The data schema, including required fields, types, nested structures, allowed values, and descriptions.
- Defaults or preview data, where those are explicitly supported.
- Declared dependencies and relevant asset or JavaScript requirements, where applicable.

The component metadata v1 envelope is implemented in [component-metadata.schema.json](../schemas/component-metadata.schema.json) and validated during discovery, `component:validate`, and project `validate`. The embedded Draft 2020-12 data schema is checked against its meta-schema. Component-instance data is validated against that contract during `shorty build`; the current project-wide `shorty validate` checks page metadata and component structure, but does not traverse every template to validate all referenced instances. Variants, defaults, preview data, declared dependency graphs, and Inspector/documentation-generation consumers remain future contract work. These consumers must not maintain competing descriptions of the same implemented component metadata.

A component with an invalid or unsupported contract must not be silently registered as if it were valid. Diagnostics should identify the component directory and the invalid property or file.

## 3.16 External developer and AI-agent workflow

The component system must be understandable and operable through documented, stable interfaces. Shorty does not provide its own AI agent; external agents use the same project files, schemas, CLI operations, and validation rules as developers.

For a component-related task, an external tool should be able to:

1. Discover available component types and read their metadata.
2. Identify the component template, styles, optional behaviour, and declared dependencies.
3. Read the data schema before creating or changing an instance.
4. Locate a page's component instance through its stable instance ID and predictable data path.
5. Validate proposed data independently of rendering.
6. Run the relevant build or Inspector workflow and interpret actionable diagnostics.

The component type ID, instance ID, page ID, and language context must remain explicit. Tools must not need to infer identity from rendered HTML, visual position, or arbitrary template parsing.

External agents are not trusted sources of valid project changes by default. Their output must pass the same schema validation and build checks as changes made by a developer. Generated output is not the source of truth and must not be edited as a substitute for the structured project source.

