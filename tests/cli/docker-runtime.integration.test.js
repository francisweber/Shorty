const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const test = require("node:test");

const LAUNCHER = path.resolve(__dirname, "../../bin/shorty.js");
const SHORTY_SOURCE_ROOT = path.resolve(__dirname, "../..");
const SHORTY_VERSION = require("../../package.json").version;
const IMAGE_REPOSITORY = "shorty-runtime";
const enabled = process.env.SHORTY_DOCKER_INTEGRATION === "1";
const DOCKER_COMMAND_TIMEOUT_MS = 60000;
const IMAGE_INSPECT_TIMEOUT_MS = 5000;

function requireRuntimeImage(image) {
    if (typeof image !== "string" || !image.trim()) {
        throw new Error(
            "Der Docker-Integrationstest benötigt ein ausdrücklich gesetztes SHORTY_IMAGE. " +
            "Baue zuerst das zur installierten Shorty-Version und zum vollständigen Git-Commit passende Runtime-Image mit `shorty image build` und übergib dessen Tag über SHORTY_IMAGE. " +
            "Der Test baut oder lädt Images nicht automatisch herunter."
        );
    }
    return image.trim();
}

function getExpectedCommit(spawnSyncImpl = spawnSync) {
    const result = spawnSyncImpl("git", ["rev-parse", "--verify", "HEAD^{commit}"], {
        cwd: SHORTY_SOURCE_ROOT,
        encoding: "utf8",
        timeout: 5000
    });
    if (result.error || result.status !== 0) {
        const detail = result.error?.message || (result.stderr || "").trim();
        throw new Error(
            `Der erwartete Shorty-Commit konnte im Quellrepository nicht über git rev-parse ermittelt werden.${detail ? ` ${detail}` : ""}`
        );
    }
    const commit = (result.stdout || "").trim().toLowerCase();
    if (!/^[a-f0-9]{40}$/.test(commit)) {
        throw new Error("git rev-parse lieferte keinen vollständigen 40-stelligen Shorty-Commit-SHA.");
    }
    return commit;
}

function runtimeImageIdentity(image, expectedVersion = SHORTY_VERSION) {
    const selectedImage = requireRuntimeImage(image);
    const match = selectedImage.match(/^shorty-runtime:(\d+\.\d+\.\d+)-([a-f\d]{40})$/i);
    if (!match) {
        throw new Error(
            `SHORTY_IMAGE muss dem vorhandenen Image-Tag ${IMAGE_REPOSITORY}:<Version>-<vollständiger-Commit-SHA> entsprechen; erhalten: "${selectedImage}".`
        );
    }
    const [, version, commit] = match;
    if (version !== expectedVersion) {
        throw new Error(`SHORTY_IMAGE verwendet Shorty ${version}; erwartet wird ${expectedVersion}.`);
    }
    return { version, commit };
}

function verifyRuntimeImage(image, expectedCommit, spawnSyncImpl = spawnSync) {
    const identity = runtimeImageIdentity(image);
    if (!/^[a-f0-9]{40}$/i.test(String(expectedCommit || ""))) {
        throw new Error("Für die Runtime-Image-Prüfung ist ein unabhängig ermittelter vollständiger Git-Commit-SHA erforderlich.");
    }
    if (identity.commit.toLowerCase() !== expectedCommit.toLowerCase()) {
        throw new Error(
            `Runtime-Image-Commit stimmt nicht mit dem getesteten Shorty-Quellcommit überein: ` +
            `Image ${identity.commit}, Quellrepository ${expectedCommit}.`
        );
    }
    const result = spawnSyncImpl("docker", [
        "image", "inspect", "--format", "{{json .Config.Labels}}", image
    ], { encoding: "utf8", timeout: IMAGE_INSPECT_TIMEOUT_MS });
    if (result.error || result.status !== 0) {
        const detail = result.error?.message || (result.stderr || "").trim();
        throw new Error(
            `Das angegebene Runtime-Image "${image}" ist lokal nicht verfügbar oder konnte nicht geprüft werden. ` +
            `Baue es ausdrücklich mit shorty image build; der Test führt keinen Pull oder Build aus.${detail ? ` ${detail}` : ""}`
        );
    }

    let labels;
    try {
        labels = JSON.parse((result.stdout || "").trim());
    } catch (error) {
        throw new Error(`Docker lieferte für "${image}" keine lesbaren Image-Labels: ${error.message}`);
    }
    if (labels?.["org.opencontainers.image.version"] !== identity.version ||
        labels?.["org.opencontainers.image.revision"]?.toLowerCase() !== identity.commit.toLowerCase()) {
        throw new Error(
            `Runtime-Image "${image}" passt nicht zu seiner Image-Identität. Erwartet werden ` +
            `org.opencontainers.image.version=${identity.version} und ` +
            `org.opencontainers.image.revision=${identity.commit}. ` +
            "Baue das Image aus genau dieser Shorty-Version und diesem Commit neu."
        );
    }
    return identity;
}

