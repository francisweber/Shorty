const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const Ajv2020 = require("ajv/dist/2020").default;
const sass = require("sass");
const { discoverComponents } = require("./component/component-validator");

const PAGE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const COMPONENT_CALL_PATTERN = /\{\{\s*component\(\s*(['"])([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\1\s*,\s*(['"])([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\3\s*\)\s*\}\}/g;
const WORKER_PATH = path.resolve(__dirname, "render/twig-worker.php");
const PAGE_DATA_SCHEMA_PATH = path.resolve(__dirname, "../../schemas/page-data.schema.json");
const pageDataSchema = readJson(PAGE_DATA_SCHEMA_PATH, "Seitendatenschema");
const validatePageDataSchema = new Ajv2020({ allErrors: true, strict: true }).compile(pageDataSchema);

function readJson(filePath, label) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        throw new Error(`${label} kann nicht gelesen werden (${filePath}): ${error.message}`);
    }
}

function readComponentRegistry(project) {
    const results = discoverComponents(project);
    const invalid = results.filter((component) => component.status !== "valid");
    if (invalid.length > 0) {
        throw new Error(`Komponenten ungültig: ${invalid.map((item) => item.name).join(", ")}`);
    }

    return Object.fromEntries(results.map(({ name }) => {
        const directory = path.join(project.paths.components.absolute, name);
        const metadataPath = path.join(directory, `${name}.json`);
        return [name, {
            template: path.relative(project.root, path.join(directory, `${name}.tpl`)).split(path.sep).join("/"),
            schema: readJson(metadataPath, `Komponentenmetadaten für '${name}'`).dataSchema,
            directory,
            stylesheet: path.join(directory, `${name}.scss`),
            script: path.join(directory, `${name}.js`),
        }];
    }));
}

function collectComponentCalls(templateSource) {
    const calls = [];
    for (const match of templateSource.matchAll(COMPONENT_CALL_PATTERN)) {
        calls.push({ componentId: match[2], instanceId: match[4] });
    }
    return calls;
}

function loadPageComponents(project, pageId, pageTemplate, registry) {
    const pageDataDirectory = path.join(project.paths.data.absolute, "pages", pageId);
    const loaded = {};
    const visitedTemplates = new Set();
    const pendingTemplates = [pageTemplate];
    const ajv = new Ajv2020({ allErrors: true, strict: true });

    while (pendingTemplates.length > 0) {
        const templatePath = pendingTemplates.pop();
        if (visitedTemplates.has(templatePath)) continue;
        visitedTemplates.add(templatePath);

        const templateSource = fs.readFileSync(templatePath, "utf8");
        for (const { componentId, instanceId } of collectComponentCalls(templateSource)) {
            const definition = registry[componentId];
            if (!definition) throw new Error(`Unbekannter Komponententyp '${componentId}' in ${templatePath}`);

            const dataPath = path.join(pageDataDirectory, "components", `${instanceId}.json`);
            const data = readJson(dataPath, `Daten für Instanz '${instanceId}'`);
            let validate;
            try {
                validate = ajv.compile(definition.schema);
            } catch (error) {
                throw new Error(`Daten-Schema der Komponente '${componentId}' ist ungültig: ${error.message}`);
            }
            if (!validate(data)) {
                const details = (validate.errors || []).map((error) => `${error.instancePath || "/"}: ${error.message}`).join("; ");
                throw new Error(`Daten für '${componentId}/${instanceId}' sind ungültig (${dataPath}): ${details}`);
            }

            loaded[componentId] ??= {};
            loaded[componentId][instanceId] = data;
            pendingTemplates.push(path.join(definition.directory, `${componentId}.tpl`));
        }
    }

    return {
        data: Object.fromEntries(Object.entries(loaded).map(([componentId, instances]) => [
            componentId,
            { template: registry[componentId].template, instances },
        ])),
        componentIds: Object.keys(loaded).sort((a, b) => a.localeCompare(b)),
    };
}

function renderPage(project, template, page, components) {
    const input = JSON.stringify({
        projectRoot: project.root,
        template: path.relative(project.root, template).split(path.sep).join("/"),
        page,
        components,
    });
    const result = spawnSync(process.env.PHP_BINARY || "php", [WORKER_PATH], {
        cwd: project.root,
        input,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
    });

    if (result.error) throw new Error(`PHP/Twig konnte nicht gestartet werden: ${result.error.message}`);
    if (result.status !== 0) {
        const error = new Error((result.stderr || "Twig-Rendering fehlgeschlagen.").trim());
        error.exitCode = result.status === 3 ? 3 : 1;
        throw error;
    }
    return result.stdout;
}

function readPageData(project, pageId, { required = true } = {}) {
    const pageDataPath = path.join(project.paths.data.absolute, "pages", pageId, "page.json");
    if (!fs.existsSync(pageDataPath)) {
        if (!required) return null;
        throw new Error(`Seitendaten für '${pageId}' fehlen: ${path.relative(project.root, pageDataPath)}`);
    }
    const page = readJson(pageDataPath, `Seitendaten für '${pageId}'`);
    if (!validatePageDataSchema(page)) {
        const details = (validatePageDataSchema.errors || [])
            .map((error) => `${error.instancePath || "/"}: ${error.message}`)
            .join("; ");
        throw new Error(`Seitendaten für '${pageId}' sind ungültig (${path.relative(project.root, pageDataPath)}): ${details}`);
    }
    return page;
}

function validateProjectPages(project) {
    const pagesRoot = project.paths.pages.absolute;
    if (!fs.existsSync(pagesRoot)) return 0;
    const pageIds = fs.readdirSync(pagesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    for (const pageId of pageIds) readPageData(project, pageId, { required: false });
    return pageIds.length;
}

function withNoindexRobotsMeta(html) {
    const marker = '<meta name="robots" content="noindex">';
    const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)];
    for (const match of metaTags) {
        if (/\bname\s*=\s*(?:"robots"|'robots'|robots(?=[\s/>]))/i.test(match[0])) {
            return `${html.slice(0, match.index)}${marker}${html.slice(match.index + match[0].length)}`;
        }
    }

    const head = /<head(?:\s[^>]*)?>/i.exec(html);
    if (head) {
        const insertAt = head.index + head[0].length;
        return `${html.slice(0, insertAt)}\n    ${marker}${html.slice(insertAt)}`;
    }
    const document = /<html(?:\s[^>]*)?>/i.exec(html);
    if (document) {
        const insertAt = document.index + document[0].length;
        return `${html.slice(0, insertAt)}\n<head>${marker}</head>${html.slice(insertAt)}`;
    }
    return `${marker}\n${html}`;
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function createSitemap(project, outputs) {
    const base = new URL(project.config.site.url);
    if (!base.pathname.endsWith("/")) base.pathname += "/";
    const entries = outputs
        .filter(({ page }) => page.sitemap !== false && page.noindex !== true)
        .map(({ pageId }) => {
            const location = new URL(`${encodeURIComponent(pageId)}.html`, base).href;
            return `  <url>\n    <loc>${escapeXml(location)}</loc>\n  </url>`;
        });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
}

function compileStyles(registry, componentIds) {
    const css = componentIds
        .map((componentId) => sass.compile(registry[componentId].stylesheet, {
            style: "compressed",
            loadPaths: [path.dirname(registry[componentId].stylesheet)],
        }).css.replace(/url\((['"]?)(?:\.\/)?assets\//g, `url($1components/${componentId}/assets/`))
        .filter(Boolean)
        .join("\n");
    return css;
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

function processProjectAssets(project, outputRoot) {
    const assetsRoot = project.paths.assets.absolute;
    const outputAssetsRoot = path.join(outputRoot, "assets");
    const stylesheets = [];
    const files = collectFiles(assetsRoot);

    for (const sourcePath of files) {
        const relativePath = path.relative(assetsRoot, sourcePath);
        const extension = path.extname(sourcePath).toLowerCase();
        if (extension === ".scss") {
            if (path.basename(sourcePath).startsWith("_")) continue;
            const cssPath = relativePath.replace(/\.scss$/i, ".css");
            if (cssPath === "shorty.css" || cssPath.startsWith(`pages${path.sep}`) || cssPath.startsWith(`components${path.sep}`)) {
                throw new Error(`Asset-Pfad ist für Shorty-Ausgaben reserviert: '${cssPath}'.`);
            }
            const outputPath = path.join(outputAssetsRoot, cssPath);
            if (files.some((candidate) => path.relative(assetsRoot, candidate) === cssPath)) {
                throw new Error(`Asset-Konflikt: SCSS und CSS erzeugen denselben Ausgabepfad '${cssPath}'.`);
            }
            const result = sass.compile(sourcePath, {
                style: "compressed",
                loadPaths: [assetsRoot, project.root],
            });
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, result.css + "\n", "utf8");
            stylesheets.push(`assets/${cssPath.split(path.sep).join("/")}`);
            continue;
        }

        if (relativePath === "shorty.css" || relativePath.startsWith(`pages${path.sep}`) || relativePath.startsWith(`components${path.sep}`)) {
            throw new Error(`Asset-Pfad ist für Shorty-Ausgaben reserviert: '${relativePath}'.`);
        }
        const outputPath = path.join(outputAssetsRoot, relativePath);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.copyFileSync(sourcePath, outputPath);
        if (extension === ".css") {
            stylesheets.push(`assets/${relativePath.split(path.sep).join("/")}`);
        }
    }
    return [...new Set(stylesheets)].sort((a, b) => a.localeCompare(b));
}

function addAssetReferences(html, pageId, hasStyles, scriptComponents, globalStylesheets) {
    let output = html;
    const stylesheetLinks = [
        ...(hasStyles ? ['<link rel="stylesheet" href="assets/shorty.css">'] : []),
        ...globalStylesheets.map((href) => `<link rel="stylesheet" href="${href}">`),
    ];
    if (stylesheetLinks.length > 0) {
        const links = stylesheetLinks.join("\n");
        output = /<\/head\s*>/i.test(output)
            ? output.replace(/<\/head\s*>/i, `${links}\n</head>`)
            : `${links}\n${output}`;
    }

    if (scriptComponents.length > 0) {
        const script = `<script type="module" src="assets/pages/${pageId}.js"></script>`;
        output = /<\/body\s*>/i.test(output)
            ? output.replace(/<\/body\s*>/i, `${script}\n</body>`)
            : `${output}\n${script}`;
    }
    return output;
}

function writeAssets(project, registry, outputs, outputRoot) {
    const usedComponents = [...new Set(outputs.flatMap((page) => page.componentIds))]
        .sort((a, b) => a.localeCompare(b));
    const css = compileStyles(registry, usedComponents);
    const assetsRoot = path.join(outputRoot, "assets");
    const globalStylesheets = processProjectAssets(project, outputRoot);

    if (css.trim()) {
        fs.mkdirSync(assetsRoot, { recursive: true });
        fs.writeFileSync(path.join(assetsRoot, "shorty.css"), css + "\n", "utf8");
    }

    for (const page of outputs) {
        const scripts = page.componentIds.filter((componentId) => fs.existsSync(registry[componentId].script));
        page.html = addAssetReferences(
            page.html,
            page.pageId,
            Boolean(css.trim()),
            scripts,
            globalStylesheets
        );
        if (scripts.length === 0) continue;

        const componentOutputRoot = path.join(assetsRoot, "components");
        fs.mkdirSync(path.join(assetsRoot, "pages"), { recursive: true });
        const imports = scripts.map((componentId) => `import "../components/${componentId}/${componentId}.js";`);
        fs.writeFileSync(path.join(assetsRoot, "pages", `${page.pageId}.js`), `${imports.join("\n")}\n`, "utf8");

        for (const componentId of page.componentIds) {
            const targetDirectory = path.join(componentOutputRoot, componentId);
            const sourceRoot = registry[componentId].directory;
            for (const sourcePath of collectFiles(sourceRoot)) {
                const relativePath = path.relative(sourceRoot, sourcePath);
                const isScript = path.extname(sourcePath) === ".js";
                const isComponentAsset = relativePath.startsWith(`assets${path.sep}`);
                if ((scripts.includes(componentId) && isScript) || isComponentAsset) {
                    const destination = path.join(targetDirectory, relativePath);
                    fs.mkdirSync(path.dirname(destination), { recursive: true });
                    fs.copyFileSync(sourcePath, destination);
                }
            }
        }
    }
}

function pathExists(filePath) {
    try {
        fs.lstatSync(filePath);
        return true;
    } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
    }
}

function isInside(parent, candidate) {
    const relative = path.relative(parent, candidate);
    return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function resolveSafeOutput(project) {
    const projectRoot = fs.realpathSync(project.root);
    const outputRoot = path.resolve(project.paths.output.absolute);
    if (!isInside(projectRoot, outputRoot) || outputRoot === projectRoot) {
        throw new Error("Das Ausgabeverzeichnis muss innerhalb des Projekts liegen und darf nicht dessen Wurzel sein.");
    }

    const relative = path.relative(projectRoot, outputRoot);
    let current = projectRoot;
    const segments = relative.split(path.sep);
    for (let index = 0; index < segments.length; index += 1) {
        current = path.join(current, segments[index]);
        if (!pathExists(current)) break;
        const stats = fs.lstatSync(current);
        if (stats.isSymbolicLink()) {
            throw new Error(`Das Ausgabeverzeichnis darf keine symbolischen Links enthalten: ${current}`);
        }
        if (index < segments.length - 1 && !stats.isDirectory()) {
            throw new Error(`Ein übergeordnetes Ausgabeverzeichnis ist kein Verzeichnis: ${current}`);
        }
        if (index === segments.length - 1 && !stats.isDirectory()) {
            throw new Error(`Das Ausgabeverzeichnis ist kein Verzeichnis: ${current}`);
        }
    }

    for (const [key, entry] of Object.entries(project.paths)) {
        if (key === "output") continue;
        const sourcePath = path.resolve(entry.absolute);
        let sourceRealPath = sourcePath;
        const missingSegments = [];
        while (!pathExists(sourceRealPath)) {
            const parent = path.dirname(sourceRealPath);
            if (parent === sourceRealPath) break;
            missingSegments.push(path.basename(sourceRealPath));
            sourceRealPath = parent;
        }
        sourceRealPath = path.join(fs.realpathSync(sourceRealPath), ...missingSegments.reverse());
        if (isInside(sourceRealPath, outputRoot) || isInside(outputRoot, sourceRealPath)) {
            throw new Error(`Das Ausgabeverzeichnis überschneidet sich mit dem Quellpfad "${key}".`);
        }
    }

    return {
        projectRoot,
        outputRoot,
        outputParent: path.dirname(outputRoot),
        outputName: path.basename(outputRoot),
    };
}

function getTransactionPaths(outputContext, transactionId = null) {
    const outputKey = crypto.createHash("sha256")
        .update(path.relative(outputContext.projectRoot, outputContext.outputRoot))
        .digest("hex")
        .slice(0, 16);
    const journalPath = path.join(
        outputContext.outputParent,
        `.${outputContext.outputName}.shorty-${outputKey}.transaction.json`
    );
    if (!transactionId) return { outputKey, journalPath };
    const prefix = `.${outputContext.outputName}.shorty-${outputKey}-${transactionId}`;
    return {
        outputKey,
        journalPath,
        markerPath: path.join(outputContext.outputParent, `${prefix}.marker`),
        stagePath: path.join(outputContext.outputParent, `${prefix}.stage`),
        backupPath: path.join(outputContext.outputParent, `${prefix}.backup`),
    };
}

function writeTransaction(journalPath, transaction, options = {}) {
    const temporaryPath = `${journalPath}.${process.pid}.${transaction.id}.tmp`;
    try {
        const descriptor = fs.openSync(temporaryPath, "wx", 0o600);
        try {
            fs.writeFileSync(descriptor, `${JSON.stringify(transaction)}\n`, "utf8");
            fs.fsyncSync(descriptor);
        } finally {
            fs.closeSync(descriptor);
        }
        if (options.exclusive) {
            fs.linkSync(temporaryPath, journalPath);
            fs.unlinkSync(temporaryPath);
        } else {
            fs.renameSync(temporaryPath, journalPath);
        }
    } catch (error) {
        try {
            fs.unlinkSync(temporaryPath);
        } catch (cleanupError) {
            if (cleanupError.code !== "ENOENT") {
                error.message += `; temporäre Wiederherstellungsdatei bleibt bestehen: ${temporaryPath}`;
            }
        }
        throw error;
    }
}

function readTransaction(outputContext, transactionPaths) {
    let transaction;
    try {
        transaction = JSON.parse(fs.readFileSync(transactionPaths.journalPath, "utf8"));
    } catch (error) {
        throw new Error(`Build-Wiederherstellungsdatei kann nicht gelesen werden (${transactionPaths.journalPath}): ${error.message}`);
    }
    if (
        transaction?.version !== 1 ||
        !/^[0-9a-f-]{36}$/.test(transaction.id || "") ||
        !["building", "ready", "backed-up", "promoting", "committed"].includes(transaction.state) ||
        typeof transaction.hadOutput !== "boolean" ||
        !Number.isInteger(transaction.pid)
    ) {
        throw new Error(`Build-Wiederherstellungsdatei hat ein ungültiges Format: ${transactionPaths.journalPath}`);
    }
    return { transaction, paths: getTransactionPaths(outputContext, transaction.id) };
}

function processIsAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === "EPERM";
    }
}

function assertManagedDirectory(directoryPath, label) {
    if (!pathExists(directoryPath)) return false;
    const stats = fs.lstatSync(directoryPath);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new Error(`Das ${label} ist kein reguläres Verzeichnis: ${directoryPath}`);
    }
    return true;
}

function hasTransactionMarker(directoryPath, markerName, transactionId) {
    const markerPath = path.join(directoryPath, markerName);
    if (!pathExists(markerPath)) return false;
    const stats = fs.lstatSync(markerPath);
    if (stats.isSymbolicLink() || !stats.isFile()) return false;
    try {
        return JSON.parse(fs.readFileSync(markerPath, "utf8")).id === transactionId;
    } catch {
        return false;
    }
}

function removeManagedDirectory(directoryPath, label) {
    if (!assertManagedDirectory(directoryPath, label)) return;
    fs.rmSync(directoryPath, { recursive: true, force: false });
}

function recoverOutputTransaction(project, outputContext, options = {}) {
    const initialPaths = getTransactionPaths(outputContext);
    if (!pathExists(initialPaths.journalPath)) return false;

    const { transaction, paths } = readTransaction(outputContext, initialPaths);
    if (transaction.pid !== options.ignorePid && processIsAlive(transaction.pid)) {
        throw new Error(`Ein anderer Shorty-Build läuft bereits (PID ${transaction.pid}); Transaktion: ${initialPaths.journalPath}`);
    }

    const outputExists = assertManagedDirectory(outputContext.outputRoot, "Ausgabeverzeichnis");
    const stageExists = assertManagedDirectory(paths.stagePath, "Staging-Verzeichnis");
    const backupExists = assertManagedDirectory(paths.backupPath, "Backup-Verzeichnis");
    const markerName = path.basename(paths.markerPath);
    const outputHasMarker = outputExists && hasTransactionMarker(outputContext.outputRoot, markerName, transaction.id);

    if (transaction.state === "committed") {
        if (!outputExists && transaction.hadOutput && backupExists) {
            fs.renameSync(paths.backupPath, outputContext.outputRoot);
        } else if (!outputExists && transaction.hadOutput) {
            throw new Error(`Weder aktuelle noch vorherige Build-Ausgabe ist vorhanden; Backup erwartet unter ${paths.backupPath}`);
        } else if (outputExists && pathExists(path.join(outputContext.outputRoot, markerName))) {
            if (!outputHasMarker) throw new Error(`Transaktionsmarker in der Ausgabe ist ungültig: ${outputContext.outputRoot}`);
            fs.unlinkSync(path.join(outputContext.outputRoot, markerName));
        }
        removeManagedDirectory(paths.stagePath, "Staging-Verzeichnis");
        removeManagedDirectory(paths.backupPath, "Build-Backup");
    } else {
        if (transaction.hadOutput) {
            if (backupExists) {
                if (outputExists) {
                    if (!outputHasMarker) {
                        throw new Error(`Ausgabe und Backup sind gleichzeitig vorhanden, aber die Ausgabe gehört nicht eindeutig zur Transaktion. Sicherung bleibt erhalten: ${paths.backupPath}`);
                    }
                    removeManagedDirectory(outputContext.outputRoot, "nicht bestätigte Build-Ausgabe");
                }
                fs.renameSync(paths.backupPath, outputContext.outputRoot);
            } else if (!outputExists) {
                throw new Error(`Vorherige Ausgabe und Backup fehlen; Wiederherstellung nicht möglich. Transaktion: ${initialPaths.journalPath}`);
            }
        } else if (transaction.state === "promoting" && outputExists) {
            if (!outputHasMarker) {
                throw new Error(`Die Ausgabe kann nicht sicher als unbestätigte Transaktion erkannt werden; sie bleibt erhalten: ${outputContext.outputRoot}`);
            }
            removeManagedDirectory(outputContext.outputRoot, "nicht bestätigte Build-Ausgabe");
        } else if (!transaction.hadOutput && outputExists && transaction.state !== "promoting") {
            throw new Error(`Unerwartete Ausgabe während der Wiederherstellung; sie bleibt erhalten: ${outputContext.outputRoot}`);
        }
        removeManagedDirectory(paths.stagePath, "Staging-Verzeichnis");
        removeManagedDirectory(paths.backupPath, "Build-Backup");
    }

    if (pathExists(initialPaths.journalPath)) fs.unlinkSync(initialPaths.journalPath);
    return true;
}

function createStagingParent(outputContext) {
    const missing = [];
    let current = outputContext.outputParent;
    while (!pathExists(current)) {
        missing.push(current);
        const parent = path.dirname(current);
        if (parent === current) throw new Error(`Übergeordnetes Ausgabeverzeichnis kann nicht gefunden werden: ${current}`);
        current = parent;
    }
    const existingStats = fs.lstatSync(current);
    if (existingStats.isSymbolicLink() || !existingStats.isDirectory()) {
        throw new Error(`Übergeordnetes Ausgabeverzeichnis ist unsicher oder kein Verzeichnis: ${current}`);
    }
    for (const directory of missing.reverse()) fs.mkdirSync(directory);
}

function promoteOutput(project, outputContext, transaction, paths) {
    const outputExists = assertManagedDirectory(outputContext.outputRoot, "Ausgabeverzeichnis");
    if (outputExists !== transaction.hadOutput) {
        throw new Error("Das Ausgabeverzeichnis wurde während des Builds unerwartet verändert.");
    }

    if (transaction.hadOutput) {
        fs.renameSync(outputContext.outputRoot, paths.backupPath);
        transaction.state = "backed-up";
        writeTransaction(paths.journalPath, transaction);
    } else {
        transaction.state = "promoting";
        writeTransaction(paths.journalPath, transaction);
    }

    fs.renameSync(paths.stagePath, outputContext.outputRoot);
    transaction.state = "committed";
    writeTransaction(paths.journalPath, transaction);
}

function buildProject(project) {
    const outputContext = resolveSafeOutput(project);
    recoverOutputTransaction(project, outputContext);

    const pagesRoot = project.paths.pages.absolute;
    if (!fs.existsSync(pagesRoot)) throw new Error(`Seitenverzeichnis fehlt: ${project.paths.pages.relative}`);

    const registry = readComponentRegistry(project);
    const pages = fs.readdirSync(pagesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
    if (pages.length === 0) throw new Error("Keine Seiten gefunden.");

    const outputs = [];
    for (const pageId of pages) {
        if (!PAGE_ID_PATTERN.test(pageId)) throw new Error(`Ungültige Seiten-ID: ${pageId}`);
        const template = path.join(pagesRoot, pageId, `${pageId}.tpl`);
        if (!fs.existsSync(template) || !fs.statSync(template).isFile()) {
            throw new Error(`Seitentemplate fehlt: ${path.relative(project.root, template)}`);
        }

        const page = readPageData(project, pageId);
        const components = loadPageComponents(project, pageId, template, registry);
        outputs.push({
            pageId,
            page,
            componentIds: components.componentIds,
            html: page.noindex === true
                ? withNoindexRobotsMeta(renderPage(project, template, page, components.data))
                : renderPage(project, template, page, components.data),
        });
    }

    createStagingParent(outputContext);
    const transactionId = crypto.randomUUID();
    const paths = getTransactionPaths(outputContext, transactionId);
    const transaction = {
        version: 1,
        id: transactionId,
        pid: process.pid,
        state: "building",
        hadOutput: assertManagedDirectory(outputContext.outputRoot, "Ausgabeverzeichnis"),
    };
    if (pathExists(paths.stagePath) || pathExists(paths.backupPath) || pathExists(paths.journalPath)) {
        throw new Error(`Build-Transaktionspfad ist bereits belegt: ${paths.journalPath}`);
    }

    try {
        writeTransaction(paths.journalPath, transaction, { exclusive: true });
        fs.mkdirSync(paths.stagePath);
        writeAssets(project, registry, outputs, paths.stagePath);
        for (const { pageId, html } of outputs) {
            fs.writeFileSync(path.join(paths.stagePath, `${pageId}.html`), html, { encoding: "utf8" });
        }
        fs.writeFileSync(path.join(paths.stagePath, "sitemap.xml"), createSitemap(project, outputs), { encoding: "utf8" });
        fs.writeFileSync(
            path.join(paths.stagePath, path.basename(paths.markerPath)),
            `${JSON.stringify({ id: transactionId })}\n`,
            { encoding: "utf8", flag: "wx" }
        );
        transaction.state = "ready";
        writeTransaction(paths.journalPath, transaction);

        // Recheck immediately before the only operation that replaces the configured output.
        resolveSafeOutput(project);
        promoteOutput(project, outputContext, transaction, paths);
    } catch (error) {
        try {
            recoverOutputTransaction(project, outputContext, { ignorePid: process.pid });
        } catch (recoveryError) {
            throw new Error(`${error.message}; automatische Wiederherstellung fehlgeschlagen: ${recoveryError.message}. Wiederherstellungsdatei: ${paths.journalPath}`);
        }
        throw error;
    }

    // The committed output is authoritative. If cleanup is interrupted, the committed
    // journal lets the next build remove the backup without rolling back the new output.
    try {
        fs.unlinkSync(path.join(outputContext.outputRoot, path.basename(paths.markerPath)));
        removeManagedDirectory(paths.backupPath, "Build-Backup");
        fs.unlinkSync(paths.journalPath);
    } catch (error) {
        console.warn(`Build-Ausgabe wurde bereitgestellt, Transaktionsbereinigung steht noch aus: ${error.message}`);
    }
    return outputs.map(({ pageId }) => pageId);
}

module.exports = { buildProject, createSitemap, validateProjectPages };
