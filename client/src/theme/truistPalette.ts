export const TRUIST = {
  purple: '#2E1A47',
  white: '#FFFFFF',
  dusk: '#7C6992',
  sky: '#B0E0E2',
  darkGray: '#787878',
  charcoal: '#34343B',
  dawn: '#AFABC9',
  lightGray: '#C9C9C9',
  midGray: '#A8A8A8',
  shell: '#F6F4F8',
  mist: '#EEF7F8',
  paper: '#FAFAFA',
  ink: '#1F2937',
  muted: '#60717F',
  line: '#D9E3EE',
} as const

export const APP_COLORS = {
  primary: TRUIST.purple,
  secondary: TRUIST.dusk,
  tertiary: TRUIST.sky,
  success: TRUIST.dusk,
  warning: TRUIST.darkGray,
  danger: TRUIST.charcoal,
  info: TRUIST.purple,
  background: TRUIST.paper,
  panel: TRUIST.white,
  panelAlt: TRUIST.shell,
  border: TRUIST.line,
  text: TRUIST.ink,
  subtext: TRUIST.muted,
} as const

export const STATUS_BADGE = {
  critical: { color: TRUIST.charcoal, bg: '#EFEDF4', dot: TRUIST.charcoal },
  high: { color: TRUIST.purple, bg: '#ECE9F1', dot: TRUIST.purple },
  medium: { color: TRUIST.darkGray, bg: '#F1F1F1', dot: TRUIST.darkGray },
  low: { color: TRUIST.dusk, bg: TRUIST.shell, dot: TRUIST.dusk },
  info: { color: TRUIST.purple, bg: TRUIST.mist, dot: TRUIST.sky },
  success: { color: TRUIST.dusk, bg: TRUIST.shell, dot: TRUIST.dusk },
  warning: { color: TRUIST.darkGray, bg: '#F1F1F1', dot: TRUIST.midGray },
  error: { color: TRUIST.charcoal, bg: '#EFEDF4', dot: TRUIST.charcoal },
} as const

export const PRIORITY_BADGE = {
  P1: { color: TRUIST.charcoal, bg: '#EFEDF4' },
  P2: { color: TRUIST.purple, bg: '#ECE9F1' },
  P3: { color: TRUIST.dusk, bg: TRUIST.shell },
  P4: { color: TRUIST.darkGray, bg: '#F1F1F1' },
  P5: { color: TRUIST.midGray, bg: '#F5F5F5' },
} as const

export const STATUS_STATE = {
  open: { color: TRUIST.purple, bg: '#ECE9F1' },
  in_progress: { color: TRUIST.darkGray, bg: '#F1F1F1' },
  resolved: { color: TRUIST.dusk, bg: TRUIST.shell },
  healthy: { color: TRUIST.dusk, bg: TRUIST.shell, dot: TRUIST.dusk },
  at_risk: { color: TRUIST.darkGray, bg: '#F1F1F1', dot: TRUIST.darkGray },
  critical: { color: TRUIST.charcoal, bg: '#EFEDF4', dot: TRUIST.charcoal },
} as const

export const AGENT_BRAND = {
  knowledge: TRUIST.purple,
  esp: TRUIST.dusk,
  dmf: TRUIST.darkGray,
  servicenow: TRUIST.charcoal,
  talend: TRUIST.dawn,
  snowflake: TRUIST.sky,
} as const

export const CHART_PALETTE = [
  TRUIST.purple,
  TRUIST.dusk,
  TRUIST.sky,
  TRUIST.darkGray,
  TRUIST.charcoal,
  TRUIST.dawn,
  TRUIST.midGray,
  TRUIST.lightGray,
]

export const HEALTH_COLOR = (level: 'ok' | 'warn' | 'alert') => {
  if (level === 'ok') return TRUIST.dusk
  if (level === 'warn') return TRUIST.darkGray
  return TRUIST.charcoal
}
