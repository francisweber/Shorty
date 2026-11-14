# ADR-0003: CLI command and syntax convention

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

Shorty needs a CLI that remains predictable as commands and capabilities grow. Main actions, related subcommands, and user-supplied argument values must have a consistent and recognizable syntax.

## Decision

Use the following conventions:

1. The executable name is `shorty`.
2. Main actions use short, direct commands without a namespace, for example:
   - `shorty init`
   - `shorty build`
   - `shorty serve`
   - `shorty inspect`
3. Related subcommands use a colon to separate the command namespace from the action, for example:
   - `shorty component:create`
   - `shorty component:validate`
4. Argument values are passed as separate, space-delimited tokens, for example:
   - `shorty init my-project`
   - `shorty build --watch`
5. A colon is used for command structure, not to attach argument values.
6. Square brackets in documentation indicate optional arguments; they are not typed in the actual command.

## Consequences

- CLI commands share one naming and syntax convention.
- Main actions remain concise.
- Related operations can be grouped without introducing unnecessary command namespaces.
- The convention applies to future CLI commands and documentation.

## Examples

```bash
shorty init
shorty init my-project
shorty build
shorty build --watch
shorty serve
shorty inspect
shorty component:create
shorty component:validate
```

The examples establish naming patterns, not a final list of implemented commands or options.
