const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CLI_PATH = path.resolve(__dirname, "../../bin/shorty-container.js");

function createProject(config) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-cli-project-"));

    fs.writeFileSync(
        path.join(root, "shorty.config.json"),
        JSON.stringify({ site: { url: "https://example.test/" }, ...config }, null, 2)
    );

    return root;
}

function runCli(cwd, args = ["component:list"]) {
    return spawnSync(process.execPath, [CLI_PATH, ...args], {
        cwd,
        encoding: "utf8"
    });
}

test("component:list uses the configured components directory", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "custom-components-path" },
        paths: { components: "frontend/ui-components" }
    });
    const componentDirectory = path.join(
        root,
        "frontend",
        "ui-components",
        "custom-card"
    );

    fs.mkdirSync(componentDirectory, { recursive: true });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = runCli(root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /custom-card/);
    assert.match(result.stdout, /incomplete/);
    assert.doesNotMatch(result.stdout, /Keine Komponenten gefunden/);
});

test("component:list discovers the project from a nested working directory", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "nested-cli-project" },
        paths: { components: "src/components" }
    });
    const nestedDirectory = path.join(root, "src", "pages", "home");
    const componentDirectory = path.join(
        root,
        "src",
        "components",
        "nested-card"
    );

    fs.mkdirSync(nestedDirectory, { recursive: true });
    fs.mkdirSync(componentDirectory, { recursive: true });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = runCli(nestedDirectory);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /nested-card/);
});

test("component:list reports a missing project configuration", (context) => {
    const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), "shorty-cli-no-config-")
    );
    context.after(() => fs.rmSync(directory, { recursive: true, force: true }));

    const result = runCli(directory);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /SHORTY_PROJECT_CONFIG_NOT_FOUND/);
    assert.match(result.stderr, /shorty\.config\.json/);
});


test("component:create creates the required scaffold files", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "create-component-project" }
    });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = runCli(root, ["component:create", "feature-card"]);
    const componentDirectory = path.join(root, "components", "feature-card");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Komponente "feature-card" wurde angelegt/);
    assert.equal(fs.statSync(path.join(componentDirectory, "feature-card.json")).isFile(), true);
    assert.equal(fs.statSync(path.join(componentDirectory, "feature-card.tpl")).isFile(), true);
    assert.equal(fs.statSync(path.join(componentDirectory, "feature-card.scss")).isFile(), true);
    assert.equal(fs.existsSync(path.join(componentDirectory, "feature-card.js")), false);

    const metadata = JSON.parse(
        fs.readFileSync(path.join(componentDirectory, "feature-card.json"), "utf8")
    );

    assert.equal(metadata.metadataVersion, 1);
    assert.equal(metadata.name, "Feature Card");
    assert.equal(metadata.dataSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
});

test("component:create creates the optional JavaScript file with --with-js", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "create-component-js-project" }
    });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = runCli(root, ["component:create", "interactive-card", "--with-js"]);
    const componentDirectory = path.join(root, "components", "interactive-card");

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
        fs.statSync(path.join(componentDirectory, "interactive-card.js")).isFile(),
        true
    );
    assert.match(result.stdout, /interactive-card\.js/);
});

test("component:create rejects invalid component names with usage exit code 2", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "invalid-component-name-project" }
    });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    for (const name of ["Feature-card", "feature_card", "feature--card", "../feature-card"]) {
        const result = runCli(root, ["component:create", name]);

        assert.equal(result.status, 2, `Expected usage error for ${name}: ${result.stderr}`);
        assert.match(result.stderr, /kebab-case/);
    }

    assert.equal(fs.existsSync(path.join(root, "components")), false);
});

test("component:create refuses to overwrite an existing component", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "duplicate-component-project" }
    });
    const componentDirectory = path.join(root, "components", "existing-card");
    fs.mkdirSync(componentDirectory, { recursive: true });
    fs.writeFileSync(path.join(componentDirectory, "keep.txt"), "keep");
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = runCli(root, ["component:create", "existing-card"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /existiert bereits/);
    assert.equal(
        fs.readFileSync(path.join(componentDirectory, "keep.txt"), "utf8"),
        "keep"
    );
    assert.equal(fs.existsSync(path.join(componentDirectory, "existing-card.json")), false);
});

test("component:list sorts components and reports each validation status", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "component-list-status-project" }
    });
    const componentsRoot = path.join(root, "components");
    const validDirectory = path.join(componentsRoot, "valid-card");
    const incompleteDirectory = path.join(componentsRoot, "incomplete-card");
    const invalidDirectory = path.join(componentsRoot, "invalid-card");

    fs.mkdirSync(validDirectory, { recursive: true });
    fs.mkdirSync(incompleteDirectory, { recursive: true });
    fs.mkdirSync(invalidDirectory, { recursive: true });

    const validMetadata = {
        metadataVersion: 1,
        name: "Valid Card",
        description: "A valid test component.",
        category: "content",
        dataSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            properties: {},
            additionalProperties: false
        }
    };

    fs.writeFileSync(
        path.join(validDirectory, "valid-card.json"),
        JSON.stringify(validMetadata, null, 2)
    );
    fs.writeFileSync(path.join(validDirectory, "valid-card.tpl"), "<div>Valid</div>");
    fs.writeFileSync(path.join(validDirectory, "valid-card.scss"), ".valid-card {}");
    fs.writeFileSync(path.join(invalidDirectory, "invalid-card.json"), "{ invalid json");
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = runCli(root);
    const incompleteIndex = result.stdout.indexOf("incomplete-card");
    const invalidIndex = result.stdout.indexOf("invalid-card");
    const validIndex = result.stdout.indexOf("valid-card");

    assert.equal(result.status, 0, result.stderr);
    assert.ok(incompleteIndex >= 0);
    assert.ok(invalidIndex > incompleteIndex);
    assert.ok(validIndex > invalidIndex);
    assert.match(result.stdout, /valid-card\s+valid/);
    assert.match(result.stdout, /incomplete-card\s+incomplete/);
    assert.match(result.stdout, /invalid-card\s+invalid/);
    assert.match(result.stdout, /Gesamt: 3 \| Gültig: 1 \| Unvollständig: 1 \| Ungültig: 1/);
});

test("component:list reports an empty component directory", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "empty-component-list-project" }
    });
    fs.mkdirSync(path.join(root, "components"), { recursive: true });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = runCli(root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Keine Komponenten gefunden/);
});

test("component:create rejects unknown options and extra positional arguments", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "component-create-arguments-project" }
    });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const unknownOption = runCli(root, [
        "component:create",
        "feature-card",
        "--unknown"
    ]);
    const extraArgument = runCli(root, [
        "component:create",
        "feature-card",
        "another-card"
    ]);

    assert.equal(unknownOption.status, 2);
    assert.match(unknownOption.stderr, /Unbekannte Option/);
    assert.equal(extraArgument.status, 2);
    assert.match(extraArgument.stderr, /genau einen Komponentennamen/);
});


test("component:create uses the configured components directory", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "custom-create-path-project" },
        paths: { components: "frontend/components" }
    });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = runCli(root, ["component:create", "custom-card"]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
        fs.statSync(
            path.join(root, "frontend", "components", "custom-card", "custom-card.json")
        ).isFile(),
        true
    );
    assert.equal(fs.existsSync(path.join(root, "components", "custom-card")), false);
});
