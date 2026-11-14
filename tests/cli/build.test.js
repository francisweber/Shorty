const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const CLI_PATH = path.resolve(__dirname, "../../bin/shorty-container.js");

function createBuildProject(context, instanceData = { heading: "A <useful> card" }) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-build-"));
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    fs.writeFileSync(path.join(root, "shorty.config.json"), JSON.stringify({
        configVersion: 1,
        project: { name: "build-test" },
        site: { url: "https://example.test/" }
    }));

    const componentDirectory = path.join(root, "components", "card");
    fs.mkdirSync(componentDirectory, { recursive: true });
    fs.writeFileSync(path.join(componentDirectory, "card.json"), JSON.stringify({
        metadataVersion: 1,
        name: "Card",
        description: "Build test component.",
        category: "content",
        dataSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            properties: { heading: { type: "string" } },
            required: ["heading"],
            additionalProperties: false
        }
    }));
    fs.writeFileSync(path.join(componentDirectory, "card.tpl"), "<article>{{ data.heading }}</article>\n");
    fs.mkdirSync(path.join(componentDirectory, "assets"), { recursive: true });
    fs.writeFileSync(path.join(componentDirectory, "assets", "card.svg"), "<svg class=\"card\"></svg>\n");
    fs.writeFileSync(
        path.join(componentDirectory, "card.scss"),
        ".card { color: red; background-image: url('./assets/card.svg'); }\n"
    );
    fs.writeFileSync(
        path.join(componentDirectory, "card.js"),
        "import './helper.js';\ndocument.documentElement.dataset.cardModule = 'loaded';\n"
    );
    fs.writeFileSync(path.join(componentDirectory, "helper.js"), "export {};\n");

    const pageDirectory = path.join(root, "pages", "home");
    fs.mkdirSync(pageDirectory, { recursive: true });
    fs.writeFileSync(
        path.join(pageDirectory, "home.tpl"),
        "<!doctype html><h1>{{ page.title }}</h1>{{ component('card', 'intro') }}<script type=\"module\" src=\"assets/scripts/site.js\"></script>\n"
    );

    const globalAssets = path.join(root, "assets");
    fs.mkdirSync(path.join(globalAssets, "styles"), { recursive: true });
    fs.mkdirSync(path.join(globalAssets, "scripts"), { recursive: true });
    fs.mkdirSync(path.join(globalAssets, "img"), { recursive: true });
    fs.writeFileSync(path.join(globalAssets, "styles", "_tokens.scss"), "$brand: #123456;\n");
    fs.writeFileSync(
        path.join(globalAssets, "styles", "site.scss"),
        '@use "tokens"; body { color: tokens.$brand; background-image: url("../img/bg.svg"); }\n'
    );
    fs.writeFileSync(path.join(globalAssets, "img", "bg.svg"), "<svg></svg>\n");
    fs.writeFileSync(path.join(globalAssets, "scripts", "site.js"), "import './helper.js';\n");
    fs.writeFileSync(path.join(globalAssets, "scripts", "helper.js"), "export {};\n");

    const pageDataDirectory = path.join(root, "data", "pages", "home");
    const componentsDataDirectory = path.join(pageDataDirectory, "components");
    fs.mkdirSync(componentsDataDirectory, { recursive: true });
    fs.writeFileSync(path.join(pageDataDirectory, "page.json"), JSON.stringify({
        title: "A <page>"
    }));
    if (instanceData !== null) {
        fs.writeFileSync(
            path.join(componentsDataDirectory, "intro.json"),
            JSON.stringify(instanceData)
        );
    }

    return root;
}

function addPage(root, pageId, pageData, template = "<html><head></head><body><h1>{{ page.title }}</h1></body></html>\n") {
    const templateDirectory = path.join(root, "pages", pageId);
    const dataDirectory = path.join(root, "data", "pages", pageId);
    fs.mkdirSync(templateDirectory, { recursive: true });
    fs.mkdirSync(dataDirectory, { recursive: true });
    fs.writeFileSync(path.join(templateDirectory, `${pageId}.tpl`), template);
    fs.writeFileSync(path.join(dataDirectory, "page.json"), JSON.stringify(pageData));
}