function runShorty(cwd, args, env = process.env, spawnSyncImpl = spawnSync) {
    const result = spawnSyncImpl(process.execPath, [LAUNCHER, ...args], {
        cwd,
        env: { ...env, npm_config_local_prefix: cwd },
        encoding: "utf8",
        timeout: DOCKER_COMMAND_TIMEOUT_MS
    });
    if (result.error || result.status === null) {
        throw new Error(commandFailureMessage(result, args));
    }
    return result;
}

function commandFailureMessage(result, args) {
    const command = [process.execPath, LAUNCHER, ...args]
        .map((argument) => JSON.stringify(argument))
        .join(" ");
    let reason;
    if (result.error?.code === "ETIMEDOUT") {
        reason = `Timeout nach ${DOCKER_COMMAND_TIMEOUT_MS} ms beim Shorty-Befehl "${args.join(" ")}".`;
    } else if (result.error) {
        reason = `Shorty-Befehl "${args.join(" ")}" konnte nicht ausgeführt werden (${result.error.code || result.error.message}).`;
    } else if (result.signal) {
        reason = `Shorty-Befehl "${args.join(" ")}" wurde durch Signal ${result.signal} beendet.`;
    } else {
        reason = `Shorty-Befehl "${args.join(" ")}" endete mit Exitcode ${result.status}.`;
    }

    return [
        reason,
        `Aufruf: ${command}`,
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : ""
    ].filter(Boolean).join("\n");
}

function assertShortySucceeded(result, args) {
    assert.equal(result.status, 0, commandFailureMessage(result, args));
}

test("synchronous Docker command timeout is reported as a failure with captured output", () => {
    let options;
    assert.throws(() => runShorty(
        "/tmp/shorty-timeout-project",
        ["validate"],
        {},
        (_command, _args, spawnOptions) => {
            options = spawnOptions;
            const error = new Error("spawnSync node ETIMEDOUT");
            error.code = "ETIMEDOUT";
            return {
                status: null,
                signal: "SIGTERM",
                error,
                stdout: "partial docker output",
                stderr: "bind mount preparation stalled"
            };
        }
    ), (error) => {
        assert.match(error.message, /Timeout nach 60000 ms/);
        assert.match(error.message, /Shorty-Befehl "validate"/);
        assert.match(error.message, /Aufruf:.*shorty\.js.*validate/);
        assert.match(error.message, /partial docker output/);
        assert.match(error.message, /bind mount preparation stalled/);
        assert.doesNotMatch(error.message, /erfolgreich|success/i);
        return true;
    });

    assert.equal(options.timeout, DOCKER_COMMAND_TIMEOUT_MS);
});

test("Docker integration requires an explicitly supplied runtime image", () => {
    assert.throws(() => requireRuntimeImage(undefined), (error) => {
        assert.match(error.message, /SHORTY_IMAGE/);
        assert.match(error.message, /shorty image build/);
        assert.match(error.message, /nicht automatisch/);
        return true;
    });
});

