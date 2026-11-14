#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const SHORTY_PACKAGE = require("../package.json");
const SHORTY_PACKAGE_ROOT = path.resolve(__dirname, "..");
const SHORTY_PACKAGE_LOCK_NAME = `node_modules/${SHORTY_PACKAGE.name}`;
const MIN_NODE_VERSION = "24.0.0";
const MIN_NPM_VERSION = "10.2.0";
const SHORTY_GIT_REPOSITORY = "git+https://github.com/francisweber/Shorty.git";
const SHORTY_IMAGE_REPOSITORY = "shorty-runtime";
const CONTAINER_PROJECT_ROOT = "/workspace";
const PROJECT_PATHS = ["components", "pages", "layouts", "data", "assets", "schemas", "dist"];

const SUPPORTED_COMMANDS = new Set([
    "component:create",
    "component:validate",
    "component:list",
    "validate",
    "init",
    "build",
    "serve"
]);

function showHelp(write = console.log, command = null) {
    if (command === "init") {
        write(`
Shorty-Projekt initialisieren

Für ein leeres Verzeichnis zuerst einen temporären, sauberen Shorty-Checkout auf den gewünschten vollständigen Commit setzen:

  git clone --no-checkout https://github.com/francisweber/Shorty.git <bootstrap-directory>
  git -C <bootstrap-directory> checkout --detach <full-git-commit>
  node <bootstrap-directory>/bin/shorty.js init <project-directory>

init installiert Shorty projektlokal vom selben Commit und überschreibt keine vorhandenen npm- oder Shorty-Konfigurationen.
`);
        return;
    }
    if (command === "image") {
        write(`
Shorty Image-Verwaltung

Verwendung:

  npm exec -- shorty image build
  npm exec -- shorty image --help

"image build" baut das fest versionierte Shorty-Runtime-Image lokal aus dem installierten Shorty-Paket.
Es wird keine Registry verwendet.
`);
        return;
    }
    write(`
Shorty CLI (Host-Launcher)

Verwendung:

  npm exec -- shorty init [project-directory]
  npm exec -- shorty validate
  npm exec -- shorty build
  npm exec -- shorty serve [port]
  npm exec -- shorty image build
  npm exec -- shorty component:create <component-name> [--with-js]
  npm exec -- shorty component:validate <component-name>
  npm exec -- shorty component:list

Die Shorty-Build-Laufzeit wird projektlokal über das passende Docker-Image ausgeführt.
Images werden nicht automatisch heruntergeladen oder gebaut.
`);
}

function findProjectRoot(startDirectory = process.cwd()) {
    let currentDirectory = path.resolve(startDirectory);

    while (true) {
        const configPath = path.join(currentDirectory, "shorty.config.json");
        if (fs.existsSync(configPath)) {
            const stats = fs.statSync(configPath);
            if (!stats.isFile()) {
                throw new Error(`Projektkonfiguration ist keine Datei: ${configPath}`);
            }
            return currentDirectory;
        }

        const parentDirectory = path.dirname(currentDirectory);
        if (parentDirectory === currentDirectory) {
            throw new Error(
                `Keine shorty.config.json gefunden. Bitte im Projektverzeichnis arbeiten oder "shorty init" ausführen.`
            );
        }
        currentDirectory = parentDirectory;
    }
}

function parseCommand(argv, env = process.env) {
    if (argv.length === 0) {
        return { help: true };
    }

    if (argv[0] === "image") {
        const [, subcommand, ...args] = argv;
        if (subcommand === "--help" || subcommand === "-h") return { help: true, helpCommand: "image" };
        if (subcommand === "build" && args.length === 0) return { command: "image:build", args: [] };
        if (subcommand === "build") return { error: "Fehler: image build akzeptiert keine zusätzlichen Argumente." };
        return { error: "Unbekannter Image-Befehl. Verwende 'shorty image build' oder 'shorty image --help'.", usage: true, helpCommand: "image" };
    }

    if (argv.includes("--help") || argv.includes("-h")) return { help: true };

    const [command, ...args] = argv;
    if (!SUPPORTED_COMMANDS.has(command)) {
        return { error: `Unbekannter Befehl: ${command}`, usage: true };
    }

    if (command === "init") {
        if (args.length > 1) {
            return { error: "Fehler: init akzeptiert höchstens ein Projektverzeichnis." };
        }
        return { command, args };
    }

    if (["validate", "build", "component:list"].includes(command)) {
        if (args.length > 0) {
            return { error: `Fehler: ${command} benötigt keine zusätzlichen Argumente.` };
        }
        return { command, args };
    }

    if (command === "serve") {
        if (args.length > 1) {
            return { error: "Fehler: serve akzeptiert höchstens eine Portnummer." };
        }
        const port = args[0] || env.SHORTY_PORT || "3000";
        if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
            return { error: "Fehler: Der Port muss eine Zahl zwischen 1 und 65535 sein." };
        }
        return { command, args: [port] };
    }

    const allowedOptions = command === "component:create" ? ["--with-js"] : [];
    const unknownOption = args.find(
        (argument) => argument.startsWith("--") && !allowedOptions.includes(argument)
    );
    if (unknownOption) {
        return { error: `Unbekannte Option: ${unknownOption}` };
    }

    const positional = args.filter((argument) => !argument.startsWith("--"));
    if (positional.length !== 1) {
        return {
            error: `Fehler: Bitte genau einen Komponentennamen für ${command} angeben.`,
            usage: true
        };
    }
    if (command === "component:validate" && args.some((argument) => argument.startsWith("--"))) {
        return { error: "Fehler: component:validate akzeptiert keine Optionen." };
    }

    return { command, args };
}

