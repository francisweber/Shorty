const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const LAUNCHER_PATH = path.resolve(__dirname, "../../bin/shorty.js");
const SHORTY_VERSION = require("../../package.json").version;
const {
    buildDockerArgs,
    buildImageDockerArgs,
    checkDockerAvailability,
    checkHostToolchain,
    executeImageBuild,
    executeDocker,
    parseCommand,
    resolveImageIdentity,
    resolvePinnedImage,
    run,
    runProcess
} = require("../../bin/shorty.js");

function createProjectPath(name = "shorty-launcher-project-") {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), name));
    fs.writeFileSync(path.join(root, "shorty.config.json"), JSON.stringify({
        configVersion: 1,
        project: { name: "launcher-test" },
        site: { url: "https://example.test/" }
    }));
    fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({
        name: "website",
        lockfileVersion: 3,
        packages: {
            "": { name: "website" },
            "node_modules/shorty-cli": {
                version: SHORTY_VERSION,
                resolved: "git+https://github.com/francisweber/Shorty.git#0123456789abcdef0123456789abcdef01234567"
            }
        }
    }));
    return root;
}

function fakeChild() {
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stderr.setEncoding = () => {};
    child.killSignals = [];
    child.kill = (signal) => {
        child.killSignals.push(signal);
        return true;
    };
    return child;
}

function executeDockerImageBuildForTest(root, spawnImpl, messages) {
    return executeImageBuild({
        projectRoot: root,
        cwd: root,
        env: {},
        spawnImpl,
        signalSource: new EventEmitter()
    }, (message) => messages.push(message), (message) => messages.push(message));
}

function writeBootstrapLock(root, commit = "0123456789abcdef0123456789abcdef01234567") {
    fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({
        name: "bootstrap-shorty",
        lockfileVersion: 3,
        packages: {
            "": { name: "bootstrap-shorty" },
            "node_modules/shorty-cli": {
                version: SHORTY_VERSION,
                resolved: `git+https://github.com/francisweber/Shorty.git#${commit}`
            }
        }
    }));
    return commit;
}

function fakeNpmInstaller(commit, calls = []) {
    return (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        const manifest = JSON.parse(fs.readFileSync(path.join(options.cwd, "package.json"), "utf8"));
        fs.writeFileSync(path.join(options.cwd, "package-lock.json"), JSON.stringify({
            name: manifest.name,
            version: manifest.version,
            lockfileVersion: 3,
            packages: {
                "": { name: manifest.name, version: manifest.version, dependencies: manifest.dependencies },
                "node_modules/shorty-cli": {
                    version: SHORTY_VERSION,
                    resolved: `${manifest.dependencies["shorty-cli"]}`
                }
            }
        }));
        const installedDirectory = path.join(options.cwd, "node_modules", "shorty-cli");
        fs.mkdirSync(installedDirectory, { recursive: true });
        fs.writeFileSync(path.join(installedDirectory, "package.json"), JSON.stringify({ name: "shorty-cli", version: SHORTY_VERSION }));
        const child = fakeChild();
        process.nextTick(() => child.emit("close", command === "npm" && args[0] === "install" ? 0 : 1, null));
        return child;
    };
}

