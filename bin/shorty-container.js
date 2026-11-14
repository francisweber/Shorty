#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
    DEFAULT_PATHS,
    loadProject,
    ProjectError,
    RELEASE_LOCK_FILENAME,
    validateProjectConfig
} = require("../src/core/project/project-loader");
const {
    discoverComponents,
    inspectComponent,
    isValidComponentName,
    validateMetadata
} = require("../src/core/component/component-validator");
const { buildProject, validateProjectPages } = require("../src/core/site-builder");
const { startDevelopmentServer } = require("../src/core/dev-server");
const { STARTER_FILES } = require("../src/core/project/starter-template");

function showHelp() {
    console.log(`
Shorty CLI

Verwendung:

  shorty component:create <component-name> [--with-js]
  shorty component:validate <component-name>
  shorty component:list
  shorty validate
  shorty init [project-directory]
  shorty build
  shorty serve [port]

Befehle:

  component:create    Erstellt eine neue Komponente
  component:validate  Validiert eine bestehende Komponente
  component:list      Listet alle Komponenten auf
  validate            Prüft Projektkonfiguration und Komponenten
  init                Erstellt ein neues Shorty-Projekt
  build               Rendert statische HTML-Seiten
  serve               Startet Build, lokalen Server und Dateiüberwachung

Optionen:

  --with-js           Erzeugt zusätzlich eine JavaScript-Datei
  --help              Zeigt diese Hilfe

`);
}

function validateComponent(name, project) {
    if (!name || !isValidComponentName(name)) {
        console.error(
            "Fehler: Bitte einen gültigen Namen im kebab-case angeben."
        );
        console.error("Beispiel: shorty component:validate feature-grid");
        process.exitCode = 2;
        return;
    }

    const result = inspectComponent(name, project);

    if (result.status !== "valid") {
        console.error("");
        console.error(`Komponente "${name}" ist ${result.status}:`);

        for (const error of result.errors) {
            console.error(`  - ${error}`);
        }

        console.error("");

        process.exitCode = result.missingSchema ? 3 : 1;
        return;
    }

    console.log("");
    console.log(`Komponente "${name}" ist gültig.`);
    console.log(
        "Dateistruktur, Metadaten und eingebettetes JSON-Schema sind valide."
    );
    console.log("");
}

function listComponents(project) {
    const componentsRoot = project.paths.components.absolute;

    if (!fs.existsSync(componentsRoot)) {
        console.log("");
        console.log("Keine Komponenten gefunden.");
        console.log("");
        return;
    }

    console.log("");
    console.log("Shorty Components");
    console.log("");

    let results;
    try {
        results = discoverComponents(project);
    } catch (error) {
        console.error(`Fehler beim Lesen des Komponentenverzeichnisses: ${error.message}`);
        process.exitCode = 1;
        return;
    }

    if (results.length === 0) {
        console.log("Keine Komponenten gefunden.");
        console.log("");
        return;
    }

    const nameWidth = Math.max(
        4,
        ...results.map((result) => result.name.length)
    );

    console.log(`${"NAME".padEnd(nameWidth)}  STATUS`);
    console.log(`${"-".repeat(nameWidth)}  ------`);

    for (const result of results) {
        console.log(
            `${result.name.padEnd(nameWidth)}  ${result.status}`
        );

        for (const error of result.errors) {
            console.log(`  - ${error}`);
        }
    }

    const validCount = results.filter(
        (result) => result.status === "valid"
    ).length;

    const incompleteCount = results.filter(
        (result) => result.status === "incomplete"
    ).length;

    const invalidCount = results.filter(
        (result) => result.status === "invalid"
    ).length;

    console.log("");
    console.log(
        `Gesamt: ${results.length} | Gültig: ${validCount} | Unvollständig: ${incompleteCount} | Ungültig: ${invalidCount}`
    );
    console.log("");
}

