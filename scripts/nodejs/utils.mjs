import child_process from 'child_process'
import { promises as fs } from 'fs'
import http from 'http'
import https from 'https'
import path from 'path'

/**
 * @param {string} src
 * @param {string} dest
 */
export async function copyFile(src, dest) {
    try {
        // seems like copyFile can not rewrite files from pod-container,
        // see https://github.com/nodejs/node/issues/43471
        unlinkFile(dest);
    } finally {
        await fs.copyFile(src, dest);
    }
}

/**
 * @param {string} path
 */
export async function unlinkFile(path) {
    try {
        await fs.unlink(path);
    } catch {
        // most probably, there is no such file already
    }    
}

/**
 * @param {string} filePath 
 * @param {https.RequestOptions} request
 */
export async function downloadFileIfMissed(filePath, request) {
    try {
        await fs.access(filePath);
        console.log(`📝 File '${filePath}' exists; you can delete it to re-fetch.`);
    } catch {
        await downloadFile(filePath, request);
    }
}

/**
 * @param {string} filePath 
 * @param {https.RequestOptions} request
 */
export async function downloadFile(filePath, request) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    console.log(`📝 Downloading '${filePath}' from https://${request.hostname}${request.path}`);
    for await (const chunk of downloadChunks(request)) {
        await fs.appendFile(filePath, chunk);
    }
}

/**
 * @param {https.RequestOptions} request
 * @return {Promise<string>} File content as UTF-8 string.
 */
export async function download(request) {
    console.log(`📝 Downloading https://${request.hostname}${request.path}`);
    const chunks = [];
    for await (const chunk of downloadChunks(request)) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf-8');
}

async function* downloadChunks(request) {
    /** @type Promise<http.IncomingMessage> */
    const response = await new Promise((resolve, reject) => {
        https.request(request)
            .once('response', response => resolve(response))
            .once('error', error => reject(error))
            .end();
    });
    try
    {
        const fileName = path.basename(request.path);
        if (response.statusCode != 200) {
            console.log(`❌ Downloading '${fileName}': ${response.statusCode} status code.`);
        }
        let readLen = 0;
        const totalLen = response.headers['content-length'];
        for await (const chunk of response) {
            const partLen = Buffer.byteLength(chunk);
            const percent = () => (100 * (readLen + partLen) / totalLen).toFixed();
            console.log(totalLen
                ? `🌐 Downloading '${fileName}': ${percent()}% (${readLen}+${partLen} of ${totalLen} bytes)`
                : `🌐 Downloading '${fileName}': ${readLen}+${partLen} bytes`
            );
            readLen += partLen;
            yield chunk;
        }
        console.log(`✅ Downloading '${fileName}': done.`);
    } catch (error) {
        console.log(`❌ Downloading '${fileName}': failed.`);
        throw error;
    }
}

/**
 * @param {string} value
 * @param {string} charToEscape
 * @returns {string} String with special symbols escaped with backslash.
 */
export function escapeChar(value, charToEscape) {
    return value.replace(charToEscape, `\\${charToEscape}`);
}

/**
 * @param {string} value
 * @param {string} charToEscape
 * @returns {string} Regex string with special symbols escaped with backslash.
 */