test("host launcher loads without AJV, Sass, PHP, or Composer modules", () => {
    const script = `
        require(${JSON.stringify(LAUNCHER_PATH)});
        process.stdout.write(Object.keys(require.cache).join("\\n"));
    `;
    const result = spawnSync(process.execPath, ["-e", script], { encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /node_modules[\\/]?(?:ajv|sass)(?:[\\/]|$)/i);
    assert.doesNotMatch(result.stdout, /src[\\/](?:core|render|component)/i);
    const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf8"));
    assert.deepEqual(packageJson.dependencies || {}, {});
});

test("host launcher accepts supported commands and rejects invalid arguments", () => {
    assert.deepEqual(parseCommand(["validate"]), { command: "validate", args: [] });
    assert.deepEqual(parseCommand(["serve", "4177"]), { command: "serve", args: ["4177"] });
    assert.deepEqual(parseCommand(["component:create", "feature-grid", "--with-js"]), {
        command: "component:create",
        args: ["feature-grid", "--with-js"]
    });
    assert.match(parseCommand(["unknown"]).error, /Unbekannter Befehl/);
    assert.match(parseCommand(["build", "unexpected"]).error, /keine zusätzlichen Argumente/);
    assert.match(parseCommand(["serve", "70000"]).error, /Port/);
    assert.match(parseCommand(["component:validate"]).error, /Komponentennamen/);
    assert.deepEqual(parseCommand(["image", "build"]), { command: "image:build", args: [] });
    assert.deepEqual(parseCommand(["image", "--help"]), { help: true, helpCommand: "image" });
    assert.match(parseCommand(["image", "build", "extra"]).error, /keine zusätzlichen Argumente/);
});

test("host toolchain rejects Node.js below 24 with the detected and required versions", () => {
    const result = checkHostToolchain({
        env: { npm_config_user_agent: "npm/12.2.2 node/v24.22.2 darwin arm64" },
        nodeVersion: "23.11.0"
    });
    assert.equal(result.code, 1);
    assert.match(result.message, /erkannt 23\.11\.0, erforderlich >=24\.0\.0/);
});

test("host toolchain reports an unavailable Node.js version", () => {
    const result = checkHostToolchain({ env: {}, nodeVersion: null });
    assert.equal(result.code, 1);
    assert.match(result.message, /Node\.js wurde nicht erkannt/);
    assert.match(result.message, />=24\.0\.0/);
});

test("host toolchain reports missing npm clearly", () => {
    const result = checkHostToolchain({
        env: {},
        nodeVersion: "24.22.2",
        spawnSyncImpl: () => ({ status: null, stdout: "", stderr: "", error: Object.assign(new Error("spawn npm ENOENT"), { code: "ENOENT" }) })
    });
    assert.equal(result.code, 1);
    assert.match(result.message, /npm wurde nicht gefunden/);
    assert.match(result.message, />=10\.2\.0/);
});

test("host toolchain rejects npm below 10.2.0 with both versions", () => {
    const result = checkHostToolchain({
        env: { npm_config_user_agent: "npm/10.1.9 node/v24.22.2 darwin arm64" },
        nodeVersion: "24.22.2"
    });
    assert.equal(result.code, 1);
    assert.match(result.message, /erkannt 10\.1\.9, erforderlich >=10\.2\.0/);
});

test("host toolchain accepts npm 10.2.0 and newer npm versions", () => {
    for (const version of ["10.2.0", "10.9.10", "11.21.2", "12.2.2"]) {
        const result = checkHostToolchain({
            env: { npm_config_user_agent: `npm/${version} node/v24.22.2 darwin arm64` },
            nodeVersion: "24.22.2"
        });
        assert.equal(result.code, 0, result.message);
        assert.equal(result.npmVersion, version);
    }
});

test("init rejects unsupported Node.js and npm before creating project files", async (context) => {
    const scenarios = [
        {
            name: "old Node.js",
            nodeVersion: "23.11.0",
            env: { npm_config_user_agent: "npm/12.2.2 node/v24.22.2 darwin arm64" },
            expected: /Node\.js-Version nicht unterstützt/
        },
        {
            name: "old npm",
            nodeVersion: "24.22.2",
            env: { npm_config_user_agent: "npm/10.1.9 node/v24.22.2 darwin arm64" },
            expected: /npm-Version nicht unterstützt/
        },
        {
            name: "missing npm",
            nodeVersion: "24.22.2",
            env: {},
            spawnSyncImpl: () => ({ status: null, stdout: "", stderr: "", error: Object.assign(new Error("spawn npm ENOENT"), { code: "ENOENT" }) }),
            expected: /npm wurde nicht gefunden/
        }
    ];

    for (const scenario of scenarios) {
        const parent = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-toolchain-preflight-"));
        const target = path.join(parent, "new-project");
        context.after(() => fs.rmSync(parent, { recursive: true, force: true }));
        const errors = [];
        const result = await run(["init", target], {
            cwd: parent,
            env: scenario.env,
            nodeVersion: scenario.nodeVersion,
            spawnSyncImpl: scenario.spawnSyncImpl || (() => { throw new Error("npm preflight should use the supplied user-agent"); }),
            writeError: (message) => errors.push(message)
        });
        assert.equal(result, 1, scenario.name);
        assert.match(errors.join(" "), scenario.expected, scenario.name);
        assert.equal(fs.existsSync(target), false, `${scenario.name}: init must not create its target`);
    }
});

test("init reports missing Git before creating the project directory", async () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-no-git-"));
    const target = path.join(parent, "new-project");
    const errors = [];
    const result = await run(["init", target], {
        cwd: parent,
        env: { npm_config_user_agent: "npm/10.2.0 node/v24.22.2 darwin arm64" },
        spawnSyncImpl: (command) => command === "git"
            ? { status: null, stdout: "", stderr: "", error: Object.assign(new Error("spawn git ENOENT"), { code: "ENOENT" }) }
            : { status: 0, stdout: "10.2.0", stderr: "" },
        writeError: (message) => errors.push(message)
    });
    fs.rmSync(parent, { recursive: true, force: true });
    assert.equal(result, 1);
    assert.match(errors.join(" "), /Git wurde nicht gefunden/);
    assert.match(errors.join(" "), /private Shorty-Repository/);
    assert.equal(fs.existsSync(target), false);
});

