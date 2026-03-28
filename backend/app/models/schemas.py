from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class ChartType(str, Enum):
    BAR = "bar"
    LINE = "line"
    PIE = "pie"
    TABLE = "table"
    NUMBER = "number"
    SCATTER = "scatter"


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000, description="Natural language question")
    session_id: Optional[str] = Field(default=None, description="Session ID for conversation memory")


class ChartConfig(BaseModel):
    chart_type: ChartType = ChartType.TABLE
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    title: str = ""


class QueryResponse(BaseModel):
    answer: str
    sql: str
    data: list[dict]
    chart_config: ChartConfig
    row_count: int
    execution_time_ms: float
    session_id: str
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    version: str
    tables_loaded: list[str]
    total_rows: dict[str, int]


class SchemaResponse(BaseModel):
    tables: dict[str, list[dict]]
    relationships: list[str]


class SuggestionsResponse(BaseModel):
    suggestions: list[str]
