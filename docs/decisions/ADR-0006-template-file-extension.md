# ADR-0006: Use the .tpl template file extension

- **Status:** Accepted
- **Date:** 2026-11-09
- **Clarification:** 2026-11-10

## Context

Shorty 2.0 uses Twig as its fixed template engine (see ADR-0001). Template filenames should follow one consistent convention across pages, layouts, components, and internal partials.

The .tpl extension is a filename convention only. It does not make template syntax independent of Twig and does not imply that another renderer can be substituted without migrating template contents.

## Decision

- Shorty template files use the .tpl extension.
- Component templates, page templates, layouts, and internal template partials follow this extension convention.
- All .tpl templates in Shorty 2.0 use Twig syntax and are processed by Twig.
- The extension is retained as a concise project-wide naming convention, not as a renderer abstraction.

## Consequences

- Project files use one consistent template extension.
- Developers know that .tpl files in Shorty 2.0 contain Twig templates.
- A future template-engine change may require adapting template contents and will be treated as a deliberate migration, potentially in a new major version.