test("help does not run Node, npm, Git, or Docker preflight checks", async () => {
    let checks = 0;
    let help = "";
    const code = await run(["--help"], {
        checkToolchain: async () => { checks += 1; throw new Error("must not run"); },
        checkGit: async () => { checks += 1; throw new Error("must not run"); },
        checkDocker: async () => { checks += 1; throw new Error("must not run"); },
        write: (message) => { help = message; }
    });
    assert.equal(code, 0);
    assert.equal(checks, 0);
    assert.match(help, /Shorty CLI/);
});

test("image help does not require Docker", async () => {
    let dockerChecks = 0;
    let help = "";
    const code = await run(["image", "--help"], {
        checkDocker: async () => { dockerChecks += 1; return { code: 0 }; },
        write: (value) => { help = value; }
    });
    assert.equal(code, 0);
    assert.equal(dockerChecks, 0);
    assert.match(help, /shorty image build/);
});

test("init bootstraps a fresh local npm project and reports its neutral scaffold without Docker", async (context) => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "Shorty bootstrap mit ä ö "));
    const target = path.join(parent, "Neue Website ü");
    const bootstrap = path.join(parent, "bootstrap");
    fs.mkdirSync(bootstrap);
    const commit = writeBootstrapLock(bootstrap);
    context.after(() => fs.rmSync(parent, { recursive: true, force: true }));
    const output = [];
    const errors = [];
    const calls = [];
    let dockerChecks = 0;

    const code = await run(["init"], {
        cwd: target,
        env: { npm_config_local_prefix: bootstrap },
        checkDocker: async () => { dockerChecks += 1; return { code: 0 }; },
        spawnImpl: fakeNpmInstaller(commit, calls),
        signalSource: new EventEmitter(),
        write: (message) => output.push(message),
        writeError: (message) => errors.push(message)
    });

    assert.equal(code, 0, errors.join("\n"));
    assert.match(output.join("\n"), /Scaffold: neutrales Layout, minimale Beispielseite mit Seitendaten und Basis-Stylesheet/);
    assert.doesNotMatch(output.join("\n"), /Styleguide|Button|Formular|Komponenten/);
    assert.equal(dockerChecks, 0);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args, ["install", "--save-exact", "--ignore-scripts", "--no-audit", "--no-fund"]);
    const manifest = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
    assert.equal(manifest.private, true);
    assert.deepEqual(manifest.shorty, { version: SHORTY_VERSION, commit });
    assert.equal(manifest.dependencies["shorty-cli"], `git+https://github.com/francisweber/Shorty.git#${commit}`);
    assert.match(fs.readFileSync(path.join(target, ".npmrc"), "utf8"), /^allow-git=root\s*$/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, "package-lock.json"), "utf8")).packages["node_modules/shorty-cli"].resolved.endsWith(commit), true);
    assert.equal(fs.existsSync(path.join(target, "node_modules", "shorty-cli", "package.json")), true);
    assert.equal(fs.existsSync(path.join(target, "shorty.config.json")), true);
    assert.equal(fs.existsSync(path.join(target, "shorty.lock.json")), false);
    assert.equal(fs.existsSync(path.join(target, "pages", "home", "home.tpl")), true);
    assert.equal(fs.existsSync(path.join(target, "pages", "styleguide")), false);
    assert.deepEqual(fs.readdirSync(path.join(target, "components")), []);
    assert.deepEqual(fs.readFileSync(path.join(target, ".gitignore"), "utf8").trim().split("\n"), ["node_modules/", "dist/"]);
    assert.match(output.join("\n"), /shorty image build/);
});

