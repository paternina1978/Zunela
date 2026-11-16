/** Respuestas fail-closed compartidas para rutas /api del piloto. */

export function rejectForbidden(error: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status: 403 });
}

export function rejectMethod(allowed: string[]) {
  return Response.json(
    {
      error: `Método no permitido. Esta prueba solo admite: ${allowed.join(", ")}.`,
    },
    {
      status: 405,
      headers: { Allow: allowed.join(", ") },
    },
  );
}

export function rejectNotFound(error: string) {
  return Response.json({ error }, { status: 404 });
}

/** Descarta el cuerpo para no procesar payloads de llamadas directas. */
export async function discardBody(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    await request.json().catch(() => null);
    return;
  }
  if (type.includes("multipart/") || type.includes("octet-stream")) {
    await request.arrayBuffer().catch(() => null);
    return;
  }
  await request.text().catch(() => "");
}
