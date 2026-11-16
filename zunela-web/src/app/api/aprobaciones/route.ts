import { discardBody, rejectForbidden, rejectMethod } from "@/lib/api-guard";

export async function GET() {
  return rejectForbidden(
    "No se listó ninguna aprobación. El panel local no expone expedientes por API.",
    { aprobaciones: [] },
  );
}

export async function POST(request: Request) {
  await discardBody(request);
  return rejectForbidden(
    "No se preparó ni se aplicó ningún cambio. Una llamada directa no puede saltarse la aprobación, el permiso ni la revisión del servicio de IA.",
    { aprobacion: null, aplicado: false },
  );
}

export async function PUT(request: Request) {
  await discardBody(request);
  return rejectMethod(["POST"]);
}