test("init refuses to overwrite existing npm and Shorty project files", async (context) => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-init-protect-"));
    const bootstrap = path.join(parent, "bootstrap");
    const target = path.join(parent, "existing");
    fs.mkdirSync(bootstrap);
    fs.mkdirSync(target);
    writeBootstrapLock(bootstrap);
    const originalManifest = JSON.stringify({ name: "existing-site", private: true, dependencies: { "shorty-cli": "git+https://github.com/francisweber/Shorty.git#ffffffffffffffffffffffffffffffffffffffff" } }, null, 2);
    fs.writeFileSync(path.join(target, "package.json"), originalManifest);
    fs.writeFileSync(path.join(target, "package-lock.json"), "existing lock\n");
    context.after(() => fs.rmSync(parent, { recursive: true, force: true }));
    const errors = [];
    let npmCalls = 0;
    const code = await run(["init"], {
        cwd: target,
        env: { npm_config_local_prefix: bootstrap },
        checkDocker: async () => ({ code: 0 }),
        spawnImpl: () => { npmCalls += 1; return fakeChild(); },
        signalSource: new EventEmitter(),
        writeError: (message) => errors.push(message)
    });
    assert.equal(code, 1);
    assert.equal(npmCalls, 0);
    assert.match(errors.join(" "), /ersetzt keine installierte Version automatisch/);
    assert.equal(fs.readFileSync(path.join(target, "package.json"), "utf8"), originalManifest);
    assert.equal(fs.readFileSync(path.join(target, "package-lock.json"), "utf8"), "existing lock\n");
    assert.equal(fs.existsSync(path.join(target, "shorty.config.json")), false);
});

test("init preserves existing npm configuration and appends only required gitignore entries", async (context) => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-init-preserve-"));
    const target = path.join(parent, "site");
    const bootstrap = path.join(parent, "bootstrap");
    fs.mkdirSync(target);
    fs.mkdirSync(bootstrap);
    const commit = writeBootstrapLock(bootstrap);
    fs.writeFileSync(path.join(target, ".npmrc"), "cache=.npm-cache\n");
    fs.writeFileSync(path.join(target, ".gitignore"), "node_modules/\ncustom-file\n");
    context.after(() => fs.rmSync(parent, { recursive: true, force: true }));
    const info = [];
    const code = await run(["init"], {
        cwd: target,
        env: { npm_config_local_prefix: bootstrap },
        spawnImpl: fakeNpmInstaller(commit),
        signalSource: new EventEmitter(),
        write: (message) => info.push(message),
        writeError: (message) => { throw new Error(message); }
    });
    assert.equal(code, 0);
    assert.match(fs.readFileSync(path.join(target, ".npmrc"), "utf8"), /^cache=\.npm-cache\nallow-git=root\n$/);
    assert.match(fs.readFileSync(path.join(target, ".gitignore"), "utf8"), /^node_modules\/\ncustom-file\ndist\/\n$/);
    assert.match(info.join(" "), /allow-git=root ergänzt/);
});