function toProjectDisplayName(directoryName) {
    return directoryName
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

function initializeProject(targetArgument) {
    const targetPath = path.resolve(process.cwd(), targetArgument || ".");
    const projectName = toProjectDisplayName(path.basename(targetPath));

    if (!projectName) {
        console.error("Fehler: Aus dem Zielverzeichnis konnte kein Projektname abgeleitet werden.");
        process.exitCode = 2;
        return;
    }

    const targetStats = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null;

    if (targetStats && !targetStats.isDirectory()) {
        console.error(`Fehler: Das Projektziel ist kein Verzeichnis: ${targetPath}`);
        process.exitCode = 1;
        return;
    }

    const configPath = path.join(targetPath, "shorty.config.json");

    if (fs.existsSync(configPath)) {
        console.error(`Fehler: Eine Projektkonfiguration existiert bereits: ${configPath}`);
        process.exitCode = 1;
        return;
    }

    const releaseLockPath = path.join(targetPath, RELEASE_LOCK_FILENAME);
    if (fs.existsSync(releaseLockPath)) {
        console.error(`Fehler: Eine Shorty-Versionsdatei existiert bereits: ${releaseLockPath}`);
        process.exitCode = 1;
        return;
    }

    const config = {
        configVersion: 1,
        project: { name: projectName },
        site: { url: "" }
    };

    try {
        validateProjectConfig(config, undefined, { allowUnsetSiteUrl: true });
    } catch (error) {
        reportProjectError(error);
        return;
    }

    const directories = Object.values(DEFAULT_PATHS).map((relativePath) => ({
        relativePath,
        absolutePath: path.resolve(targetPath, relativePath)
    }));

    for (const directory of directories) {
        if (fs.existsSync(directory.absolutePath) &&
            !fs.statSync(directory.absolutePath).isDirectory()) {
            console.error(`Fehler: Der Standardpfad ist bereits als Datei vorhanden: ${directory.relativePath}`);
            process.exitCode = 1;
            return;
        }
    }

    const starterFiles = Object.entries(STARTER_FILES);
    for (const [relativePath, content] of starterFiles) {
        const filePath = path.join(targetPath, relativePath);
        if (fs.existsSync(filePath)) {
            console.error(`Fehler: Eine Starterdatei existiert bereits: ${relativePath}`);
            process.exitCode = 1;
            return;
        }

        const componentMetadataMatch = relativePath.match(/^components\/([a-z][a-z0-9-]*)\/\1\.json$/);
        if (componentMetadataMatch) {
            const validation = validateMetadata(JSON.parse(content));
            if (!validation.valid) {
                console.error(`Fehler: Starter-Metadaten sind ungültig (${relativePath}).`);
                for (const error of validation.errors) console.error(`  - ${error}`);
                process.exitCode = validation.missingSchema ? 3 : 1;
                return;
            }
        }
    }

    const createdDirectories = [];
    const createdFiles = [];
    let createdConfig = false;

    function createParentDirectories(directoryPath) {
        const missing = [];
        let current = directoryPath;
        while (!fs.existsSync(current) && current !== targetPath) {
            missing.push(current);
            current = path.dirname(current);
        }
        for (const directoryPath of missing.reverse()) {
            fs.mkdirSync(directoryPath);
            createdDirectories.push(directoryPath);
        }
    }

    try {
        fs.mkdirSync(targetPath, { recursive: true });

        for (const directory of directories) {
            if (!fs.existsSync(directory.absolutePath)) {
                fs.mkdirSync(directory.absolutePath, { recursive: true });
                createdDirectories.push(directory.absolutePath);
            }
        }

        for (const [relativePath, content] of starterFiles) {
            const filePath = path.join(targetPath, relativePath);
            createParentDirectories(path.dirname(filePath));
            fs.writeFileSync(filePath, content, {
                encoding: "utf8",
                flag: "wx"
            });
            createdFiles.push(filePath);
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", {
            encoding: "utf8",
            flag: "wx"
        });
        createdConfig = true;
    } catch (error) {
        for (const filePath of createdFiles.reverse()) {
            try {
                fs.unlinkSync(filePath);
            } catch {
                // Bereits entfernte oder gesperrte Dateien nicht verschleiern.
            }
        }
        if (createdConfig) {
            try {
                fs.unlinkSync(configPath);
            } catch {
                // Aufräumfehler nicht verschleiern.
            }
        }
        for (const directory of createdDirectories.reverse()) {
            try {
                fs.rmdirSync(directory);
            } catch {
                // Nur leere, von init angelegte Verzeichnisse entfernen.
            }
        }

        console.error(`Fehler beim Initialisieren des Projekts: ${error.message}`);
        process.exitCode = 1;
        return;
    }

    console.log("");
    console.log(`Shorty-Projekt "${projectName}" wurde initialisiert:`);
    console.log(`  ${targetPath}`);
    console.log("");
    console.log("Angelegt:");

    for (const directory of directories) {
        console.log(`  ${directory.relativePath}`);
    }

    console.log(`  ${starterFiles.length} Scaffold-Dateien (Basislayout, minimale Beispielseite, Seitendaten und Basis-Stylesheet)`);
    console.log("  shorty.config.json");
    console.log("");
    console.log("Trage vor validate/build eine echte HTTP(S)-Basis-URL unter site.url in shorty.config.json ein.");
    console.log("Nächster Schritt: shorty validate");
    console.log("");
}