function parseVersion(value) {
    const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
    if (!match) return null;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: match[4] || null
    };
}

function versionAtLeast(version, minimum) {
    const actual = parseVersion(version);
    const required = parseVersion(minimum);
    if (!actual || !required) return false;
    for (const key of ["major", "minor", "patch"]) {
        if (actual[key] !== required[key]) return actual[key] > required[key];
    }
    return actual.prerelease === null;
}

function npmVersionFromUserAgent(userAgent) {
    return String(userAgent || "").match(/(?:^|\s)npm\/v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\s|$)/)?.[1] || null;
}

function checkHostToolchain({ env = process.env, nodeVersion = process.versions?.node, spawnSyncImpl = spawnSync } = {}) {
    if (!nodeVersion) {
        return { code: 1, message: `Node.js wurde nicht erkannt (Version nicht verfügbar). Erforderlich ist Node.js >=${MIN_NODE_VERSION}.` };
    }
    if (!versionAtLeast(nodeVersion, MIN_NODE_VERSION)) {
        return { code: 1, message: `Node.js-Version nicht unterstützt: erkannt ${nodeVersion}, erforderlich >=${MIN_NODE_VERSION}. Installiere eine passende Node.js-Version und starte Shorty erneut.` };
    }

    const effectiveEnv = { ...process.env, ...env };
    let npmVersion = npmVersionFromUserAgent(env.npm_config_user_agent || env.NPM_CONFIG_USER_AGENT);
    if (!npmVersion) {
        let result;
        try {
            result = spawnSyncImpl("npm", ["--version"], {
                encoding: "utf8",
                env: effectiveEnv,
                timeout: 5000
            });
        } catch (error) {
            return { code: 1, message: `npm-Version konnte nicht ermittelt werden; erforderlich ist npm >=${MIN_NPM_VERSION}. ${error.message}` };
        }
        if (result.error?.code === "ENOENT") {
            return { code: 1, message: `npm wurde nicht gefunden. Erforderlich ist npm >=${MIN_NPM_VERSION}; installiere npm passend zu deiner Node.js-Installation.` };
        }
        if (result.error || result.status !== 0) {
            const detail = result.error?.message || (result.stderr || "").trim();
            return { code: 1, message: `npm-Version konnte nicht ermittelt werden; erforderlich ist npm >=${MIN_NPM_VERSION}.${detail ? ` ${detail}` : ""}` };
        }
        npmVersion = (result.stdout || "").trim().replace(/^v/, "");
    }

    if (!versionAtLeast(npmVersion, MIN_NPM_VERSION)) {
        return { code: 1, message: `npm-Version nicht unterstützt: erkannt ${npmVersion}, erforderlich >=${MIN_NPM_VERSION}. Aktualisiere npm ausdrücklich und starte Shorty erneut.` };
    }
    return { code: 0, nodeVersion, npmVersion };
}

function checkGitAvailability({ env = process.env, spawnSyncImpl = spawnSync } = {}) {
    let result;
    try {
        result = spawnSyncImpl("git", ["--version"], { encoding: "utf8", env: { ...process.env, ...env }, timeout: 5000 });
    } catch (error) {
        return { code: 1, message: `Git wird für shorty init benötigt, konnte aber nicht geprüft werden: ${error.message}` };
    }
    if (result.error?.code === "ENOENT") {
        return { code: 1, message: "Git wurde nicht gefunden. Installiere Git und stelle sicher, dass GitHub-Zugriff für das private Shorty-Repository eingerichtet ist." };
    }
    if (result.error || result.status !== 0) {
        const detail = result.error?.message || (result.stderr || "").trim();
        return { code: 1, message: `Git ist für shorty init erforderlich, konnte aber nicht ausgeführt werden.${detail ? ` ${detail}` : ""}` };
    }
    return { code: 0 };
}

function resolveProjectRoot(command, args, cwd = process.cwd()) {
    if (command === "init") {
        return path.resolve(cwd, args[0] || ".");
    }
    return findProjectRoot(cwd);
}