test("init reports a failed private Git installation without scaffolding over partial files", async (context) => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-init-install-fail-"));
    const bootstrap = path.join(parent, "bootstrap");
    const target = path.join(parent, "site");
    fs.mkdirSync(bootstrap);
    writeBootstrapLock(bootstrap);
    context.after(() => fs.rmSync(parent, { recursive: true, force: true }));
    const errors = [];
    const code = await run(["init"], {
        cwd: target,
        env: { npm_config_local_prefix: bootstrap },
        spawnImpl: (command, args) => {
            assert.equal(command, "npm");
            const child = fakeChild();
            process.nextTick(() => child.emit("close", 128, null));
            return child;
        },
        signalSource: new EventEmitter(),
        writeError: (message) => errors.push(message)
    });
    assert.equal(code, 128);
    assert.match(errors.join(" "), /GitHub-Zugriff und Authentifizierung/);
    assert.equal(fs.existsSync(path.join(target, ".npmrc")), true);
    assert.equal(fs.existsSync(path.join(target, "package.json")), true);
    assert.equal(fs.existsSync(path.join(target, "shorty.config.json")), false);
});

test("image build stops with Docker guidance when the daemon is unavailable", async (context) => {
    const root = createProjectPath();
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const errors = [];
    let executions = 0;
    const code = await run(["image", "build"], {
        cwd: root,
        checkDocker: async () => ({ code: 1, message: "Docker-Daemon ist nicht erreichbar." }),
        execute: async () => { executions += 1; return { code: 0 }; },
        writeError: (message) => errors.push(message)
    });
    assert.equal(code, 1);
    assert.equal(executions, 0);
    assert.match(errors.join(" "), /Docker-Daemon ist nicht erreichbar/);
});

test("launcher resolves a project path with spaces and Unicode and forwards arguments", async (context) => {
    const root = createProjectPath("shorty site mit ä ö ü ");
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const nested = path.join(root, "pages", "über-uns");
    fs.mkdirSync(nested, { recursive: true });
    let request;

    const code = await run(["component:create", "feature-grid", "--with-js"], {
        cwd: nested,
        checkDocker: async () => ({ code: 0 }),
        execute: async (value) => {
            request = value;
            return { code: 17 };
        },
        writeError: () => {}
    });

    assert.equal(code, 17);
    assert.equal(request.projectRoot, root);
    assert.equal(request.command, "component:create");
    assert.deepEqual(request.args, ["feature-grid", "--with-js"]);
});

test("invalid commands and missing project configuration do not invoke Docker", async (context) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-launcher-empty-"));
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    let dockerChecks = 0;

    const invalidCommand = await run(["deploy"], {
        cwd: root,
        checkDocker: async () => { dockerChecks += 1; return { code: 0 }; },
        writeError: () => {}
    });
    const missingProject = await run(["build"], {
        cwd: root,
        checkDocker: async () => { dockerChecks += 1; return { code: 0 }; },
        writeError: () => {}
    });

    assert.equal(invalidCommand, 2);
    assert.equal(missingProject, 1);
    assert.equal(dockerChecks, 0);
});

test("Docker preflight reports missing executable and unavailable daemon distinctly", async () => {
    const missing = await checkDockerAvailability({
        spawnImpl: () => {
            const child = fakeChild();
            process.nextTick(() => {
                child.emit("error", new Error("spawn docker ENOENT"));
                child.emit("close", null, null);
            });
            return child;
        },
        signalSource: new EventEmitter()
    });
    const unavailable = await checkDockerAvailability({
        spawnImpl: () => {
            const child = fakeChild();
            process.nextTick(() => {
                child.stderr.emit("data", "daemon is stopped");
                child.emit("close", 1, null);
            });
            return child;
        },
        signalSource: new EventEmitter()
    });

    assert.equal(missing.code, 127);
    assert.match(missing.message, /Docker wurde nicht gefunden/);
    assert.equal(unavailable.code, 1);
    assert.match(unavailable.message, /Docker-Daemon/);
    assert.match(unavailable.message, /daemon is stopped/);
});

