# ADR-0007: External icon-font integration

- **Status:** Accepted
- **Date:** 2026-11-10

## Context

The original Shorty workflow used icon fonts assembled outside Shorty with a tool such as Fontello. The generated font files were added to the project, while a semantic icon map associated names with glyph code points. Shorty then generated CSS classes and a styleguide overview from that map.

## Decision

Shorty 2.0 retains this workflow.

The icon font is generated externally; Shorty does not generate or modify the font files. The generated files are placed in the project's `fonts/` directory.

The project maintains a map of semantic icon names to font glyph code points. Shorty uses this map to generate CSS classes, including before/after pseudo-element variants, and to generate the icon overview in the styleguide.

Shorty is not coupled to Fontello. The external generator and exact font file formats remain project choices.

## Consequences

- Projects can select and combine only the icons they need, including custom SVG artwork converted to glyphs by an external generator.
- Font generation remains outside Shorty's responsibilities.
- Shorty owns the integration layer: icon definitions, CSS class generation, and styleguide presentation.
- The concrete map format and generator implementation can be finalized during implementation.
