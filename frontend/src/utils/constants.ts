import type { ThreatLevel } from '../types';

export const API_BASE_URL = '/api';

export const THREAT_LEVEL_CONFIG: Record<ThreatLevel, { label: string; bgClass: string; textClass: string; borderClass: string; dotClass: string }> = {
  normal: {
    label: 'Normal',
    bgClass: 'bg-olive/10',
    textClass: 'text-olive',
    borderClass: 'border-olive/30',
    dotClass: 'bg-olive',
  },
  warning: {
    label: 'Warning',
    bgClass: 'bg-bk-yellow/40',
    textClass: 'text-bk-yellow-dark',
    borderClass: 'border-bk-yellow-dark/30',
    dotClass: 'bg-bk-yellow-dark',
  },
  high: {
    label: 'High',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-400/30',
    dotClass: 'bg-amber-500',
  },
  critical: {
    label: 'Critical',
    bgClass: 'bg-bk-danger-light',
    textClass: 'text-bk-danger',
    borderClass: 'border-bk-danger/30',
    dotClass: 'bg-bk-danger',
  },
};

export const ANIMAL_ICONS: Record<string, string> = {
  'Asian Elephant': '🐘',
  'Elephant': '🐘',
  'Tiger': '🐅',
  'Leopard': '🐆',
  'WILD BOAR': '🐗',
  'Wild Boar': '🐗',
  'wild boar': '🐗',
  'wildboar': '🐗',
  'Pig': '🐗',
  'Bear': '🐻',
  'Gaur': '🦬',
  'Deer': '🦌',
  'Monkey': '🐒',
  'Snake': '🐍',
  'Unknown': '❓',
  'NONE': '—',
};

export const REGIONS = [
  'Nagarhole',
  'Bandipur',
  'BRT Hills',
  'Kudremukh',
  'Bhadra',
  'Dandeli-Anshi',
  'Cauvery',
  'Sharavathi',
];

export const SENSOR_TYPES = [
  { value: 'camera', label: 'Camera' },
  { value: 'audio', label: 'Audio' },
  { value: 'vibration', label: 'Vibration' },
  { value: 'fused', label: 'Fused' },
];

export const CHART_COLORS = {
  primary: '#687442',
  secondary: '#8A9A5B',
  accent: '#F3E9A4',
  accentDark: '#E8D56C',
  danger: '#DC2626',
  gray: '#D4D5D0',
  black: '#151713',
};
