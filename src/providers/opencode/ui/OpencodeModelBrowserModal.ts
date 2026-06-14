import { type App, Modal } from 'obsidian';

import type { ProviderModelBrowserContext } from '../../../core/providers/types';
import { encodeOpencodeModelId } from '../models';
import { OpencodeChatRuntime } from '../runtime/OpencodeChatRuntime';
import { getOpencodeProviderSettings, updateOpencodeProviderSettings } from '../settings';
import { buildEnrichedModels, type EnrichedModel, toggleVisibleModel } from './OpencodeModelCatalog';

const ALL_PROVIDERS_KEY = 'all';
const OPENCODE_METADATA_WARMUP_DB = ':memory:';

/** Lists every discovered OpenCode model so a user can switch model or pin favorites. */
export class OpencodeModelBrowserModal extends Modal {
  private listEl: HTMLElement | null = null;
  private providerSelectEl: HTMLSelectElement | null = null;
  private providerFilter = ALL_PROVIDERS_KEY;
  private searchQuery = '';
  private loading = false;

  constructor(app: App, private readonly ctx: ProviderModelBrowserContext) {
    super(app);
  }

  onOpen(): void {
    this.setTitle('Browse models');
    this.modalEl.addClass('claudian-opencode-model-browser');

    const controls = this.contentEl.createDiv({ cls: 'claudian-opencode-model-picker-controls' });

    const searchInput = controls.createEl('input', {
      cls: 'claudian-opencode-model-picker-search',
      type: 'search',
    });
    searchInput.placeholder = 'Filter by model, provider, or ID…';
    searchInput.addEventListener('input', () => {
      this.searchQuery = searchInput.value.trim().toLowerCase();
      this.renderList();
    });

    this.providerSelectEl = controls.createEl('select', {
      cls: 'claudian-opencode-model-picker-provider',
    });
    this.providerSelectEl.addEventListener('change', () => {
      this.providerFilter = this.providerSelectEl?.value ?? ALL_PROVIDERS_KEY;
      this.renderList();
    });

    this.listEl = this.contentEl.createDiv({ cls: 'claudian-opencode-model-picker-list' });

    this.renderProviderSelect();
    this.renderList();

    if (this.getEnrichedModels().length === 0) {
      void this.loadCatalog();
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private getEnrichedModels(): EnrichedModel[] {
    const settings = getOpencodeProviderSettings(this.ctx.plugin.settings);
    return buildEnrichedModels(settings.discoveredModels, settings.visibleModels);
  }

  private getVisibleModels(): Set<string> {
    return new Set(getOpencodeProviderSettings(this.ctx.plugin.settings).visibleModels);
  }

  private filterModels(models: EnrichedModel[]): EnrichedModel[] {
    return models.filter((model) => {
      if (this.providerFilter !== ALL_PROVIDERS_KEY && model.providerKey !== this.providerFilter) {
        return false;
      }
      if (!this.searchQuery) {
        return true;
      }
      return (
        model.rawId.toLowerCase().includes(this.searchQuery)
        || model.modelLabel.toLowerCase().includes(this.searchQuery)
        || model.providerLabel.toLowerCase().includes(this.searchQuery)
        || model.description.toLowerCase().includes(this.searchQuery)
      );
    });
  }

  private renderProviderSelect(): void {
    if (!this.providerSelectEl) {
      return;
    }

    const enriched = this.getEnrichedModels();
    const providers = new Map<string, { count: number; label: string }>();
    for (const model of enriched) {
      const existing = providers.get(model.providerKey);
      if (existing) {
        existing.count += 1;
      } else {
        providers.set(model.providerKey, { count: 1, label: model.providerLabel });
      }
    }

    this.providerSelectEl.empty();
    this.providerSelectEl.createEl('option', {
      text: `All providers (${enriched.length})`,
      value: ALL_PROVIDERS_KEY,
    });
    for (const [key, { count, label }] of Array.from(providers.entries())
      .sort(([, left], [, right]) => left.label.localeCompare(right.label))) {
      this.providerSelectEl.createEl('option', { text: `${label} (${count})`, value: key });
    }

    if (this.providerFilter !== ALL_PROVIDERS_KEY && !providers.has(this.providerFilter)) {
      this.providerFilter = ALL_PROVIDERS_KEY;
    }
    this.providerSelectEl.value = this.providerFilter;
  }

  private renderList(): void {
    if (!this.listEl) {
      return;
    }

    this.listEl.empty();
    const activeModelId = this.getActiveModelId();
    const favorites = this.getVisibleModels();
    const filtered = this.filterModels(this.getEnrichedModels());

    if (filtered.length === 0) {
      const emptyEl = this.listEl.createDiv({ cls: 'claudian-opencode-model-picker-empty' });
      emptyEl.setText(
        this.loading
          ? 'Loading OpenCode model catalog…'
          : this.getEnrichedModels().length === 0
            ? 'Start OpenCode once to load its model catalog.'
            : 'No models match your filter.',
      );
      return;
    }

    for (const model of filtered) {
      const rowEl = this.listEl.createDiv({ cls: 'claudian-opencode-model-picker-row' });
      const encodedId = encodeOpencodeModelId(model.rawId);
      if (encodedId === activeModelId) {
        rowEl.classList.add('claudian-opencode-model-picker-row--selected');
      }
      rowEl.title = model.rawId;

      const starBtn = rowEl.createEl('button', {
        cls: 'claudian-opencode-model-picker-star',
        text: favorites.has(model.rawId) ? '★' : '☆',
      });
      starBtn.setAttribute('aria-label', favorites.has(model.rawId) ? 'Unpin from picker' : 'Pin to picker');
      starBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        void this.toggleFavorite(model.rawId);
      });

      const textEl = rowEl.createDiv({ cls: 'claudian-opencode-model-picker-row-text' });
      const headerEl = textEl.createDiv({ cls: 'claudian-opencode-model-picker-row-header' });
      headerEl.createEl('span', {
        cls: 'claudian-opencode-model-picker-row-name',
        text: model.modelLabel,
      });
      const badgeEl = headerEl.createEl('span', {
        cls: 'claudian-opencode-model-picker-row-badge',
        text: model.providerLabel,
      });
      if (!model.isAvailable) {
        badgeEl.classList.add('claudian-opencode-model-picker-row-badge--unavailable');
        badgeEl.setText('Unavailable');
      }
      textEl.createDiv({ cls: 'claudian-opencode-model-picker-row-meta', text: model.rawId });

      rowEl.addEventListener('click', () => {
        void this.selectModel(encodedId);
      });
    }
  }

