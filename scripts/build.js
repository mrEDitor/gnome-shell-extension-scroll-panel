#!/usr/bin/env node
import archiver from 'archiver';
import cmdArgs from 'command-line-args';
import cmdUsage from 'command-line-usage';
import { existsSync, promises as fs } from 'fs';
import * as path from 'path';
import * as glib from './nodejs/glib.mjs';
import * as ui from './nodejs/ui.mjs';
import * as xgettext from './nodejs/xgettext.mjs';
import { lint } from './nodejs/linter.mjs';
import { buildMetadata, readMetadata, validateMetadata, validateReleaseTag } from './nodejs/metadata.mjs';
import { copyFile, unlinkFile } from './nodejs/utils.mjs';

const metadata = await readMetadata('sources/metadata.json');
const optionDefinitions = [
    {
        name: 'help',
        description: 'Show this message and exit.',
        type: Boolean,
    },
    {
        name: 'build-dir',
        defaultValue: './build',
        description: `Set directory to place built extension files to (default: './build').`,
        typeLabel: '{underline directory}',
    },
    {
        name: 'clean',
        description: 'Delete build directory before building.',
        type: Boolean,
    },
    {
        name: 'debug',
        description: 'Include debug module to build.',
        type: Boolean,
    },
    {
        name: 'with-sources',
        description: 'Include source files to build.',
        type: Boolean,
    },
    {
        name: 'lint',
        defaultValue: 'default',
        description: "Source files linting mode: 'default' (lint and fix, if possible), 'immutable' (lint, do not mutate files) or 'none'.",
        typeLabel: 'default|immutable|none',
    },
    {
        name: 'capture-ui',
        description: 'Capture preview image of specified filename.ui after build (as filename.ui.png).',
        multiple: true,
        type: fileName => fileName.replace(/.ui$/, ''),
        typeLabel: '{underline filename}[.ui]',
    },
    {
        name: 'preview-ui',
        description: 'Run live preview of specified filename.ui after build.',
        multiple: true,
        type: fileName => fileName.replace(/.ui$/, ''),
        typeLabel: '{underline filename}[.ui]',
    },
    {
        name: 'zip',
        description: `Pack build files to '${metadata['uuid']}.zip' archive under build directory; usable for publishing at https://extensions.gnome.org.`,
        type: Boolean,
    },
    {
        name: 'install',
        description: 'Install extension after build.',
        type: Boolean,
    },
    {
        name: 'install-dir',
        defaultValue: `${process.env.HOME}/.local/share/gnome-shell/extensions`,
        description: `Set base directory to place extension directory to for --install option (default: '${process.env.HOME}/.local/share/gnome-shell/extensions/').`,
        typeLabel: '{underline directory}',
    },
    {
        name: 'built',
        description: 'Do not rewrite build files but use existing ones for other operations (e.g. for lint or install).',
        type: Boolean,
    },
];

const args = cmdArgs(optionDefinitions, { partial: true });
if (args['help'] || args['_unknown']) {
    console.log(cmdUsage([
        {
            header: 'Build script usage',
            content: `${process.argv[0]} scripts/build.js [arguments]`,
            raw: true,
        },
        {
            header: 'Arguments (in order of application)',
            optionList: optionDefinitions,
        },
        {
            header: 'Status',
            content: [
                `Working directory: ${process.cwd()}`,
                `Found source files for: ${metadata['uuid']} v${(await buildMetadata(metadata))['semantic-version']}`,
                `Project homepage: ${metadata['url']}`,
            ],
            raw: true,
        },
    ]));

    if (args['_unknown']) {
        console.error('Unknown options provided', args['_unknown']);
        process.exit(1);
    } else {
        process.exit();
    }
}

if (args['clean']) {
    for (const fileName of await fs.readdir(args['build-dir'])) {
        await fs.rm(`${args['build-dir']}/${fileName}`, { recursive: true, force: true });
    }
}

