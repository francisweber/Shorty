#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const COMPOSER_VERSION = "2.11.1";
const COMPOSER_URL = `https://getcomposer.org/download/${COMPOSER_VERSION}/composer.phar`;
const COMPOSER_SHA256 = "6f1b891e1d4927d62740276c540fb490e47689e19e102c49e8da849794882f8c";
const MINIMUM_PHP_VERSION = [8, 2, 0];

function run(command, args, options = {}) {
    return spawnSync(command, args, {
        encoding: "utf8",
        ...options
    });
}

function versionTuple(value) {
    const match = String(value).match(/\b(\d+)\.(\d+)\.(\d+)\b/);
    return match ? match.slice(1).map(Number) : null;
}

function verifyComposerArchive(archive, expectedChecksum = COMPOSER_SHA256) {
    const checksum = crypto.createHash("sha256").update(archive).digest("hex");
    if (checksum !== expectedChecksum) {
        throw new Error(
            `Prüfsummenfehler beim Composer-Download: erwartet ${expectedChecksum}, erhalten ${checksum}.`
        );
    }
    return archive;
}

function isVersionAtLeast(actual, minimum) {
    if (!actual) return false;
    for (let index = 0; index < minimum.length; index += 1) {
        if (actual[index] > minimum[index]) return true;
        if (actual[index] < minimum[index]) return false;
    }
    return true;
}

async function downloadPinnedComposer() {
    let response;
    try {
        response = await fetch(COMPOSER_URL, { redirect: "error" });
    } catch (error) {
        throw new Error(
            `Composer ${COMPOSER_VERSION} konnte nicht von getcomposer.org geladen werden: ${error.message}`
        );
    }

    if (!response.ok) {
        throw new Error(
            `Composer ${COMPOSER_VERSION} konnte nicht geladen werden (HTTP ${response.status}).`
        );
    }

    return verifyComposerArchive(Buffer.from(await response.arrayBuffer()));
}

async function runPrepare({
    packageRoot = path.resolve(__dirname, ".."),
    phpBinary = process.env.PHP_BINARY || "php",
    commandRunner = run,
    composerDownloader = downloadPinnedComposer
} = {}) {
    const phpCheck = commandRunner(
        phpBinary,
        ["-r", "echo PHP_VERSION;"],
        { cwd: packageRoot }
    );
    if (phpCheck.error || phpCheck.status !== 0) {
        throw new Error(
            "PHP wurde nicht gefunden. Dieser Composer-Schritt ist für den Docker-Image-Aufbau vorgesehen; dort muss PHP >= 8.2 verfügbar sein."
        );
    }

    const phpVersion = versionTuple(phpCheck.stdout);
    if (!isVersionAtLeast(phpVersion, MINIMUM_PHP_VERSION)) {
        throw new Error(
            `PHP ${phpCheck.stdout || "unbekannt"} ist zu alt. Shorty benötigt PHP >= 8.2.`
        );
    }

    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-composer-"));
    const composerPhar = path.join(temporaryDirectory, "composer.phar");

    try {
        fs.writeFileSync(composerPhar, await composerDownloader(), { mode: 0o600 });
        const install = commandRunner(phpBinary, [
            composerPhar,
            "install",
            "--no-dev",
            "--classmap-authoritative",
            "--no-interaction",
            `--working-dir=${packageRoot}`
        ], {
            cwd: packageRoot,
            stdio: "inherit"
        });
        if (install.error || install.status !== 0) {
            throw new Error(
                `Composer ${COMPOSER_VERSION} install fehlgeschlagen${install.error ? `: ${install.error.message}` : ` (Exitcode ${install.status})`}.`
            );
        }
    } finally {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }

    const autoloadPath = path.join(packageRoot, "vendor", "autoload.php");
    if (!fs.existsSync(autoloadPath)) {
        throw new Error(
            `Composer meldete Erfolg, aber ${autoloadPath} wurde nicht angelegt.`
        );
    }
}

if (require.main === module) {
    runPrepare().catch((error) => {
        console.error(`Shorty prepare fehlgeschlagen: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {
    COMPOSER_SHA256,
    COMPOSER_URL,
    COMPOSER_VERSION,
    runPrepare,
    verifyComposerArchive,
    versionTuple
};
