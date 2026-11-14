const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CLI_PATH = path.resolve(__dirname, "../../bin/shorty-container.js");

function runInit(cwd, args = []) {
    return spawnSync(process.execPath, [CLI_PATH, "init", ...args], {
        cwd,
        encoding: "utf8"
    });
}

test("init creates a project configuration and all standard directories", (context) => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-init-"));
    const target = path.join(parent, "my-new-project");
    context.after(() => fs.rmSync(parent, { recursive: true, force: true }));

    const result = runInit(parent, [target]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Shorty-Projekt "My New Project" wurde initialisiert/);
    assert.match(result.stdout, /Scaffold-Dateien \(Basislayout, minimale Beispielseite, Seitendaten und Basis-Stylesheet\)/);
    assert.doesNotMatch(result.stdout, /Styleguide|Button|Formular|Komponenten/);

    const config = JSON.parse(
        fs.readFileSync(path.join(target, "shorty.config.json"), "utf8")
    );

    assert.deepEqual(config, {
        configVersion: 1,
        project: { name: "My New Project" },
        site: { url: "" }
    });

    assert.equal(fs.existsSync(path.join(target, "shorty.lock.json")), false);

    assert.equal(fs.existsSync(path.join(target, "pages", "home", "home.tpl")), true);
    assert.equal(fs.existsSync(path.join(target, "data", "pages", "home", "page.json")), true);
    assert.equal(fs.existsSync(path.join(target, "layouts", "base.tpl")), true);
    assert.equal(fs.existsSync(path.join(target, "assets", "styles", "base.scss")), true);
    assert.equal(fs.existsSync(path.join(target, "pages", "styleguide")), false);
    assert.deepEqual(fs.readdirSync(path.join(target, "components")), []);
    assert.equal(fs.existsSync(path.join(target, "assets", "styles", "_tokens.scss")), false);

    for (const directory of [
        "components",
        "pages",
        "layouts",
        "data",
        "assets",
        "schemas",
        "dist"
    ]) {
        assert.equal(
            fs.statSync(path.join(target, directory)).isDirectory(),
            true,
            `Expected directory ${directory} to exist`
        );
    }
});

test("init refuses to overwrite an existing project configuration", (context) => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-init-existing-"));
    const target = path.join(parent, "existing-project");
    fs.mkdirSync(target);
    fs.writeFileSync(
        path.join(target, "shorty.config.json"),
        '{"configVersion":1,"project":{"name":"Keep Me"},"site":{"url":"https://example.test/"}}\n'
    );
    context.after(() => fs.rmSync(parent, { recursive: true, force: true }));

    const result = runInit(parent, [target]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /existiert bereits/);
    assert.equal(
        JSON.parse(fs.readFileSync(path.join(target, "shorty.config.json"), "utf8")).project.name,
        "Keep Me"
    );
});

test("init refuses an existing Shorty version file without changing project files", (context) => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-init-existing-lock-"));
    const target = path.join(parent, "locked-project");
    const lockPath = path.join(target, "shorty.lock.json");
    const lockContent = '{"lockVersion":1,"shortyVersion":"2.0.0"}\n';
    fs.mkdirSync(target);
    fs.writeFileSync(lockPath, lockContent);
    context.after(() => fs.rmSync(parent, { recursive: true, force: true }));

    const result = runInit(parent, [target]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Shorty-Versionsdatei existiert bereits/);
    assert.match(result.stderr, /shorty\.lock\.json/);
    assert.doesNotMatch(result.stderr, /ReferenceError/);
    assert.equal(fs.readFileSync(lockPath, "utf8"), lockContent);
    assert.equal(fs.existsSync(path.join(target, "shorty.config.json")), false);
    assert.deepEqual(fs.readdirSync(target), ["shorty.lock.json"]);
});

test("init refuses a standard directory path occupied by a file", (context) => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-init-conflict-"));
    const target = path.join(parent, "conflicting-project");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "components"), "not a directory");
    context.after(() => fs.rmSync(parent, { recursive: true, force: true }));

    const result = runInit(parent, [target]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Standardpfad ist bereits als Datei vorhanden/);
    assert.equal(fs.existsSync(path.join(target, "shorty.config.json")), false);
});
