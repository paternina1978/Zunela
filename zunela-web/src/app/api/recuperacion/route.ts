import { discardBody, rejectForbidden, rejectMethod } from "@/lib/api-guard";

export async function GET() {
  return rejectMethod(["POST"]);
}

export async function POST(request: Request) {
  await discardBody(request);
  return rejectForbidden(
    "No se cambió la contraseña ni se envió un correo. Una llamada directa no puede recuperar el acceso.",
    { correo: null },
  );
}
