#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';
import cmdArgs from 'command-line-args';
import cmdUsage from 'command-line-usage';
import * as git from './nodejs/git.mjs';
import { escapeChar, exec } from './nodejs/utils.mjs';
import { readMetadata } from './nodejs/metadata.mjs';

const optionDefinitions = [
    {
        name: 'help',
        description: 'Show this message, build script --help message, then exit.',
        type: Boolean,
    },
    {
        name: 'attach',
        description: 'Attach to the container after build and VNC, even if they failed. Useful for in-container problem diagnostics.',
        type: Boolean,
    },
    {
        name: 'fedora-version',
        defaultValue: 'latest',
        description: 'Version of Fedora to run Gnome Shell with.',
        typeLabel: '{underline version}',
    },
    {
        name: 'x11',
        description: `Run Gnome Shell with Xorg session instead of Wayland.`,
        type: Boolean,
    },
    {
        name: 'rm',
        description: 'After run remove the image generated by this script.',
        type: Boolean,
    },
    {
        name: 'run-vnc',
        description: "Run x0vncserver inside the container and bind it to specified port of host machine to allow password-less VNC access to it. Use '127.0.0.1:{underline port}' form to allow local access only. Runs after build, and even if it failed. Useful for in-container problem diagnostics or demonstration purposes.",
        typeLabel: '[127.0.0.1:]{underline port}',
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
        typeLabel: '{underline filename}[.ui]',
    },
    {
        name: 'preview-ui',
        description: 'Run live preview of specified filename.ui after build.',
        multiple: true,
        typeLabel: '{underline filename}[.ui]',
    },
    {
        name: 'install',
        description: 'Install extension after build.',
        type: Boolean,
    },
    {
        name: 'build-dir',
        defaultValue: 'build',
        description: "Set directory to place built extension files to (default: 'build'). If argument is provided, specified directory will be mounted to container as '../build' and corresponding argument will be passed to build script.",
        typeLabel: '{underline directory}',
    },
    {
        name: 'install-dir',
        defaultValue: '',
        description: "Set base directory to place extension directory to by --install option. Default location belongs to container itself, and may be useful for testing or demonstration purposes. But if this parameter is provided it will be treated as host filesystem path to perform a real installation; specified directory will be mounted to container as '../install' and corresponding argument will be passed to build script.",
        typeLabel: '{underline directory}',
    },
];

const args = cmdArgs(optionDefinitions, { partial: true });
if (args['help']) {
    console.log(cmdUsage([
        {
            header: 'Containerized Build script usage',
            content: `${process.argv[0]} scripts/podman.js [arguments]`,
            raw: true,
        },
        {
            header: 'Container arguments',
            optionList: optionDefinitions,
        },
        {
            header: 'Fedora known versions list (check for even fresher ones at https://hub.docker.com/_/fedora)',
            content: [
                { desc: 'Fedora 36', example: 'GNOME Shell 42.rc' },
                { desc: 'Fedora 35', example: 'GNOME Shell 41.4' },
                { desc: 'Fedora 34', example: 'GNOME Shell 40.8' },
                { desc: 'Fedora 33', example: 'GNOME Shell 3.38.5' },
                { desc: 'Fedora 32', example: 'GNOME Shell 3.36.9' },
            ],
        },
        {
            header: 'Build script options',
            content: 'This script will setup container for build script and demonstration and call build script inside the container. Options for the call are decided based on options provided to this script; all unknown options will be passed to build script as-is. Build script help page follows.',
        },
    ]));

    await exec(process.argv[0], ['scripts/build.js', '--help'], { passStdio: true });
    process.exit();
}

const metadata = await readMetadata('sources/metadata.json');
const tag = `gnome-${await git.hash('podman')}`;
await exec(
    'podman',
    ['build', '-t', tag, `--build-arg=fedora_version=${args['fedora-version']}`, '.'],
    { workingDir: 'podman' }
);
const containerArgs = ['run', '--rm', '--detach', '--tty', '--cap-add=SYS_NICE', '--cap-add=IPC_LOCK'];

