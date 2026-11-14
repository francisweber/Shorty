const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;

const COMPONENT_METADATA_SCHEMA_PATH = path.resolve(
    __dirname,
    "../../../schemas/component-metadata.schema.json"
);

function isValidComponentName(name) {
    return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name);
}

function formatValidationErrors(errors = []) {
    return errors.map((error) => {
        const location = error.instancePath || "/";
        return `${location}: ${error.message}`;
    });
}

function validateMetadata(metadata, schemaPath = COMPONENT_METADATA_SCHEMA_PATH) {
    if (!fs.existsSync(schemaPath)) {
        return {
            valid: false,
            missingSchema: true,
            errors: [`Metadatenschema nicht gefunden: ${schemaPath}`]
        };
    }

    let metadataSchema;

    try {
        metadataSchema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    } catch (error) {
        return {
            valid: false,
            errors: [`Metadatenschema kann nicht gelesen werden: ${error.message}`]
        };
    }

    const ajv = new Ajv2020({ allErrors: true, strict: true });

    try {
        const validate = ajv.compile(metadataSchema);

        if (!validate(metadata)) {
            return { valid: false, errors: formatValidationErrors(validate.errors) };
        }

        if (!ajv.validateSchema(metadata.dataSchema)) {
            return { valid: false, errors: formatValidationErrors(ajv.errors) };
        }

        return { valid: true, errors: [] };
    } catch (error) {
        return { valid: false, errors: [error.message] };
    }
}

function inspectComponent(name, project) {
    const componentDirectory = path.join(project.paths.components.absolute, name);
    const metadataPath = path.join(componentDirectory, `${name}.json`);
    const result = { name, status: "valid", errors: [], missingSchema: false };

    if (!isValidComponentName(name)) {
        result.status = "invalid";
        result.errors.push("Ungültiger Komponentenname.");
        return result;
    }

    if (!fs.existsSync(componentDirectory)) {
        result.status = "incomplete";
        result.errors.push("Komponentenverzeichnis fehlt.");
        return result;
    }

    for (const filename of [`${name}.json`, `${name}.tpl`, `${name}.scss`]) {
        const filePath = path.join(componentDirectory, filename);

        try {
            if (!fs.existsSync(filePath)) {
                result.errors.push(`Pflichtdatei fehlt: ${filename}`);
                continue;
            }

            const stats = fs.statSync(filePath);
            if (!stats.isFile()) {
                result.errors.push(`Keine reguläre Datei: ${filename}`);
            } else if (stats.size === 0 && filename !== `${name}.json`) {
                result.errors.push(`Pflichtdatei ist leer: ${filename}`);
            }
        } catch (error) {
            result.errors.push(`Datei kann nicht geprüft werden (${filename}): ${error.message}`);
        }
    }

    if (!fs.existsSync(metadataPath)) {
        result.status = "incomplete";
    } else {
        let metadata;

        try {
            metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
        } catch (error) {
            result.status = "invalid";
            result.errors.push(`JSON-Fehler: ${error.message}`);
        }

        if (metadata !== undefined) {
            const validation = validateMetadata(metadata);
            if (!validation.valid) {
                result.status = "invalid";
                result.errors.push(...validation.errors);
                result.missingSchema = Boolean(validation.missingSchema);
            }
        }
    }

    if (result.status === "valid" && result.errors.length > 0) {
        result.status = "incomplete";
    }

    return result;
}

function discoverComponents(project) {
    const componentsRoot = project.paths.components.absolute;
    if (!fs.existsSync(componentsRoot)) return [];

    return fs.readdirSync(componentsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => inspectComponent(name, project));
}

module.exports = {
    discoverComponents,
    inspectComponent,
    isValidComponentName,
    validateMetadata
};
