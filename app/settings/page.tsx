import fs from 'node:fs'
import path from 'node:path'

export const revalidate = 0

function loadConfig() {
  try {
    const p = path.join(process.cwd(), 'config', 'weights.json')
    return JSON.parse(fs.readFileSync(p, 'utf8')) as { threshold: number; weights: Record<string, number> }
  } catch {
    return { threshold: 0.3, weights: {} as Record<string, number> }
  }
}

export default async function SettingsPage() {
  const cfg = loadConfig()
  const entries = Object.entries(cfg.weights)
  return (
    <main className="p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Configuración de pesos/umbral</h1>
        <form id="weights-form" className="rounded-lg border bg-card p-4">
          <div className="mb-4">
            <label className="block text-sm mb-1">Umbral</label>
            <input name="threshold" type="number" step="0.01" defaultValue={cfg.threshold} className="w-32 rounded border px-2 py-1" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left">Indicador (ID FRED)</th>
                  <th className="px-3 py-2 text-left">Peso</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([k, v]) => (
                  <tr key={k} className="border-t">
                    <td className="px-3 py-2">{k}</td>
                    <td className="px-3 py-2">
                      <input name={`w_${k}`} type="number" step="0.01" defaultValue={v} className="w-28 rounded border px-2 py-1" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" className="mt-4 rounded border px-3 py-1">Guardar</button>
        </form>
        <script dangerouslySetInnerHTML={{ __html: `
          const form = document.getElementById('weights-form');
          form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const threshold = parseFloat(fd.get('threshold'));
            const weights = {};
            for (const [key, val] of fd.entries()) {
              if (String(key).startsWith('w_')) {
                const id = String(key).slice(2);
                weights[id] = parseFloat(String(val));
              }
            }
            const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threshold, weights }) });
            const j = await res.json();
            alert(j.ok ? 'Guardado' : ('Error: ' + (j.error || 'unknown')));
            if (j.ok) location.reload();
          });
        ` }} />
      </div>
    </main>
  )
}


