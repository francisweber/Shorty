const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
    DEFAULT_PATHS,
    ProjectError,
    findProjectRoot,
    loadProject,
    resolveProjectPaths
} = require("../../src/core/project/project-loader");

const validSite = { url: "https://example.test/" };

function createProject(config = {
    configVersion: 1,
    project: { name: "test-project" },
    site: validSite
}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-project-"));

    fs.writeFileSync(
        path.join(root, "shorty.config.json"),
        JSON.stringify(config, null, 2)
    );

    return root;
}

test("findProjectRoot discovers the project from a nested directory", (context) => {
    const root = createProject();
    const nested = path.join(root, "src", "pages");

    fs.mkdirSync(nested, { recursive: true });
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    assert.equal(findProjectRoot(nested), fs.realpathSync(root));
});

test("loadProject applies all standard path defaults", (context) => {
    const root = createProject();
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const project = loadProject({ projectRoot: root });

    assert.equal(project.root, fs.realpathSync(root));
    assert.equal(project.name, "test-project");
    assert.deepEqual(
        Object.fromEntries(
            Object.entries(project.paths).map(([key, value]) => [
                key,
                value.relative
            ])
        ),
        DEFAULT_PATHS
    );
});

test("loadProject applies only the configured path overrides", (context) => {
    const root = createProject({
        configVersion: 1,
        project: { name: "custom-paths" },
        site: validSite,
        paths: {
            assets: "frontend/assets",
            output: "public"
        }
    });

    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const project = loadProject({ projectRoot: root });

    assert.equal(project.paths.assets.relative, "frontend/assets");
    assert.equal(project.paths.output.relative, "public");
    assert.equal(project.paths.components.relative, "components");
    assert.equal(project.paths.pages.relative, "pages");
});

test("loadProject rejects an unsupported configuration version", (context) => {
    const root = createProject({
        configVersion: 2,
        project: { name: "unsupported" },
        site: validSite
    });

    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    assert.throws(
        () => loadProject({ projectRoot: root }),
        (error) => error instanceof ProjectError &&
            error.code === "SHORTY_PROJECT_CONFIG_INVALID"
    );
});

test("resolveProjectPaths rejects duplicate paths", () => {
    const root = path.resolve(os.tmpdir(), "shorty-test-root");

    assert.throws(
        () => resolveProjectPaths(root, {
            assets: "shared",
            output: "shared"
        }),
        (error) => error instanceof ProjectError &&
            error.code === "SHORTY_PROJECT_PATH_COLLISION"
    );
});

test("resolveProjectPaths rejects output nested in a source directory", () => {
    const root = path.resolve(os.tmpdir(), "shorty-test-root");

    assert.throws(
        () => resolveProjectPaths(root, {
            output: "assets/generated"
        }),
        (error) => error instanceof ProjectError &&
            error.code === "SHORTY_PROJECT_OUTPUT_PATH_OVERLAP"
    );
});

test("findProjectRoot reports a missing project configuration", (context) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "shorty-no-project-"));
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));

    assert.throws(
        () => findProjectRoot(root),
        (error) => error instanceof ProjectError &&
            error.code === "SHORTY_PROJECT_CONFIG_NOT_FOUND"
    );
});
