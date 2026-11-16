import { discardBody, rejectForbidden, rejectMethod, rejectNotFound } from "@/lib/api-guard";
import { publicPersonRemote } from "@/lib/public-api";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = request.headers.get("authorization");
  const token =
    auth && auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const person = await publicPersonRemote(id, token);
  if (!person) {
    return rejectNotFound("No hay un perfil público con ese identificador.");
  }
  return Response.json(person);
}

export async function POST(request: Request) {
  await discardBody(request);
  return rejectForbidden(
    "No se modificó el perfil. Una llamada directa no puede crear ni alterar personas en esta prueba.",
    { persona: null },
  );
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
