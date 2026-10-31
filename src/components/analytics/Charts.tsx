import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { NamedMetric, SeriesPoint } from '@/lib/viz'
import { hasValues } from '@/lib/viz'
import { ChartCard } from './ChartCard'
import { CHART, PIE_COLORS } from './chartTheme'

function tipStyle(): { backgroundColor: string; border: string; borderRadius: number; color: string; fontSize: number } {
  return {
    backgroundColor: CHART.tooltipBg,
    border: `1px solid ${CHART.tooltipBorder}`,
    borderRadius: 10,
    color: CHART.text,
    fontSize: 12,
  }
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0)
}

export function WeeklyCompletionsChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ChartCard title="Last 7 days" hint="Tasks completed" empty="No activity yet this week — complete a task to see your rhythm." hasData={hasValues(data)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: CHART.faint, fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={tipStyle()} formatter={(v) => [`${num(v)} completed`, 'Tasks']} />
          <Bar dataKey="value" radius={[8, 8, 4, 4]} maxBarSize={36}>
            {data.map((d) => (
              <Cell key={d.date} fill={d.isToday ? CHART.accent : CHART.accentLight} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function PlannedDoneChart({ data }: { data: SeriesPoint[] }) {
  const has = data.some((d) => d.value > 0 || (d.extra ?? 0) > 0)
  return (
    <ChartCard title="Planned vs done" empty="Complete a few planned tasks to see the week." hasData={has}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: CHART.faint, fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={tipStyle()} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="extra" name="Planned" fill={CHART.track} radius={[6, 6, 2, 2]} maxBarSize={22} />
          <Bar dataKey="value" name="Done" fill={CHART.accent} radius={[6, 6, 2, 2]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function FocusMinutesChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ChartCard title="Focus hours" hint="Minutes logged" empty="Finish a focus session to track time." hasData={hasValues(data)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: CHART.faint, fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={tipStyle()} formatter={(v) => [`${num(v)}m`, 'Focus']} />
          <Bar dataKey="value" name="Minutes" fill={CHART.accentDeep} radius={[8, 8, 4, 4]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function CompletionTrendChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ChartCard title="Completion trend" hint="Last 14 days" empty="Complete tasks across a few days to see the trend." hasData={hasValues(data)} height={240}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="tfTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART.muted, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fill: CHART.faint, fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={tipStyle()} formatter={(v) => [`${num(v)} completed`, 'Tasks']} />
          <Area type="monotone" dataKey="value" stroke={CHART.accent} strokeWidth={2} fill="url(#tfTrendFill)" />
          <Line type="monotone" dataKey="value" stroke={CHART.accentDeep} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function PriorityDonutChart({ data }: { data: NamedMetric[] }) {
  const total = data.reduce((n, d) => n + d.value, 0)
  return (
    <ChartCard title="Open tasks by priority" empty="No open tasks to chart." hasData={total > 0} height={240}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={58} outerRadius={86} paddingAngle={3} stroke="none">
            {data.map((d, i) => (
              <Cell key={d.key} fill={d.color ?? PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tipStyle()} formatter={(v, name) => [`${num(v)} open`, String(name)]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function NamedBarsChart({
  title,
  data,
  empty,
  valueLabel = 'Tasks',
}: {
  title: string
  data: NamedMetric[]
  empty: string
  valueLabel?: string
}) {
  return (
    <ChartCard title={title} empty={empty} hasData={hasValues(data)} height={Math.max(180, data.length * 36)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: CHART.faint, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={88} tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tipStyle()} formatter={(v) => [`${num(v)}`, valueLabel]} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={18}>
            {data.map((d, i) => (
              <Cell key={d.key} fill={d.color ?? PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
