import type { CSSProperties } from 'react'
import { groupFindings } from '@/lib/group'
import type { Finding } from '@/lib/types'
import { ResultCard } from './ResultCard'

const sectionTitle: CSSProperties = {
  margin: '0 0 10px',
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: 'var(--muted)',
}

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: 10,
}

function Section({ title, findings }: { title: string; findings: readonly Finding[] }) {
  if (findings.length === 0) return null
  return (
    <section style={{ marginTop: 22 }}>
      <h2 style={sectionTitle}>
        {title} <span style={{ color: 'var(--text)' }}>{findings.length}</span>
      </h2>
      <div style={grid}>
        {findings.map((f) => (
          <ResultCard key={`${f.provider}:${f.site}`} finding={f} />
        ))}
      </div>
    </section>
  )
}

export function ResultList({ findings }: { findings: readonly Finding[] }) {
  const { found, uncertain, notFound } = groupFindings(findings)
  return (
    <div>
      <Section title="Found" findings={found} />
      <Section title="Uncertain / errors" findings={uncertain} />
      <Section title="Not found" findings={notFound} />
    </div>
  )
}