test("expected Shorty commit is read from Git HEAD in the source repository", () => {
    let invocation;
    const commit = getExpectedCommit((command, args, options) => {
        invocation = { command, args, options };
        return spawnSync(command, args, options);
    });
    const actualHead = spawnSync("git", ["rev-parse", "--verify", "HEAD^{commit}"], {
        cwd: SHORTY_SOURCE_ROOT,
        encoding: "utf8"
    }).stdout.trim().toLowerCase();

    assert.match(commit, /^[a-f0-9]{40}$/);
    assert.equal(commit, actualHead);
    assert.equal(invocation.command, "git");
    assert.deepEqual(invocation.args, ["rev-parse", "--verify", "HEAD^{commit}"]);
    assert.equal(invocation.options.cwd, SHORTY_SOURCE_ROOT);
});

test("runtime image tag must match the current Shorty version and contain a full commit SHA", () => {
    const commit = getExpectedCommit();
    assert.deepEqual(runtimeImageIdentity(`${IMAGE_REPOSITORY}:${SHORTY_VERSION}-${commit}`), {
        version: SHORTY_VERSION,
        commit
    });
    assert.throws(() => runtimeImageIdentity(`${IMAGE_REPOSITORY}:0.1.0-${commit}`), /erwartet wird 2\.0\.0/);
    assert.throws(() => runtimeImageIdentity(`${IMAGE_REPOSITORY}:wp3g65-test`), /vollständiger-Commit-SHA/);
});

test("runtime image verification checks matching Docker labels without building or pulling", () => {
    const commit = getExpectedCommit();
    const image = `${IMAGE_REPOSITORY}:${SHORTY_VERSION}-${commit}`;
    const calls = [];
    const identity = verifyRuntimeImage(image, commit, (command, args, options) => {
        calls.push({ command, args, options });
        return {
            status: 0,
            stdout: JSON.stringify({
                "org.opencontainers.image.version": SHORTY_VERSION,
                "org.opencontainers.image.revision": commit
            }),
            stderr: ""
        };
    });

    assert.deepEqual(identity, { version: SHORTY_VERSION, commit });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "docker");
    assert.deepEqual(calls[0].args, ["image", "inspect", "--format", "{{json .Config.Labels}}", image]);
    assert.equal(calls[0].options.timeout, IMAGE_INSPECT_TIMEOUT_MS);
    assert.doesNotMatch(calls[0].args.join(" "), /\b(build|pull)\b/);
});

test("runtime image verification rejects absent images without downloading them", () => {
    const expectedCommit = getExpectedCommit();
    const image = `${IMAGE_REPOSITORY}:${SHORTY_VERSION}-${expectedCommit}`;
    const calls = [];
    assert.throws(() => verifyRuntimeImage(image, expectedCommit, (command, args) => {
        calls.push([command, ...args]);
        return { status: 1, stdout: "", stderr: `No such image: ${image}` };
    }), /shorty image build.*keinen Pull oder Build/i);
    assert.deepEqual(calls, [["docker", "image", "inspect", "--format", "{{json .Config.Labels}}", image]]);
});

test("runtime image verification rejects mismatched version or commit labels", () => {
    const expectedCommit = getExpectedCommit();
    const image = `${IMAGE_REPOSITORY}:${SHORTY_VERSION}-${expectedCommit}`;
    assert.throws(() => verifyRuntimeImage(image, expectedCommit, () => ({
        status: 0,
        stdout: JSON.stringify({
            "org.opencontainers.image.version": SHORTY_VERSION,
            "org.opencontainers.image.revision": "e".repeat(40)
        }),
        stderr: ""
    })), /passt nicht zu seiner Image-Identität/);
});

