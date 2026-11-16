import { foldText } from "@/lib/affinity";

/** Ciudades del piloto → departamento (Colombia). */
const CITY_DEPARTMENT: Record<string, string> = {
  armenia: "Quindío",
  barrancabermeja: "Santander",
  barranquilla: "Atlántico",
  bello: "Antioquia",
  bogota: "Cundinamarca",
  bucaramanga: "Santander",
  buenaventura: "Valle del Cauca",
  cali: "Valle del Cauca",
  cartagena: "Bolívar",
  cucuta: "Norte de Santander",
  florencia: "Caquetá",
  ibague: "Tolima",
  manizales: "Caldas",
  medellin: "Antioquia",
  monteria: "Córdoba",
  neiva: "Huila",
  pasto: "Nariño",
  pereira: "Risaralda",
  popayan: "Cauca",
  riohacha: "La Guajira",
  "santa marta": "Magdalena",
  sincelejo: "Sucre",
  soacha: "Cundinamarca",
  tunja: "Boyacá",
  valledupar: "Cesar",
  villavicencio: "Meta",
};

export function departmentOfCity(city: string) {
  const key = foldText(city);
  return CITY_DEPARTMENT[key] ?? "";
}
