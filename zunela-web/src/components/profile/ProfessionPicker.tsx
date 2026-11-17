"use client";

import { SuggestionCombobox } from "@/components/profile/SuggestionCombobox";
import {
  PROFESSION_SUGGESTIONS,
  readCustomProfessions,
  rememberCustomProfession,
} from "@/lib/profile";

type ProfessionPickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function ProfessionPicker({
  id,
  value,
  onChange,
  error,
}: ProfessionPickerProps) {
  return (
    <SuggestionCombobox
      id={id}
      label="Profesión o actividad"
      hint="Elige de la lista o escribe una nueva y pulsa Agregar."
      placeholder="Ej. Contador, Docente, Mecánico…"
      value={value}
      onChange={onChange}
      error={error}
      suggestions={PROFESSION_SUGGESTIONS}
      readCustom={readCustomProfessions}
      rememberCustom={rememberCustomProfession}
    />
  );
}