test("launcher forwards an interrupt to a running child and maps its exit code", async () => {
    const signalSource = new EventEmitter();
    let child;
    const resultPromise = runProcess("docker", ["run"], {
        signalSource,
        spawnImpl: () => {
            child = fakeChild();
            child.kill = (signal) => {
                child.killSignals.push(signal);
                process.nextTick(() => child.emit("close", null, signal));
                return true;
            };
            return child;
        }
    });

    signalSource.emit("SIGINT");
    const result = await resultPromise;

    assert.deepEqual(child.killSignals, ["SIGINT"]);
    assert.equal(result.code, 130);
});

test("launcher forwards SIGTERM and maps it to exit code 143", async () => {
    const signalSource = new EventEmitter();
    let child;
    const resultPromise = runProcess("docker", ["run"], {
        signalSource,
        spawnImpl: () => {
            child = fakeChild();
            child.kill = (signal) => {
                child.killSignals.push(signal);
                process.nextTick(() => child.emit("close", null, signal));
                return true;
            };
            return child;
        }
    });
    signalSource.emit("SIGTERM");
    const result = await resultPromise;
    assert.deepEqual(child.killSignals, ["SIGTERM"]);
    assert.equal(result.code, 143);
});

test("runtime image is derived from the exact locked Git commit", (context) => {
    const root = createProjectPath();
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    assert.deepEqual(resolvePinnedImage(root, {}), {
        version: SHORTY_VERSION,
        commit: "0123456789abcdef0123456789abcdef01234567",
        image: `shorty-runtime:${SHORTY_VERSION}-0123456789abcdef0123456789abcdef01234567`
    });
    assert.deepEqual(resolveImageIdentity(root, {}), {
        version: SHORTY_VERSION,
        commit: "0123456789abcdef0123456789abcdef01234567",
        image: `shorty-runtime:${SHORTY_VERSION}-0123456789abcdef0123456789abcdef01234567`
    });
    assert.deepEqual(resolvePinnedImage(root, { SHORTY_IMAGE: "shorty-runtime:test" }), {
        image: "shorty-runtime:test"
    });
    const lockPath = path.join(root, "package-lock.json");
    fs.writeFileSync(lockPath, JSON.stringify({ packages: { "node_modules/shorty-cli": { version: SHORTY_VERSION, resolved: "git+https://example.invalid/repo.git#abc" } } }));
    assert.match(resolvePinnedImage(root, {}).error, /vollständigen Git-Commit/);
});

test("image build args use the package directory, a fixed tag and no implicit pull", () => {
    const packageRoot = path.join(os.tmpdir(), "Shorty Paket ü");
    const dockerfile = path.join(packageRoot, "docker", "runtime", "Dockerfile");
    const identity = {
        version: SHORTY_VERSION,
        commit: "0123456789abcdef0123456789abcdef01234567",
        image: `shorty-runtime:${SHORTY_VERSION}-0123456789abcdef0123456789abcdef01234567`
    };
    assert.deepEqual(buildImageDockerArgs(identity, dockerfile, packageRoot), [
        "build", "--pull=false", "--tag", identity.image,
        "--label", `org.opencontainers.image.version=${SHORTY_VERSION}`,
        "--label", `org.opencontainers.image.revision=${identity.commit}`,
        "--file", dockerfile, packageRoot
    ]);
});

