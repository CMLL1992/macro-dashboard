import Link from 'next/link'

export default function QAStatusBar({ counts, updatedAt, link, tooltip }: { counts: { pass: number; warn: number; fail: number }; updatedAt?: string; link?: string; tooltip?: { pass?: string[]; warn?: string[]; fail?: string[] } }) {
  const updatedLocal = updatedAt ? new Date(updatedAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : undefined
  const dotClass = counts.fail>0 ? 'bg-red-500' : counts.warn>0 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className={`w-2.5 h-2.5 rounded-full ${dotClass}`} title={`PASS ${counts.pass} / WARN ${counts.warn} / FAIL ${counts.fail}`}></div>
      <div>
        QA: 🟢 PASS {counts.pass} | 🟡 WARN {counts.warn} | 🔴 FAIL {counts.fail}
        {updatedLocal ? <span suppressHydrationWarning> · Última rev: {updatedLocal}</span> : null}
      </div>
      {link && (
        <Link href={link as any} className="underline">Ver QA</Link>
      )}
    </div>
  )
}