test("runtime image verification rejects a commit that differs from Git HEAD before inspecting Docker", () => {
    const expectedCommit = getExpectedCommit();
    const mismatchedCommit = `${expectedCommit[0] === "a" ? "b" : "a"}${expectedCommit.slice(1)}`;
    const image = `${IMAGE_REPOSITORY}:${SHORTY_VERSION}-${mismatchedCommit}`;
    let dockerCalls = 0;

    assert.throws(() => verifyRuntimeImage(image, expectedCommit, () => {
        dockerCalls += 1;
        return { status: 0, stdout: "{}", stderr: "" };
    }), (error) => {
        assert.match(error.message, /Image-Commit stimmt nicht mit dem getesteten Shorty-Quellcommit überein/);
        assert.match(error.message, new RegExp(`Image ${mismatchedCommit}`));
        assert.match(error.message, new RegExp(`Quellrepository ${expectedCommit}`));
        return true;
    });
    assert.equal(dockerCalls, 0, "Ein Commit-Mismatch muss vor jedem Docker-Aufruf abbrechen.");
});

function seedInstalledShorty(project, commit) {
    const dependency = `git+https://github.com/francisweber/Shorty.git#${commit}`;
    fs.writeFileSync(path.join(project, ".npmrc"), "allow-git=root\n");
    fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({
        name: "docker-runtime-integration",
        version: "1.0.0",
        private: true,
        shorty: { version: SHORTY_VERSION, commit },
        dependencies: { "shorty-cli": dependency }
    }, null, 2));
    fs.writeFileSync(path.join(project, "package-lock.json"), JSON.stringify({
        name: "docker-runtime-integration",
        lockfileVersion: 3,
        packages: {
            "": { name: "docker-runtime-integration" },
            "node_modules/shorty-cli": {
                version: SHORTY_VERSION,
                resolved: dependency
            }
        }
    }));
    const installedDirectory = path.join(project, "node_modules", "shorty-cli");
    fs.mkdirSync(installedDirectory, { recursive: true });
    fs.writeFileSync(path.join(installedDirectory, "package.json"), JSON.stringify({ name: "shorty-cli", version: SHORTY_VERSION }));
}

function reservePort() {
    return new Promise((resolve, reject) => {
        const server = http.createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            server.close((error) => error ? reject(error) : resolve(port));
        });
    });
}

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (response) => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => { body += chunk; });
            response.on("end", () => resolve({ status: response.statusCode, body }));
        }).once("error", reject);
    });
}