function findPinnedShortyIdentity(startDirectories) {
    const visited = new Set();
    for (const startDirectory of startDirectories.filter(Boolean)) {
        let current = path.resolve(startDirectory);
        while (!visited.has(current)) {
            visited.add(current);
            const lockPath = path.join(current, "package-lock.json");
            try {
                const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
                const entry = lock.packages?.[SHORTY_PACKAGE_LOCK_NAME];
                const resolved = entry?.resolved || "";
                const commit = resolved.match(/#([a-f\d]{40})$/i)?.[1];
                if (entry?.version === SHORTY_PACKAGE.version && commit && isShortyGitRepository(resolved)) {
                    return { version: entry.version, commit, resolved, lockPath };
                }
            } catch {
                // Walk up to locate the lock file associated with an npm installation.
            }
            const parent = path.dirname(current);
            if (parent === current) break;
            current = parent;
        }
    }
    return {
        error: `Die installierte Shorty-Version ${SHORTY_PACKAGE.version} ist keiner unveränderlichen Git-Auflösung zugeordnet. Starte init über npm exec mit einem vollständigen Git-Commit.`
    };
}

function isShortyGitRepository(resolved) {
    return /github\.com[/:]francisweber\/Shorty\.git/i.test(resolved || "");
}

function resolveInstalledShortyIdentity(cwd = process.cwd(), env = process.env) {
    const locked = findPinnedShortyIdentity([
        SHORTY_PACKAGE_ROOT,
        env.npm_config_local_prefix,
        cwd
    ]);
    if (!locked.error) return locked;

    if (fs.existsSync(path.join(SHORTY_PACKAGE_ROOT, ".git"))) {
        const revision = spawnSync("git", ["-C", SHORTY_PACKAGE_ROOT, "rev-parse", "HEAD"], { encoding: "utf8", env });
        if (revision.error) {
            return { error: `Git konnte den Shorty-Bootstrap-Commit nicht bestimmen: ${revision.error.message}` };
        }
        if (revision.status !== 0 || !/^[a-f\d]{40}\s*$/i.test(revision.stdout || "")) {
            return { error: "Der Shorty-Bootstrap-Checkout hat keinen vollständigen Git-Commit." };
        }
        const status = spawnSync("git", ["-C", SHORTY_PACKAGE_ROOT, "status", "--porcelain", "--untracked-files=all"], { encoding: "utf8", env });
        if (status.error || status.status !== 0) {
            return { error: `Git-Status des Shorty-Bootstrap-Checkouts kann nicht geprüft werden: ${status.error?.message || "git status failed"}` };
        }
        if (status.stdout.trim()) {
            return { error: "Der Shorty-Bootstrap-Checkout enthält lokale Änderungen. Verwende für init einen sauberen Checkout eines vollständigen Git-Commits." };
        }
        return { version: SHORTY_PACKAGE.version, commit: revision.stdout.trim() };
    }
    return locked;
}

function resolveImageIdentity(projectRoot, env = process.env) {
    let lockRoot = env.npm_config_local_prefix ? path.resolve(env.npm_config_local_prefix) : projectRoot;
    let packageLockPath = path.join(lockRoot, "package-lock.json");
    while (!fs.existsSync(packageLockPath)) {
        const parent = path.dirname(lockRoot);
        if (parent === lockRoot) break;
        lockRoot = parent;
        packageLockPath = path.join(lockRoot, "package-lock.json");
    }
    let lock;
    try {
        lock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));
    } catch (error) {
        return {
            error: `Für die Auswahl des Shorty-Runtime-Images wird eine package-lock.json mit einer fest aufgelösten Shorty-Git-Version benötigt (${error.code || error.message}).`
        };
    }

    const installedPackage = lock.packages?.[SHORTY_PACKAGE_LOCK_NAME];
    const resolved = installedPackage?.resolved || "";
    const commit = resolved.match(/#([a-f\d]{40})$/i)?.[1];
    if (installedPackage?.version !== SHORTY_PACKAGE.version || !commit || !isShortyGitRepository(resolved)) {
        return {
            error: `Die package-lock.json bindet Shorty nicht an Version ${SHORTY_PACKAGE.version} und einen vollständigen Git-Commit. Bitte Shorty im Websiteprojekt mit einer festen Git-Referenz installieren.`
        };
    }
    return {
        version: SHORTY_PACKAGE.version,
        commit,
        image: `${SHORTY_IMAGE_REPOSITORY}:${SHORTY_PACKAGE.version}-${commit}`
    };
}

function resolvePinnedImage(projectRoot, env = process.env) {
    if (env.SHORTY_IMAGE) return { image: env.SHORTY_IMAGE };
    return resolveImageIdentity(projectRoot, env);
}

function toProjectDisplayName(directoryName) {
    return directoryName
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

function toNpmProjectName(directoryName) {
    const name = directoryName.normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^[._-]+|[._-]+$/g, "")
        .slice(0, 214);
    return name || "shorty-site";
}

