import type { CSSProperties } from 'react'
import type { Finding, FindingStatus } from '@/lib/types'

const STATUS_COLOR: Record<FindingStatus, string> = {
  found: 'var(--found)',
  'not-found': 'var(--notfound)',
  ambiguous: 'var(--uncertain)',
  error: 'var(--error)',
}

const STATUS_LABEL: Record<FindingStatus, string> = {
  found: 'found',
  'not-found': 'not found',
  ambiguous: 'uncertain',
  error: 'error',
}

const card: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '12px 14px',
  background: 'var(--panel-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
}

export function ResultCard({ finding }: { finding: Finding }) {
  const color = STATUS_COLOR[finding.status]
  const dataEntries = finding.data ? Object.entries(finding.data) : []

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden
          style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }}
        />
        <strong style={{ flex: 1 }}>{finding.site}</strong>
        <span style={{ fontSize: 12, color, fontWeight: 600 }}>{STATUS_LABEL[finding.status]}</span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        via <span className="mono">{finding.provider}</span>
        {finding.note ? ` · ${finding.note}` : ''}
      </div>

      {finding.url ? (
        <a href={finding.url} target="_blank" rel="noopener noreferrer nofollow" style={{ fontSize: 13 }}>
          {finding.url}
        </a>
      ) : null}

      {dataEntries.length > 0 ? (
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', fontSize: 12 }}>
          {dataEntries.map(([key, value]) => (
            <div key={key} style={{ display: 'contents' }}>
              <dt style={{ color: 'var(--muted)' }}>{key}</dt>
              <dd className="mono" style={{ margin: 0, overflowWrap: 'anywhere' }}>
                {typeof value === 'string' ? value : JSON.stringify(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}
