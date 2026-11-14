# ADR-0013: External AI-agent compatibility

- **Status:** Accepted
- **Date:** 2026-11-11

## Context

Shorty is a frontend development environment used by developers to create and maintain independent customer projects. Developers may use external AI agents as tooling clients to inspect project structure, understand components, make bounded changes, and run the normal project workflow.

Shorty must make this work through explicit, stable, machine-readable interfaces rather than relying on undocumented conventions or assumptions inferred from source files. This does not mean Shorty should contain, host, or autonomously operate an AI agent.

## Decision

External developer tools and AI agents are first-class consumers of the documented Shorty project structure and tooling interfaces.

The platform must provide, as these capabilities are implemented:

- A predictable project layout and stable identifiers for pages, component types, and component instances.
- Machine-readable component metadata and JSON Schema data contracts.
- Documented relationships between component templates, styles, scripts, metadata, schemas, and instance data.
- Explicit CLI commands for discovery, validation, building, and other supported project operations.
- Actionable diagnostics that identify the affected file or component and explain the issue.
- The same validation and build rules for changes made by developers or external agents.
- A clear distinction between editable source files and generated build output.

Shorty does not include a built-in AI agent in v1. It does not grant external agents special privileges or bypass project validation. Publishing or deploying generated output remains an explicit developer-controlled action.

The component metadata v1 schema and its validation are implemented. The JSON result envelope, JSON-mode CLI output, complete diagnostic structure, and broader programmatic command contract remain proposed in [Machine-readable component and CLI contracts](../06-machine-readable-tooling-contracts.md) and are not implemented. Agent-specific integration conventions must build on shared interfaces rather than create a separate privileged API.

## Consequences

- Project structure and component contracts must be documented for both humans and tools.
- Metadata and schemas are operational interfaces, not merely descriptive documentation.
- CLI output and diagnostics should be designed for reliable programmatic consumption as well as human readability.
- Agent-generated changes remain reviewable source changes and must pass the same checks as manually authored changes.
- Shorty remains independent of any particular AI provider, model, agent framework, or editor.
- A built-in agent, autonomous publishing, and agent-specific privileged workflows are outside the v1 scope.

## Open implementation details

- Final review and implementation of the remaining machine-readable CLI contracts.
- Expansion of the component metadata contract for variants, defaults, previews, or dependencies if a concrete use case requires them.
- Command-specific machine-readable result payloads and the complete diagnostic code catalogue.
- Safe boundaries for file modifications and generated output.
- Documentation format for external agent workflows.
