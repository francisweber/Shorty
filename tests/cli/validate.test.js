const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CLI_PATH = path.resolve(__dirname, "../../bin/shorty-container.js");

function createProject(config) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-validate-project-"));
    fs.writeFileSync(path.join(root, "shorty.config.json"), JSON.stringify(config, null, 2));
    return root;
}

function runValidate(cwd, args = ["validate"]) {
    return spawnSync(process.execPath, [CLI_PATH, ...args], {
        cwd,
        encoding: "utf8"
    });
}

function createComponent(root, id, files = {}) {
    const directory = path.join(root, "components", id);
    fs.mkdirSync(directory, { recursive: true });
    for (const [filename, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(directory, filename), content);
    }
    return directory;
}

const validMetadata = JSON.stringify({
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
}, null, 2);

test("validate succeeds when all components are valid", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "valid-project" },
        site: { url: "https://example.test/" }
    });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    createComponent(root, "valid-card", {
        "valid-card.json": validMetadata,
        "valid-card.tpl": "<section></section>\n",
        "valid-card.scss": ".valid-card {}\n"
    });

    const result = runValidate(root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Komponenten geprüft: 1/);
    assert.match(result.stdout, /Projektvalidierung erfolgreich/);
});

test("validate reports multiple incomplete components and exits with code 1", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "invalid-project" },
        site: { url: "https://example.test/" }
    });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    createComponent(root, "first-card", {
        "first-card.tpl": "<section></section>\n"
    });
    createComponent(root, "second-card", {
        "second-card.json": "{ invalid json"
    });

    const result = runValidate(root);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /first-card/);
    assert.match(result.stdout, /second-card/);
    assert.match(result.stderr, /Projektvalidierung fehlgeschlagen/);
});

test("validate finds the project from a nested working directory", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "nested-validation" },
        site: { url: "https://example.test/" }
    });
    const nested = path.join(root, "pages", "home");
    fs.mkdirSync(nested, { recursive: true });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = runValidate(nested);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /nested-validation/);
});

test("validate rejects unexpected arguments with exit code 2", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "usage-validation" },
        site: { url: "https://example.test/" }
    });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = runValidate(root, ["validate", "unexpected"]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /benötigt keine zusätzlichen Argumente/);
});

test("validate requires site.url and explains that Shorty will not invent a domain", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "missing-site-url" }
    });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = runValidate(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /site\.url fehlt/);
    assert.match(result.stderr, /Shorty erfindet keine Domain/);
});

test("validate rejects non-absolute and non-HTTP site.url values", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "invalid-site-url" },
        site: { url: "ftp://example.test/" }
    });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = runValidate(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Ungültige site\.url/);
    assert.match(result.stderr, /http:\/\/ oder https:\/\//);
});

test("validate checks page sitemap properties against the page data schema", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "invalid-page-properties" },
        site: { url: "https://example.test/" }
    });
    const pageData = path.join(root, "data", "pages", "home", "page.json");
    fs.mkdirSync(path.dirname(pageData), { recursive: true });
    fs.writeFileSync(pageData, JSON.stringify({ title: "Home", sitemap: "false" }));
    fs.mkdirSync(path.join(root, "pages", "home"), { recursive: true });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = runValidate(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Seitendaten ungültig/);
    assert.match(result.stderr, /sitemap: must be boolean/);
});
