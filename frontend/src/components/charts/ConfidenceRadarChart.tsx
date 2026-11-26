import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { CHART_COLORS } from '../../utils/constants';

interface ConfidenceRadarChartProps {
  camera: number;
  audio: number;
  vibration: number;
  overall: number;
}

export function ConfidenceRadarChart({ camera, audio, vibration, overall }: ConfidenceRadarChartProps) {
  const data = [
    { metric: 'Camera AI', score: Math.round(camera * 100) },
    { metric: 'Audio AI', score: Math.round(audio * 100) },
    { metric: 'Vibration', score: Math.round(Math.min(1, vibration / 10) * 100) },
    { metric: 'Fused Overall', score: Math.round(overall * 100) },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke="#D4D5D0" />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#151713' }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Radar
            name="Confidence %"
            dataKey="score"
            stroke={CHART_COLORS.primary}
            fill={CHART_COLORS.primary}
            fillOpacity={0.35}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