function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function inspectExistingPackage(targetPath, identity, writeError) {
    const packagePath = path.join(targetPath, "package.json");
    const lockPath = path.join(targetPath, "package-lock.json");
    const hasPackage = fs.existsSync(packagePath);
    const hasLock = fs.existsSync(lockPath);
    if (!hasPackage && !hasLock) return { fresh: true };
    if (!hasPackage && hasLock) {
        writeError("Das Ziel enthält nur eine von package.json und package-lock.json. Shorty überschreibt oder ergänzt solche Paketmanagerdateien nicht automatisch.");
        return { error: true };
    }

    let manifest;
    try {
        manifest = readJsonFile(packagePath);
    } catch (error) {
        writeError(`Die vorhandene package.json ist ungültig und wurde nicht verändert: ${error.message}`);
        return { error: true };
    }
    const dependency = manifest.dependencies?.[SHORTY_PACKAGE.name];
    if (manifest.shorty?.version !== identity.version ||
        manifest.shorty?.commit !== identity.commit ||
        dependency !== `${SHORTY_GIT_REPOSITORY}#${identity.commit}`) {
        writeError("Vorhandene package.json/package-lock.json binden Shorty an eine andere oder nicht eindeutig gepinnte Version. Shorty ersetzt keine installierte Version automatisch.");
        return { error: true };
    }

    if (!hasLock) return { fresh: false, resume: true, manifest };
    let lock;
    try {
        lock = readJsonFile(lockPath);
    } catch (error) {
        writeError(`Die vorhandene package-lock.json ist ungültig und wurde nicht verändert: ${error.message}`);
        return { error: true };
    }
    const installed = lock.packages?.[SHORTY_PACKAGE_LOCK_NAME];
    const resolvedCommit = installed?.resolved?.match(/#([a-f\d]{40})$/i)?.[1];
    if (installed?.version !== identity.version || resolvedCommit !== identity.commit || !isShortyGitRepository(installed?.resolved)) {
        writeError("Vorhandene package-lock.json bindet Shorty an eine andere Git-Auflösung. Sie wurde nicht verändert.");
        return { error: true };
    }

    const installedPackagePath = path.join(targetPath, "node_modules", SHORTY_PACKAGE.name, "package.json");
    if (!fs.existsSync(installedPackagePath)) {
        writeError("Die vorhandene Shorty-Abhängigkeit ist nicht installiert. Führe im Projekt ausdrücklich npm ci aus; init verändert vorhandene Installationen nicht.");
        return { error: true };
    }
    try {
        if (readJsonFile(installedPackagePath).version !== identity.version) {
            writeError("Die installierte Shorty-Version stimmt nicht mit package.json/package-lock.json überein. Die Installation wurde nicht verändert.");
            return { error: true };
        }
    } catch (error) {
        writeError(`Die vorhandene Shorty-Installation kann nicht geprüft werden: ${error.message}`);
        return { error: true };
    }
    return { fresh: false, manifest, lock };
}

function ensureGitConfig(targetPath, write, writeError) {
    const npmrcPath = path.join(targetPath, ".npmrc");
    if (!fs.existsSync(npmrcPath)) {
        fs.writeFileSync(npmrcPath, "allow-git=root\n", { flag: "wx" });
        return { created: true };
    }
    let content;
    try {
        if (fs.lstatSync(npmrcPath).isSymbolicLink()) {
            writeError(".npmrc ist ein Symlink; Shorty verändert keine verlinkten Konfigurationsdateien.");
            return { error: true };
        }
        content = fs.readFileSync(npmrcPath, "utf8");
    } catch (error) {
        writeError(`.npmrc kann nicht gelesen werden: ${error.message}`);
        return { error: true };
    }
    const allowGitEntries = content.split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^allow-git\s*=/.test(line) && !line.startsWith("#"));
    if (allowGitEntries.some((line) => line !== "allow-git=root")) {
        writeError("Die vorhandene .npmrc enthält eine abweichende allow-git-Einstellung. Sie wurde nicht verändert.");
        return { error: true };
    }
    if (allowGitEntries.length === 0) {
        fs.appendFileSync(npmrcPath, `${content && !content.endsWith("\n") ? "\n" : ""}allow-git=root\n`);
        write(".npmrc wurde um allow-git=root ergänzt; vorhandene Einstellungen blieben erhalten.");
    }
    return { created: false };
}

