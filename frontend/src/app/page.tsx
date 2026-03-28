"use client";

import { useState, useEffect, useRef } from "react";
import { Message } from "@/types";
import { queryBI, getSuggestions, getHealth } from "@/lib/api";
import MessageBubble from "@/components/MessageBubble";
import QueryInput from "@/components/QueryInput";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [dbStatus, setDbStatus] = useState<{
    loaded: boolean;
    tables: string[];
    rows: Record<string, number>;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSuggestions()
      .then((res) => setSuggestions(res.suggestions))
      .catch(() => {});

    getHealth()
      .then((res) =>
        setDbStatus({
          loaded: true,
          tables: res.tables_loaded,
          rows: res.total_rows,
        })
      )
      .catch(() => setDbStatus(null));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (question: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setThinkingStep(0);
    const t1 = setTimeout(() => setThinkingStep(1), 1500);
    const t2 = setTimeout(() => setThinkingStep(2), 4000);
    const t3 = setTimeout(() => setThinkingStep(3), 7000);

    try {
      const res = await queryBI(question, sessionId);
      if (!sessionId) setSessionId(res.session_id);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.answer,
        sql: res.sql,
        data: res.data,
        chart_config: res.chart_config,
        row_count: res.row_count,
        execution_time_ms: res.execution_time_ms,
        error: res.error,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          err instanceof Error
            ? `Error: ${err.message}`
            : "Something went wrong. Please try again.",
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setIsLoading(false);
      setThinkingStep(0);
    }
  };

  const totalRows = dbStatus
    ? Object.values(dbStatus.rows).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">AI BI Agent</h1>
            <p className="text-xs text-gray-500">
              Conversational Business Intelligence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          {dbStatus && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                {dbStatus.tables.length} tables
              </span>
              <span>{totalRows.toLocaleString()} rows</span>
            </>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                setSessionId(undefined);
                setThinkingStep(0);
              }}
              className="ml-2 px-2.5 py-1 rounded-md text-xs font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border border-transparent hover:border-red-200"
            >
              Clear Chat
            </button>
          )}
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Ask anything about your data
              </h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto mb-8">
                I can query the Instacart dataset with 3.4M+ orders, generate
                charts, and help you discover insights. Try a question below.
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                {suggestions.slice(0, 6).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSubmit(s)}
                    className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-full hover:border-primary-300 hover:text-primary-600 transition-all shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {isLoading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                  <span className="text-xs text-gray-400 ml-1">
                    {thinkingStep === 0 && "Understanding question..."}
                    {thinkingStep === 1 && "Generating SQL..."}
                    {thinkingStep === 2 && "Executing query on 37M rows..."}
                    {thinkingStep === 3 && "Building visualization..."}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 bg-gray-50 border-t border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <QueryInput
            onSubmit={handleSubmit}
            isLoading={isLoading}
            suggestions={suggestions}
          />
          <p className="text-center text-[10px] text-gray-400 mt-2">
            Powered by DuckDB + GPT-4o-mini | Instacart Market Basket Dataset
          </p>
        </div>
      </div>
    </div>
  );
}
