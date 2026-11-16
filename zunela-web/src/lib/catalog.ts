import { recordAudit } from "@/lib/admin";
import {
  GOAL_OPTIONS as DEFAULT_GOALS,
  INTEREST_GROUPS as DEFAULT_INTEREST_GROUPS,
  OFFER_OPTIONS as DEFAULT_OFFERS,
  foldText,
} from "@/lib/affinity";
import { recordProductEvent } from "@/lib/product-events";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import {
  clearRemoteCatalogCache,
  fetchRemoteCatalogState,
  peekRemoteCatalogState,
  saveRemoteCatalogState,
  type RemoteCatalogState,
} from "@/lib/remote/catalog-options";
import { readDurable, writeDurable } from "@/lib/storage";

const CATALOG_KEY = "zunela.catalogs";

export type InterestGroup = {
  title: string;
  items: string[];
};

export type CatalogKind = "interests" | "goals" | "offers";

type CatalogState = RemoteCatalogState;

const EMPTY_STATE: CatalogState = {
  interestDisabled: [],
  interestExtras: [],
  goalDisabled: [],
  goalExtras: [],
  offerDisabled: [],
  offerExtras: [],
};

export function readInterestGroups(): InterestGroup[] {
  const state = readState();
  const disabled = new Set(state.interestDisabled.map(foldText));
  const groups = DEFAULT_INTEREST_GROUPS.map((group) => ({
    title: group.title,
    items: group.items.filter((item) => !disabled.has(foldText(item))),
  }));

  for (const extra of state.interestExtras) {
    const label = extra.label.trim();
    if (!label || disabled.has(foldText(label))) {
      continue;
    }
    const groupTitle = extra.group.trim() || "Otros";
    const existing = groups.find((group) => foldText(group.title) === foldText(groupTitle));
    if (existing) {
      if (!existing.items.some((item) => foldText(item) === foldText(label))) {
        existing.items.push(label);
      }
    } else {
      groups.push({ title: groupTitle, items: [label] });
    }
  }

  return groups.filter((group) => group.items.length > 0);
}

export function readGoalOptions() {
  return mergeList(DEFAULT_GOALS, readState().goalDisabled, readState().goalExtras);
}

export function readOfferOptions() {
  return mergeList(DEFAULT_OFFERS, readState().offerDisabled, readState().offerExtras);
}

export function isKnownInterest(label: string) {
  return readInterestGroups().some((group) =>
    group.items.some((item) => foldText(item) === foldText(label)),
  );
}

export function catalogInterestLabels() {
  return readInterestGroups().flatMap((group) => group.items);
}

export function addCatalogItem(kind: CatalogKind, label: string, group = "Otros") {
  if (remoteIdentityAvailable()) {
    return "Usa el guardado remoto de catálogos.";
  }
  const result = applyAdd(readState(), kind, label, group);
  if (typeof result === "string") {
    return result;
  }
  writeState(result);
  recordProductEvent(`Agregó ${kindLabel(kind)} al catálogo.`);
  recordAudit(`Agregó al catálogo de ${kindLabel(kind)}: ${label.trim()}.`);
  return null;
}

export function deactivateCatalogItem(kind: CatalogKind, label: string) {
  if (remoteIdentityAvailable()) {
    return;
  }
  const value = label.trim();
  if (!value) {
    return;
  }
  writeState(applyDeactivate(readState(), kind, value));
  recordProductEvent(`Desactivó ${kindLabel(kind)} del catálogo.`);
  recordAudit(`Desactivó del catálogo de ${kindLabel(kind)}: ${value}.`);
}

export function resetCatalogs() {
  if (remoteIdentityAvailable()) {
    return;
  }
  writeDurable(CATALOG_KEY, JSON.stringify(EMPTY_STATE));
  recordProductEvent("Restableció los catálogos al valor base.");
  recordAudit("Restableció intereses, objetivos y habilidades al catálogo base.");
}

