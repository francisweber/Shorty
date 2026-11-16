# Shorty Agent Knowledge

This directory defines the shared, agent-independent knowledge that external development agents use when working with Shorty projects.

It is intended for tools such as Codex and Claude Code. It does not implement, host, or orchestrate an AI agent. Shorty remains usable without an AI agent, and agents must follow the same project contracts, validation rules, and build process as human developers.

## Purpose

The goal is to make work performed by external agents predictable, reviewable, and reusable across different Shorty projects.

The documentation in this area must answer four questions:

1. **What does Shorty require?** The platform's architecture, file formats, component model, schemas, and CLI define the technical contracts.
2. **How should an agent work with Shorty?** Shared workflows explain how to inspect a project, plan changes, implement them, and validate the result.
3. **How does a design source become a Shorty implementation?** The Figma integration guidance defines a repeatable translation process without tying it to one website or design system.
4. **What is specific to this project?** A customer project supplies its own design decisions, content, component inventory, and references. Those details must not become platform-wide rules.

## Architectural principles

### 1. One shared source of truth

Shorty-specific technical rules must be defined and maintained centrally in the Shorty repository wherever possible.

Agent-specific entry points may explain how to discover and load this knowledge, but must not independently redefine component contracts, naming rules, validation requirements, or other platform behavior.

If an instruction conflicts with an implemented schema, CLI behavior, or accepted architecture decision, the conflict must be reported and resolved. An agent instruction must not silently override the technical contract.

### 2. Agent independence

The shared knowledge must not depend on one vendor, model, editor, or agent runtime.

Codex, Claude Code, and other compatible agents should be able to apply the same Shorty conventions. Thin adapter files may be added where a tool requires a particular instruction format, but those files should point to the shared documentation rather than duplicate it.

### 3. Project independence

The workflow must work across different Shorty customer projects.

A particular website, portfolio, component library, Figma file, brand, or visual style may be used as a test case, but must not determine the general integration architecture.

Project-specific facts belong in the respective customer project. They must not be copied into the shared Shorty knowledge base unless they represent a generally applicable platform rule.

### 4. Contracts before instructions

The authoritative technical behavior remains in Shorty's implementation and machine-readable contracts, including JSON Schemas and CLI behavior.

Agent documentation explains how to use those contracts. It does not create a parallel implementation of them.

Where a required capability is not implemented yet, documentation must identify it as planned or unresolved rather than describe it as available.

### 5. Reviewable implementation

Agent-generated changes are ordinary source changes. They must remain understandable, reviewable, and subject to the same validation and build requirements as changes made by a human developer.

Agents must not bypass validation or replace working implementations with unvalidated output.

### 6. Safe regeneration

For Figma-derived components, regeneration must be isolated from the currently working implementation. A replacement is only eligible to take the place of the existing component after it has been generated and passed the applicable validation checks.

The detailed synchronization and reconciliation behavior remains subject to further design decisions.

## Knowledge layers

The knowledge model separates shared platform knowledge from project-specific context.

| Layer | Responsibility | Ownership |
| --- | --- | --- |
| Shorty Core Knowledge | Technical architecture, project structure, components, templates, styles, data contracts, CLI, validation, and build behavior | Shorty repository |
| Design Integration Knowledge | General process for analyzing Figma designs and translating them into Shorty components | Shorty repository |
| Agent Workflow Knowledge | Shared procedures for discovery, planning, implementation, validation, and reporting | Shorty repository |
| Project Context | The project's design system, Figma references, existing components, content, and project decisions | Customer project |

These are logical knowledge boundaries. They do not imply that Shorty already has an extension loader, agent runtime, package manager, or automatic knowledge-discovery mechanism.

## Planned documentation map

The following map describes the intended organization. A document is not considered implemented merely because it appears in this list.

### Shared workflows

| Document | Responsibility |
| --- | --- |
| `working-principles.md` | General rules for safe, predictable agent work |
| `project-discovery.md` | How to inspect a Shorty project and establish its actual state |
| `implementation-workflow.md` | How to plan and implement source changes |
| `validation-workflow.md` | How to validate changes and report results |

### Shorty Core knowledge

| Document | Responsibility |
| --- | --- |
| `core/project-structure.md` | Project layout, configuration, and source/output boundaries |
| `core/component-system.md` | Component identity, metadata, instances, and discovery |
| `core/templates-and-twig.md` | Template structure and Twig usage |
| `core/styling-and-assets.md` | SCSS, JavaScript, and asset conventions |
| `core/data-contracts.md` | JSON data, schemas, and validation contracts |

