"use client";

import { SuggestionCombobox } from "@/components/profile/SuggestionCombobox";
import {
  COLOMBIA_CITIES,
  readCustomCities,
  rememberCustomCity,
} from "@/lib/profile";

type CityPickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function CityPicker({ id, value, onChange, error }: CityPickerProps) {
  return (
    <SuggestionCombobox
      id={id}
      label="Ciudad"
      hint="Elige de la lista o escribe un municipio que no aparezca y pulsa Agregar."
      placeholder="Ej. Bogotá, Medellín, Sincelejo…"
      value={value}
      onChange={onChange}
      error={error}
      suggestions={COLOMBIA_CITIES}
      readCustom={readCustomCities}
      rememberCustom={rememberCustomCity}
    />
  );
}
