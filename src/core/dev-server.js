const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { buildProject } = require("./site-builder");

const MIME_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".xml": "application/xml; charset=utf-8",
};

function isInside(parent, candidate) {
    const relative = path.relative(parent, candidate);
    return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function injectLiveReload(html) {
    const snippet = '<script>new EventSource("/__shorty/events").onmessage=()=>location.reload();</script>';
    return /<\/body\s*>/i.test(html)
        ? html.replace(/<\/body\s*>/i, `${snippet}</body>`)
        : `${html}\n${snippet}`;
}

function resolveRequestPath(requestPath, outputRoot) {
    let decoded;
    try {
        decoded = decodeURIComponent(requestPath);
    } catch {
        return null;
    }

    if (decoded === "/") {
        const indexPath = path.join(outputRoot, "index.html");
        if (fs.existsSync(indexPath)) return indexPath;
        const homePath = path.join(outputRoot, "home.html");
        if (fs.existsSync(homePath)) return homePath;
        const firstPage = fs.existsSync(outputRoot)
            ? fs.readdirSync(outputRoot)
                .filter((filename) => filename.endsWith(".html"))
                .sort((a, b) => a.localeCompare(b))[0]
            : null;
        return firstPage ? path.join(outputRoot, firstPage) : homePath;
    }

    const relativePath = decoded.replace(/^\/+/, "");
    let candidate = path.resolve(outputRoot, relativePath);
    if (!isInside(outputRoot, candidate)) return null;

    if (!path.extname(candidate)) candidate += ".html";
    return candidate;
}

function watchTree(root, onChange, watchers, watchedDirectories) {
    if (!fs.existsSync(root) || watchedDirectories.has(root)) return;
    let stats;
    try {
        stats = fs.statSync(root);
    } catch {
        return;
    }
    if (!stats.isDirectory()) return;

    watchedDirectories.add(root);
    let watcher;
    try {
        watcher = fs.watch(root, (eventType, filename) => {
            const changedPath = filename ? path.join(root, filename.toString()) : root;
            if (eventType === "rename" && fs.existsSync(changedPath)) {
                try {
                    if (fs.statSync(changedPath).isDirectory()) {
                        watchTree(changedPath, onChange, watchers, watchedDirectories);
                    }
                } catch {
                    // The path may disappear between the event and this check.
                }
            }
            onChange(changedPath);
        });
    } catch (error) {
        watchedDirectories.delete(root);
        console.error(`Dateiüberwachung nicht möglich (${root}): ${error.message}`);
        return;
    }
    watchers.push(watcher);

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
            watchTree(path.join(root, entry.name), onChange, watchers, watchedDirectories);
        }
    }
}

function snapshotTree(roots) {
    const snapshot = new Map();
    const visit = (candidate) => {
        let stats;
        try {
            stats = fs.lstatSync(candidate);
        } catch {
            return;
        }
        if (stats.isSymbolicLink()) return;
        snapshot.set(candidate, `${stats.isDirectory() ? "d" : "f"}:${stats.size}:${stats.mtimeMs}:${stats.ctimeMs}`);
        if (!stats.isDirectory()) return;
        let entries;
        try {
            entries = fs.readdirSync(candidate, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.name.startsWith(".")) visit(path.join(candidate, entry.name));
        }
    };
    for (const root of roots) visit(root);
    return snapshot;
}

function startDevelopmentServer(project, options = {}) {
    const port = options.port || 3000;
    const outputRoot = project.paths.output.absolute;
    buildProject(project);

    const clients = new Set();
    const server = http.createServer((request, response) => {
        const requestUrl = new URL(request.url, "http://127.0.0.1");
        if (requestUrl.pathname === "/__shorty/events") {
            response.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            });
            response.write(": connected\n\n");
            clients.add(response);
            request.on("close", () => clients.delete(response));
            return;
        }

        const filePath = resolveRequestPath(requestUrl.pathname, outputRoot);
        if (!filePath || !isInside(outputRoot, filePath) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Not found\n");
            return;
        }

        const extension = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
            "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
            "Cache-Control": "no-cache",
        });
        if (extension === ".html") {
            response.end(injectLiveReload(fs.readFileSync(filePath, "utf8")));
        } else {
            fs.createReadStream(filePath).pipe(response);
        }
    });

    let close = () => server.close();
    server.on("error", (error) => {
        console.error(`Serve-Server fehlgeschlagen: ${error.message}`);
        process.exitCode = 1;
        close();
    });
    const bindHost = options.host || process.env.SHORTY_BIND_HOST || "127.0.0.1";
    server.listen(port, bindHost, () => {
        console.log(`Shorty Serve läuft unter http://${bindHost}:${port}`);
        console.log("Mit Ctrl+C beenden.");
    });

    const watchers = [];
    const watchedDirectories = new Set();
    let rebuildTimer;
    let rebuilding = false;
    let rebuildPending = false;
    const notifyReload = () => {
        for (const client of clients) client.write("data: reload\n\n");
    };
    const rebuild = () => {
        if (rebuilding) {
            rebuildPending = true;
            return;
        }
        rebuilding = true;
        try {
            const pages = buildProject(project);
            console.log(`Build aktualisiert (${pages.length} Seite(n)).`);
            notifyReload();
        } catch (error) {
            console.error(`Build fehlgeschlagen: ${error.message}`);
        } finally {
            rebuilding = false;
            if (rebuildPending) {
                rebuildPending = false;
                rebuild();
            }
        }
    };
    const scheduleRebuild = (changedPath) => {
        if (changedPath && isInside(outputRoot, path.resolve(changedPath))) return;
        clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(rebuild, 150);
    };

    const watchRoots = ["components", "pages", "layouts", "data", "assets", "schemas"]
        .map((key) => project.paths[key].absolute);
    let pollingTimer;
    if (options.polling || process.env.SHORTY_POLL_WATCH === "1") {
        let previous = snapshotTree(watchRoots);
        pollingTimer = setInterval(() => {
            const current = snapshotTree(watchRoots);
            const changed = new Set([...previous.keys(), ...current.keys()]);
            const didChange = [...changed].some((candidate) => previous.get(candidate) !== current.get(candidate));
            previous = current;
            if (didChange) scheduleRebuild();
        }, options.pollInterval || 350);
        pollingTimer.unref?.();
    } else {
        for (const root of watchRoots) watchTree(root, scheduleRebuild, watchers, watchedDirectories);
    }

    close = () => {
        clearTimeout(rebuildTimer);
        clearInterval(pollingTimer);
        for (const watcher of watchers) watcher.close();
        for (const client of clients) client.end();
        server.close();
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);

    return { server, close };
}

module.exports = { snapshotTree, startDevelopmentServer };