async function waitFor(action, predicate, timeout = 12000) {
    const deadline = Date.now() + timeout;
    let lastError;
    while (Date.now() < deadline) {
        try {
            const result = await action();
            if (predicate(result)) return result;
        } catch (error) { lastError = error; }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw lastError || new Error("Zeitüberschreitung beim Warten auf Docker-Serve.");
}

test("Docker runtime integration: init, validate, build, error safety, serve, reload and signals", {
    skip: !enabled && "Set SHORTY_DOCKER_INTEGRATION=1 to run Docker integration tests"
}, async (context) => {
    const expectedCommit = getExpectedCommit();
    const image = requireRuntimeImage(process.env.SHORTY_IMAGE);
    verifyRuntimeImage(image, expectedCommit);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "Shorty WP3d äöü "));
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const project = path.join(root, "neue Website ü");
    fs.mkdirSync(project, { recursive: true });
    seedInstalledShorty(project, expectedCommit);
    const integrationEnv = { ...process.env, SHORTY_IMAGE: image };

    const initialized = runShorty(project, ["init"], integrationEnv);
    assertShortySucceeded(initialized, ["init"]);
    const configPath = path.join(project, "shorty.config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    assert.deepEqual(config.site, { url: "" });
    config.site.url = "https://example.test/";
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    assertShortySucceeded(runShorty(project, ["validate"], integrationEnv), ["validate"]);
    const built = runShorty(project, ["build"], integrationEnv);
    assertShortySucceeded(built, ["build"]);
    const htmlPath = path.join(project, "dist", "home.html");
    assert.ok(fs.existsSync(htmlPath), "Build-Ausgabe muss auf dem Host erscheinen");
    assert.ok(fs.existsSync(path.join(project, "dist", "sitemap.xml")), "Sitemap muss auf dem Host erscheinen");
    assert.equal(fs.statSync(htmlPath).isFile(), true);

    const originalHtml = fs.readFileSync(htmlPath);
    const page = path.join(project, "pages", "home", "home.tpl");
    const validTemplate = fs.readFileSync(page, "utf8");
    fs.writeFileSync(page, "{% invalid twig syntax %}");
    assert.equal(runShorty(project, ["build"], integrationEnv).status, 1, "Fehlerhafte Twig-Datei muss mit Exitcode 1 fehlschlagen");
    assert.deepEqual(fs.readFileSync(htmlPath), originalHtml, "Fehlgeschlagener Build darf letzte Ausgabe erhalten");
    fs.writeFileSync(page, validTemplate);

    const port = await reservePort();
    const occupied = http.createServer();
    await new Promise((resolve, reject) => occupied.once("error", reject).listen(port, "127.0.0.1", resolve));
    const portConflict = runShorty(project, ["serve", String(port)], integrationEnv);
    await new Promise((resolve) => occupied.close(resolve));
    assert.notEqual(portConflict.status, 0);
    assert.match(portConflict.stderr, /Port .* ist belegt/);

    const server = spawn(process.execPath, [LAUNCHER, "serve", String(port)], {
        cwd: project,
        env: integrationEnv,
        stdio: ["ignore", "pipe", "pipe"]
    });
    let logs = "";
    server.stdout.setEncoding("utf8").on("data", (chunk) => { logs += chunk; });
    server.stderr.setEncoding("utf8").on("data", (chunk) => { logs += chunk; });
    try {
        const served = await waitFor(() => get(`http://127.0.0.1:${port}/`), (result) => result.status === 200);
        assert.match(served.body, /__shorty\/events/);
        const originalSource = fs.readFileSync(page, "utf8");
        const updatedSource = originalSource.replace(
            "<p>{{ page.description }}</p>",
            "<p>Farbtest WP3g.5</p>"
        );
        assert.notEqual(
            updatedSource,
            originalSource,
            "Live-Reload-Test konnte den erwarteten Beschreibungstext im Home-Template nicht finden."
        );
        fs.writeFileSync(page, updatedSource);
        const updated = await waitFor(() => fs.readFileSync(htmlPath, "utf8"), (html) => html.includes("Farbtest WP3g.5"));
        assert.match(updated, /Farbtest WP3g\.5/);
        const outputStats = fs.statSync(htmlPath);
        const mode = outputStats.mode & 0o777;
        assert.notEqual(mode & 0o200, 0, "Host soll die erzeugte Datei schreiben können");
        if (typeof process.getuid === "function") {
            assert.equal(outputStats.uid, process.getuid(), "Container-Ausgabe soll dem Host-Benutzer gehören");
        }
    } finally {
        server.kill("SIGINT");
        await Promise.race([
            new Promise((resolve) => server.once("exit", resolve)),
            new Promise((resolve) => setTimeout(resolve, 5000))
        ]);
        if (server.exitCode === null) server.kill("SIGTERM");
    }
    assert.equal(server.exitCode, 130, logs);

    const terminated = spawn(process.execPath, [LAUNCHER, "serve", String(port)], {
        cwd: project,
        env: integrationEnv,
        stdio: ["ignore", "pipe", "pipe"]
    });
    try {
        await waitFor(() => get(`http://127.0.0.1:${port}/`), (result) => result.status === 200);
        terminated.kill("SIGTERM");
        await Promise.race([
            new Promise((resolve) => terminated.once("exit", resolve)),
            new Promise((_, reject) => setTimeout(() => reject(new Error("SIGTERM shutdown timed out")), 5000))
        ]);
    } finally {
        if (terminated.exitCode === null) terminated.kill("SIGKILL");
    }
    assert.equal(terminated.exitCode, 143);
});
