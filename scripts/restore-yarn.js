#!/usr/bin/env node
/******************************************************************************
 * This script expected to run via `npm run` or `yarn run` with global package
 * manager before any dependencies get installed, so it can not use any of them.
 ******************************************************************************/
import { promises as fs } from 'fs';
import { basename } from 'path';
import { readMetadata, readPackageJson, writePackageJson } from './nodejs/metadata.mjs';
import { download, exec, downloadFile } from './nodejs/utils.mjs';

const [scriptInterpreter, scriptName, versionArg, ...extraArgs] = process.argv;

const metadataJsonPath = 'sources/metadata.json';
const packageJsonPath = 'package.json';
const yarnLockPath = 'yarn.lock';
const yarnrcYamlPath = '.yarnrc.yml';

const versionLatest = 'latest';
const versionPrefix = 'yarn@';
const versionMask = new RegExp(`^(${versionPrefix}|v)?([0-9.]+)$`);
let version = (versionArg?.match(versionMask) ?? [])[2];

try {
    if (extraArgs.length) {
        throw new Error('Too many arguments.');
    }
    if (versionArg !== undefined && versionArg !== versionLatest) {
        if (/(-|--|\/)?(h|help|\?)/i.test(versionArg)) {
            throw new Error(`Argument '${versionArg}' seems like help request.`);
        } else if (version === null) {
            throw new Error(`Argument '${versionArg}' does not seem like yarn version.`);
        }
    }
} catch (e) {
    console.log(`\
Simple Yarn restore script: it downloads and configures yarn package manager of version defined in '${packageJsonPath}' file. This script is supposed to be optional: other build scripts also should be able to run via 'npm run' or classic 'yarn run', though modern yarn is supposed as more efficient way to manage dependencies.

Usage:
    ${scriptInterpreter} scripts/${basename(scriptName)} [X.Y.Z|latest]

Where:
    X.Y.Z - is semantic version of yarn, e.g. 3.2.0. If 'X.Y.Z' or 'latest' argument is provided, '${packageJsonPath}' and '${yarnLockPath}' files will be updated.

See also:
    Further Yarn configuration: https://yarnpkg.com/configuration/yarnrc/

    `);
    throw e;
}

const metadataJson = await readMetadata(metadataJsonPath);
const packageJson = await readPackageJson(packageJsonPath);
const packageManagerKey = 'packageManager';
const nodeUserAgent = process.env['npm_config_user_agent'] ?? `nodejs/${process.version} ${process.platform} ${process.arch}`;
const httpHeaders = {
    'User-Agent': `${nodeUserAgent} (${basename(scriptName)}; +${metadataJson['url']})`,
};

if (versionArg === versionLatest) {
    const latestRelease = await download({
        hostname: 'api.github.com',
        path: '/repos/yarnpkg/berry/releases/latest',
        headers: httpHeaders,
    });
    version = JSON.parse(latestRelease)['name'].match(versionMask)[2];
} else if (version === undefined) {
    version = packageJson[packageManagerKey].match(versionMask)[2];
    if (version === undefined) {
        throw new Error(`${packageJsonPath} defines unsupported ${packageManagerKey}: '${packageJson[packageManagerKey]}'.`);
    }
} else {
    packageJson[packageManagerKey] = `yarn@${version}`;
    await writePackageJson(packageJsonPath, packageJson);
}

const yarnPath = 'yarnPath';
const yarnrcEncoding = 'utf-8';
const yarnrcContent = (await fs.readFile(yarnrcYamlPath, { flag: 'a+' }))
    .toString(yarnrcEncoding).trim().split('\n')
    .reduce((target, line) => {
        const [k, v] = line.split(':').map(v => v.trim());
        if (k || v) {
            target[k] = v;
        }
        return target;
    }, {});
yarnrcContent[yarnPath] = '.yarn/releases/yarn-berry.cjs';
await downloadFile(yarnrcContent[yarnPath], {
    hostname: 'repo.yarnpkg.com',
    path: `/${version}/packages/yarnpkg-cli/bin/yarn.js`,
    headers: httpHeaders,
});
await fs.writeFile(
    yarnrcYamlPath,
    Object.entries(yarnrcContent).map(([k, v]) => `${k}: ${v}`).join('\n'),
    { 'encoding': yarnrcEncoding }
);
await exec(
    'yarn',
    versionArg === undefined ? ['install', '--immutable'] : ['install'],
    { stdio: 'inherit' }
);
