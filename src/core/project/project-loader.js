const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;

const DEFAULT_PATHS = Object.freeze({
    components: "components",
    pages: "pages",
    layouts: "layouts",
    data: "data",
    assets: "assets",
    schemas: "schemas",
    output: "dist"
});

const CONFIG_FILENAME = "shorty.config.json";
const RELEASE_LOCK_FILENAME = "shorty.lock.json";
const SHORTY_VERSION = require("../../../package.json").version;
const CONFIG_SCHEMA_PATH = path.resolve(
    __dirname,
    "../../../schemas/shorty-config.schema.json"
);
const RELEASE_LOCK_SCHEMA_PATH = path.resolve(
    __dirname,
    "../../../schemas/shorty-lock.schema.json"
);

class ProjectError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = "ProjectError";
        this.code = code;
        this.details = details;
    }
}

function isPathInside(parent, candidate) {
    const relative = path.relative(parent, candidate);

    return (
        relative === "" ||
        (!relative.startsWith(`..${path.sep}`) &&
            relative !== ".." &&
            !path.isAbsolute(relative))
    );
}

function findProjectRoot(startDirectory = process.cwd()) {
    let currentDirectory;

    try {
        currentDirectory = fs.realpathSync(startDirectory);
    } catch (error) {
        throw new ProjectError(
            `Startverzeichnis kann nicht aufgelöst werden: ${startDirectory}`,
            "SHORTY_PROJECT_START_DIRECTORY_INVALID",
            { cause: error.message }
        );
    }

    while (true) {
        const configPath = path.join(currentDirectory, CONFIG_FILENAME);

        if (fs.existsSync(configPath)) {
            let stats;

            try {
                stats = fs.statSync(configPath);
            } catch (error) {
                throw new ProjectError(
                    `Projektkonfiguration kann nicht geprüft werden: ${configPath}`,
                    "SHORTY_PROJECT_CONFIG_UNREADABLE",
                    { cause: error.message }
                );
            }

            if (!stats.isFile()) {
                throw new ProjectError(
                    `Projektkonfiguration ist keine reguläre Datei: ${configPath}`,
                    "SHORTY_PROJECT_CONFIG_NOT_FILE",
                    { configPath }
                );
            }

            return currentDirectory;
        }

        const parentDirectory = path.dirname(currentDirectory);

        if (parentDirectory === currentDirectory) {
            throw new ProjectError(
                `Keine ${CONFIG_FILENAME} gefunden. Bitte im Projektverzeichnis arbeiten oder ein Projekt mit "shorty init" anlegen.`,
                "SHORTY_PROJECT_CONFIG_NOT_FOUND",
                { startDirectory }
            );
        }

        currentDirectory = parentDirectory;
    }
}

function readProjectConfig(configPath) {
    let source;

    try {
        source = fs.readFileSync(configPath, "utf8");
    } catch (error) {
        throw new ProjectError(
            `Projektkonfiguration kann nicht gelesen werden: ${configPath}`,
            "SHORTY_PROJECT_CONFIG_UNREADABLE",
            { configPath, cause: error.message }
        );
    }

    try {
        return JSON.parse(source);
    } catch (error) {
        throw new ProjectError(
            `Projektkonfiguration enthält ungültiges JSON: ${configPath}`,
            "SHORTY_PROJECT_CONFIG_INVALID_JSON",
            { configPath, cause: error.message }
        );
    }
}

