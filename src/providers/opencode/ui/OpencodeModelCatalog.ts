import {
  buildOpencodeBaseModels,
  type OpencodeDiscoveredModel,
  splitOpencodeModelLabel,
} from '../models';

export interface EnrichedModel {
  description: string;
  isAvailable: boolean;
  modelLabel: string;
  providerKey: string;
  providerLabel: string;
  rawId: string;
}

/**
 * Flattens discovered models (plus any still-configured visible models that are no
 * longer reported by OpenCode) into provider-grouped rows for catalog UIs. Models
 * present only in `visibleModels` are flagged `isAvailable: false`.
 */
export function buildEnrichedModels(
  discoveredModels: OpencodeDiscoveredModel[],
  visibleModels: string[],
): EnrichedModel[] {
  const enriched: EnrichedModel[] = [];
  const discoveredIds = new Set<string>();
  const baseModels = buildOpencodeBaseModels(discoveredModels);

  for (const model of baseModels) {
    const { modelLabel, providerLabel } = splitOpencodeModelLabel(model.label || model.rawId);
    discoveredIds.add(model.rawId);
    enriched.push({
      description: model.description ?? '',
      isAvailable: true,
      modelLabel,
      providerKey: providerLabel.toLowerCase(),
      providerLabel,
      rawId: model.rawId,
    });
  }

  for (const rawId of visibleModels) {
    if (discoveredIds.has(rawId)) {
      continue;
    }

    const { modelLabel, providerLabel } = splitOpencodeModelLabel(rawId);
    enriched.push({
      description: '',
      isAvailable: false,
      modelLabel,
      providerKey: providerLabel.toLowerCase(),
      providerLabel,
      rawId,
    });
  }

  return enriched.sort((left, right) => {
    const providerCmp = left.providerLabel.localeCompare(right.providerLabel);
    if (providerCmp !== 0) {
      return providerCmp;
    }
    return left.modelLabel.localeCompare(right.modelLabel);
  });
}

/** Returns the next favorites list with `rawId` toggled in or out, preserving order. */
export function toggleVisibleModel(visibleModels: string[], rawId: string): string[] {
  return visibleModels.includes(rawId)
    ? visibleModels.filter((entry) => entry !== rawId)
    : [...visibleModels, rawId];
}
