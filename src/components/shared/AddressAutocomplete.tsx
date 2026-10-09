"use client";

// ============================================================
// AddressAutocomplete — campo de dirección con autocompletado
// ============================================================
// Si el servidor tiene GOOGLE_MAPS_API_KEY configurada, al escribir
// aparecen sugerencias de Google Places; al seleccionar una, se
// completan la dirección formateada y las coordenadas GPS (lat/lng).
//
// Si NO hay clave configurada (o Google falla), se degrada
// silenciosamente a un campo de texto normal: el usuario escribe la
// dirección a mano y no aparece ningún error.
//
// La clave de Google vive solo en el servidor: este componente habla
// únicamente con nuestras rutas /api/places/*.

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface AddressSelection {
  address: string;
  lat?: number;
  lng?: number;
  zone?: string;
}

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface Props {
  value: string;
  onChange: (v: AddressSelection) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder,
  id,
  required,
  disabled,
  className,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  // enabled=false cuando el servidor confirma que no hay clave de Google:
  // deja de consultar y se comporta como un Input normal.
  const [enabled, setEnabled] = useState(true);

  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef("");
  const listId = useRef(`addr-list-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function getSession(): string {
    if (!sessionRef.current) {
      sessionRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return sessionRef.current;
  }

  function handleChange(v: string) {
    onChange({ address: v });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = v.trim();
    if (q.length < 3 || !enabled) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/places/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: q, sessionToken: getSession() }),
        });
        const data = await res.json().catch(() => null);
        if (!data?.enabled) {
          setEnabled(false);
          setSuggestions([]);
          setOpen(false);
          return;
        }
        const list: Suggestion[] = Array.isArray(data.suggestions) ? data.suggestions : [];
        setSuggestions(list);
        setHighlight(list.length ? 0 : -1);
        setOpen(list.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  async function select(s: Suggestion) {
    setSuggestions([]);
    setOpen(false);
    setLoading(false);
    // Vista optimista mientras se consultan las coordenadas
    onChange({
      address: s.secondaryText ? `${s.mainText}, ${s.secondaryText}` : s.mainText,
    });
    // Nueva sesión de facturación para la próxima búsqueda
    sessionRef.current = "";
    try {
      const res = await fetch("/api/places/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: s.placeId }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.address) {
        onChange({
          address: d.address,
          lat: typeof d.lat === "number" ? d.lat : undefined,
          lng: typeof d.lng === "number" ? d.lng : undefined,
          zone: typeof d.zone === "string" && d.zone ? d.zone : undefined,
        });
      }
    } catch {
      // Sin coordenadas: la dirección seleccionada queda igual y el
      // usuario puede ajustar lat/lng manualmente o con el mapa.
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      select(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className={`relative ${className || ""}`}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId.current}
          aria-autocomplete="list"
          className="pr-9 pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <ul id={listId.current} role="listbox" className="max-h-60 overflow-y-auto py-1 text-sm">
            {suggestions.map((s, i) => (
              <li key={s.placeId} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors ${
                    i === highlight ? "bg-accent text-accent-foreground" : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(s);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.mainText}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.secondaryText}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
            Sugerencias de dirección · Google
          </div>
        </div>
      )}
    </div>
  );
}
