"use client";

import { useState } from "react";
import { Message } from "@/types";
import ChartRenderer from "./ChartRenderer";
import DataTable from "./DataTable";

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopySql = () => {
    if (message.sql) {
      navigator.clipboard.writeText(message.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[75%] bg-primary-600 text-white px-4 py-3 rounded-2xl rounded-br-md shadow-sm">
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="max-w-[85%] w-full">
        {/* Answer text */}
        <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
          <p className="text-sm leading-relaxed text-gray-800">
            {message.content}
          </p>

          {/* Metadata bar */}
          {(message.sql || message.execution_time_ms) && (
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
              {message.execution_time_ms !== undefined && (
                <span>⚡ {message.execution_time_ms.toFixed(0)}ms</span>
              )}
              {message.row_count !== undefined && (
                <span>{message.row_count.toLocaleString()} rows</span>
              )}
              {message.sql && (
                <>
                  <button
                    onClick={() => setShowSql(!showSql)}
                    className="text-primary-500 hover:text-primary-700 font-medium transition-colors"
                  >
                    {showSql ? "Hide SQL" : "Show SQL"}
                  </button>
                  <button
                    onClick={handleCopySql}
                    className="text-gray-400 hover:text-primary-600 font-medium transition-colors"
                  >
                    {copied ? "✓ Copied" : "Copy SQL"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* SQL Block */}
          {showSql && message.sql && (
            <div className="mt-2 bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto font-mono">
              <pre className="whitespace-pre-wrap">{message.sql}</pre>
            </div>
          )}
        </div>

        {/* Chart */}
        {message.data &&
          message.data.length > 0 &&
          message.chart_config &&
          message.chart_config.chart_type !== "table" && (
            <div className="mt-3 bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
              <ChartRenderer
                data={message.data}
                config={message.chart_config}
              />
            </div>
          )}

        {/* Data Table */}
        {message.data && message.data.length > 0 && (
          <div className="mt-3">
            <DataTable
              data={message.data}
              maxRows={50}
              defaultCollapsed={
                !!(
                  message.chart_config &&
                  message.chart_config.chart_type !== "table"
                )
              }
            />
          </div>
        )}

        {/* Error */}
        {message.error && (
          <div className="mt-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
            {message.error}
          </div>
        )}
      </div>
    </div>
  );
}