function readReleaseLock(projectRoot) {
    const lockPath = path.join(projectRoot, RELEASE_LOCK_FILENAME);
    if (!fs.existsSync(lockPath)) return null;

    let lock;
    try {
        const stats = fs.statSync(lockPath);
        if (!stats.isFile()) throw new Error("keine reguläre Datei");
        lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    } catch (error) {
        throw new ProjectError(
            `Shorty-Versionsdatei kann nicht gelesen werden: ${lockPath}`,
            "SHORTY_PROJECT_RELEASE_LOCK_INVALID",
            { lockPath, cause: error.message }
        );
    }

    let lockSchema;
    try {
        lockSchema = JSON.parse(fs.readFileSync(RELEASE_LOCK_SCHEMA_PATH, "utf8"));
    } catch (error) {
        throw new ProjectError(
            `Shorty-Versionsschema kann nicht geladen werden: ${RELEASE_LOCK_SCHEMA_PATH}`,
            "SHORTY_PROJECT_RELEASE_SCHEMA_UNAVAILABLE",
            { schemaPath: RELEASE_LOCK_SCHEMA_PATH, cause: error.message }
        );
    }

    const ajv = new Ajv2020({ allErrors: true, strict: true });
    let validateLock;
    try {
        validateLock = ajv.compile(lockSchema);
    } catch (error) {
        throw new ProjectError(
            "Shorty-Versionsschema ist ungültig.",
            "SHORTY_PROJECT_RELEASE_SCHEMA_INVALID",
            { schemaPath: RELEASE_LOCK_SCHEMA_PATH, cause: error.message }
        );
    }
    if (!validateLock(lock)) {
        throw new ProjectError(
            `Shorty-Versionsdatei hat ein ungültiges Format: ${lockPath}`,
            "SHORTY_PROJECT_RELEASE_LOCK_INVALID",
            { lockPath, errors: validateLock.errors }
        );
    }

    if (lock.shortyVersion !== SHORTY_VERSION) {
        throw new ProjectError(
            `Dieses Legacy-Projekt ist an Shorty ${lock.shortyVersion} gebunden, installiert ist ${SHORTY_VERSION}. Ändere die projektlokale Shorty-Git-Abhängigkeit in package.json nur nach bewusster Versionsentscheidung und installiere anschließend mit npm install.`,
            "SHORTY_PROJECT_VERSION_MISMATCH",
            { lockPath, expectedVersion: lock.shortyVersion, actualVersion: SHORTY_VERSION }
        );
    }

    return lock.shortyVersion;
}

function validateProjectConfig(config, schemaPath = CONFIG_SCHEMA_PATH, options = {}) {
    if (!(options.allowUnsetSiteUrl && config?.site?.url === "")) validateSiteUrl(config);

    let schema;

    try {
        schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    } catch (error) {
        throw new ProjectError(
            `Shorty-Projektkonfigurationsschema kann nicht geladen werden: ${schemaPath}`,
            "SHORTY_PROJECT_SCHEMA_UNAVAILABLE",
            { schemaPath, cause: error.message }
        );
    }

    const ajv = new Ajv2020({
        allErrors: true,
        strict: true
    });

    let validate;

    try {
        validate = ajv.compile(schema);
    } catch (error) {
        throw new ProjectError(
            "Shorty-Projektkonfigurationsschema ist ungültig.",
            "SHORTY_PROJECT_SCHEMA_INVALID",
            { cause: error.message }
        );
    }

    if (!validate(config)) {
        throw new ProjectError(
            "Projektkonfiguration entspricht nicht dem Shorty-Konfigurationsvertrag.",
            "SHORTY_PROJECT_CONFIG_INVALID",
            {
                errors: (validate.errors || []).map((error) => ({
                    instancePath: error.instancePath,
                    keyword: error.keyword,
                    message: error.message,
                    params: error.params
                }))
            }
        );
    }
}

function validateSiteUrl(config) {
    const siteUrl = config?.site?.url;
    if (typeof siteUrl !== "string" || !siteUrl.trim()) {
        throw new ProjectError(
            `site.url fehlt in ${CONFIG_FILENAME}. Trage eine absolute HTTP- oder HTTPS-Basis-URL ein; Shorty erfindet keine Domain.`,
            "SHORTY_PROJECT_SITE_URL_REQUIRED",
            { configPath: CONFIG_FILENAME }
        );
    }

    let parsedUrl;
    try {
        if (siteUrl !== siteUrl.trim() || !/^https?:\/\/[^/?#\s]+/i.test(siteUrl)) {
            throw new Error("URL muss mit http:// oder https:// und einem Host beginnen");
        }
        parsedUrl = new URL(siteUrl);
    } catch (error) {
        throw invalidSiteUrl(siteUrl, error.message);
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol) ||
        !parsedUrl.hostname ||
        parsedUrl.username ||
        parsedUrl.password ||
        siteUrl.includes("?") ||
        siteUrl.includes("#")) {
        throw invalidSiteUrl(siteUrl, "erwartet wird eine absolute HTTP- oder HTTPS-Basis-URL ohne Zugangsdaten, Query oder Fragment");
    }
}

function invalidSiteUrl(siteUrl, reason) {
    return new ProjectError(
        `Ungültige site.url in ${CONFIG_FILENAME}: "${siteUrl}" (${reason}).`,
        "SHORTY_PROJECT_SITE_URL_INVALID",
        { configPath: CONFIG_FILENAME, siteUrl, reason }
    );
}