export async function refreshRemoteCatalogs() {
  if (!remoteIdentityAvailable()) {
    clearRemoteCatalogCache();
    return null;
  }
  return fetchRemoteCatalogState();
}

export async function addCatalogItemAsync(kind: CatalogKind, label: string, group = "Otros") {
  if (remoteIdentityAvailable()) {
    const current = peekRemoteCatalogState() ?? (await fetchRemoteCatalogState()) ?? { ...EMPTY_STATE };
    const next = applyAdd(current, kind, label, group);
    if (typeof next === "string") {
      return next;
    }
    const saved = await saveRemoteCatalogState(next);
    if (typeof saved === "string") {
      return saved;
    }
    recordProductEvent(`Agregó ${kindLabel(kind)} al catálogo.`);
    recordAudit(`Agregó al catálogo de ${kindLabel(kind)}: ${label.trim()}.`);
    return null;
  }
  return addCatalogItem(kind, label, group);
}

export async function deactivateCatalogItemAsync(kind: CatalogKind, label: string) {
  const value = label.trim();
  if (!value) {
    return null;
  }
  if (remoteIdentityAvailable()) {
    const current = peekRemoteCatalogState() ?? (await fetchRemoteCatalogState()) ?? { ...EMPTY_STATE };
    const saved = await saveRemoteCatalogState(applyDeactivate(current, kind, value));
    if (typeof saved === "string") {
      return saved;
    }
    recordProductEvent(`Desactivó ${kindLabel(kind)} del catálogo.`);
    recordAudit(`Desactivó del catálogo de ${kindLabel(kind)}: ${value}.`);
    return null;
  }
  deactivateCatalogItem(kind, value);
  return null;
}

export async function resetCatalogsAsync() {
  if (remoteIdentityAvailable()) {
    const saved = await saveRemoteCatalogState({ ...EMPTY_STATE });
    if (typeof saved === "string") {
      return saved;
    }
    recordProductEvent("Restableció los catálogos al valor base.");
    recordAudit("Restableció intereses, objetivos y habilidades al catálogo base.");
    return null;
  }
  resetCatalogs();
  return null;
}

function applyAdd(
  state: CatalogState,
  kind: CatalogKind,
  label: string,
  group: string,
): CatalogState | string {
  const value = label.trim();
  if (value.length < 2) {
    return "Escribe al menos 2 caracteres.";
  }
  const next: CatalogState = {
    interestDisabled: [...state.interestDisabled],
    interestExtras: [...state.interestExtras],
    goalDisabled: [...state.goalDisabled],
    goalExtras: [...state.goalExtras],
    offerDisabled: [...state.offerDisabled],
    offerExtras: [...state.offerExtras],
  };
  if (kind === "interests") {
    if (mergeKnownInterests(next).some((item) => foldText(item) === foldText(value))) {
      return "Ese interés ya está en el catálogo.";
    }
    next.interestExtras = [...next.interestExtras, { label: value, group: group.trim() || "Otros" }];
    next.interestDisabled = next.interestDisabled.filter((item) => foldText(item) !== foldText(value));
  } else if (kind === "goals") {
    if (mergeList(DEFAULT_GOALS, next.goalDisabled, next.goalExtras).some((item) => foldText(item) === foldText(value))) {
      return "Ese objetivo ya está en el catálogo.";
    }
    next.goalExtras = [...next.goalExtras, value];
    next.goalDisabled = next.goalDisabled.filter((item) => foldText(item) !== foldText(value));
  } else {
    if (mergeList(DEFAULT_OFFERS, next.offerDisabled, next.offerExtras).some((item) => foldText(item) === foldText(value))) {
      return "Esa habilidad ya está en el catálogo.";
    }
    next.offerExtras = [...next.offerExtras, value];
    next.offerDisabled = next.offerDisabled.filter((item) => foldText(item) !== foldText(value));
  }
  return next;
}

