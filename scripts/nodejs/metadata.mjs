import * as fs from 'fs/promises';
import * as git from './git.mjs';

const jsonEncoding = 'ascii';

/**
 * @param {string} filePath
 * @returns {object} Package metadata object.
 */
export async function readPackageJson(filePath) {
    try {
        const fileBuffer = await fs.readFile(filePath);
        return JSON.parse(fileBuffer.toString(jsonEncoding));
    } catch (e) {
        throw new Error(`\
Unable to import package.json file: ${filePath}
Check that working directory is the extension project root directory and source files are present.
Working directory: ${process.cwd()}
${'-'.repeat(10)}
${e}
        `);
    }
}

/**
 * @param {string} filePath
 * @param {object} packageJson
 * @return {Promise}
 */
export function writePackageJson(filePath, packageJson) {
    return fs.writeFile(filePath, JSON.stringify(packageJson, null, 2));
}

/**
 * @param {string} filePath
 * @returns {object} Gnome Shell extension metadata object.
 */
 export async function readMetadata(filePath) {
    try {
        const fileBuffer = await fs.readFile(filePath);
        return JSON.parse(fileBuffer.toString(jsonEncoding));
    } catch (e) {
        throw new Error(`\
Unable to import extension metadata from file: ${filePath}
Check that working directory is the extension project root directory and source files are present.
Working directory: ${process.cwd()}
${'-'.repeat(10)}
${e}
        `);
    }
}

/**
 * @param {object} metadata - {@link readMetadata} call result.
 * @returns Metadata complemented with build information.
 */
export async function buildMetadata(metadata) {
    const buildTag = (await git.hasChanges())
        ? '+custom'
        : `+git-` + (await git.hash());
    return {
        ...metadata,
        'semantic-version': metadata['semantic-version'] + buildTag,
    };
}

/**
 * @param {object} metadata - call result of {@link readMetadata} function
 * (without build metadata, so not a call result of {@link buildMetadata} function).
 * @throws If metadata is invalid.
 */
export function validateReleaseTag(metadata) {
    const actualTag = git('tag', '--points-at').stdout.trim();
    if (!actualTag) {
        throw new Error('Current commit is not tagged.');
    }

    const expectedTag = `v${metadata['semantic-version']}-gnome${metadata["shell-version"].at(-1)}`;
    if (actualTag !== expectedTag) {
        throw new Error(
            `Metadata describes extension version '${expectedTag}', but current commit is tagged with '${actualTag}'.`
        );
    }
}
