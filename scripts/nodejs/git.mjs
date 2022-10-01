import { exec } from "./utils.mjs";

export async function getTag() {
    return (await git(['tag', '--points-at'])).trim();
}

export async function hasChanges() {
    const stdout = await git(['status', '--porcelain', '--untracked-files=no']);
    return stdout.trim().length !== 0;
}

export async function hash(workingDir) {
    try {
        const stdout = await git(
            ['rev-parse', '--short', 'HEAD'],
            { workingDir }
        );
        return stdout.trim();
    } catch (e) {
        console.error(
            "🚧 Unable to fetch current git revision, resulting in fake 'unknown' hash string: ",
            e
        );
        return 'unknown';
    }
}

function git(args, { workingDir }={}) {
    return exec('git', args, {
        readStdErr: true,
        readStdOut: true,
        workingDir,
    });
}
