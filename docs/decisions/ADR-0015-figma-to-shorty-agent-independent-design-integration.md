# ADR-0015: Figma-to-Shorty: Agent-independent design integration

- **Status:** Accepted
- **Date:** 2026-11-13
- **Related:** [ADR-0013](ADR-0013-external-ai-agent-compatibility.md)

## Context

Shorty is intended to support design-led frontend work while remaining useful without AI tooling. A future integration should let external agents use design information from Figma to create project-specific Shorty components. Shared Shorty conventions must remain understandable and usable across agents rather than being embedded in one agent's configuration.

This decision records the agreed direction for future planning. It does not authorize or describe a current implementation.

## Decision

- Figma is the sole planned design source for the initial integration.
- The integration will use the available Figma interfaces, including Figma MCP.
- Codex and Claude Code are equally supported clients. The design must not depend on either agent exclusively.
- Shorty remains fully usable without AI agents. Shorty will not include its own AI agent or agent orchestration.
- Shared Shorty rules, project conventions, and technical component knowledge belong centrally in the repository and must be agent-independent.
- Agent-specific configuration is an integration layer only. It may explain how an agent accesses shared Shorty guidance and Figma interfaces, but it must not become the authoritative home of Shorty conventions.

## Component model

- Figma components are the design source of truth.
- An external agent translates a selected Figma component into a standalone Shorty component.
- Shorty does not prescribe a domain-specific or product-specific component library. The agent implements each component according to the technical conventions and contracts defined by Shorty.
- Every imported component records a unique Figma component ID so its implementation can be associated with its design source.
- By default, a change to a source Figma component leads to full regeneration of the corresponding Shorty component. Synchronization details, variants, and the treatment of manual code changes remain to be specified during implementation.
- Regeneration is isolated: the agent creates a new implementation separately and validates it before replacing the existing component. The current implementation remains in place unless the replacement has been generated and passed the agreed validation.

## Consequences

- Shared component conventions and relevant technical knowledge need a central, discoverable repository location before the integration is implemented.
- Agent-specific instructions must stay thin and refer to those shared materials.
- Figma IDs become part of the provenance and mapping information for imported components.
- Replacement and validation must be designed as a reviewable operation; synchronization, variants, and manual edits are not settled by this ADR.
- WP4 is deferred until Shorty 2.0 is stabilized, tested, and release-ready. Current development priority remains completion of Shorty 2.0.

## Out of scope

- Implementing a Figma connection or configuring Figma MCP.
- Choosing detailed synchronization, variant-mapping, or manual-edit reconciliation behavior.
- Building an AI agent, agent orchestrator, or agent-specific component library.
