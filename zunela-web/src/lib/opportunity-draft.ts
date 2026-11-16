import { isKnownInterest } from "@/lib/catalog";
import { OPPORTUNITY_CATEGORIES, opportunityFieldError, type OpportunityInput } from "@/lib/own-opportunities";

const DRAFT_KEY = "zunela.opportunity-copilot";

export type CopilotDraft = OpportunityInput;

export const EMPTY_COPILOT_DRAFT: CopilotDraft = {
  title: "",
  category: "Conocimiento",
  objective: "",
  city: "Medellín",
  modality: "ambas",
  spots: 8,
  interest: "Programación",
  role: "",
  rule: "",
};

export function readCopilotDraft(): CopilotDraft | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CopilotDraft>;
    return { ...EMPTY_COPILOT_DRAFT, ...parsed, spots: Number(parsed.spots) || 8 };
  } catch {
    return null;
  }
}

export function saveCopilotDraft(draft: CopilotDraft) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearCopilotDraft() {
  sessionStorage.removeItem(DRAFT_KEY);
}

export function reviewCopilotDraft(draft: CopilotDraft) {
  const errors: string[] = [];
  const title = draft.title.trim();
  const objective = draft.objective.trim();
  const role = draft.role.trim();
  const rule = draft.rule.trim();
  if (title.length < 4 || title.length > 80) {
    errors.push("El título necesita entre 4 y 80 caracteres.");
  }
  if (!OPPORTUNITY_CATEGORIES.some((item) => item === draft.category)) {
    errors.push("Elige una categoría.");
  }
  if (objective.length < 12 || objective.length > 400) {
    errors.push("El objetivo necesita entre 12 y 400 caracteres.");
  }
  if (!draft.city.trim()) {
    errors.push("Elige una ciudad.");
  }
  if (draft.modality !== "presencial" && draft.modality !== "remota" && draft.modality !== "ambas") {
    errors.push("Elige la modalidad.");
  }
  if (!Number.isInteger(draft.spots) || draft.spots < 2 || draft.spots > 30) {
    errors.push("El cupo va de 2 a 30 personas.");
  }
  if (!isKnownInterest(draft.interest)) {
    errors.push("Elige un interés del catálogo.");
  }
  if (role.length > 60) {
    errors.push("El rol puede tener hasta 60 caracteres.");
  }
  const policy = [title, objective, role, rule].map(opportunityFieldError).find((reason) => reason);
  if (policy) {
    errors.push(policy);
  }
  return errors;
}