export function escapeRegex(value) {
    return value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Start a process and get promise for it's completion.
 * @param {string} command
 * @param {string[]} args
 * @param {object} params
 * @param {Record<string, string>} params.env
 * @param {boolean} params.passStdio
 * @param {boolean} params.readStdErr
 * @param {boolean} params.readStdOut
 * @param {string} params.workingDir
 * @return Promise<string>
 * @throws If command failed, i.e. returned non-zero exit code.
 */
export async function exec(command, args, params={}) {
    const process = new BackgroundProcess(command, args, params);
    await process.wait();
    let result = '';
    if (params.readStdOut) {
        result ||= `${result}\n`;
        result += process.readStdOut().toString(process.encoding);
    }
    if (params.readStdErr) {
        result ||= `${result}\n`;
        result += process.readStdErr().toString(process.encoding);
    }
    return result;
}

/**
 * Start a command from package and get promise for it's completion.
 * @param {string} command
 * @param {string[]} args
 * @param {object} params
 * @param {Record<string, string>} params.env
 * @param {boolean} params.passStdio
 * @param {boolean} params.readStdErr
 * @param {boolean} params.readStdOut
 * @param {string} params.workingDir
 * @return Promise<string>
 * @throws If command failed, i.e. returned non-zero exit code.
 */
export function execPackage(command, args, params={}) {
    if (process.env['npm_config_user_agent'].startsWith('yarn')) {
        return exec('yarn', ['run', command, ...args], params);
    } else {
        const joinedCommand = [command, ...args].join(' ');
        return exec('npm', ['exec', '-c', joinedCommand], params);
    }
}

// TODO: replace passStdio with pass/pipe/quiet enum?
export class BackgroundProcess {
    /**
     * @param {string} command
     * @param {string[]} args
     * @param {object} params
     * @param {Record<string, string>} params.env
     * @param {boolean} params.passStdio
     * @param {boolean} params.readStdErr
     * @param {boolean} params.readStdOut
     * @param {string} params.workingDir
     */
    constructor(command, args, { env, passStdio, readStdErr, readStdOut, workingDir }={}) {
        this.encoding = 'utf-8';
        this.process = child_process.spawn(command, args, {
            cwd: workingDir ?? process.cwd(),
            encoding: this.encoding,
            env: { ...process.env, ...env },
            stdio: passStdio ? 'inherit' : 'pipe',
        });
        console.log(
            passStdio ? '🔧 Executing interactive command:' : '🔨 Executing command:',
            this.pid(),
            command,
            args
        );

        /** @type ArrayBuffer[] */
        this.stderr = [];
        /** @type ArrayBuffer[] */
        this.stdout = [];
        this.promise = new Promise((resolve, reject) => {
            if (!passStdio) {
                this.process.stdout.on('data', data => {
                    console.log(`💻 ${this.pid()} '${this.process.spawnfile}' > ${data.toString(this.encoding).trim()}`);
                    if (readStdOut) {
                        this.stdout.push(data);
                    }
                });
                this.process.stderr.on('data', data => {
                    console.log(`🚨 ${this.pid()} '${this.process.spawnfile}' > ${data.toString(this.encoding).trim()}`);
                    if (readStdErr) {
                        this.stderr.push(data);
                    }
                });
            }
            this.process.on('error', error => {
                console.log(`❌ Command ${this.pid()} '${command}' exited with error:`, error);
                reject(error);
            });
            this.process.on('close', exitCode => {
                if (exitCode === null) {
                    console.log(`⚡ Command ${this.pid()} '${command}' interrupted.`);
                    resolve();
                } else if (exitCode === 0) {
                    console.log(`✅ Command ${this.pid()} '${command}' done.`);
                    resolve();
                } else {
                    console.log(`❌ Command ${this.pid()} '${command}' exited with code ${exitCode}.`);
                    reject(new Error(`Command '${command}' exited with code ${exitCode}.`));
                }
            })
        });
    }

    /**
     * Close the standard input for process. The process will receive EOF;
     * most probably, it will decide to exit when read it.
     */
    close() {
        this.process.stdin.end();
    }

    /**
     * @param {NodeJS.Signals} signal - Signal to send; SIGTERM if not defined.
     */
    kill(signal = 'SIGTERM') {
        this.process.kill(signal);
    }
    
    pid() {
        return this.process.pid;
    }

    /**
     * @return {ArrayBuffer}
     */
    readStdErr() {
        const result = Buffer.concat(this.stderr);
        this.stderr = [];
        return result;
    }

    /**
     * @return {ArrayBuffer}
     */
    readStdOut() {
        const result = Buffer.concat(this.stdout);
        this.stdout = [];
        return result;
    }

    /**
     * @throws If command failed, i.e. returned non-zero exit code.
     * @return {Promise}
     */
    wait() {
        return this.promise;
    }

    /**
     * @param {string} value
     */
    write(value) {
        console.log(`⌨️  ${this.pid()} '${this.process.spawnfile}' < ${value}`);
        this.process.stdin.write(value + '\n');
    }
}
