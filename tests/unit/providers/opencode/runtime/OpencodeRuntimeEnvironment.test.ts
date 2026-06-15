import { resolveHostXdgOverrides } from '@/providers/opencode/runtime/OpencodeRuntimeEnvironment';

describe('resolveHostXdgOverrides', () => {
  it('redirects flatpak-sandboxed XDG paths back to host defaults', () => {
    const overrides = resolveHostXdgOverrides({
      HOME: '/home/retard',
      XDG_DATA_HOME: '/home/retard/.var/app/md.obsidian.Obsidian/data',
      XDG_CONFIG_HOME: '/home/retard/.var/app/md.obsidian.Obsidian/config',
    } as NodeJS.ProcessEnv);

    expect(overrides).toEqual({
      XDG_DATA_HOME: '/home/retard/.local/share',
      XDG_CONFIG_HOME: '/home/retard/.config',
    });
  });

  it('leaves normal (non-sandboxed) XDG paths untouched', () => {
    expect(
      resolveHostXdgOverrides({
        HOME: '/home/retard',
        XDG_DATA_HOME: '/home/retard/.local/share',
        XDG_CONFIG_HOME: '/home/retard/.config',
      } as NodeJS.ProcessEnv),
    ).toEqual({});
  });

  it('does nothing when XDG vars are unset (CLI already defaults correctly)', () => {
    expect(resolveHostXdgOverrides({ HOME: '/home/retard' } as NodeJS.ProcessEnv)).toEqual({});
  });

  it('only corrects the sandboxed var, leaving a normal sibling alone', () => {
    expect(
      resolveHostXdgOverrides({
        HOME: '/home/retard',
        XDG_DATA_HOME: '/home/retard/.var/app/md.obsidian.Obsidian/data',
        XDG_CONFIG_HOME: '/home/retard/.config',
      } as NodeJS.ProcessEnv),
    ).toEqual({ XDG_DATA_HOME: '/home/retard/.local/share' });
  });

  it('returns nothing without HOME (cannot resolve host defaults)', () => {
    expect(
      resolveHostXdgOverrides({
        XDG_DATA_HOME: '/somewhere/.var/app/x/data',
      } as NodeJS.ProcessEnv),
    ).toEqual({});
  });
});
