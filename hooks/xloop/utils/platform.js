/**
 * Platform Detection Utilities
 *
 * Cross-platform detection for Windows, Linux, macOS, and WSL.
 * No external dependencies - uses Node.js built-ins only.
 *
 * @module @crateon/xloop/utils/platform
 */

import { platform } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Get the current platform name
 * @returns {'windows' | 'macos' | 'linux'} Platform identifier
 */
export function getPlatform() {
  const p = platform();
  if (p === 'win32') return 'windows';
  if (p === 'darwin') return 'macos';
  return 'linux';
}

/**
 * Check if running on Windows
 * @returns {boolean}
 */
export function isWindows() {
  return platform() === 'win32';
}

/**
 * Check if running on macOS
 * @returns {boolean}
 */
export function isMacOS() {
  return platform() === 'darwin';
}

/**
 * Check if running on Linux
 * @returns {boolean}
 */
export function isLinux() {
  return platform() === 'linux';
}

/**
 * Check if running inside WSL (Windows Subsystem for Linux)
 * @returns {boolean}
 */
export function isWSL() {
  if (platform() !== 'linux') return false;

  // Check WSL environment variable
  if (process.env.WSL_DISTRO_NAME) return true;
  if (process.env.WSLENV) return true;

  // Check /proc/version for Microsoft
  try {
    if (existsSync('/proc/version')) {
      const version = readFileSync('/proc/version', 'utf8');
      return version.toLowerCase().includes('microsoft');
    }
  } catch {
    // Ignore errors
  }

  return false;
}

/**
 * Check if running inside a Docker container
 * @returns {boolean}
 */
export function isDocker() {
  // Check for .dockerenv file
  if (existsSync('/.dockerenv')) return true;

  // Check cgroup for docker
  try {
    if (existsSync('/proc/1/cgroup')) {
      const cgroup = readFileSync('/proc/1/cgroup', 'utf8');
      return cgroup.includes('docker') || cgroup.includes('kubepods');
    }
  } catch {
    // Ignore errors
  }

  return false;
}

/**
 * Get detailed platform info
 * @returns {Object} Platform information
 */
export function getPlatformInfo() {
  return {
    platform: getPlatform(),
    isWindows: isWindows(),
    isMacOS: isMacOS(),
    isLinux: isLinux(),
    isWSL: isWSL(),
    isDocker: isDocker(),
    nodeVersion: process.version,
    arch: process.arch
  };
}
