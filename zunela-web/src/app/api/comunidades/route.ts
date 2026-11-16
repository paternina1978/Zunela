import { discardBody, rejectForbidden, rejectMethod } from "@/lib/api-guard";
import { publicCommunities } from "@/lib/public-api";

const REJECTED =
  "No se creó la comunidad. Esta prueba no tiene sesión en el servidor, así que una llamada directa no puede saltarse el cupo ni publicar.";

export function GET() {
  return Response.json({
    comunidades: publicCommunities(),
    nota: "Solo comunidades públicas del catálogo. Las privadas o por invitación no salen por API.",
  });
}

export async function POST(request: Request) {
  await discardBody(request);
  return rejectForbidden(REJECTED, { comunidad: null });
}

export async function PUT(request: Request) {
  await discardBody(request);
  return rejectMethod(["GET"]);
}

export async function PATCH(request: Request) {
  await discardBody(request);
  return rejectMethod(["GET"]);
}

export async function DELETE(request: Request) {
  await discardBody(request);
  return rejectMethod(["GET"]);
}