function validateProject(project) {
    try {
        validateProjectPages(project);
    } catch (error) {
        console.error(`Seitendaten ungültig: ${error.message}`);
        process.exitCode = 1;
        return;
    }

    let results;
    try {
        results = discoverComponents(project);
    } catch (error) {
        console.error(`Komponentenverzeichnis kann nicht gelesen werden: ${error.message}`);
        process.exitCode = 1;
        return;
    }

    if (!fs.existsSync(project.paths.components.absolute)) {
        console.log("");
        console.log(`Projekt "${project.name}" ist gültig.`);
        console.log("Komponentenverzeichnis existiert noch nicht; keine Komponenten zu prüfen.");
        console.log("");
        return;
    }

    const validCount = results.filter((result) => result.status === "valid").length;
    const incompleteCount = results.filter((result) => result.status === "incomplete").length;
    const invalidCount = results.filter((result) => result.status === "invalid").length;
    const hasErrors = results.some((result) => result.status !== "valid");
    const missingSchema = results.some((result) => result.missingSchema);

    console.log("");
    console.log(`Shorty-Projekt: ${project.name}`);
    console.log(`Komponenten geprüft: ${results.length}`);
    console.log(`Gültig: ${validCount} | Unvollständig: ${incompleteCount} | Ungültig: ${invalidCount}`);

    for (const result of results) {
        if (result.status === "valid") {
            continue;
        }

        console.log("");
        console.log(`[${result.status}] ${result.name}`);

        for (const error of result.errors) {
            console.log(`  - ${error}`);
        }
    }

    console.log("");

    if (hasErrors) {
        console.error("Projektvalidierung fehlgeschlagen.");
        process.exitCode = missingSchema ? 3 : 1;
        return;
    }

    console.log("Projektvalidierung erfolgreich.");
}

function createComponent(name, options = {}, project) {
    if (!name || !isValidComponentName(name)) {
        console.error(
            "Fehler: Bitte einen gültigen Namen im kebab-case angeben."
        );
        console.error("Beispiel: shorty component:create feature-grid");
        process.exitCode = 2;
        return;
    }

    const projectRoot = project.root;
    const componentsRoot = project.paths.components.absolute;
    const componentDirectory = path.join(componentsRoot, name);
    if (fs.existsSync(componentDirectory)) {
        console.error(`Fehler: Die Komponente "${name}" existiert bereits.`);
        process.exitCode = 1;
        return;
    }

    const displayName = name
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

    const metadata = {
        metadataVersion: 1,
        name: displayName,
        description: "TODO: Beschreibung der Komponente ergänzen.",
        category: "content",
        dataSchema: {
            $schema: "https:" + "/" + "/json-schema.org/draft/2020-12/schema",
            type: "object",
            properties: {},
            additionalProperties: false
        }
    };

    const validation = validateMetadata(metadata);

    if (!validation.valid) {
        console.error("Fehler: Die Komponentenmetadaten sind ungültig.");

        for (const error of validation.errors) {
            console.error(`  - ${error}`);
        }

        process.exitCode = validation.missingSchema ? 3 : 1;
        return;
    }

    const files = {
        [`${name}.json`]: JSON.stringify(metadata, null, 2) + "\n",

        [`${name}.tpl`]: [
            `{# Component: ${name} #}`,
            "",
            `<section class="component-${name}">`,
            "    {# Component markup #}",
            "</section>",
            ""
        ].join("\n"),

        [`${name}.scss`]: [
            `.component-${name} {`,
            "    // Component styles",
            "}",
            ""
        ].join("\n")
    };

    if (options.withJs) {
        files[`${name}.js`] = [
            "// Component JavaScript",
            ""
        ].join("\n");
    }

    const createdFiles = [];

    try {
        fs.mkdirSync(componentDirectory, { recursive: true });

        for (const [filename, content] of Object.entries(files)) {
            const filePath = path.join(componentDirectory, filename);

            fs.writeFileSync(filePath, content, {
                encoding: "utf8",
                flag: "wx"
            });

            createdFiles.push(filePath);
        }
    } catch (error) {
        for (const filePath of createdFiles) {
            try {
                fs.unlinkSync(filePath);
            } catch {
                // Fehler beim Aufräumen werden nicht verschleiert.
            }
        }

        try {
            fs.rmdirSync(componentDirectory);
        } catch {
            // Verzeichnis kann bereits entfernt oder nicht leer sein.
        }

        console.error(
            `Fehler beim Erstellen der Komponente: ${error.message}`
        );

        process.exitCode = 1;
        return;
    }

    console.log("");
    console.log(`Komponente "${name}" wurde angelegt:`);
    console.log(`  ${path.relative(projectRoot, componentDirectory)}`);

    for (const filename of Object.keys(files)) {
        console.log(`  ${filename}`);
    }

    console.log("");
}

