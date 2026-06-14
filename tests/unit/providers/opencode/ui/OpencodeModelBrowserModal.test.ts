import { OPENCODE_DEFAULT_ENVIRONMENT_VARIABLES } from '@/providers/opencode/settings';
import { OpencodeModelBrowserModal } from '@/providers/opencode/ui/OpencodeModelBrowserModal';

jest.mock('obsidian', () => {
  const { createMockEl: makeEl } = jest.requireActual('@test/helpers/mockElement');
  return {
    Modal: class {
      app: unknown;
      contentEl = makeEl();
      modalEl = makeEl();
      close = jest.fn();
      setTitle = jest.fn();
      constructor(app: unknown) {
        this.app = app;
      }
    },
  };
});

const mockEnsureReady = jest.fn().mockResolvedValue(false);
jest.mock('@/providers/opencode/runtime/OpencodeChatRuntime', () => ({
  OpencodeChatRuntime: class {
    syncConversationState = jest.fn();
    ensureReady = (...args: unknown[]) => mockEnsureReady(...args);
    cleanup = jest.fn();
  },
}));

function createPlugin(discoveredModels: Array<{ label: string; rawId: string }>, visibleModels: string[] = []) {
  return {
    app: {},
    saveSettings: jest.fn().mockResolvedValue(undefined),
    settings: {
      providerConfigs: {
        opencode: {
          availableModes: [],
          cliPath: '',
          cliPathsByHost: {},
          discoveredModels,
          enabled: true,
          environmentVariables: OPENCODE_DEFAULT_ENVIRONMENT_VARIABLES,
          modelAliases: {},
          preferredThinkingByModel: {},
          selectedMode: '',
          visibleModels,
        },
      },
    },
  } as any;
}

function openModal(plugin: any, ctx: any) {
  const modal = new OpencodeModelBrowserModal(plugin.app, ctx);
  modal.onOpen();
  return modal;
}

function getRows(modal: any) {
  const list = modal.contentEl.querySelector('.claudian-opencode-model-picker-list');
  return list?.children ?? [];
}

describe('OpencodeModelBrowserModal', () => {
  const models = [
    { label: 'openrouter/Foo', rawId: 'openrouter/foo' },
    { label: 'venice/Bar', rawId: 'venice/bar' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists every discovered model as a row', () => {
    const plugin = createPlugin(models);
    const modal = openModal(plugin, {
      plugin,
      selectModel: jest.fn().mockResolvedValue(undefined),
      refresh: jest.fn(),
    });

    expect(getRows(modal)).toHaveLength(2);
  });

  it('switches the active model and closes when a row is clicked', async () => {
    const plugin = createPlugin(models);
    const selectModel = jest.fn().mockResolvedValue(undefined);
    const modal = openModal(plugin, { plugin, selectModel, refresh: jest.fn() });

    await getRows(modal)[0].dispatchEvent('click');

    expect(selectModel).toHaveBeenCalledWith('opencode:openrouter/foo');
    expect((modal as any).close).toHaveBeenCalledTimes(1);
  });

  it('toggles a favorite via the star without switching or closing', async () => {
    const plugin = createPlugin(models);
    const selectModel = jest.fn().mockResolvedValue(undefined);
    const refresh = jest.fn();
    const modal = openModal(plugin, { plugin, selectModel, refresh });

    const star = getRows(modal)[0].children[0];
    await star.dispatchEvent('click', { stopPropagation: () => {} });

    expect(plugin.settings.providerConfigs.opencode.visibleModels).toEqual(['openrouter/foo']);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(selectModel).not.toHaveBeenCalled();
    expect((modal as any).close).not.toHaveBeenCalled();
  });

  it('warms the catalog when no models are discovered yet', () => {
    const plugin = createPlugin([]);
    openModal(plugin, {
      plugin,
      selectModel: jest.fn().mockResolvedValue(undefined),
      refresh: jest.fn(),
    });

    expect(mockEnsureReady).toHaveBeenCalledWith({ allowSessionCreation: true });
  });
});