function resolveProjectPaths(projectRoot, configuredPaths = {}) {
    const paths = {
        ...DEFAULT_PATHS,
        ...configuredPaths
    };

    const resolvedPaths = {};

    for (const [key, relativePath] of Object.entries(paths)) {
        const absolutePath = path.resolve(projectRoot, relativePath);

        if (!isPathInside(projectRoot, absolutePath)) {
            throw new ProjectError(
                `Projektpfad "${key}" verlässt das Projektverzeichnis: ${relativePath}`,
                "SHORTY_PROJECT_PATH_OUTSIDE_ROOT",
                { key, relativePath }
            );
        }

        resolvedPaths[key] = {
            relative: relativePath,
            absolute: absolutePath
        };
    }

    const entries = Object.entries(resolvedPaths);

    for (let index = 0; index < entries.length; index += 1) {
        const [key, current] = entries[index];

        for (const [otherKey, other] of entries.slice(index + 1)) {
            if (current.absolute === other.absolute) {
                throw new ProjectError(
                    `Die Projektpfade "${key}" und "${otherKey}" zeigen auf dasselbe Verzeichnis.`,
                    "SHORTY_PROJECT_PATH_COLLISION",
                    { key, otherKey, path: current.relative }
                );
            }
        }
    }

    const outputPath = resolvedPaths.output.absolute;

    for (const [key, entry] of entries) {
        if (key === "output") {
            continue;
        }

        if (
            isPathInside(entry.absolute, outputPath) ||
            isPathInside(outputPath, entry.absolute)
        ) {
            throw new ProjectError(
                `Das Ausgabeverzeichnis darf sich nicht mit dem Quellverzeichnis "${key}" überschneiden.`,
                "SHORTY_PROJECT_OUTPUT_PATH_OVERLAP",
                {
                    output: resolvedPaths.output.relative,
                    source: key,
                    sourcePath: entry.relative
                }
            );
        }
    }

    return resolvedPaths;
}

function assertResolvedPathsStayInsideRoot(projectRoot, resolvedPaths) {
    for (const [key, entry] of Object.entries(resolvedPaths)) {
        let currentPath = entry.absolute;

        while (!fs.existsSync(currentPath)) {
            const parentPath = path.dirname(currentPath);

            if (parentPath === currentPath) {
                break;
            }

            currentPath = parentPath;
        }

        let realPath;

        try {
            realPath = fs.realpathSync(currentPath);
        } catch (error) {
            throw new ProjectError(
                `Projektpfad "${key}" kann nicht sicher aufgelöst werden.`,
                "SHORTY_PROJECT_PATH_UNRESOLVABLE",
                { key, path: entry.relative, cause: error.message }
            );
        }

        if (!isPathInside(projectRoot, realPath)) {
            throw new ProjectError(
                `Projektpfad "${key}" führt über einen symbolischen Link aus dem Projektverzeichnis.`,
                "SHORTY_PROJECT_PATH_SYMLINK_ESCAPE",
                { key, path: entry.relative, resolvedPath: realPath }
            );
        }
    }
}

function loadProject(options = {}) {
    const startDirectory = options.startDirectory || process.cwd();
    const projectRoot = options.projectRoot
        ? fs.realpathSync(options.projectRoot)
        : findProjectRoot(startDirectory);

    const configPath = path.join(projectRoot, CONFIG_FILENAME);
    const config = readProjectConfig(configPath);

    validateProjectConfig(
        config,
        options.schemaPath || CONFIG_SCHEMA_PATH
    );

    const resolvedPaths = resolveProjectPaths(
        projectRoot,
        config.paths
    );

    assertResolvedPathsStayInsideRoot(projectRoot, resolvedPaths);
    const shortyVersion = readReleaseLock(projectRoot);

    return Object.freeze({
        root: projectRoot,
        configPath,
        configVersion: config.configVersion,
        shortyVersion,
        name: config.project.name,
        config,
        paths: Object.freeze(
            Object.fromEntries(
                Object.entries(resolvedPaths).map(([key, value]) => [
                    key,
                    Object.freeze(value)
                ])
            )
        )
    });
}

module.exports = {
    CONFIG_FILENAME,
    CONFIG_SCHEMA_PATH,
    DEFAULT_PATHS,
    RELEASE_LOCK_SCHEMA_PATH,
    RELEASE_LOCK_FILENAME,
    SHORTY_VERSION,
    ProjectError,
    findProjectRoot,
    loadProject,
    resolveProjectPaths,
    validateProjectConfig
};
