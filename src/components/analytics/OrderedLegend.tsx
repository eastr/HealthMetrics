import { Legend, type LegendProps } from 'recharts'
import { useMetrics } from '../../hooks/useMetricColors'

export default function OrderedLegend(props: Partial<LegendProps> = {}) {
  const { metrics } = useMetrics()

  return (
    <Legend
      {...props}
      content={({ payload }) => {
        if (!payload?.length) return null

        const items = [...payload].sort((a, b) => {
          const indexA = metrics.findIndex((m) => m.key === a.dataKey)
          const indexB = metrics.findIndex((m) => m.key === b.dataKey)
          return indexA - indexB
        })

        return (
          <ul
            className="recharts-default-legend"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '8px 16px',
              padding: 0,
              margin: 0,
              listStyle: 'none',
              fontSize: 12,
            }}
          >
            {items.map((entry) => (
              <li
                key={String(entry.dataKey ?? entry.value)}
                className="recharts-legend-item"
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    marginRight: 6,
                    backgroundColor: entry.color,
                    borderRadius: 2,
                  }}
                />
                <span style={{ color: '#64748b' }}>{entry.value}</span>
              </li>
            ))}
          </ul>
        )
      }}
    />
  )
}
