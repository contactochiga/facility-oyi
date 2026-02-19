import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
}

export function MetricCard({ title, value, change, trend, icon: Icon, iconColor = 'text-blue-500' }: MetricCardProps) {
  const trendColors = {
    up: 'text-green-500',
    down: 'text-red-500',
    neutral: 'text-slate-400',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-400 mb-2">{title}</p>
          <p className="text-3xl font-semibold mb-1">{value}</p>
          {change && (
            <p className={`text-sm ${trend ? trendColors[trend] : 'text-slate-400'}`}>
              {change}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-slate-800 ${iconColor}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}