function verifyInstalledPackage(targetPath, identity) {
    const lock = readJsonFile(path.join(targetPath, "package-lock.json"));
    const entry = lock.packages?.[SHORTY_PACKAGE_LOCK_NAME];
    const commit = entry?.resolved?.match(/#([a-f\d]{40})$/i)?.[1];
    if (entry?.version !== identity.version || commit !== identity.commit || !isShortyGitRepository(entry.resolved)) {
        throw new Error("npm package-lock.json enthält nicht die erwartete Shorty-Version und den erwarteten Git-Commit.");
    }
    const installedPath = path.join(targetPath, "node_modules", SHORTY_PACKAGE.name, "package.json");
    const manifest = readJsonFile(installedPath);
    if (manifest.version !== identity.version) {
        throw new Error("Die lokal installierte Shorty-Version stimmt nicht mit der angeforderten Version überein.");
    }
    if (Object.keys(manifest.dependencies || {}).length ||
        Object.keys(manifest.optionalDependencies || {}).length ||
        Object.keys(manifest.peerDependencies || {}).length) {
        throw new Error("Das Shorty-Host-Paket deklariert npm-Laufzeitabhängigkeiten. Der Host-Launcher muss ohne AJV, Sass oder weitere externe Node-Pakete auskommen.");
    }
    if (manifest.scripts?.prepare) {
        throw new Error("Das Shorty-Host-Paket enthält ein prepare-Script. Build-Abhängigkeiten und PHP dürfen bei der Host-Installation nicht ausgeführt werden.");
    }
    const extraPackages = Object.keys(lock.packages || {}).filter((name) =>
        name !== "" && name !== SHORTY_PACKAGE_LOCK_NAME
    );
    if (extraPackages.length) {
        throw new Error(`Die Host-Installation enthält unerwartete npm-Pakete: ${extraPackages.join(", ")}. Der Shorty-Host-Launcher benötigt keine externen Node-Abhängigkeiten.`);
    }
}

async function installShortyLocally(targetPath, identity, { env, spawnImpl, signalSource, write, writeError }) {
    const existing = inspectExistingPackage(targetPath, identity, writeError);
    if (existing.error) return { code: 1, existing: true };
    const npmrc = ensureGitConfig(targetPath, write, writeError);
    if (npmrc.error) return { code: 1, existing: true };
    if (!existing.fresh && !existing.resume) return { code: 0, existing: true };

    const manifest = existing.resume ? existing.manifest : {
        name: toNpmProjectName(path.basename(targetPath)),
        version: "1.0.0",
        private: true,
        shorty: { version: identity.version, commit: identity.commit },
        dependencies: {
            [SHORTY_PACKAGE.name]: `${SHORTY_GIT_REPOSITORY}#${identity.commit}`
        }
    };
    if (existing.fresh) {
        try {
            fs.writeFileSync(path.join(targetPath, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
        } catch (error) {
            writeError(`package.json wurde nicht angelegt: ${error.message}`);
            return { code: 1, existing: true };
        }
    }

    const result = await runProcess("npm", ["install", "--save-exact", "--ignore-scripts", "--no-audit", "--no-fund"], {
        cwd: targetPath,
        env: { ...env, npm_config_local_prefix: targetPath },
        spawnImpl,
        signalSource,
        inheritStdout: true
    });
    if (result.error) {
        writeError(`Die lokale Shorty-Installation konnte nicht gestartet werden: ${result.error.message}`);
        return { code: 127, existing: true };
    }
    if (result.code !== 0) {
        writeError(`Die private Shorty-Git-Abhängigkeit konnte nicht installiert werden (Exitcode ${result.code}). Prüfe GitHub-Zugriff und Authentifizierung; package.json und .npmrc bleiben erhalten.`);
        return { code: result.code, existing: true };
    }
    try {
        verifyInstalledPackage(targetPath, identity);
    } catch (error) {
        writeError(`Shorty-Installation konnte nicht bestätigt werden: ${error.message}`);
        return { code: 1, existing: true };
    }
    return { code: 0, existing: false };
}

function createProjectScaffold(targetPath, write, writeError) {
    const availability = checkScaffoldTarget(targetPath, writeError);
    if (availability.error) return { code: availability.code };
    const { STARTER_FILES, projectName } = availability;
    const configPath = path.join(targetPath, "shorty.config.json");
    const ignorePath = path.join(targetPath, ".gitignore");
    const gitignoreRules = ["node_modules/", "dist/"];

    const createdFiles = [];
    const createdDirectories = [];
    try {
        fs.mkdirSync(targetPath, { recursive: true });
        for (const relative of PROJECT_PATHS) {
            const directory = path.join(targetPath, relative);
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
                createdDirectories.push(directory);
            }
        }
        for (const [relative, content] of Object.entries(STARTER_FILES)) {
            const filePath = path.join(targetPath, relative);
            const parentDirectory = path.dirname(filePath);
            if (!fs.existsSync(parentDirectory)) {
                fs.mkdirSync(parentDirectory, { recursive: true });
                createdDirectories.push(parentDirectory);
            }
            fs.writeFileSync(filePath, content, { encoding: "utf8", flag: "wx" });
            createdFiles.push(filePath);
        }
        fs.writeFileSync(configPath, `${JSON.stringify({ configVersion: 1, project: { name: projectName }, site: { url: "" } }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
        createdFiles.push(configPath);
        if (!fs.existsSync(ignorePath)) {
            fs.writeFileSync(ignorePath, `${gitignoreRules.join("\n")}\n`, { encoding: "utf8", flag: "wx" });
            createdFiles.push(ignorePath);
        } else {
            const existingRules = new Set(fs.readFileSync(ignorePath, "utf8").split(/\r?\n/).map((rule) => rule.trim()));
            const missingRules = gitignoreRules.filter((rule) => !existingRules.has(rule));
            if (missingRules.length) {
                const current = fs.readFileSync(ignorePath, "utf8");
                fs.appendFileSync(ignorePath, `${current && !current.endsWith("\n") ? "\n" : ""}${missingRules.join("\n")}\n`);
                write(`Vorhandene .gitignore wurde nur um ${missingRules.join(", ")} ergänzt; vorhandene Regeln blieben erhalten.`);
            }
        }
    } catch (error) {
        for (const filePath of createdFiles.reverse()) {
            try { fs.unlinkSync(filePath); } catch { /* Preserve the original failure. */ }
        }
        for (const directory of createdDirectories.reverse()) {
            try { fs.rmdirSync(directory); } catch { /* Remove only empty generated directories. */ }
        }
        writeError(`Fehler beim Initialisieren des Projekts: ${error.message}`);
        return { code: 1 };
    }

    write(`Shorty-Projekt "${projectName}" wurde initialisiert: ${targetPath}`);
    write(`Shorty ${SHORTY_PACKAGE.version} ist lokal installiert; package-lock.json bindet den Git-Commit.`);
    write("Scaffold: neutrales Layout, minimale Beispielseite mit Seitendaten und Basis-Stylesheet.");
    write("Trage vor validate/build eine echte HTTP(S)-Basis-URL unter site.url in shorty.config.json ein.");
    write("Danach: npm exec -- shorty image build");
    return { code: 0 };
}

function checkScaffoldTarget(targetPath, writeError = console.error) {
    const projectName = toProjectDisplayName(path.basename(targetPath));
    if (!projectName) {
        writeError("Fehler: Aus dem Zielverzeichnis konnte kein Projektname abgeleitet werden.");
        return { error: true, code: 2 };
    }
    if (fs.existsSync(path.join(targetPath, "shorty.config.json")) ||
        fs.existsSync(path.join(targetPath, "shorty.lock.json"))) {
        writeError("Im Ziel existiert bereits eine Shorty-Projektkonfiguration oder Legacy-Versionsdatei. Sie wurde nicht verändert.");
        return { error: true, code: 1 };
    }

    const { STARTER_FILES } = require("../src/core/project/starter-template");
    const ignorePath = path.join(targetPath, ".gitignore");
    if (fs.existsSync(ignorePath) && fs.lstatSync(ignorePath).isSymbolicLink()) {
        writeError(".gitignore ist ein Symlink und wird nicht verändert.");
        return { error: true, code: 1 };
    }

    const directoryPaths = PROJECT_PATHS.map((relative) => path.join(targetPath, relative));
    for (const directory of directoryPaths) {
        if (hasSymlinkInPath(targetPath, directory)) {
            writeError(`Fehler: Ein Shorty-Pfad enthält einen Symlink: ${path.relative(targetPath, directory)}`);
            return { error: true, code: 1 };
        }
        if (fs.existsSync(directory) && !fs.statSync(directory).isDirectory()) {
            writeError(`Fehler: Der Standardpfad ist bereits als Datei vorhanden: ${path.relative(targetPath, directory)}`);
            return { error: true, code: 1 };
        }
    }
    for (const relative of Object.keys(STARTER_FILES)) {
        const filePath = path.join(targetPath, relative);
        if (hasSymlinkInPath(targetPath, path.dirname(filePath))) {
            writeError(`Fehler: Ein Starterpfad enthält einen Symlink: ${relative}`);
            return { error: true, code: 1 };
        }
        if (fs.existsSync(filePath)) {
            writeError(`Fehler: Eine Starterdatei existiert bereits: ${relative}`);
            return { error: true, code: 1 };
        }
    }
    for (const [relative, content] of Object.entries(STARTER_FILES)) {
        if (relative.endsWith(".json")) JSON.parse(content);
    }

    return { projectName, STARTER_FILES };
}

function hasSymlinkInPath(root, candidate) {
    const relative = path.relative(root, candidate);
    let current = root;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
        current = path.join(current, segment);
        try {
            if (fs.lstatSync(current).isSymbolicLink()) return true;
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
        }
    }
    return false;
}

async function initializeHostProject({ projectRoot, cwd, env = process.env, spawnImpl = spawn, signalSource = process }, write = console.log, writeError = console.error) {
    if (fs.existsSync(projectRoot) && !fs.statSync(projectRoot).isDirectory()) {
        writeError(`Fehler: Das Projektziel ist kein Verzeichnis: ${projectRoot}`);
        return { code: 1 };
    }
    try {
        fs.mkdirSync(projectRoot, { recursive: true });
    } catch (error) {
        writeError(`Projektverzeichnis kann nicht angelegt werden: ${error.message}`);
        return { code: 1 };
    }
    if (fs.existsSync(path.join(projectRoot, "shorty.config.json")) || fs.existsSync(path.join(projectRoot, "shorty.lock.json"))) {
        writeError("Im Ziel existiert bereits eine Shorty-Projektkonfiguration oder Legacy-Versionsdatei. Es wurden keine Dateien verändert.");
        return { code: 1 };
    }
    const scaffoldAvailability = checkScaffoldTarget(projectRoot, writeError);
    if (scaffoldAvailability.error) return { code: scaffoldAvailability.code };
    if (!fs.existsSync(path.join(projectRoot, "package.json")) && fs.existsSync(path.join(projectRoot, "package-lock.json"))) {
        writeError("Eine package-lock.json existiert ohne package.json. Beide Dateien bleiben unverändert; init bricht sicher ab.");
        return { code: 1 };
    }
    if (!fs.existsSync(path.join(projectRoot, "package.json")) && fs.existsSync(path.join(projectRoot, "node_modules"))) {
        writeError("node_modules existiert ohne package.json. init verändert die vorhandene Installation nicht.");
        return { code: 1 };
    }

    const identity = resolveInstalledShortyIdentity(cwd || projectRoot, env);
    if (identity.error) {
        writeError(identity.error);
        return { code: 1 };
    }
    const install = await installShortyLocally(projectRoot, identity, { env, spawnImpl, signalSource, write, writeError });
    if (install.code !== 0) return { code: install.code };
    return createProjectScaffold(projectRoot, write, writeError);
}

function escapeMountSource(source) {
    // Docker's --mount grammar uses commas as separators; escaped commas stay in the path.
    return source.replace(/,/g, "\\,");
}

function buildDockerArgs({ command, args, projectRoot, image, platform = process.platform, uid = process.getuid?.(), gid = process.getgid?.() }) {
    const dockerArgs = [
        "run", "--rm", "--init", "--pull=never", "--workdir", CONTAINER_PROJECT_ROOT,
        "--mount", `type=bind,source=${escapeMountSource(projectRoot)},target=${CONTAINER_PROJECT_ROOT}`
    ];
    if ((platform === "linux" || platform === "darwin") && Number.isInteger(uid) && Number.isInteger(gid) && uid > 0 && gid > 0) {
        dockerArgs.push("--user", `${uid}:${gid}`);
    }
    if (command === "serve") {
        const port = args[0];
        dockerArgs.push(
            "--network=bridge",
            "--publish", `127.0.0.1:${port}:${port}/tcp`,
            "--env", `SHORTY_PORT=${port}`,
            "--env", "SHORTY_BIND_HOST=0.0.0.0",
            "--env", "SHORTY_POLL_WATCH=1"
        );
    } else {
        dockerArgs.push("--network=none");
    }
    dockerArgs.push(image, command, ...(command === "init" ? [] : args));
    return dockerArgs;
}

function runProcess(command, args, {
    spawnImpl = spawn,
    signalSource = process,
    cwd,
    env = process.env,
    inheritStdout = false
} = {}) {
    let child;
    try {
        child = spawnImpl(command, args, {
            cwd,
            env,
            stdio: ["ignore", inheritStdout ? "inherit" : "ignore", "pipe"]
        });
    } catch (error) {
        return Promise.resolve({ code: 127, error, stderr: "" });
    }

    let spawnError = null;
    let stderr = "";
    let interrupted = null;
    if (child.stderr && typeof child.stderr.on === "function") {
        child.stderr.setEncoding?.("utf8");
        child.stderr.on("data", (chunk) => {
            stderr += chunk;
            process.stderr.write(chunk);
        });
    }

    const forwardSignal = (signal) => {
        interrupted = signal;
        try {
            child.kill(signal);
        } catch {
            // The child may already have exited while the signal was delivered.
        }
    };
    const onInterrupt = () => forwardSignal("SIGINT");
    const onTerminate = () => forwardSignal("SIGTERM");
    signalSource.once("SIGINT", onInterrupt);
    signalSource.once("SIGTERM", onTerminate);

    return new Promise((resolve) => {
        child.once("error", (error) => { spawnError = error; });
        child.once("close", (code, signal) => {
            signalSource.removeListener("SIGINT", onInterrupt);
            signalSource.removeListener("SIGTERM", onTerminate);
            const exitCode = spawnError
                ? 127
                : interrupted === "SIGTERM" || signal === "SIGTERM"
                    ? 143
                    : interrupted || signal
                        ? 130
                        : code ?? 1;
            resolve({ code: exitCode, error: spawnError, signal: signal || interrupted, stderr });
        });
    });
}

async function checkDockerAvailability(options = {}) {
    const result = await runProcess(
        "docker",
        ["info", "--format", "{{.ServerVersion}}"],
        options
    );

    if (result.error) {
        return {
            code: 127,
            message: `Docker wurde nicht gefunden. Installiere Docker Desktop oder Docker Engine: ${result.error.message}`
        };
    }
    if (result.code !== 0) {
        return {
            code: result.code || 1,
            message: `Der Docker-Daemon ist nicht erreichbar.${result.stderr ? `\n${result.stderr.trim()}` : ""}`
        };
    }
    return { code: 0 };
}

async function executeDocker({ command, args, projectRoot, cwd, env = process.env, spawnImpl = spawn, signalSource = process }, writeError = console.error) {
    const selected = resolvePinnedImage(env.npm_config_local_prefix || cwd || projectRoot, env);
    if (selected.error) {
        writeError(selected.error);
        return { code: 1 };
    }

    if (command === "init" && fs.existsSync(projectRoot) && !fs.statSync(projectRoot).isDirectory()) {
        writeError(`Das Projektziel ist kein Verzeichnis: ${projectRoot}`);
        return { code: 1 };
    }

    const inspected = await runProcess("docker", ["image", "inspect", selected.image], { cwd: cwd || process.cwd(), env, spawnImpl, signalSource });
    if (inspected.error) {
        writeError(`Docker konnte nicht gestartet werden: ${inspected.error.message}`);
        return { code: 127 };
    }
    if (inspected.code !== 0) {
        writeError(`Das Shorty-Runtime-Image ${selected.image} ist lokal nicht vorhanden. Es wurde nichts heruntergeladen oder gebaut. Erstelle es später ausdrücklich mit "shorty image build".`);
        return { code: 1 };
    }

    if (command === "init") {
        try {
            fs.mkdirSync(projectRoot, { recursive: true });
        } catch (error) {
            writeError(`Projektverzeichnis kann nicht angelegt werden: ${error.message}`);
            return { code: 1 };
        }
    }

    const dockerArgs = buildDockerArgs({ command, args, projectRoot, image: selected.image });
    const result = await runProcess("docker", dockerArgs, { cwd: projectRoot, env, spawnImpl, signalSource, inheritStdout: true });
    if (result.error) {
        writeError(`Docker konnte nicht gestartet werden: ${result.error.message}`);
        return { code: 127 };
    }
    if (command === "serve" && result.code !== 0 && /port is already allocated|address already in use/i.test(result.stderr)) {
        writeError(`Host-Port ${args[0]} ist belegt. Wähle einen anderen Port: shorty serve <port>.`);
    }
    return { code: result.code };
}

function buildImageDockerArgs(identity, dockerfile, packageRoot = SHORTY_PACKAGE_ROOT) {
    return [
        "build",
        "--pull=false",
        "--tag", identity.image,
        "--label", `org.opencontainers.image.version=${identity.version}`,
        "--label", `org.opencontainers.image.revision=${identity.commit}`,
        "--file", dockerfile,
        packageRoot
    ];
}

async function executeImageBuild({ projectRoot, cwd, env = process.env, spawnImpl = spawn, signalSource = process }, write = console.log, writeError = console.error) {
    const identity = resolveImageIdentity(env.npm_config_local_prefix || cwd || projectRoot, env);
    if (identity.error) {
        writeError(identity.error);
        return { code: 1 };
    }

    const dockerfile = path.join(SHORTY_PACKAGE_ROOT, "docker", "runtime", "Dockerfile");
    if (!fs.existsSync(dockerfile)) {
        writeError(`Shorty-Runtime-Dockerfile fehlt im installierten Paket: ${dockerfile}`);
        return { code: 1 };
    }

    const dockerArgs = buildImageDockerArgs(identity, dockerfile);
    const build = await runProcess("docker", dockerArgs, {
        cwd: SHORTY_PACKAGE_ROOT,
        env,
        spawnImpl,
        signalSource,
        inheritStdout: true
    });
    if (build.error) {
        writeError(`Docker-Image-Build konnte nicht gestartet werden: ${build.error.message}`);
        return { code: 127 };
    }
    if (build.code !== 0) {
        writeError(`Shorty-Runtime-Image konnte nicht gebaut werden (Exitcode ${build.code}).`);
        return { code: build.code };
    }

    const inspected = await runProcess("docker", ["image", "inspect", identity.image], {
        cwd: SHORTY_PACKAGE_ROOT,
        env,
        spawnImpl,
        signalSource
    });
    if (inspected.error) {
        writeError(`Image-Build war erfolgreich, aber Docker konnte das Ergebnis nicht prüfen: ${inspected.error.message}`);
        return { code: 127 };
    }
    if (inspected.code !== 0) {
        writeError(`Docker meldete einen erfolgreichen Build, aber das Image ${identity.image} ist lokal nicht auffindbar.`);
        return { code: inspected.code || 1 };
    }

    write(`Shorty-Runtime-Image erfolgreich gebaut und geprüft.\nVersion: ${identity.version}\nCommit: ${identity.commit}\nImage: ${identity.image}`);
    return { code: 0 };
}

async function run(argv, {
    cwd = process.cwd(),
    env = process.env,
    write = console.log,
    writeError = console.error,
    checkDocker = checkDockerAvailability,
    execute = null,
    spawnImpl = spawn,
    spawnSyncImpl = spawnSync,
    nodeVersion = process.versions?.node,
    checkToolchain = checkHostToolchain,
    checkGit = checkGitAvailability,
    signalSource = process
} = {}) {
    const parsed = parseCommand(argv, env);
    if (parsed.help) {
        showHelp(write, parsed.helpCommand || (argv[0] === "init" ? "init" : null));
        return 0;
    }
    if (parsed.error) {
        writeError(parsed.error);
        if (parsed.usage) showHelp(writeError, parsed.helpCommand);
        return 2;
    }

    let hostToolchain;
    try {
        hostToolchain = await checkToolchain({ env, nodeVersion, spawnSyncImpl });
    } catch (error) {
        writeError(`Host-Toolchain-Prüfung fehlgeschlagen: ${error.message}`);
        return 1;
    }
    if (hostToolchain.code !== 0) {
        writeError(hostToolchain.message);
        return hostToolchain.code;
    }
    if (parsed.command === "init") {
        let git;
        try {
            git = await checkGit({ env, spawnSyncImpl });
        } catch (error) {
            writeError(`Git-Prüfung fehlgeschlagen: ${error.message}`);
            return 1;
        }
        if (git.code !== 0) {
            writeError(git.message);
            return git.code;
        }
    }

    let projectRoot;
    try {
        projectRoot = resolveProjectRoot(parsed.command, parsed.args, cwd);
    } catch (error) {
        writeError(error.message);
        return 1;
    }

    if (parsed.command !== "init") {
        let docker;
        try {
            docker = await checkDocker({ cwd, env, spawnImpl, signalSource });
        } catch (error) {
            writeError(`Docker-Prüfung fehlgeschlagen: ${error.message}`);
            return 1;
        }
        if (docker.code !== 0) {
            if (docker.message) writeError(docker.message);
            return docker.code;
        }
    }

    try {
        const request = {
            command: parsed.command,
            args: parsed.args,
            projectRoot,
            cwd,
            env
        };
        const result = execute
            ? await execute(request)
            : parsed.command === "init"
                ? await initializeHostProject({ ...request, spawnImpl, signalSource }, write, writeError)
                : parsed.command === "image:build"
                    ? await executeImageBuild({ ...request, spawnImpl, signalSource }, write, writeError)
                    : await executeDocker({ ...request, spawnImpl, signalSource }, writeError);
        return typeof result === "number" ? result : result?.code ?? 1;
    } catch (error) {
        writeError(`Shorty-Launcher fehlgeschlagen: ${error.message}`);
        return 1;
    }
}

if (require.main === module) {
    run(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    }).catch((error) => {
        console.error(`Shorty-Launcher fehlgeschlagen: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {
    MIN_NODE_VERSION,
    MIN_NPM_VERSION,
    SUPPORTED_COMMANDS,
    checkGitAvailability,
    checkHostToolchain,
    checkDockerAvailability,
    buildDockerArgs,
    buildImageDockerArgs,
    createProjectScaffold,
    executeImageBuild,
    executeDocker,
    findPinnedShortyIdentity,
    findProjectRoot,
    parseCommand,
    resolveProjectRoot,
    run,
    resolveImageIdentity,
    resolveInstalledShortyIdentity,
    installShortyLocally,
    initializeHostProject,
    resolvePinnedImage,
    runProcess
};
