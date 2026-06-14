import {
  buildEnrichedModels,
  type EnrichedModel,
  toggleVisibleModel,
} from '@/providers/opencode/ui/OpencodeModelCatalog';

function rawIds(models: EnrichedModel[]): string[] {
  return models.map((model) => model.rawId);
}

describe('buildEnrichedModels', () => {
  it('marks discovered models available and splits provider/model labels', () => {
    const enriched = buildEnrichedModels(
      [
        { label: 'openrouter/DeepSeek V4 Pro', rawId: 'openrouter/deepseek/deepseek-v4-pro' },
        { label: 'venice/Llama', rawId: 'venice/llama' },
      ],
      [],
    );

    const openrouter = enriched.find((model) => model.rawId === 'openrouter/deepseek/deepseek-v4-pro');
    expect(openrouter).toMatchObject({
      isAvailable: true,
      providerLabel: 'openrouter',
      providerKey: 'openrouter',
      modelLabel: 'DeepSeek V4 Pro',
    });
    expect(enriched.every((model) => model.isAvailable)).toBe(true);
  });

  it('includes visible models that are no longer discovered, flagged unavailable', () => {
    const enriched = buildEnrichedModels(
      [{ label: 'venice/Llama', rawId: 'venice/llama' }],
      ['openrouter/ghost-model'],
    );

    const ghost = enriched.find((model) => model.rawId === 'openrouter/ghost-model');
    expect(ghost).toBeDefined();
    expect(ghost?.isAvailable).toBe(false);
    expect(ghost?.providerLabel).toBe('openrouter');
  });

  it('does not duplicate a visible model that is also discovered', () => {
    const enriched = buildEnrichedModels(
      [{ label: 'venice/Llama', rawId: 'venice/llama' }],
      ['venice/llama'],
    );

    expect(rawIds(enriched).filter((id) => id === 'venice/llama')).toHaveLength(1);
    expect(enriched.find((model) => model.rawId === 'venice/llama')?.isAvailable).toBe(true);
  });

  it('sorts by provider label then model label', () => {
    const enriched = buildEnrichedModels(
      [
        { label: 'venice/Zephyr', rawId: 'venice/zephyr' },
        { label: 'venice/Alpha', rawId: 'venice/alpha' },
        { label: 'openrouter/Beta', rawId: 'openrouter/beta' },
      ],
      [],
    );

    expect(rawIds(enriched)).toEqual([
      'openrouter/beta',
      'venice/alpha',
      'venice/zephyr',
    ]);
  });
});

describe('toggleVisibleModel', () => {
  it('adds a model that is not yet a favorite', () => {
    expect(toggleVisibleModel(['venice/llama'], 'openrouter/beta')).toEqual([
      'venice/llama',
      'openrouter/beta',
    ]);
  });

  it('removes a model that is already a favorite', () => {
    expect(toggleVisibleModel(['venice/llama', 'openrouter/beta'], 'venice/llama')).toEqual([
      'openrouter/beta',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = ['venice/llama'];
    toggleVisibleModel(input, 'openrouter/beta');
    expect(input).toEqual(['venice/llama']);
  });
});
