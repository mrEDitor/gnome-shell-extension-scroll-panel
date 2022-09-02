import path from "path";
import { exec } from "./utils.mjs";

export async function hasChanges() {
    const stdout = await git(['status', '--porcelain', '--untracked-files=no']);
    return stdout.length !== 0;
}

export async function hash(workingDir) {
    const stdout = await git(
        ['rev-parse', '--short', 'HEAD'],
        { workingDir }
    );
    return stdout.trim();
}

function git(args, { workingDir }={}) {
    return exec('git', args, {
        readStdErr: true,
        readStdOut: true,
        workingDir,
    });
}