function runBuild(cwd, args = ["build"]) {
    return spawnSync(process.execPath, [CLI_PATH, ...args], {
        cwd,
        encoding: "utf8"
    });
}

function snapshotFiles(root) {
    const snapshot = new Map();
    if (!fs.existsSync(root)) return snapshot;

    for (const filePath of collectFiles(root)) {
        snapshot.set(path.relative(root, filePath), fs.readFileSync(filePath));
    }
    return snapshot;
}

function collectFiles(root) {
    if (!fs.existsSync(root)) return [];
    const files = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const entryPath = path.join(root, entry.name);
        if (entry.isDirectory()) files.push(...collectFiles(entryPath));
        else if (entry.isFile()) files.push(entryPath);
    }
    return files;
}

function assertSnapshotsEqual(actual, expected) {
    assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort());
    for (const [relativePath, contents] of expected) {
        assert.deepEqual(actual.get(relativePath), contents, `Unexpected output change: ${relativePath}`);
    }
}

function setOutputPath(root, output) {
    const configPath = path.join(root, "shorty.config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.paths = { output };
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function createInterruptedTransaction(root, options) {
    const outputRoot = path.join(root, options.output || "dist");
    const outputName = path.basename(outputRoot);
    const outputParent = path.dirname(outputRoot);
    const outputKey = crypto.createHash("sha256")
        .update(path.relative(root, outputRoot))
        .digest("hex")
        .slice(0, 16);
    const id = crypto.randomUUID();
    const prefix = `.${outputName}.shorty-${outputKey}-${id}`;
    const journalPath = path.join(outputParent, `.${outputName}.shorty-${outputKey}.transaction.json`);
    const stagePath = path.join(outputParent, `${prefix}.stage`);
    const backupPath = path.join(outputParent, `${prefix}.backup`);
    const markerName = `${prefix}.marker`;

    fs.mkdirSync(outputParent, { recursive: true });
    if (options.stage !== false) fs.mkdirSync(stagePath);
    if (options.backup) {
        fs.mkdirSync(backupPath);
        fs.writeFileSync(path.join(backupPath, "home.html"), options.backup);
    }
    if (options.promotedOutput) {
        fs.mkdirSync(outputRoot, { recursive: true });
        fs.writeFileSync(path.join(outputRoot, "home.html"), options.promotedOutput);
        fs.writeFileSync(path.join(outputRoot, markerName), `${JSON.stringify({ id })}\n`);
    }
    fs.writeFileSync(journalPath, `${JSON.stringify({
        version: 1,
        id,
        pid: 2147483647,
        state: options.state,
        hadOutput: options.hadOutput,
    })}\n`);
    return { outputRoot, journalPath, stagePath, backupPath, markerName };
}

test("build renders Twig pages and components into escaped static HTML", (context) => {
    const root = createBuildProject(context);
    const result = runBuild(root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Build erfolgreich: 1 Seite/);

    const html = fs.readFileSync(path.join(root, "dist", "home.html"), "utf8");
    assert.match(html, /<h1>A &lt;page&gt;<\/h1>/);
    assert.match(fs.readFileSync(path.join(root, "dist", "sitemap.xml"), "utf8"), /<loc>https:\/\/example\.test\/home\.html<\/loc>/);
    assert.match(html, /<article>A &lt;useful&gt; card<\/article>/);
    assert.doesNotMatch(html, /&lt;article&gt;/);
    assert.match(html, /href="assets\/shorty\.css"/);
    assert.match(html, /href="assets\/styles\/site\.css"/);
    assert.match(html, /type="module" src="assets\/pages\/home\.js"/);
    assert.match(
        fs.readFileSync(path.join(root, "dist", "assets", "shorty.css"), "utf8"),
        /\.card\{color:red;background-image:url\(["']?components\/card\/assets\/card\.svg["']?\)\}/
    );
    assert.equal(
        fs.readFileSync(path.join(root, "dist", "assets", "pages", "home.js"), "utf8"),
        'import "../components/card/card.js";\n'
    );
    assert.match(
        fs.readFileSync(path.join(root, "dist", "assets", "components", "card", "card.js"), "utf8"),
        /dataset\.cardModule/
    );
    assert.equal(
        fs.readFileSync(path.join(root, "dist", "assets", "components", "card", "helper.js"), "utf8"),
        "export {};\n"
    );
    assert.match(
        fs.readFileSync(path.join(root, "dist", "assets", "styles", "site.css"), "utf8"),
        /color:#123456/
    );
    assert.equal(
        fs.readFileSync(path.join(root, "dist", "assets", "scripts", "helper.js"), "utf8"),
        "export {};\n"
    );
    assert.equal(
        fs.readFileSync(path.join(root, "dist", "assets", "img", "bg.svg"), "utf8"),
        "<svg></svg>\n"
    );
    assert.equal(
        fs.readFileSync(path.join(root, "dist", "assets", "components", "card", "assets", "card.svg"), "utf8"),
        "<svg class=\"card\"></svg>\n"
    );
});

test("sitemap includes all pages by default and does not depend on navigation", (context) => {
    const root = createBuildProject(context);
    addPage(root, "about", { title: "About" });

    const result = runBuild(root);
    assert.equal(result.status, 0, result.stderr);
    const sitemap = fs.readFileSync(path.join(root, "dist", "sitemap.xml"), "utf8");
    assert.match(sitemap, /<loc>https:\/\/example\.test\/home\.html<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/example\.test\/about\.html<\/loc>/);
    assert.equal((sitemap.match(/<url>/g) || []).length, 2);
    assert.equal(fs.existsSync(path.join(root, "data", "navigation")), false);
});

test("sitemap false excludes only that page", (context) => {
    const root = createBuildProject(context);
    addPage(root, "about", { title: "About", sitemap: false });

    const result = runBuild(root);
    assert.equal(result.status, 0, result.stderr);
    const sitemap = fs.readFileSync(path.join(root, "dist", "sitemap.xml"), "utf8");
    assert.match(sitemap, /home\.html/);
    assert.doesNotMatch(sitemap, /about\.html/);
    assert.equal(fs.existsSync(path.join(root, "dist", "about.html")), true);
});

test("noindex emits a robots directive and takes precedence over sitemap true", (context) => {
    const root = createBuildProject(context);
    const pagePath = path.join(root, "data", "pages", "home", "page.json");
    fs.writeFileSync(pagePath, JSON.stringify({ title: "Home", sitemap: true, noindex: true }));
    fs.writeFileSync(path.join(root, "pages", "home", "home.tpl"),
        '<!doctype html><html><head><meta name="robots" content="index,follow"></head><body>{{ page.title }}</body></html>\n');

    const result = runBuild(root);
    assert.equal(result.status, 0, result.stderr);
    const html = fs.readFileSync(path.join(root, "dist", "home.html"), "utf8");
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.doesNotMatch(html, /content="index,follow"/);
    assert.doesNotMatch(fs.readFileSync(path.join(root, "dist", "sitemap.xml"), "utf8"), /home\.html/);
});

test("sitemap URL encodes the configured base path and escapes XML characters", (context) => {
    const root = createBuildProject(context);
    const configPath = path.join(root, "shorty.config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.site.url = "https://example.test/Über & Brand/";
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = runBuild(root);
    assert.equal(result.status, 0, result.stderr);
    const sitemap = fs.readFileSync(path.join(root, "dist", "sitemap.xml"), "utf8");
    assert.match(sitemap, /https:\/\/example\.test\/%C3%9Cber%20&amp;%20Brand\/home\.html/);
    assert.doesNotMatch(sitemap, /<loc>[^<]*&[^a][^m][^p];/);
});

test("build reports a missing component instance data file", (context) => {
    const root = createBuildProject(context, null);
    const result = runBuild(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Daten für Instanz 'intro' kann nicht gelesen werden/);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
});

test("build reports component instance data that violates its schema", (context) => {
    const root = createBuildProject(context, { heading: 42 });
    const result = runBuild(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Daten für 'card\/intro' sind ungültig/);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
});

test("build rejects unexpected arguments with usage exit code 2", (context) => {
    const root = createBuildProject(context);
    const result = runBuild(root, ["build", "unexpected"]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /build benötigt keine zusätzlichen Argumente/);
});

test("build renders inherited layouts and nested components with explicit data", (context) => {
    const root = createBuildProject(context);
    const layoutsDirectory = path.join(root, "layouts");
    fs.mkdirSync(layoutsDirectory, { recursive: true });
    fs.writeFileSync(
        path.join(layoutsDirectory, "base.tpl"),
        "<!doctype html><html><head><title>{{ page.title }}</title></head><body>{% block content %}{% endblock %}</body></html>\n"
    );
    fs.writeFileSync(
        path.join(root, "pages", "home", "home.tpl"),
        "{% extends 'layouts/base.tpl' %}{% block content %}<h1>{{ page.title }}</h1>{{ component('card', 'intro') }}{% endblock %}\n"
    );
    fs.writeFileSync(
        path.join(root, "components", "card", "card.tpl"),
        "<article>{{ data.heading }}{{ component('badge', 'nested') }}</article>\n"
    );

    const badgeDirectory = path.join(root, "components", "badge");
    fs.mkdirSync(badgeDirectory, { recursive: true });
    fs.writeFileSync(path.join(badgeDirectory, "badge.json"), JSON.stringify({
        metadataVersion: 1,
        name: "Badge",
        description: "Nested build test component.",
        category: "content",
        dataSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            properties: { label: { type: "string" } },
            required: ["label"],
            additionalProperties: false
        }
    }));
    fs.writeFileSync(path.join(badgeDirectory, "badge.tpl"), "<span>{{ data.label }}</span>\n");
    fs.writeFileSync(path.join(badgeDirectory, "badge.scss"), ".badge {}\n");
    fs.writeFileSync(
        path.join(root, "data", "pages", "home", "components", "nested.json"),
        JSON.stringify({ label: "Nested content" })
    );

    const result = runBuild(root);
    assert.equal(result.status, 0, result.stderr);

    const html = fs.readFileSync(path.join(root, "dist", "home.html"), "utf8");
    assert.match(html, /<title>A &lt;page&gt;<\/title>/);
    assert.match(html, /<article>A &lt;useful&gt; card<span>Nested content<\/span>\s*<\/article>/);
});

test("component rendering does not inherit the page data context", (context) => {
    const root = createBuildProject(context);
    fs.writeFileSync(
        path.join(root, "components", "card", "card.tpl"),
        "<article>{{ page.title }}</article>\n"
    );

    const result = runBuild(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Variable "page" does not exist/);
});

test("successful rebuild removes stale page and asset files", (context) => {
    const root = createBuildProject(context);
    const oldPageDirectory = path.join(root, "pages", "old-page");
    fs.mkdirSync(oldPageDirectory, { recursive: true });
    fs.writeFileSync(path.join(oldPageDirectory, "old-page.tpl"), "<p>Old page</p>\n");
    fs.mkdirSync(path.join(root, "data", "pages", "old-page"), { recursive: true });
    fs.writeFileSync(path.join(root, "data", "pages", "old-page", "page.json"), "{}\n");
    fs.writeFileSync(path.join(root, "assets", "obsolete.txt"), "old asset\n");

    assert.equal(runBuild(root).status, 0);
    assert.equal(fs.existsSync(path.join(root, "dist", "old-page.html")), true);
    assert.equal(fs.existsSync(path.join(root, "dist", "assets", "obsolete.txt")), true);

    fs.rmSync(oldPageDirectory, { recursive: true });
    fs.rmSync(path.join(root, "data", "pages", "old-page"), { recursive: true });
    fs.rmSync(path.join(root, "assets", "obsolete.txt"));
    const rebuilt = runBuild(root);

    assert.equal(rebuilt.status, 0, rebuilt.stderr);
    assert.equal(fs.existsSync(path.join(root, "dist", "home.html")), true);
    assert.equal(fs.existsSync(path.join(root, "dist", "old-page.html")), false);
    assert.equal(fs.existsSync(path.join(root, "dist", "assets", "obsolete.txt")), false);
});

test("failed build preserves the complete last successful output", (context) => {
    const root = createBuildProject(context);
    assert.equal(runBuild(root).status, 0);
    const outputRoot = path.join(root, "dist");
    const expected = snapshotFiles(outputRoot);
    assert.equal(expected.has("sitemap.xml"), true);

    fs.writeFileSync(path.join(root, "components", "card", "card.scss"), ".card { color: ; }\n");
    const failed = runBuild(root);

    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /Build fehlgeschlagen/);
    assertSnapshotsEqual(snapshotFiles(outputRoot), expected);
    assert.equal(fs.readdirSync(root).some((name) => name.includes("shorty-") && (name.endsWith(".stage") || name.endsWith(".backup") || name.endsWith(".transaction.json"))), false);
});

test("successful rebuild replaces an empty output directory", (context) => {
    const root = createBuildProject(context);
    fs.mkdirSync(path.join(root, "dist"));

    const result = runBuild(root);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, "dist", "home.html")), true);
});

test("custom output directory is replaced without leaving stale files", (context) => {
    const root = createBuildProject(context);
    setOutputPath(root, "public/generated");
    const result = runBuild(root);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, "public/generated/home.html")), true);
    assert.equal(fs.existsSync(path.join(root, "public/generated/sitemap.xml")), true);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);

    fs.writeFileSync(path.join(root, "public/generated/obsolete.html"), "stale\n");
    const rebuilt = runBuild(root);

    assert.equal(rebuilt.status, 0, rebuilt.stderr);
    assert.equal(fs.existsSync(path.join(root, "public/generated/obsolete.html")), false);
    assert.equal(fs.existsSync(path.join(root, "public/generated/home.html")), true);

    const configPath = path.join(root, "shorty.config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.site.url = "https://updated.example.test/";
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    const updated = runBuild(root);
    assert.equal(updated.status, 0, updated.stderr);
    const sitemap = fs.readFileSync(path.join(root, "public/generated/sitemap.xml"), "utf8");
    assert.match(sitemap, /updated\.example\.test\/home\.html/);
    assert.doesNotMatch(sitemap, /https:\/\/example\.test\/home\.html/);
});

