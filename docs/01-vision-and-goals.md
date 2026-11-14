# 1. Vision and goals

## 1.1 Vision

Shorty is a CMS-independent, component-based frontend development system for building complete, functional frontend prototypes and websites quickly.

A developer should be able to create a realistic, clickable frontend independently of the eventual CMS, backend, or application framework. The result should be useful for design reviews, customer feedback, frontend implementation, and later integration into a wider technical system.

Shorty starts with static website generation. It is not another CMS: it can provide the frontend for integration into an existing CMS, or replace the need for a CMS on small informational websites. Its project structure, metadata, and tooling interfaces must be usable by external AI agents from the beginning. Shorty does not include its own AI agent as a v1 feature.

## 1.2 Intended workflow

A typical agency workflow can look like this:

1. A designer creates the screen and interaction design.
2. A frontend developer builds a complete, clickable frontend with Shorty.
3. The customer reviews and approves the frontend before backend/CMS integration.
4. An integrator adapts the frontend to the selected target platform, for example TYPO3, WordPress, Magento, a Java/Rails backend, or a JavaScript application.
5. Backend and API work is implemented separately.

Shorty provides the frontend structure, components, styles, behaviour, data definitions, and a working prototype. It does not promise that generated templates can be copied unchanged into every target platform.

## 1.3 What Shorty is

- A frontend prototyping and development system.
- A component-based system with discoverable, reusable components.
- A static-site build pipeline for project-authored frontend pages and components.
- A development environment with validation and a local preview server. A visual Inspector is an optional future extension, not part of the Shorty 2.0 Core release.
- A focused build workflow for static frontends that can be integrated into other platforms or deployed directly.
- A predictable, documented environment that external developer tools and AI agents can inspect and operate through explicit interfaces.

## 1.4 What Shorty is not

- Not a CMS.
- Not a TYPO3 framework or extension.
- Not a replacement for React, Vue, Angular, or another application framework.
- Not a backend framework.
- Not a drag-and-drop page builder in the first implementation.
- Not a runtime dependency of the generated customer website.
- Not a built-in autonomous AI agent.

## 1.5 Core principles

### CMS and platform independence

Shorty must not be designed around a specific CMS, backend, hosting platform, or framework. Technologies such as TYPO3 Fluid may be integration targets, but they are not part of the initial internal rendering stack.

### Static output first

The first implementation uses JSON data and generates static output at build time. API access may be considered later for concrete use cases, but it is not a v1 requirement.

### Components own their presentation

A component defines its markup, styles, optional JavaScript behaviour, technical metadata, and data contract. It receives data explicitly and should not depend on undocumented parent context.

### Structured content and machine-readable contracts

JSON files are the content source in Shorty 2.0. Components receive explicit data and are validated against JSON Schema contracts. Stable page IDs, component type IDs, and instance IDs make content predictable to developers and external tools. Multilingual build processing is outside the 2.0 Core release. Component metadata and schemas must be machine-readable and documented.

### External AI-agent compatibility

External AI agents are treated as tooling clients that may inspect and modify a customer project. They must use the same documented project structure, component contracts, validation, diagnostics, and build workflow as a developer. Shorty does not include or operate an agent itself. Agent-generated changes remain subject to the same validation and human review as other changes.

### Developer-defined content structures

Repeatable content is represented by defined data structures, for example arrays of gallery images, team members, accordion entries, testimonials, or references. The developer controls structure and presentation. External tooling may edit content within those boundaries, but Shorty v1 is not a content editor and does not include an AI agent.

### Inspectability and quality

The Core makes project sources inspectable through predictable files, schemas, validation, diagnostics, and the development server. A visual Inspector that presents components together is an optional extension beyond the 2.0 Core release, not a Core dependency.

### Twig as the fixed template technology

Shorty 2.0 uses Twig for pages, layouts, components, and partials. PHP executes Twig during builds inside the Docker Runtime; PHP and Composer are not required on the host. Node.js and npm are host requirements for the Shorty launcher and private Git installation. Generated websites do not require Shorty, PHP, Node.js, or Docker. We will not add a general-purpose renderer abstraction for hypothetical alternatives. A fundamental template-technology change can be handled deliberately in a future major version, including template migration where necessary.

## 1.6 Technical validation

Shorty architecture is validated through small, temporary, project-neutral technical experiments. These experiments test assumptions about build orchestration, Twig rendering, component discovery, data validation, asset processing, and generated output.

They are not customer reference projects, permanent fixtures, or dependencies of Shorty Core. Test projects may be replaced or discarded at any time.
