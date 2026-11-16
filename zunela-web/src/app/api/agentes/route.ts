import { discardBody, rejectForbidden, rejectMethod } from "@/lib/api-guard";

export async function GET() {
  return rejectForbidden(
    "No se ejecutó ni se listó ningún agente. La matriz y el apagado de emergencia siguen fail-closed.",
    {
      ejecucion: null,
      datos: null,
      consumo: { ejecuciones: 0, tokens: 0 },
      matriz: "fail-closed",
      emergencia: "fail-closed",
      runs: [],
      ledger: [],
    },
  );
}

export async function POST(request: Request) {
  await discardBody(request);
  return rejectForbidden(
    "No se ejecutó ningún agente. Apagado de emergencia, matriz y módulo bloquean la llamada: no hay herramientas Premium ni acceso a correo, teléfono, mensajes o datos ocultos.",
    {
      ejecucion: null,
      datos: null,
      consumo: { ejecuciones: 0, tokens: 0 },
      matriz: "fail-closed",
      emergencia: "fail-closed",
      runs: [],
      ledger: [],
    },
  );
}

export async function PUT(request: Request) {
  await discardBody(request);
  return rejectMethod(["POST"]);
}
