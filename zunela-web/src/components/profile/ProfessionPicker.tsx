"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { foldText } from "@/lib/affinity";
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
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listId = `${fieldId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<string[]>([]);

  useEffect(() => {
    setCustom(readCustomProfessions());
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const options = useMemo(() => {
    const merged = [...PROFESSION_SUGGESTIONS, ...custom];
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const item of merged) {
      const key = foldText(item);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(item);
    }
    return unique.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [custom]);

  const query = value.trim();
  const filtered = useMemo(() => {
    if (!query) {
      return options;
    }
    const needle = foldText(query);
    return options.filter((item) => foldText(item).includes(needle));
  }, [options, query]);

  const exactMatch = options.some((item) => foldText(item) === foldText(query));
  const canAddCustom = query.length >= 2 && !exactMatch;

  function selectProfession(next: string) {
    const trimmed = next.trim();
    onChange(trimmed);
    if (trimmed.length >= 2) {
      rememberCustomProfession(trimmed);
      setCustom(readCustomProfessions());
    }
    setOpen(false);
  }

  function addCustom() {
    if (!canAddCustom) {
      return;
    }
    selectProfession(query);
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-navy" htmlFor={fieldId}>
        Profesión o actividad
      </label>
      <p className="mb-2 text-xs leading-5 text-muted">
        Elige de la lista o escribe una nueva y pulsa Agregar.
      </p>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id={fieldId}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={Boolean(error)}
            autoComplete="off"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
              }
              if (event.key === "Enter" && canAddCustom) {
                event.preventDefault();
                addCustom();
              }
            }}
            placeholder="Ej. Contador, Docente, Mecánico…"
            className={`h-11 w-full rounded-xl border bg-white px-3.5 pr-10 text-sm text-ink outline-none transition-[border,box-shadow] placeholder:text-muted/70 ${
              error
                ? "border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(155,59,50,0.14)]"
                : "border-line focus:border-teal focus:shadow-[0_0_0_3px_rgba(10,111,108,0.14)]"
            }`}
          />
          <button
            type="button"
            aria-label={open ? "Cerrar lista" : "Abrir lista"}
            onClick={() => setOpen((current) => !current)}
            className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-cream-deep hover:text-navy"
          >
            <span aria-hidden className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>
              ▼
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={addCustom}
          disabled={!canAddCustom}
          className="h-11 shrink-0 rounded-xl border border-line px-3 text-sm font-semibold text-navy disabled:cursor-not-allowed disabled:opacity-40"
        >
          Agregar
        </button>
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-[0_16px_40px_rgba(7,21,31,0.14)]"
        >
          {filtered.length === 0 && !canAddCustom ? (
            <li className="px-3.5 py-2.5 text-sm text-muted">Sin coincidencias. Escribe y pulsa Agregar.</li>
          ) : null}
          {filtered.map((item) => {
            const selected = foldText(item) === foldText(value);
            return (
              <li key={item} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectProfession(item)}
                  className={`flex w-full px-3.5 py-2.5 text-left text-sm ${
                    selected ? "bg-cream-deep font-semibold text-navy" : "text-ink hover:bg-cream-deep"
                  }`}
                >
                  {item}
                </button>
              </li>
            );
          })}
          {canAddCustom ? (
            <li role="option" aria-selected={false} className="border-t border-line">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={addCustom}
                className="flex w-full px-3.5 py-2.5 text-left text-sm font-semibold text-teal hover:bg-cream-deep"
              >
                Agregar «{query}»
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {error ? (
        <p className="mt-1.5 text-xs text-danger" id={`${fieldId}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
