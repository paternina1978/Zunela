import { discardBody, rejectForbidden, rejectMethod } from "@/lib/api-guard";

export async function GET() {
  return rejectMethod(["POST"]);
}

export async function POST(request: Request) {
  await discardBody(request);
  return rejectForbidden(
    "No se guardó ningún adjunto. Esta prueba no admite archivos en el chat y una llamada directa tampoco puede subirlos.",
    { adjunto: null },
  );
}
