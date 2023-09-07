import { exec } from './child-process.mjs';

/**
 * @param {String} [publishTagName] - optional publish tag (alpha, beta, ...)
 * @param {{ cwd: String, dryRun: Boolean}} options
 * @returns {Promise<any>}
 */
export function publishPackage(publishTagName, { cwd, dryRun }) {
  const execArgs = ['publish'];
  if (publishTagName) {
    execArgs.push('--tag', publishTagName);
  }
  if (dryRun) {
    execArgs.push('--dry-run');
  }
  return exec('npm', execArgs, { cwd });
}

/**
 * @param {{ cwd: String, dryRun: Boolean}} options
 * @returns {Promise<any>}
 */
export function syncLockFile({ cwd, dryRun }) {
  return exec('npm', ['install', '--package-lock-only'], { cwd }, dryRun);
}