function reportProjectError(error) {
    if (error instanceof ProjectError) {
        console.error("");
        console.error(`Projektfehler [${error.code}]: ${error.message}`);

        if (Array.isArray(error.details.errors)) {
            for (const detail of error.details.errors) {
                console.error(
                    `  - ${detail.instancePath || "/"}: ${detail.message}`
                );
            }
        }

        console.error("");
        process.exitCode = [
            "SHORTY_PROJECT_SCHEMA_UNAVAILABLE",
            "SHORTY_PROJECT_RELEASE_SCHEMA_UNAVAILABLE"
        ].includes(error.code)
            ? 3
            : 1;
        return;
    }

    console.error(`Unerwarteter Fehler: ${error.message}`);
    process.exitCode = 1;
}

function main() {
    const args = process.argv.slice(2);

    if (
        args.includes("--help") ||
        args.includes("-h") ||
        args.length === 0
    ) {
        showHelp();
        return;
    }

    const command = args[0];

    const supportedCommands = [
        "component:create",
        "component:validate",
        "component:list",
        "validate",
        "init",
        "build",
        "serve"
    ];

    if (!supportedCommands.includes(command)) {
        console.error(`Unbekannter Befehl: ${command}`);
        showHelp();
        process.exitCode = 2;
        return;
    }

    const commandArguments = args.slice(1);

    if (command === "init") {
        if (commandArguments.length > 1) {
            console.error("Fehler: init akzeptiert höchstens ein Projektverzeichnis.");
            process.exitCode = 2;
            return;
        }

        initializeProject(commandArguments[0]);
        return;
    }

    if (command === "validate") {
        if (commandArguments.length !== 0) {
            console.error("Fehler: validate benötigt keine zusätzlichen Argumente.");
            process.exitCode = 2;
            return;
        }

        try {
            validateProject(loadProject());
        } catch (error) {
            reportProjectError(error);
        }
        return;
    }

    if (command === "build") {
        if (commandArguments.length !== 0) {
            console.error("Fehler: build benötigt keine zusätzlichen Argumente.");
            process.exitCode = 2;
            return;
        }

        try {
            const project = loadProject();
            const pages = buildProject(project);
            console.log(`Build erfolgreich: ${pages.length} Seite(n) nach ${project.paths.output.relative} geschrieben.`);
        } catch (error) {
            console.error(`Build fehlgeschlagen: ${error.message}`);
            process.exitCode = error.exitCode || 1;
        }
        return;
    }

    if (command === "serve") {
        if (commandArguments.length > 1) {
            console.error("Fehler: serve akzeptiert höchstens eine Portnummer.");
            process.exitCode = 2;
            return;
        }

        const portArgument = commandArguments[0] || process.env.SHORTY_PORT || "3000";
        if (!/^\d+$/.test(portArgument) || Number(portArgument) < 1 || Number(portArgument) > 65535) {
            console.error("Fehler: Der Port muss eine Zahl zwischen 1 und 65535 sein.");
            process.exitCode = 2;
            return;
        }

        try {
            startDevelopmentServer(loadProject(), { port: Number(portArgument) });
        } catch (error) {
            console.error(`Serve konnte nicht gestartet werden: ${error.message}`);
            process.exitCode = error.exitCode || 1;
        }
        return;
    }

    if (command === "component:list") {
        if (commandArguments.length !== 0) {
            console.error(
                "Fehler: component:list benötigt keine zusätzlichen Argumente."
            );
            process.exitCode = 2;
            return;
        }

        try {
            listComponents(loadProject());
        } catch (error) {
            reportProjectError(error);
        }
        return;
    }

    const allowedOptions = command === "component:create"
        ? ["--with-js"]
        : [];

    const positionalArguments = commandArguments.filter(
        (argument) => !argument.startsWith("--")
    );

    const unknownOptions = commandArguments.filter(
        (argument) =>
            argument.startsWith("--") &&
            !allowedOptions.includes(argument)
    );

    if (unknownOptions.length > 0) {
        console.error(`Unbekannte Option: ${unknownOptions[0]}`);
        process.exitCode = 2;
        return;
    }

    if (positionalArguments.length !== 1) {
        console.error(
            "Fehler: Bitte genau einen Komponentennamen angeben."
        );
        showHelp();
        process.exitCode = 2;
        return;
    }

    const componentName = positionalArguments[0];

    if (command === "component:create") {
        try {
            createComponent(componentName, {
                withJs: commandArguments.includes("--with-js")
            }, loadProject());
        } catch (error) {
            reportProjectError(error);
        }
        return;
    }

    if (command === "component:validate") {
        try {
            validateComponent(componentName, loadProject());
        } catch (error) {
            reportProjectError(error);
        }
    }
}

main();
