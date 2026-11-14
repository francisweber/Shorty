# ADR-0011: Automatic XML sitemap generation

- **Status:** Accepted
- **Date:** 2026-11-10

## Context

Shorty builds static websites from project pages. Search engines benefit from an XML sitemap that makes relevant page URLs discoverable. Sitemap membership is independent of a site's navigation structure: a page may be absent from menus and still belong in the sitemap.

Sitemap inclusion is also distinct from whether a search engine is allowed to index a page.

## Decision

- Shorty generates an XML sitemap automatically as part of the build.
- Discovered pages are included by default.
- Pages are included by default. A page may opt out with `sitemap: false` in its page data.
- `noindex: true` is a separate page property that emits a robots `noindex` directive and excludes the page from the sitemap. `noindex` takes precedence over sitemap inclusion.
- Sitemap generation is based on the project's page information, not on navigation menus.
- The sitemap feature does not require manual generation or maintenance by the developer.
- The absolute HTTP(S) base URL is configured as `site.url`; Shorty does not infer a domain.
- Sitemap locations retain the existing `<page-id>.html` output paths and are written to `sitemap.xml` in the configured build output directory.
- URL components are encoded and XML special characters are escaped.

Canonical URL policy beyond the configured base URL, and multilingual sitemap behavior, remain outside the current implementation.

## Consequences

- Sitemap generation is a standard build capability.
- Navigation and sitemap membership remain independent.
- Projects can exclude individual pages without maintaining a separate sitemap file.
- The page data model can evolve; Shorty should not impose unrelated business-specific content structures.
