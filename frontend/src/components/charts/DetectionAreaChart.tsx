import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS } from '../../utils/constants';

interface DetectionAreaChartProps {
  data: { date: string; count: number }[];
}

export function DetectionAreaChart({ data }: DetectionAreaChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="oliveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
              <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E6E0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#151713' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#151713' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              borderColor: '#D4D5D0',
              borderRadius: '10px',
              fontSize: '12px',
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            name="Detections"
            stroke={CHART_COLORS.primary}
            strokeWidth={2.5}
            fill="url(#oliveFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