test("image build reports failure and verifies a successful local image", async (context) => {
    const root = createProjectPath();
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const commandCalls = [];
    const spawnWithCodes = (codes) => (command, args, options) => {
        commandCalls.push({ command, args, cwd: options.cwd });
        const child = fakeChild();
        process.nextTick(() => child.emit("close", codes.shift(), null));
        return child;
    };

    const failedMessages = [];
    const failed = await executeDockerImageBuildForTest(root, spawnWithCodes([23]), failedMessages);
    assert.equal(failed.code, 23);
    assert.match(failedMessages.join(" "), /konnte nicht gebaut werden/);
    assert.equal(commandCalls.length, 1, "Nach fehlgeschlagenem Build darf kein Image-Inspect erfolgen");
    assert.equal(commandCalls[0].args[0], "build");

    commandCalls.length = 0;
    const successMessages = [];
    const success = await executeDockerImageBuildForTest(root, spawnWithCodes([0, 0]), successMessages);
    assert.equal(success.code, 0);
    assert.equal(commandCalls.length, 2);
    assert.equal(commandCalls[1].args[0], "image");
    assert.equal(commandCalls[1].args[1], "inspect");
    assert.ok(successMessages.join(" ").includes(`Version: ${SHORTY_VERSION}`));
    assert.match(successMessages.join(" "), /Commit: 0123456789abcdef0123456789abcdef01234567/);

    commandCalls.length = 0;
    const inspectFailureMessages = [];
    const inspectFailure = await executeDockerImageBuildForTest(root, spawnWithCodes([0, 1]), inspectFailureMessages);
    assert.equal(inspectFailure.code, 1);
    assert.match(inspectFailureMessages.join(" "), /nicht auffindbar/);
});

test("Docker arguments safely mount Unicode paths and only publish serve on loopback", () => {
    const root = path.join(os.tmpdir(), "Shorty Website, über uns");
    const common = buildDockerArgs({ command: "build", args: [], projectRoot: root, image: "shorty-runtime:test", platform: "win32", uid: undefined, gid: undefined });
    assert.ok(common.includes(`type=bind,source=${root.replace(/,/g, "\\,")},target=/workspace`));
    assert.ok(!common.includes("--publish"));
    assert.ok(!common.includes("--user"));
    assert.ok(common.includes("--pull=never"));
    assert.equal(common[0], "run");
    assert.equal(common[0], "run", "Launcher only runs the requested container command");
    const serve = buildDockerArgs({ command: "serve", args: ["4177"], projectRoot: root, image: "shorty-runtime:test", platform: "linux", uid: 501, gid: 20 });
    assert.ok(serve.includes("127.0.0.1:4177:4177/tcp"));
    assert.ok(serve.includes("--network=bridge"));
    assert.ok(serve.includes("501:20"));
    assert.ok(serve.includes("SHORTY_POLL_WATCH=1"));
});

test("missing local runtime image never starts a container and gives explicit guidance", async (context) => {
    const root = createProjectPath();
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const calls = [];
    const errors = [];
    const code = await executeDocker({
        command: "validate", args: [], projectRoot: root,
        env: {},
        spawnImpl: (command, args) => {
            calls.push(args);
            const child = fakeChild();
            process.nextTick(() => child.emit("close", 1, null));
            return child;
        }, signalSource: new EventEmitter()
    }, (message) => errors.push(message));

    assert.equal(code.code, 1);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].slice(0, 3), ["image", "inspect", `shorty-runtime:${SHORTY_VERSION}-0123456789abcdef0123456789abcdef01234567`]);
    assert.match(errors.join(" "), /nichts heruntergeladen oder gebaut/);
    assert.match(errors.join(" "), /shorty image build/);
});

test("normal runtime commands never build or pull an image", async (context) => {
    const root = createProjectPath();
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const calls = [];
    const childCodes = [0, 0];
    const result = await executeDocker({
        command: "validate", args: [], projectRoot: root, cwd: root,
        env: { SHORTY_IMAGE: "shorty-runtime:test" },
        spawnImpl: (command, args) => {
            calls.push(args);
            const child = fakeChild();
            process.nextTick(() => child.emit("close", childCodes.shift(), null));
            return child;
        },
        signalSource: new EventEmitter()
    }, () => {});

    assert.equal(result.code, 0);
    assert.deepEqual(calls[0], ["image", "inspect", "shorty-runtime:test"]);
    assert.equal(calls[1][0], "run");
    assert.ok(calls[1].includes("--pull=never"));
    assert.ok(calls[1].includes("--network=none"));
    assert.ok(!calls.some((args) => args[0] === "build" || args[0] === "pull"));
});
