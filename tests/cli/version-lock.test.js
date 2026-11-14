const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CLI_PATH = path.resolve(__dirname, "../../bin/shorty-container.js");

function createProject(shortyVersion) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-version-lock-"));
    fs.writeFileSync(path.join(root, "shorty.config.json"), JSON.stringify({
        configVersion: 1,
        project: { name: "version-locked-project" },
        site: { url: "https://example.test/" }
    }));
    fs.writeFileSync(path.join(root, "shorty.lock.json"), JSON.stringify({
        lockVersion: 1,
        shortyVersion
    }));
    return root;
}

test("project commands reject a different Shorty release with an exact install command", (context) => {
    const root = createProject("99.8.7");
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = spawnSync(process.execPath, [CLI_PATH, "validate"], {
        cwd: root,
        encoding: "utf8"
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /an Shorty 99\.8\.7 gebunden/);
    assert.match(result.stderr, /projektlokale Shorty-Git-Abhängigkeit/);
});

test("project commands reject malformed release lock files", (context) => {
    const root = createProject("not-a-version");
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = spawnSync(process.execPath, [CLI_PATH, "validate"], {
        cwd: root,
        encoding: "utf8"
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Shorty-Versionsdatei hat ein ungültiges Format/);
});
