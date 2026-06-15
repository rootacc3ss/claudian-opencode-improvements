import * as path from 'node:path';

import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';

// Flatpak (and similar sandboxes) relocate the XDG base dirs into a per-app
// private path under ~/.var/app/<id>/. That is the signal we correct for.
const SANDBOX_XDG_MARKER = '/.var/app/';

/**
 * When Obsidian runs inside a Flatpak sandbox, XDG_DATA_HOME/XDG_CONFIG_HOME are
 * redirected to the app's private dirs, so the spawned `opencode` process looks
 * for auth.json/config under ~/.var/app/... instead of the host ~/.local/share
 * and ~/.config. The result is that only login-free providers appear. When we
 * detect that redirect, point XDG back at the host defaults so OpenCode resolves
 * the same providers and models it does in a terminal. User-supplied env vars
 * still take precedence (see buildOpencodeRuntimeEnv).
 */
export function resolveHostXdgOverrides(env: NodeJS.ProcessEnv): Record<string, string> {
  const home = env.HOME;
  if (!home) {
    return {};
  }

  const overrides: Record<string, string> = {};
  if (env.XDG_DATA_HOME?.includes(SANDBOX_XDG_MARKER)) {
    overrides.XDG_DATA_HOME = path.join(home, '.local', 'share');
  }
  if (env.XDG_CONFIG_HOME?.includes(SANDBOX_XDG_MARKER)) {
    overrides.XDG_CONFIG_HOME = path.join(home, '.config');
  }
  return overrides;
}

export function buildOpencodeRuntimeEnv(
  settings: Record<string, unknown>,
  cliPath: string,
  databasePathOverride?: string | null,
): NodeJS.ProcessEnv {
  const envText = getRuntimeEnvironmentText(settings, 'opencode');
  const envVars = parseEnvironmentVariables(envText);
  return {
    ...process.env,
    ...resolveHostXdgOverrides(process.env),
    ...envVars,
    OPENCODE_DISABLE_CLAUDE_CODE_PROMPT: 'true',
    ...(databasePathOverride ? { OPENCODE_DB: databasePathOverride } : {}),
    PATH: getEnhancedPath(envVars.PATH, cliPath || undefined),
  };
}