//// TODO: is there no-sudo way to work with shared files? e.g.:
//await exec('podman', ['unshare', 'find', process.cwd(), '-type', 'd', '-exec', 'chmod', 'g+s', '{}', ';']);
//await exec('podman', ['unshare', 'chmod', `g+w`, '-R', process.cwd()]);
//await exec('podman', ['unshare', 'chown', `0:1000`, '-R', process.cwd()]);
containerArgs.push(`--mount=type=bind,source=${process.cwd()},target=/home/gnomeshell/workspace`);

await fs.mkdir(path.resolve(args['build-dir']), { recursive: true });
containerArgs.push(`--mount=type=bind,source=${path.resolve(args['build-dir'])},target=/home/gnomeshell/build`);

if (args['install-dir']) {
    const installDir = path.resolve(`${args['build-dir']}/${metadata['uuid']}`);
    await fs.mkdir(installDir, { recursive: true });
    containerArgs.push(`--mount=type=bind,source=${path.resolve(args['install-dir'])},target=/home/gnomeshell/install`);
}

if (args['run-vnc']) {
    containerArgs.push(`--publish=${args['run-vnc']}:5900`);
}

if (args['rm']) {
    containerArgs.push('--rmi');
}

containerArgs.push(tag);

let container = (await exec('podman', containerArgs, { readStdOut: true })).trim();
process.on('SIGINT', onContainerError);
process.on('SIGTERM', onContainerError);
process.on('uncaughtException', onContainerError);
try {
    await containerSuGnomeExec('wait-user-bus.sh');
    try {
        const yarnCommonArgs = ['yarn', 'run', 'build', '--build-dir=../build'];
        const yarnBuildArgs = [...yarnCommonArgs];
        yarnBuildArgs.push(
            args['install-dir']
                ? '--install-dir=../install'
                : '--install-dir=/home/gnomeshell/.local/share/gnome-shell/extensions'
        );

        if (args['install']) {
            yarnBuildArgs.push('--install');
        }

        if (args['_unknown']) {
            yarnBuildArgs.push(...args['_unknown']);
        }

        // sudo is used here since build files are owned by container root
        // (a.k.a podman host user); TODO may be get rid of it.
        await containerSuGnomeExec(
            'sudo',
            yarnBuildArgs,
            { passStdio: true, workingDir: '/home/gnomeshell/workspace' }
        );

        // If performing demo installation, own the files by gnomeshell user.
        if (args['install'] && !args['install-dir']) {
            await containerSuRootExec(
                'chown',
                ['-R', 'gnomeshell', metadata['uuid']],
                { workingDir: '/home/gnomeshell/.local/share/gnome-shell/extensions' }
            );
        }

        // Tune gnome shell: do not show tour and overview when staring. 
        await containerSuGnomeExec('gnome-extensions', ['enable', 'no-overview@fthx']);
        await containerSuGnomeExec(
            'gsettings',
            ['set', 'org.gnome.shell welcome-dialog-last-shown-version', "'4294967295'"]
        );

        if (args['x11']) {
            await containerSuGnomeExec('systemctl', ['--user', 'start', '"gnome-xsession@:99"']);
        } else {
            await containerSuGnomeExec('systemctl', ['--user', 'start', '"gnome-wayland-nested@:99"']);
        }

        // TODO: single build with shell restart -or- capture/preview without rebuild here?
        if (args['lint'] !== 'none') {
            const yarnBuildArgs = ['--wait', '--', 'sudo', 'env', 'DISPLAY=:99', ...yarnCommonArgs];
            yarnBuildArgs.push('--built');
            yarnBuildArgs.push(`--lint=${args['lint']}`);
            
            await containerSuGnomeExec(
                'gnome-terminal',
                yarnBuildArgs,
                { passStdio: true, workingDir: '/home/gnomeshell/workspace' }
            );
        }

        if (args['capture-ui']?.length) {
            const yarnBuildArgs = ['--wait', '--', 'sudo', 'env', 'DISPLAY=:99', ...yarnCommonArgs];
            yarnBuildArgs.push('--built');
            
            for (const fileName of args['capture-ui']) {
                yarnBuildArgs.push(`--capture-ui=${fileName}`);
            }

            await containerSuGnomeExec(
                'gnome-terminal',
                yarnBuildArgs,
                { passStdio: true, workingDir: '/home/gnomeshell/workspace' }
            );
        }

        if (args['preview-ui']?.length) {
            const yarnBuildArgs = ['--', 'sudo', 'env', 'DISPLAY=:99', ...yarnCommonArgs];
            yarnBuildArgs.push('--built');
            
            for (const fileName of args['preview-ui']) {
                yarnBuildArgs.push(`--preview-ui=${fileName}`);
            }

            if (!args['run-vnc']) {
                console.log(
                    "Hint: you have provided '--preview-ui' argument without '--run-vnc' "
                    + "so most probably you will not be able to see requested preview."
                );
            }

            await containerSuGnomeExec(
                'gnome-terminal',
                yarnBuildArgs,
                { passStdio: true, workingDir: '/home/gnomeshell/workspace' }
            );
        }
    } finally {
        // Run VNC and shell even after failed build, may be useful for diagnostics.
        if (args['run-vnc']) {
            try {
                if (args['x11']) {
                    await containerSuGnomeExec('systemctl', ['--user', 'start', '"gnome-xsession@:99"']);
                } else {
                    await containerSuGnomeExec('systemctl', ['--user', 'start', '"gnome-wayland-nested@:99"']);
                }
            } catch {
                // Just an extra try to run shell if it is not running yet, ignore problems.
            }

            // Seems like it can not crash, but works only if delayed after session start.
            // TODO: consider reordering this command?
            if (args['install'] && !args['install-dir']) {
                await containerSuGnomeExec(
                    'gnome-terminal',
                    ['--', 'gnome-extensions', 'enable', metadata['uuid']]
                );
            }

            const vncTask = containerSuGnomeExec('x0vncserver -display=:99 -SecurityTypes=none');
            if (!args['attach']) {
                await vncTask;
                // Else wait for attach session only.
            }
        }
    }
} finally {
    // Attach to console even after failed build and/or VNC, may be useful for diagnostics.
    if (args['attach']) {
        console.log("ℹ️ To stop the container and exit, use 'poweroff'.");
        await exec('podman', [ 'attach', container ], { passStdio: true });
    }

    // Anyway stop the container now (wait a little for graceful stop though).
    exec('podman', ['stop', '--time=120', container]);
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {object} options
 * @param {string} options.env
 * @param {string} options.workingDir
 * @returns {Promise}
 */
function containerSuGnomeExec(command, args=[], { env, passStdio, workingDir }={}) {
    const fullCommand = [ escapeChar(command, "'"), ...args ].join(' ');
    workingDir ??= '/home/gnomeshell';
    const podmanArgs = ['--user=gnomeshell', `--workdir=${workingDir}`];

    if (env) {
        for (const name of Object.getOwnPropertyNames(env)) {
            podmanArgs.push(`--env=${name}=${env[name]}`);
        }
    }

    return exec(
        'podman',
        [ 'exec', ...podmanArgs, container, 'set-env.sh', fullCommand ],
        { passStdio }
    );
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {object} options
 * @param {string} options.env
 * @param {string} options.workingDir
 * @returns {Promise}
 */
function containerSuRootExec(command, args=[], { env, passStdio, workingDir }={}) {
    workingDir ??= '/home/gnomeshell';
    const podmanArgs = [`--workdir=${workingDir}`];

    if (env) {
        for (const name of Object.getOwnPropertyNames(env)) {
            podmanArgs.push(`--env=${name}=${env[name]}`);
        }
    }

    return exec(
        'podman',
        [ 'exec', ...podmanArgs, container, command, ...args ],
        { passStdio }
    );
}

function onContainerError(code) {
    console.log();
    console.error(`⚡ ${container} 'podman' >`);
    console.error(code);
    process.exit(1);
}
