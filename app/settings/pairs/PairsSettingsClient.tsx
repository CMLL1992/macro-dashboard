"use client";

import { useState, useEffect } from "react";

type PairsData = Record<string, string[]>;

export default function PairsSettingsClient({ initialData, labels }: { initialData: PairsData; labels: Record<string, string> }) {
  const [data, setData] = useState<PairsData>(initialData);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleKeyChange = (pair: string, index: number, value: string) => {
    const newData = { ...data };
    if (!newData[pair]) newData[pair] = [];
    newData[pair] = [...newData[pair]];
    newData[pair][index] = value;
    setData(newData);
  };

  const handleAddKey = (pair: string) => {
    const newData = { ...data };
    if (!newData[pair]) newData[pair] = [];
    newData[pair] = [...newData[pair], ""];
    setData(newData);
  };

  const handleRemoveKey = (pair: string, index: number) => {
    const newData = { ...data };
    if (newData[pair]) {
      newData[pair] = newData[pair].filter((_, i) => i !== index);
      if (newData[pair].length === 0) delete newData[pair];
    }
    setData(newData);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/pairs-priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setMessage({ type: "success", text: "Guardado correctamente" });
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm("¿Restaurar valores por defecto?")) return;
    const res = await fetch("/api/pairs-priority");
    if (res.ok) {
      const restored = await res.json();
      setData(restored);
      setMessage({ type: "success", text: "Valores restaurados (guarda para aplicar)" });
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-4">Configuración de Prioridades por Par</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Define qué eventos macro son más relevantes para cada par/activo. El orden importa: se usa el primer evento disponible en los próximos 14 días.
      </p>

      {message && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(data).map(([pair, keys]) => (
          <div key={pair} className="rounded-lg border p-4">
            <h2 className="font-semibold mb-2">{pair}</h2>
            <div className="space-y-2">
              {keys.map((key, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => handleKeyChange(pair, idx, e.target.value.toUpperCase())}
                    placeholder="Ej: CPIAUCSL"
                    className="flex-1 rounded border px-2 py-1 text-sm"
                    title={labels[key] ? `${key}: ${labels[key]}` : key}
                  />
                  <span className="text-xs text-muted-foreground" title={labels[key] || ""}>
                    {labels[key] || ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveKey(pair, idx)}
                    className="rounded border px-2 py-1 text-xs hover:bg-muted"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddKey(pair)}
                className="text-xs text-muted-foreground hover:underline"
              >
                + Añadir evento
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded border bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={handleRestore}
          className="rounded border px-4 py-2 text-sm hover:bg-muted"
        >
          Restaurar
        </button>
      </div>
    </div>
  );
}

