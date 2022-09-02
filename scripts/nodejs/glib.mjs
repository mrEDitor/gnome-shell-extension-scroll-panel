import { exec } from "./utils.mjs";

/**
 * @param {string} targetSchemasFilePath 
 * @param {string} sourceXmlDirPath 
 * @return {Promise}
 */
export function compileSchemas(targetSchemasFilePath, sourceXmlDirPath) {
    return exec('glib-compile-schemas', [
        '--strict',
        `--targetdir=${targetSchemasFilePath}`,
        sourceXmlDirPath
    ]);
}