test("output symlink to a source directory is rejected without changing source files", (context) => {
    const root = createBuildProject(context);
    const componentFile = path.join(root, "components", "card", "card.tpl");
    const before = fs.readFileSync(componentFile);
    const outputLink = path.join(root, "linked-output");
    try {
        fs.symlinkSync(path.join(root, "components"), outputLink, "dir");
    } catch (error) {
        if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
            context.skip(`Symlinks are unavailable in this environment: ${error.code}`);
            return;
        }
        throw error;
    }
    setOutputPath(root, "linked-output");

    const result = runBuild(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /symbolischen Links/);
    assert.equal(fs.lstatSync(outputLink).isSymbolicLink(), true);
    assert.deepEqual(fs.readFileSync(componentFile), before);
});

test("symlink in a parent segment of the output path is rejected", (context) => {
    const root = createBuildProject(context);
    const componentFile = path.join(root, "components", "card", "card.tpl");
    const before = fs.readFileSync(componentFile);
    const parentLink = path.join(root, "linked-parent");
    try {
        fs.symlinkSync(path.join(root, "components"), parentLink, "dir");
    } catch (error) {
        if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
            context.skip(`Symlinks are unavailable in this environment: ${error.code}`);
            return;
        }
        throw error;
    }
    setOutputPath(root, "linked-parent/generated");

    const result = runBuild(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /symbolischen Links/);
    assert.deepEqual(fs.readFileSync(componentFile), before);
    assert.equal(fs.existsSync(path.join(root, "components", "generated")), false);
});

