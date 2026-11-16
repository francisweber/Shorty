# Validation Workflow

This document defines how external AI agents validate changes in a Shorty project. It applies to Codex, Claude Code, and other tools. Validation must be based on the actual project state and the commands supported by the installed Shorty version.

## 1. Validation principles

- Validate the smallest relevant unit first, then increase coverage.
- Validate source files and project contracts, not generated output as a substitute for source validation.
- Use the commands available in the project's installed Shorty version. Do not invent flags, commands, JSON output modes, or diagnostics.
- Treat a successful command as evidence only for the checks that command actually performs.
- Do not claim that a build, test, or visual review passed unless it was actually run and its result inspected.
- Preserve existing work and the last known-good generated output.
- Report checks that could not be run, and explain why.

## 2. Establish the validation context

Before running commands:

1. Complete project discovery using project-discovery.md.
2. Confirm the project root, installed Shorty version, dependency pin, and configured paths.
3. Inspect the Git working tree and identify unrelated or uncommitted changes.
4. Identify the files and behaviours affected by the change.
5. Check the project's package scripts and available test commands rather than assuming a standard script exists.
6. Confirm required tools and runtime services are available. Do not install, upgrade, or reconfigure dependencies without authorization.

Run commands from the project root unless the command or project configuration requires otherwise.

## 3. Validation levels

Choose validation depth according to the scope and risk of the change. A focused component change usually needs component validation and a project build. A change to shared configuration, schemas, rendering, layouts, or build behaviour requires broader checks.

### Level 1: Source and contract inspection

Inspect the changed files and their relationships.

Check that:

- filenames and component directory names follow the project's conventions;
- metadata contains the required fields and uses the supported schema version;
- data schemas match the data consumed by templates;
- Twig templates use the expected component data structure;
- styles and scripts follow the project's existing conventions;
- referenced assets exist and use valid paths;
- page composition refers to component types and instance data correctly;
- no generated output has been edited in place of its source.

A code review is useful, but it does not replace executable validation.

### Level 2: Component validation

For a component-specific change, use the installed CLI's component validation command:

    shorty component:validate <component-name>

Use the component type ID expected by the installed CLI. Do not substitute a page-local component instance ID.

If the component name or command syntax is uncertain, inspect the installed CLI help or the project's installed Shorty documentation before proceeding.

### Level 3: Project validation

Run:

    shorty validate

This checks the project configuration and components according to the current Core implementation. It does not, by itself, prove that every page can be rendered successfully or that every page's component instance data is valid.

### Level 4: Full build

Run:

    shorty build

A full build is required when changes can affect rendering, page composition, component instance data, layouts, shared styles or assets, or build behaviour.

The build exercises the rendering path and validates page/component instance data as part of the build. Inspect the complete command result. A successful exit alone does not replace visual inspection when visual correctness is part of the acceptance criteria.

### Level 5: Project tests

If the repository defines automated tests relevant to the change, run the appropriate test command. Discover the actual scripts in package.json and any project-specific test documentation first.

Do not assume that npm test, lint, type-check, or other conventional scripts exist. Do not report a test suite as passed if it was absent, skipped, or could not run.

For changes to Shorty Core itself, follow the Core repository's own test and release requirements in addition to the project-level checks described here.

### Level 6: Rendered-output and visual review

When the change affects appearance or interaction:

- inspect the generated pages in a browser where the environment permits;
- check the relevant viewport sizes and responsive states specified by the task or design source;
- check interactive states and behaviour that are part of the acceptance criteria;
- inspect browser console and network errors when relevant;
- compare against the supplied reference without assuming that an unprovided state or breakpoint is defined.

A successful build is not proof of visual fidelity. If browser review is unavailable, state that limitation explicitly.

## 4. Recommended validation sequence

For a typical component implementation:

1. Inspect changed source and metadata.
2. Validate the component.
3. Validate the project.
4. Run a full build.
5. Run relevant project tests if defined.
6. Inspect rendered output if visual or interactive behaviour is in scope.
7. Review the Git diff and working tree.

For a documentation-only change, inspect the rendered Markdown or read the file back and check links, terminology, and consistency. Do not run a site build unless the documentation change is part of a project where that build is relevant.

For a shared or cross-cutting change, expand the checks to cover every affected component, page, layout, and configuration path.

## 5. Build safety and generated output

Shorty build output is generated. Make changes in the configured source directories, not by editing generated files in the output directory.

The current builder uses a staging output and replaces the previous output only after the new build has completed successfully. Therefore:

- do not delete the existing output before a build as a routine precaution;
- do not manually replace the output with a partially generated staging directory;
- if a build fails, inspect the error and preserve the previous successful output;
- do not claim the generated site is current after a failed build.

Always use the output directory resolved from the project's configuration rather than assuming a directory name.

## 6. Safe regeneration

When replacing or regenerating an existing component, do not overwrite the working implementation before the candidate has been generated and validated.

Follow this sequence:

1. Inspect and preserve the current component.
2. Generate the candidate in an isolated location.
3. Validate its metadata, data contract, template, styles, scripts, and assets.
4. Integrate it only after the candidate passes the relevant checks.
5. Run project validation and a full build after integration.
6. Review the final diff and confirm that unrelated files were not changed.

The exact Figma synchronization and regeneration contract remains subject to the decisions recorded in ADR-0015. This document does not define an automatic synchronization mechanism.

## 7. Failure handling

When a check fails:

1. Capture the exact command and relevant error output.
2. Identify whether the failure is caused by the change, existing project state, configuration, dependencies, or the environment.
3. Inspect the relevant source and contract before changing anything.
4. Fix the source of the problem rather than patching generated output.
5. Re-run the failed check.
6. Re-run broader checks if the fix affects other areas.

Do not hide, suppress, or work around a validation error merely to obtain a successful build. If a failure is unrelated to the task, document it and distinguish it from regressions introduced by the change.

If a required runtime, dependency, credential, or external service is unavailable, stop at the boundary of what can be verified. Do not make environment changes without authorization.

## 8. Completion criteria

A change is ready to report as complete only when:

- the agreed acceptance criteria have been reviewed;
- all applicable validation levels have been run, or their omission is explicitly explained;
- failures and unresolved issues are documented;
- generated output has been produced successfully when a build is required;
- visual review has been performed when visual behaviour is in scope, or its absence is disclosed;
- the Git diff contains only intended changes;
- no unrelated user changes have been overwritten.

Validation is evidence, not a guarantee that every possible defect has been found.

## 9. Validation report

Conclude implementation work with a concise report containing:

- **Changed:** the files or behaviours changed.
- **Checks run:** exact commands or review steps performed.
- **Results:** passed, failed, or partially completed, with relevant details.
- **Not run:** checks that were unavailable or outside scope, with reasons.
- **Remaining:** known issues, assumptions, and follow-up work.

Never describe a check as passed when it was not executed. Never describe an unverified visual result as pixel-perfect or fully responsive.

## Related documents

- [Agent knowledge architecture](README.md)
- [Working principles](working-principles.md)
- [Project discovery](project-discovery.md)
- [Implementation workflow](implementation-workflow.md)
- [Machine-readable tooling contracts](../06-machine-readable-tooling-contracts.md)
- [ADR-0013: External AI agents as first-class consumers](../adr/0013-external-ai-agents-as-first-class-consumers.md)
- [ADR-0015: Figma-to-Shorty integration](../adr/0015-figma-to-shorty-integration.md)
- [ADR-0016: Narrow Core release scope](../adr/0016-narrow-core-release-scope.md)