Implemented: [Project structure](core/project-structure.md) and [Component model](core/component-model.md). The remaining Core documents are planned. These documents reference and complement the existing Shorty documentation and schemas; they must not become competing descriptions of the platform.

### Figma integration knowledge

| Document | Responsibility |
| --- | --- |
| `figma/overview.md` | Scope, assumptions, and boundaries of the Figma-to-Shorty workflow |
| `figma/design-analysis.md` | How to inspect and describe selected Figma source material |
| `figma/component-mapping.md` | How design structures map to existing or new Shorty components |
| `figma/responsive-design.md` | How responsive behavior is identified and represented |
| `figma/variants-and-states.md` | How component variants, properties, and states are analyzed |
| `figma/implementation.md` | How an approved mapping is implemented in a Shorty project |
| `figma/regeneration.md` | How source changes and component regeneration are handled safely |

Documentation completed for the planned workflow: [Figma integration overview](figma/overview.md), [design analysis](figma/design-analysis.md), [component mapping](figma/component-mapping.md), [responsive design](figma/responsive-design.md), [variants and states](figma/variants-and-states.md), [implementation](figma/implementation.md), and [regeneration](figma/regeneration.md). The integration itself is not implemented; unresolved technical decisions are identified in the documents.

### Project context

The exact file format and location for project-specific agent context will be defined separately. It must be discoverable by agents without requiring project details to be embedded in the shared Shorty rules.

At minimum, project context should be able to describe:

- the Shorty version and project configuration;
- the relevant Figma file, pages, and selected source components;
- project design tokens and visual conventions, where available;
- existing Shorty components and known mappings to Figma sources;
- project-specific decisions and unresolved questions.

No particular project-context filename or synchronization mechanism is mandated by this document.

## Relationship to existing Shorty documentation

This knowledge base builds on the existing platform documentation and accepted architecture decisions:

- [Vision and goals](../01-vision-and-goals.md)
- [Architecture](../02-architecture.md)
- [Component system](../03-component-system.md)
- [Roadmap](../05-roadmap.md)
- [Machine-readable tooling contracts](../06-machine-readable-tooling-contracts.md)
- [Project configuration](../07-project-configuration.md)
- [ADR-0013: External AI-agent compatibility](../decisions/ADR-0013-external-ai-agent-compatibility.md)
- [ADR-0015: Figma-to-Shorty agent-independent design integration](../decisions/ADR-0015-figma-to-shorty-agent-independent-design-integration.md)
- [ADR-0016: Shorty 2.0 release scope and optional extensions](../decisions/ADR-0016-shorty-2-release-scope-and-extensions.md)

If this index and an accepted ADR disagree, the ADR takes precedence until the discrepancy is resolved.

## Current implementation status and boundaries

This document establishes the organization and principles for the shared knowledge base. It does not claim that all listed documents or capabilities already exist.

In particular:

- Shorty does not include or operate a built-in AI agent.
- A complete machine-readable CLI result and diagnostic contract is not yet implemented.
- Figma connectivity and the Figma-to-Shorty workflow are not implemented by this document.
- Component-to-Figma identity storage and synchronization details still require technical decisions.
- No extension installation, discovery, or lifecycle mechanism is defined here.

The Figma-to-Shorty integration remains a planned optional extension. Preparing reusable architecture and documentation must not delay the Shorty 2.0 Core release gates defined in ADR-0016 and the roadmap.

## How to use this directory

An external agent should:

1. Read the applicable project-level agent entry point, if one exists.
2. Identify the Shorty version and inspect the actual project structure and configuration.
3. Read the relevant shared workflow and Core knowledge documents before changing source files.
4. Load Figma integration guidance only when the task involves Figma-derived work.
5. Treat schemas, implemented CLI behavior, and accepted ADRs as authoritative contracts.
6. Validate changes using the project's supported Shorty workflow and report any missing capability or unresolved conflict.

The project-level entry point should remain short and direct agents to the relevant documents here. It should not copy this knowledge into every customer project.

## Evolution

New documents should be added only when they have a clear responsibility and do not duplicate an existing source of truth.

Changes to platform contracts belong in the relevant Core documentation, schema, implementation, or ADR—not solely in agent instructions.

When a workflow or capability is still experimental, mark it as such. Promote it to a stable shared rule only after its behavior and technical dependencies have been reviewed.
