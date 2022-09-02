import fs from 'fs';
import { BackgroundProcess, escapeChar, escapeRegex, exec } from './utils.mjs';

/**
 * @param {string} buildDirPath 
 * @param {string} fileName 
 * @param {string} title - If not defined, {@link fileName} will be used instead.
 * @returns BackgroundProcess
 */
export async function capture(buildDirPath, fileName, title = undefined) {
    title ??= fileName;
    
    const childProcess = preview(buildDirPath, fileName, title, true);
    try {
        for (let attempts = 1; ; ++attempts) {
            try {
                const windowId = await exec(
                    'xdotool',
                    ['search', '--all', '--pid', childProcess.pid(), '--name', escapeRegex(title)],
                    { readStdOut: true }
                );

                // FIXME: time to time captures another window when running via podman?
                const e = (await exec(
                    'import',
                    ['-trim', '-window', windowId.trim(), `${fileName}.ui.png`],
                    { readStdErr: true }
                )).trim();

                if (e) {
                    throw new Error(e);
                }

                return childProcess;
            } catch (e) {
                const maxAttempts = 10;
                if (attempts >= maxAttempts) {
                    throw e;
                } else {
                    const timeoutMs = attempts * 500; // 500ms, 1000ms, etc
                    console.log(`🔃 Failed to capture window (attempt ${attempts}/${maxAttempts}), retry in ${timeoutMs} ms...`);
                    console.log();
                    await new Promise(r => setTimeout(r, timeoutMs));
                }
            }
        }
    } catch (e) {
        childProcess.kill();
        throw e;
    }
}

/**
 * @param {string} buildDirPath 
 * @param {string} fileName 
 * @param {string} title - If not defined, {@link fileName} will be used instead.
 * @param {boolean} protect
 * @returns BackgroundProcess
 */
export function preview(buildDirPath, fileName, title = undefined, protect = false) {
    title ??= fileName;

    const QT = "'";
    const args = [buildDirPath, fileName, title, protect].map(
        arg => typeof arg === 'string' ? QT + escapeChar(arg, QT) + QT : String(arg)
    );

    const childProcess = new BackgroundProcess(
        'gjs',
        [`--include-path=${buildDirPath}`, `--include-path=${process.cwd()}/scripts/gjs`]
    );
    try {
        childProcess.write(`new imports['ui-preview'].UiPreview(${args}).run([])`);
        childProcess.close();
        return childProcess;
    } catch (e) {
        childProcess.kill();
        throw e;
    }
}

/**
 * @param {string} filePath
 * @return {Promise}
 */
export function lint(filePath) {
    if (!process.env['GNOME_TERMINAL_SCREEN']) {
        // FIXME: Running validator outside of Xorg or something hangs it.
        console.log('🚧 Running in a container; unable to validate UI file:', filePath);
        return Promise.resolve();
    }

    return exec('gtk4-builder-tool', ['validate', filePath]);
}
