const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const packageJson = require("../../package.json");
const runtimePackageJson = require("../../docker/runtime/package.json");
const runtimePackageLock = require("../../docker/runtime/package-lock.json");
const composerJson = require("../../docker/runtime/composer.json");
const composerLock = JSON.parse(fs.readFileSync(
    path.join(__dirname, "../../docker/runtime/composer.lock"),
    "utf8"
));
const {
    COMPOSER_SHA256,
    COMPOSER_URL,
    COMPOSER_VERSION,
    runPrepare,
    verifyComposerArchive,
    versionTuple
} = require("../../docker/runtime/scripts/prepare");

test("private Git distribution is guarded against npm publishing", () => {
    assert.equal(packageJson.private, true);
    assert.equal(packageJson.scripts.prepare, undefined);
    assert.equal(packageJson.scripts.prepack, undefined);
    assert.deepEqual(packageJson.dependencies, undefined);
    assert.ok(packageJson.files.includes("docker/runtime/**"));
    assert.equal(packageJson.engines.node, ">=24");
});

test("build dependencies are isolated in the Docker runtime manifests", () => {
    assert.deepEqual(runtimePackageJson.dependencies, {
        ajv: "^8.20.0",
        sass: "^1.108.2"
    });
    assert.deepEqual(runtimePackageLock.packages[""].dependencies, runtimePackageJson.dependencies);
    assert.equal(runtimePackageLock.packages["node_modules/ajv"].version, "8.20.0");
    assert.equal(runtimePackageLock.packages["node_modules/sass"].version, "1.108.2");
    assert.deepEqual(composerJson.require, { php: ">=8.2", "twig/twig": "^3.0" });
    assert.match(composerLock["content-hash"], /^[a-f0-9]{32}$/);
    assert.deepEqual(
        composerLock.packages.map(({ name, version }) => ({ name, version })),
        [
            { name: "symfony/deprecation-contracts", version: "v3.8.1" },
            { name: "symfony/polyfill-ctype", version: "v1.37.0" },
            { name: "symfony/polyfill-mbstring", version: "v1.43.3" },
            { name: "twig/twig", version: "v3.30.0" }
        ]
    );
});

test("Composer bootstrap is pinned to an exact release and checksum", () => {
    assert.equal(COMPOSER_VERSION, "2.11.1");
    assert.equal(COMPOSER_URL, "https://getcomposer.org/download/2.11.1/composer.phar");
    assert.match(COMPOSER_SHA256, /^[a-f0-9]{64}$/);
    assert.deepEqual(versionTuple("Composer version 2.11.1 2026-10-30"), [2, 11, 1]);
    assert.throws(() => verifyComposerArchive(Buffer.from("tampered")), /Prüfsummenfehler/);
});

test("prepare fails clearly when PHP is unavailable", async () => {
    await assert.rejects(
        runPrepare({
            packageRoot: os.tmpdir(),
            phpBinary: "missing-php-for-shorty-test",
            commandRunner: () => ({ status: null, error: new Error("not found"), stdout: "" }),
            composerDownloader: async () => {
                throw new Error("network must not be reached");
            }
        }),
        /PHP wurde nicht gefunden/
    );
});

test("prepare bootstraps Composer locally without requiring a Composer executable", async () => {
    const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-prepare-fallback-test-"));
    const calls = [];
    const commandRunner = (command, args) => {
        calls.push({ command, args });
        if (args[0] === "-r") return { status: 0, stdout: "8.5.12", stderr: "" };
        fs.mkdirSync(path.join(packageRoot, "vendor"), { recursive: true });
        fs.writeFileSync(path.join(packageRoot, "vendor", "autoload.php"), "<?php\n");
        return { status: 0, stdout: "", stderr: "" };
    };

    try {
        await runPrepare({
            packageRoot,
            phpBinary: "mise-php",
            commandRunner,
            composerDownloader: async () => Buffer.from("test composer phar")
        });
        assert.equal(calls[1].command, "mise-php");
        assert.match(calls[1].args[0], /shorty-composer-.*composer\.phar$/);
        assert.ok(calls[1].args.includes("install"));
        assert.equal(fs.existsSync(path.dirname(calls[1].args[0])), false);
    } finally {
        fs.rmSync(packageRoot, { recursive: true, force: true });
    }
});

test("prepare installs Composer dependencies and verifies the Twig autoloader", async () => {
    const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-prepare-test-"));
    const calls = [];
    const commandRunner = (command, args) => {
        calls.push({ command, args });
        if (args[0] === "-r") return { status: 0, stdout: "8.5.12", stderr: "" };
        if (args[0] === "--version") return { status: 0, stdout: "Composer version 2.11.1", stderr: "" };
        fs.mkdirSync(path.join(packageRoot, "vendor"), { recursive: true });
        fs.writeFileSync(path.join(packageRoot, "vendor", "autoload.php"), "<?php\n");
        return { status: 0, stdout: "", stderr: "" };
    };

    try {
        await runPrepare({
            packageRoot,
            phpBinary: "php",
            commandRunner,
            composerDownloader: async () => Buffer.from("mock pinned Composer PHAR")
        });
        assert.equal(fs.existsSync(path.join(packageRoot, "vendor", "autoload.php")), true);
        assert.equal(calls[1].command, "php");
        assert.match(calls[1].args[0], /shorty-composer-.*composer\.phar$/);
        assert.ok(calls[1].args.includes("--no-dev"));
        assert.ok(calls[1].args.includes("--classmap-authoritative"));
    } finally {
        fs.rmSync(packageRoot, { recursive: true, force: true });
    }
});