test("output symlink outside the project is rejected without changing its target", (context) => {
    const root = createBuildProject(context);
    const outside = `${root}-outside`;
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "sentinel.txt"), "keep\n");
    context.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    const outputLink = path.join(root, "linked-output");
    try {
        fs.symlinkSync(outside, outputLink, "dir");
    } catch (error) {
        if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
            context.skip(`Symlinks are unavailable in this environment: ${error.code}`);
            return;
        }
        throw error;
    }
    setOutputPath(root, "linked-output");

    const result = runBuild(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /symbolischen Link/);
    assert.equal(fs.readFileSync(path.join(outside, "sentinel.txt"), "utf8"), "keep\n");
    assert.equal(fs.readdirSync(outside).length, 1);
});

test("output path that is a regular file is preserved", (context) => {
    const root = createBuildProject(context);
    setOutputPath(root, "public-output");
    const outputFile = path.join(root, "public-output");
    fs.writeFileSync(outputFile, "user data\n");

    const result = runBuild(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /kein Verzeichnis/);
    assert.equal(fs.readFileSync(outputFile, "utf8"), "user data\n");
});

test("interrupted transaction after backup rename restores the previous output", (context) => {
    const root = createBuildProject(context);
    const transaction = createInterruptedTransaction(root, {
        state: "ready",
        hadOutput: true,
        backup: "last successful output\n",
    });
    fs.writeFileSync(path.join(root, "components", "card", "card.scss"), ".card { color: ; }\n");

    const result = runBuild(root);

    assert.equal(result.status, 1);
    assert.equal(fs.readFileSync(path.join(transaction.outputRoot, "home.html"), "utf8"), "last successful output\n");
    assert.equal(fs.existsSync(transaction.backupPath), false);
    assert.equal(fs.existsSync(transaction.journalPath), false);
});

