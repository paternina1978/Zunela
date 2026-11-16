/** Reglas RB-08 compartidas: correo, teléfono, enlaces e identificadores sociales. */

export function blockedOutboundText(
  value: string,
  options?: { scope?: "chat" | "comunidad"; maxLength?: number },
) {
  const scope = options?.scope ?? "chat";
  const maxLength = options?.maxLength ?? 280;
  const text = value.trim();
  const place = scope === "comunidad" ? "la comunidad" : "el chat";

  if (!text) {
    return "Escribe algo antes de enviarlo.";
  }
  if (text.length > maxLength) {
    return `Puede tener hasta ${maxLength} caracteres.`;
  }
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) {
    return `No se envió: el correo no se comparte en ${place}.`;
  }
  if (/(?:\d[\s.-]?){7,}/.test(text)) {
    return `No se envió: el teléfono no se comparte en ${place}.`;
  }
  if (/https?:\/\/|www\./i.test(text)) {
    return `No se envió: los enlaces no se comparten en ${place}.`;
  }
  if (/(?:^|\s)@[a-z0-9._]{2,}/i.test(text) || /\b(?:t\.me|wa\.me|instagram\.com|x\.com|twitter\.com|linkedin\.com|facebook\.com)\b/i.test(text)) {
    return `No se envió: las redes y handles no se comparten en ${place}.`;
  }
  return null;
}