  private getActiveModelId(): string {
    const model = this.ctx.plugin.settings.model;
    return typeof model === 'string' ? model : '';
  }

  private async selectModel(encodedModelId: string): Promise<void> {
    await this.ctx.selectModel(encodedModelId);
    this.close();
  }

  private async toggleFavorite(rawId: string): Promise<void> {
    const settingsBag = this.ctx.plugin.settings as unknown as Record<string, unknown>;
    const current = getOpencodeProviderSettings(settingsBag).visibleModels;
    updateOpencodeProviderSettings(settingsBag, {
      visibleModels: toggleVisibleModel(current, rawId),
    });
    await this.ctx.plugin.saveSettings();
    this.ctx.refresh();
    this.renderProviderSelect();
    this.renderList();
  }

  private async loadCatalog(): Promise<void> {
    if (this.loading) {
      return;
    }

    this.loading = true;
    this.renderList();

    const runtime = new OpencodeChatRuntime(this.ctx.plugin);
    try {
      runtime.syncConversationState({
        providerState: { databasePath: OPENCODE_METADATA_WARMUP_DB },
        sessionId: null,
      });
      await runtime.ensureReady({ allowSessionCreation: true });
      this.ctx.refresh();
    } catch {
      // Catalog warm-up is opportunistic; the empty state guides the user.
    } finally {
      this.loading = false;
      runtime.cleanup();
      this.renderProviderSelect();
      this.renderList();
    }
  }
}
