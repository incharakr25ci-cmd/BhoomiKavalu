import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS } from '../../utils/constants';

interface VibrationLineChartProps {
  data: { time: string; intensity: number }[];
  threshold?: number;
}

export function VibrationLineChart({ data, threshold = 5.5 }: VibrationLineChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E6E0" />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#151713' }} />
          <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#151713' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              borderColor: '#D4D5D0',
              borderRadius: '10px',
              fontSize: '12px',
            }}
          />
          <ReferenceLine
            y={threshold}
            stroke={CHART_COLORS.danger}
            strokeDasharray="4 4"
            label={{ value: `Alert Threshold (${threshold})`, position: 'insideTopRight', fontSize: 10, fill: CHART_COLORS.danger }}
          />
          <Line
            type="monotone"
            dataKey="intensity"
            name="Intensity (mm/s)"
            stroke={CHART_COLORS.primary}
            strokeWidth={2.5}
            dot={{ r: 3, fill: CHART_COLORS.primary }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
