import { discardBody, rejectForbidden, rejectMethod } from "@/lib/api-guard";

export async function GET() {
  return rejectForbidden(
    "No se reveló ningún contacto. El GET directo tampoco puede leer correo, teléfono ni redes.",
    { contacto: null },
  );
}

export async function POST(request: Request) {
  await discardBody(request);
  return rejectForbidden(
    "No se compartió ningún contacto. Una llamada directa no puede autorizar ni mostrar correo o teléfono.",
    { contacto: null },
  );
}

export async function PUT(request: Request) {
  await discardBody(request);
  return rejectForbidden("No se actualizó ningún contacto por API.", { contacto: null });
}

export async function DELETE(request: Request) {
  await discardBody(request);
  return rejectForbidden("No se borró ningún contacto por API.", { contacto: null });
}
