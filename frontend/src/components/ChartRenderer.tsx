"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartConfig } from "@/types";

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#84cc16",
];

interface ChartRendererProps {
  data: Record<string, unknown>[];
  config: ChartConfig;
}

export default function ChartRenderer({ data, config }: ChartRendererProps) {
  if (!data || data.length === 0) return null;

  const { chart_type, x_column, y_column, title } = config;
  const xKey = x_column || Object.keys(data[0])[0];
  const yKey = y_column || Object.keys(data[0])[1] || Object.keys(data[0])[0];

  if (chart_type === "number") {
    const value = Object.values(data[0])[0];
    return (
      <div className="flex flex-col items-center justify-center py-8">
        {title && (
          <p className="text-sm text-gray-500 mb-2">{title}</p>
        )}
        <p className="text-5xl font-bold text-primary-600">
          {typeof value === "number"
            ? value.toLocaleString()
            : String(value)}
        </p>
      </div>
    );
  }

  // Truncate long labels
  const formatLabel = (val: unknown) => {
    const s = String(val);
    return s.length > 20 ? s.slice(0, 18) + "…" : s;
  };

  return (
    <div className="w-full">
      {title && (
        <p className="text-sm font-medium text-gray-700 mb-3 text-center">
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={chart_type === "pie" ? 420 : 350}>
        {chart_type === "bar" ? (
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11 }}
              tickFormatter={formatLabel}
              angle={-35}
              textAnchor="end"
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              }}
            />
            <Bar dataKey={yKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : chart_type === "line" ? (
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11 }}
              tickFormatter={formatLabel}
              angle={-35}
              textAnchor="end"
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              }}
            />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        ) : chart_type === "pie" ? (
          (() => {
            // Group small slices into "Other" when too many categories
            const MAX_SLICES = 10;
            const MIN_LABEL_PERCENT = 0.04;
            let pieData = data;
            if (data.length > MAX_SLICES) {
              const sorted = [...data].sort(
                (a, b) => Number(b[yKey] || 0) - Number(a[yKey] || 0)
              );
              const top = sorted.slice(0, MAX_SLICES - 1);
              const rest = sorted.slice(MAX_SLICES - 1);
              const otherVal = rest.reduce(
                (sum, r) => sum + Number(r[yKey] || 0),
                0
              );
              pieData = [
                ...top,
                { [xKey]: "Other", [yKey]: Math.round(otherVal * 100) / 100 },
              ];
            }
            return (
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey={yKey}
                  nameKey={xKey}
                  cx="50%"
                  cy="50%"
                  outerRadius={130}
                  label={({ name, percent, x, y }) => {
                    if (percent < MIN_LABEL_PERCENT) return null;
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="#374151"
                        fontSize={11}
                        textAnchor={x > 0 ? "start" : "end"}
                        dominantBaseline="central"
                      >
                        {`${formatLabel(name)} ${(percent * 100).toFixed(1)}%`}
                      </text>
                    );
                  }}
                  labelLine={true}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    typeof value === "number" ? value.toLocaleString() : value,
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                />
              </PieChart>
            );
          })()
        ) : chart_type === "scatter" ? (
          <ScatterChart margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={xKey} name={xKey} tick={{ fontSize: 11 }} />
            <YAxis dataKey={yKey} name={yKey} tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data} fill="#3b82f6" />
          </ScatterChart>
        ) : (
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} angle={-35} textAnchor="end" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey={yKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
