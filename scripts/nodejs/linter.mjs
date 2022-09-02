import { execPackage, downloadFileIfMissed } from './utils.mjs'

/**
 * @param {string} path
 * @param {boolean} fix
 * @return {Promise}
 */
export async function lint(fix) {
    await Promise.all([
        downloadFileIfMissed(
            'eslintrc-gjs.yml',
            {
                hostname: 'gitlab.gnome.org',
                path: '/GNOME/gnome-shell-extensions/-/raw/main/lint/eslintrc-gjs.yml',
            }
        ),
        downloadFileIfMissed(
            'eslintrc-shell.yml',
            {
                hostname: 'gitlab.gnome.org',
                path: '/GNOME/gnome-shell-extensions/-/raw/main/lint/eslintrc-shell.yml',
            }
        ),
    ]);

    const eslintArgs = [
        '--config', 'eslintrc.yml',
        '--resolve-plugins-relative-to', '.',
        './sources/*.js',
    ];
    
    if (fix) {
        eslintArgs.push('--fix');
    }

    return execPackage('eslint', eslintArgs);
}