function applyDeactivate(state: CatalogState, kind: CatalogKind, value: string): CatalogState {
  const next: CatalogState = {
    interestDisabled: [...state.interestDisabled],
    interestExtras: [...state.interestExtras],
    goalDisabled: [...state.goalDisabled],
    goalExtras: [...state.goalExtras],
    offerDisabled: [...state.offerDisabled],
    offerExtras: [...state.offerExtras],
  };
  if (kind === "interests") {
    next.interestExtras = next.interestExtras.filter((item) => foldText(item.label) !== foldText(value));
    if (DEFAULT_INTEREST_GROUPS.some((group) => group.items.some((item) => foldText(item) === foldText(value)))) {
      if (!next.interestDisabled.some((item) => foldText(item) === foldText(value))) {
        next.interestDisabled = [...next.interestDisabled, value];
      }
    }
  } else if (kind === "goals") {
    next.goalExtras = next.goalExtras.filter((item) => foldText(item) !== foldText(value));
    if (DEFAULT_GOALS.some((item) => foldText(item) === foldText(value))) {
      if (!next.goalDisabled.some((item) => foldText(item) === foldText(value))) {
        next.goalDisabled = [...next.goalDisabled, value];
      }
    }
  } else {
    next.offerExtras = next.offerExtras.filter((item) => foldText(item) !== foldText(value));
    if (DEFAULT_OFFERS.some((item) => foldText(item) === foldText(value))) {
      if (!next.offerDisabled.some((item) => foldText(item) === foldText(value))) {
        next.offerDisabled = [...next.offerDisabled, value];
      }
    }
  }
  return next;
}

function mergeKnownInterests(state: CatalogState) {
  const disabled = new Set(state.interestDisabled.map(foldText));
  const base = DEFAULT_INTEREST_GROUPS.flatMap((group) =>
    group.items.filter((item) => !disabled.has(foldText(item))),
  );
  const extras = state.interestExtras
    .map((item) => item.label.trim())
    .filter((label) => label && !disabled.has(foldText(label)));
  return [...base, ...extras];
}

function mergeList(defaults: string[], disabled: string[], extras: string[]) {
  const blocked = new Set(disabled.map(foldText));
  const base = defaults.filter((item) => !blocked.has(foldText(item)));
  const added = extras.filter(
    (item) =>
      item.trim().length > 0 &&
      !blocked.has(foldText(item)) &&
      !base.some((entry) => foldText(entry) === foldText(item)),
  );
  return [...base, ...added];
}

function kindLabel(kind: CatalogKind) {
  if (kind === "interests") {
    return "intereses";
  }
  if (kind === "goals") {
    return "objetivos";
  }
  return "habilidades";
}

function readState(): CatalogState {
  if (remoteIdentityAvailable()) {
    return peekRemoteCatalogState() ?? { ...EMPTY_STATE };
  }
  const raw = readDurable(CATALOG_KEY);
  if (!raw) {
    return { ...EMPTY_STATE };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CatalogState>;
    return {
      interestDisabled: asStringList(parsed.interestDisabled),
      interestExtras: asInterestExtras(parsed.interestExtras),
      goalDisabled: asStringList(parsed.goalDisabled),
      goalExtras: asStringList(parsed.goalExtras),
      offerDisabled: asStringList(parsed.offerDisabled),
      offerExtras: asStringList(parsed.offerExtras),
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function writeState(state: CatalogState) {
  writeDurable(CATALOG_KEY, JSON.stringify(state));
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asInterestExtras(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as { label?: unknown; group?: unknown };
      if (typeof row.label !== "string" || !row.label.trim()) {
        return null;
      }
      return {
        label: row.label.trim(),
        group: typeof row.group === "string" && row.group.trim() ? row.group.trim() : "Otros",
      };
    })
    .filter((item): item is { label: string; group: string } => Boolean(item));
}
