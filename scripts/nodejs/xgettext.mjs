import * as fs from 'fs/promises';
import path from 'path';
import { escapeChar, exec } from './utils.mjs';

/**
 * @param {string} potFilePath 
 * @param {{ [key: string]: string} } dictionary
 * @return {Promise}
 */
export function create(potFilePath, dictionary) {
    return fs.writeFile(
        potFilePath,
        Object.entries(dictionary).map(
            ([key, value]) => `msgid "${escapeChar(key, '"')}"\nmsgstr "${escapeChar(value, '"')}"`
        ).join('\n\n')
    );
}

/**
 * @param {string} language
 * @param {string[]} sourceFilePaths
 * @param {string} targetPotFilePath 
 * @return {Promise}
 */
export function extract(language, sourceFilePaths, targetPotFilePath) {
    return exec('xgettext', [
        '--join-existing',
        `--language=${language}`,
        `--output=${targetPotFilePath}`,
        ...sourceFilePaths
    ]);    
}

/**
 * @param {string} sourcePotFilePath
 * @param {string} targetPotFilePath
 * @param {string} outputPotFilePath - If not set, {@link targetPotFilePath} will be used.
 * @return {Promise}
 */
export function merge(sourcePotFilePath, targetPotFilePath, outputPotFilePath = undefined) {
    return exec('msgmerge', [
        '--previous',
        targetPotFilePath,
        sourcePotFilePath,
        ...(outputPotFilePath === undefined
            ? ['--update']
            : ['--output-file', outputPotFilePath]
        )
    ]);
}

/**
 * @param {string} sourcePoFilePath
 * @param {string} targetMoFilePath
 * @return {Promise}
 */
export async function compile(sourcePoFilePath, targetMoFilePath) {
    await fs.mkdir(path.dirname(targetMoFilePath), { recursive: true });
    await exec('msgfmt', ['-o', targetMoFilePath, sourcePoFilePath])
}
