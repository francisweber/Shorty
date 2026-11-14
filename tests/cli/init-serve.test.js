const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const CLI_PATH = path.resolve(__dirname, "../../bin/shorty-container.js");

async function reservePort() {
    const server = http.createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    return port;
}

async function waitFor(check, description, processHandle, getLogs) {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
        if (processHandle.exitCode !== null) {
            throw new Error(`Serve-Prozess wurde beendet. ${getLogs()}`);
        }
        if (await check()) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Zeitüberschreitung: ${description}. ${getLogs()}`);
}

function getText(url) {
    return fetch(url).then(async (response) => ({
        status: response.status,
        contentType: response.headers.get("content-type"),
        body: await response.text(),
    }));
}

function waitForReload(url) {
    return new Promise((resolve, reject) => {
        const request = http.get(url, (response) => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => {
                body += chunk;
                if (body.includes("data: reload")) {
                    clearTimeout(timeout);
                    request.destroy();
                    resolve();
                }
            });
        });
        const timeout = setTimeout(() => {
            request.destroy();
            reject(new Error("Der Serve-Server hat kein Reload-Ereignis gesendet."));
        }, 10000);
        request.on("error", (error) => {
            if (error.code !== "ECONNRESET") reject(error);
        });
    });
}

test("shorty init creates a neutral minimal page served with live reload", async (context) => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-init-serve-"));
    const projectRoot = path.join(temporaryRoot, "starter-project");
    context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

    const init = spawnSync(process.execPath, [CLI_PATH, "init", projectRoot], {
        cwd: temporaryRoot,
        encoding: "utf8",
    });
    assert.equal(init.status, 0, init.stderr);

    const configPath = path.join(projectRoot, "shorty.config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    assert.deepEqual(config.site, { url: "" });
    config.site.url = "https://example.test/";
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const port = await reservePort();
    const serve = spawn(process.execPath, [CLI_PATH, "serve", String(port)], {
        cwd: projectRoot,
        stdio: ["ignore", "pipe", "pipe"],
    });
    let logs = "";
    serve.stdout.setEncoding("utf8").on("data", (chunk) => { logs += chunk; });
    serve.stderr.setEncoding("utf8").on("data", (chunk) => { logs += chunk; });
    context.after(async () => {
        if (serve.exitCode === null) {
            serve.kill("SIGTERM");
            await new Promise((resolve) => serve.once("exit", resolve));
        }
    });

    const origin = `http://127.0.0.1:${port}`;
    await waitFor(async () => {
        try {
            return (await getText(`${origin}/`)).status === 200;
        } catch {
            return false;
        }
    }, "die minimale Beispielseite sollte erreichbar sein", serve, () => logs);

    const page = await getText(`${origin}/`);
    assert.match(page.body, /Meine Website/);
    assert.match(page.body, /minimale Startseite/);
    assert.doesNotMatch(page.body, /Beispielkomponenten|Primärer Button|Formularfelder/);
    assert.match(page.body, /EventSource\("\/__shorty\/events"\)/);

    const baseCss = await getText(`${origin}/assets/styles/base.css`);
    assert.equal(baseCss.status, 200);
    assert.match(baseCss.body, /font-family:\s*system-ui,sans-serif/);

    const reload = waitForReload(`${origin}/__shorty/events`);
    const stylesheetPath = path.join(projectRoot, "assets", "styles", "base.scss");
    const originalStylesheet = fs.readFileSync(stylesheetPath, "utf8");
    fs.writeFileSync(stylesheetPath, originalStylesheet.replace("system-ui", "serif"));

    await reload;
    await waitFor(async () => {
        const response = await getText(`${origin}/assets/styles/base.css`);
        return /font-family:\s*serif,sans-serif/.test(response.body);
    }, "das geänderte neutrale SCSS sollte neu gebaut und ausgeliefert werden", serve, () => logs);
});
