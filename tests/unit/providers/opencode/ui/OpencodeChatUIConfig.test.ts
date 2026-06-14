const mockOpen = jest.fn();
const mockModalCtor = jest.fn().mockImplementation(() => ({ open: mockOpen }));

jest.mock('obsidian', () => ({ Modal: class {}, setIcon: jest.fn() }));
jest.mock('@/providers/opencode/ui/OpencodeModelBrowserModal', () => ({
  OpencodeModelBrowserModal: mockModalCtor,
}));

import { opencodeChatUIConfig } from '@/providers/opencode/ui/OpencodeChatUIConfig';

describe('opencodeChatUIConfig model browser hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('advertises a browse action label', () => {
    expect(opencodeChatUIConfig.getModelBrowser?.({})).toEqual({
      label: 'Browse all models…',
    });
  });

  it('opens the model browser modal with the app and context', () => {
    const app = { id: 'app' };
    const ctx = {
      plugin: { app },
      selectModel: jest.fn().mockResolvedValue(undefined),
      refresh: jest.fn(),
    } as any;

    opencodeChatUIConfig.openModelBrowser?.(ctx);

    expect(mockModalCtor).toHaveBeenCalledWith(app, ctx);
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });
});