test("interrupted transaction after new output rename rolls back to the backup", (context) => {
    const root = createBuildProject(context);
    const transaction = createInterruptedTransaction(root, {
        state: "promoting",
        hadOutput: true,
        backup: "last successful output\n",
        promotedOutput: "uncommitted output\n",
        stage: false,
    });
    fs.writeFileSync(path.join(root, "components", "card", "card.scss"), ".card { color: ; }\n");

    const result = runBuild(root);

    assert.equal(result.status, 1);
    assert.equal(fs.readFileSync(path.join(transaction.outputRoot, "home.html"), "utf8"), "last successful output\n");
    assert.equal(fs.existsSync(transaction.backupPath), false);
    assert.equal(fs.existsSync(transaction.journalPath), false);
});

test("interrupted first build removes only its marked uncommitted output", (context) => {
    const root = createBuildProject(context);
    const transaction = createInterruptedTransaction(root, {
        state: "promoting",
        hadOutput: false,
        promotedOutput: "uncommitted output\n",
        stage: false,
    });
    fs.writeFileSync(path.join(root, "components", "card", "card.scss"), ".card { color: ; }\n");

    const result = runBuild(root);

    assert.equal(result.status, 1);
    assert.equal(fs.existsSync(transaction.outputRoot), false);
    assert.equal(fs.existsSync(transaction.journalPath), false);
});

test("committed interrupted transaction keeps the new output and removes its backup", (context) => {
    const root = createBuildProject(context);
    const transaction = createInterruptedTransaction(root, {
        state: "committed",
        hadOutput: true,
        backup: "previous output\n",
        promotedOutput: "committed output\n",
        stage: false,
    });
    fs.writeFileSync(path.join(root, "components", "card", "card.scss"), ".card { color: ; }\n");

    const result = runBuild(root);

    assert.equal(result.status, 1);
    assert.equal(fs.readFileSync(path.join(transaction.outputRoot, "home.html"), "utf8"), "committed output\n");
    assert.equal(fs.existsSync(path.join(transaction.outputRoot, transaction.markerName)), false);
    assert.equal(fs.existsSync(transaction.backupPath), false);
    assert.equal(fs.existsSync(transaction.journalPath), false);
});