if (args['built']) {
    await validateMetadata(await readMetadata(`${args['build-dir']}/metadata.json`));
    console.log('⏩ Build files considered up-to-date, skipping build...')
} else {
    await fs.mkdir(`${args['build-dir']}/locales`, { recursive: true });
    await fs.mkdir(`${args['build-dir']}/schemas`, { recursive: true });
    const potPatchFilePath = `${args['build-dir']}/locales.patch.pot`;
    try {
        const srcFileNamesByExt = {};
        for (const fileName of await fs.readdir('sources')) {
            srcFileNamesByExt[path.extname(fileName)] ??= [];
            srcFileNamesByExt[path.extname(fileName)].push(`sources/${fileName}`);
        }
        await xgettext.create(potPatchFilePath, { [metadata['description']]: '' });
        await xgettext.extract('JavaScript', srcFileNamesByExt['.js'], potPatchFilePath);
        await xgettext.extract('Glade', srcFileNamesByExt['.ui'], potPatchFilePath);

        const potMessagesFilePath = 'locales/messages.pot';
        await xgettext.merge(potPatchFilePath, potMessagesFilePath);
        for (const fileName of await fs.readdir('locales')) {
            const fileInfo = path.parse(fileName);
            if (fileInfo.ext === '.po') {
                const localeDirPath = `${args['build-dir']}/locales/${fileInfo.name}/LC_MESSAGES`;
                await fs.mkdir(localeDirPath, { recursive: true });
                await xgettext.merge(potMessagesFilePath, `locales/${fileName}`, `${localeDirPath}/${metadata['uuid']}.po`);
                await xgettext.compile(`${localeDirPath}/${metadata['uuid']}.po`, `${localeDirPath}/${metadata['uuid']}.mo`);
            }
        }

        for (const localeName of await fs.readdir(`${args['build-dir']}/locales`)) {
            const localeBasePath = `${args['build-dir']}/locales/${localeName}/LC_MESSAGES/${metadata['uuid']}`;
            switch (args['lint']) {
                case 'default':
                    if (!existsSync(`locales/${localeName}.po`)) {
                        console.log(`Missed or deleted locale file restored from build files during linting: 'locales/${localeName}.po'. To prevent this, see build option --lint or --clean.`);
                    }

                    await copyFile(`${localeBasePath}.po`, `locales/${localeName}.po`);
                    break;
                case 'immutable':
                    try {
                        const genFileBuffer = await fs.readFile(`${localeBasePath}.po`);
                        const srcFileBuffer = await fs.readFile(`locales/${localeName}.po`);

                        if (!genFileBuffer.equals(srcFileBuffer)) {
                            throw new Error(`There are some outdated locale files. See --linter option to fix or ignore these problems.`);
                        }

                        break;
                    } catch (e) {
                        console.error(`Linting locale file '${localeName}.po' failed, most probably it's missed or unavailable. See --linter option to fix or ignore this problems.`);
                        console.error();
                        throw e;
                    }
            }
        }
    } finally {
        await fs.rm(potPatchFilePath, { force: true });
    }

    copyBuildFiles(args['build-dir'], '.', 'sources');
    await glib.compileSchemas(`${args['build-dir']}/schemas`, 'schemas');

    await unlinkFile(`${args['build-dir']}/metadata.json`);
    await fs.writeFile(
        `${args['build-dir']}/metadata.json`,
        JSON.stringify(await buildMetadata(metadata), null, 2)
    );
}

switch (args['lint']) {
    case 'default':
    case 'immutable':
        await lint(args['lint'] === 'default');

        for (const fileName of await fs.readdir('sources')) {
            if (path.extname(fileName) === '.ui') {
                await ui.lint(`sources/${fileName}`);
            }
        }
}

for (const captureFileName of args['capture-ui'] ?? []) {
    const preview = await ui.capture(args['build-dir'], captureFileName, metadata['name']);
    preview.kill();
}

for (const previewFileName of args['preview-ui'] ?? []) {
    await ui.preview(args['build-dir'], previewFileName).wait();
}

if (args['zip']) {
    try {
        await validateReleaseTag(metadata);
    } catch (e) {
        console.error('An attempt to create zip distributable rejected since version is not properly tagged.');
        console.error();
        throw e;
    }

    const zip = archiver('zip');
    zip.pipe(fs.createWriteStream(`${args['build-dir']}/${metadata['uuid']}.zip`));
    zip.glob(`${args['build-dir']}/**/*`, { ignore: [ '**/!(*.zip)' ] });
    zip.finalize();
}

if (args['install']) {
    if (existsSync(`${args['install-dir']}/${metadata['uuid']}`)) {
        throw new Error(`Unable to install extension, path already exists: ${args['install-dir']}/${metadata['uuid']}`);
    }

    await copyBuildFiles(`${args['install-dir']}/${metadata['uuid']}`, args['build-dir']);
}

/**
 * @param {string} targetDirPath
 * @param {string} baseDirPath
 * @param {string} sourcesDirName - If provided, used to find source files to build and copy.
 * @return {Promise}
 */
 async function copyBuildFiles(targetDirPath, baseDirPath, sourcesDirName = undefined) {
    if (!args['debug']) {
        await fs.mkdir(targetDirPath, { recursive: true });
        await fs.writeFile(`${targetDirPath}/debug.js`, '');
    }
    await copyFiles(
        `${baseDirPath}/${sourcesDirName ?? '.'}`,
        targetDirPath,
        fileName => {
            switch (path.extname(fileName)) {
                case '.js':
                    return args['debug'] || fileName !== 'debug.js';
                case '.ui':
                    return true;
                case '.yml':
                    return args['with-sources'] || sourcesDirName !== undefined;
                default:
                    return args['with-sources'];
            }
        }
    );

    for (const dirName of await fs.readdir(`${baseDirPath}/locales`)) {
        if (!path.extname(dirName)) {
            await copyFiles(
                `${baseDirPath}/locales/${dirName}/LC_MESSAGES`,
                `${targetDirPath}/locales/${dirName}/LC_MESSAGES`,
                fileName => args['with-sources'] || path.extname(fileName) === '.mo'
            );
        }
    }

    await copyFiles(
        `${baseDirPath}/schemas`,
        `${targetDirPath}/schemas`,
        fileName => args['with-sources'] || fileName === 'gschemas.compiled'
    );
}

/**
 * @param {string} sourceDirPath
 * @param {string} targetDirPath
 * @param {(filename: string) => boolean} filter
 * @return {Promise}
 */
async function copyFiles(sourceDirPath, targetDirPath, filter) {
    await fs.mkdir(targetDirPath, { recursive: true });
    for (const fileName of (await fs.readdir(sourceDirPath)).filter(filter)) {
        console.log(`📝 Copying file '${sourceDirPath}/${fileName}' to '${targetDirPath}/${fileName}'`);
        await copyFile(`${sourceDirPath}/${fileName}`, `${targetDirPath}/${fileName}`);
    }
}
