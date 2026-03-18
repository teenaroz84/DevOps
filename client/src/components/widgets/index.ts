/**
 * Widget Primitive Library
 *
 * Import any primitive from this barrel:
 *   import { WidgetShell, StatCardGrid, DataTable, ... } from './widgets'
 *
 * Primitives are pure display components — they accept data via props and
 * contain no fetching logic. Business widgets (ExecutiveWidgets, DataSourceWidgets,
 * DMFWidgets) compose these primitives and own their own data/state.
 */

export { WidgetShell } from './WidgetShell'
export type { WidgetShellProps } from './WidgetShell'

export { StatCardGrid } from './StatCardGrid'
export type { StatCardItem } from './StatCardGrid'

export { MetricBarList } from './MetricBarList'
export type { MetricBarItem } from './MetricBarList'

export { TrendLineChart, ComposedBarLineChart } from './TrendCharts'
export type { LineConfig, BarConfig, ComposedLineConfig } from './TrendCharts'

export { DonutChart, DonutPair } from './DonutChart'
export type { DonutSlice } from './DonutChart'

export { HeatmapGrid } from './HeatmapGrid'
export type { HeatmapGridProps } from './HeatmapGrid'

export { DataTable } from './DataTable'
export type { ColumnDef } from './DataTable'

export { AlertBanner } from './AlertBanner'
export type { AlertBannerProps, AlertSeverity } from './AlertBanner'

export { SegmentedBarList } from './SegmentedBarList'
export type { SegmentedBarItem, SegmentedBarSegment } from './SegmentedBarList'

export { WidgetDetailModal } from './WidgetDetailModal'
export type { WidgetDetailModalProps, WidgetDetailStat } from './WidgetDetailModal'
