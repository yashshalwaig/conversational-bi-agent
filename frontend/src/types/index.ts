export type ChartType = "bar" | "line" | "pie" | "table" | "number" | "scatter";

export interface ChartConfig {
  chart_type: ChartType;
  x_column: string | null;
  y_column: string | null;
  title: string;
}

export interface QueryResponse {
  answer: string;
  sql: string;
  data: Record<string, unknown>[];
  chart_config: ChartConfig;
  row_count: number;
  execution_time_ms: number;
  session_id: string;
  error: string | null;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  data?: Record<string, unknown>[];
  chart_config?: ChartConfig;
  row_count?: number;
  execution_time_ms?: number;
  error?: string | null;
  timestamp: Date;
}

export interface HealthResponse {
  status: string;
  version: string;
  tables_loaded: string[];
  total_rows: Record<string, number>;
}
