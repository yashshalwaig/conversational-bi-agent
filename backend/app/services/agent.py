import json
import logging
import uuid
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from app.config import get_settings
from app.models.schemas import ChartConfig, ChartType, QueryResponse
from app.prompts.templates import SYSTEM_PROMPT, RETRY_PROMPT, FOLLOWUP_CONTEXT
from app.services.database import DatabaseService

logger = logging.getLogger(__name__)

settings = get_settings()


class BIAgent:
    """LangChain-powered BI agent that converts natural language to SQL.

    Architecture:
    1. User question + schema context + conversation history → LLM
    2. LLM generates structured JSON with SQL + chart config
    3. SQL executed against DuckDB
    4. On failure: error fed back to LLM for retry (up to MAX_RETRIES)
    5. Results formatted and returned with chart configuration
    """

    def __init__(self, db: DatabaseService):
        self.db = db
        self.llm = ChatOpenAI(
            model=settings.OPENAI_MODEL,
            temperature=settings.OPENAI_TEMPERATURE,
            api_key=settings.OPENAI_API_KEY,
            request_timeout=settings.QUERY_TIMEOUT_SECONDS,
        )
        # In-memory session store: session_id -> list of (question, sql, answer) tuples
        self._sessions: dict[str, list[dict]] = {}

    def _get_or_create_session(self, session_id: Optional[str]) -> str:
        if not session_id:
            session_id = str(uuid.uuid4())
        if session_id not in self._sessions:
            self._sessions[session_id] = []
        return session_id

    def _build_messages(self, question: str, session_id: str) -> list:
        """Build message list with system prompt, conversation history, and user question."""
        messages = [SystemMessage(content=SYSTEM_PROMPT)]

        # Add conversation history (last 5 turns for context window management)
        history = self._sessions.get(session_id, [])
        if history:
            recent = history[-5:]
            history_text = "\n".join(
                f"Q: {h['question']}\nSQL: {h['sql']}\nAnswer: {h['answer']}"
                for h in recent
            )
            context = FOLLOWUP_CONTEXT.format(history=history_text)
            messages.append(SystemMessage(content=context))

        messages.append(HumanMessage(content=question))
        return messages

    def _parse_llm_response(self, content: str) -> dict:
        """Parse LLM JSON response, handling markdown code blocks."""
        text = content.strip()
        if text.startswith("```"):
            # Remove markdown code fence
            lines = text.split("\n")
            lines = lines[1:]  # Remove opening ```json or ```
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)
        return json.loads(text)

    def _build_error_response(
        self, session_id: str, message: str, sql: str = "",
        error: str = "", execution_time_ms: float = 0,
    ) -> QueryResponse:
        """Build a standardized error response."""
        return QueryResponse(
            answer=message,
            sql=sql,
            data=[],
            chart_config=ChartConfig(chart_type=ChartType.TABLE, title="Error"),
            row_count=0,
            execution_time_ms=execution_time_ms,
            session_id=session_id,
            error=error,
        )

    def _build_success_response(
        self, parsed: dict, result: dict, session_id: str, question: str,
    ) -> QueryResponse:
        """Build response from successful SQL execution and store in session."""
        chart_config = ChartConfig(
            chart_type=ChartType(parsed.get("chart_type", "table")),
            x_column=parsed.get("x_column"),
            y_column=parsed.get("y_column"),
            title=parsed.get("title", ""),
        )
        answer = parsed.get("explanation", "Here are the results.")
        sql = parsed.get("sql", "")

        self._sessions[session_id].append(
            {"question": question, "sql": sql, "answer": answer}
        )
        logger.info(
            "[%s] Success: %s rows, %sms",
            session_id[:8], result['row_count'], result['execution_time_ms'],
        )
        return QueryResponse(
            answer=answer,
            sql=sql,
            data=result["data"],
            chart_config=chart_config,
            row_count=result["row_count"],
            execution_time_ms=result["execution_time_ms"],
            session_id=session_id,
        )

    async def _attempt_query(
        self, messages: list, session_id: str,
    ) -> tuple[dict | None, dict | None, str | None]:
        """Single LLM call + SQL execution attempt.

        Returns (parsed, result, error). On success error is None.
        """
        response = await self.llm.ainvoke(messages)
        parsed = self._parse_llm_response(response.content)

        sql = parsed.get("sql", "")
        if not sql:
            # LLM intentionally returned no SQL (e.g., dataset limitation explanation)
            explanation = parsed.get("explanation", "")
            if explanation:
                return parsed, {"data": [], "row_count": 0, "execution_time_ms": 0, "error": None}, None
            raise ValueError("LLM returned empty SQL")

        logger.info("[%s] Generated SQL: %s", session_id[:8], sql)
        result = self.db.execute_query(sql, max_rows=settings.MAX_ROWS_RETURN)

        if result["error"]:
            return parsed, result, result["error"]
        return parsed, result, None

    def _append_retry_context(
        self, messages: list, attempt: int, last_error: str | None, last_sql: str | None, session_id: str,
    ) -> None:
        """Append retry context to messages if this is a retry attempt."""
        if attempt <= 1 or not last_error:
            return
        retry_msg = RETRY_PROMPT.format(error=last_error, failed_sql=last_sql)
        messages.append(HumanMessage(content=retry_msg))
        logger.info("[%s] Retry %s/%s", session_id[:8], attempt, settings.MAX_RETRIES)

    async def _run_single_attempt(
        self, messages: list, session_id: str, question: str,
    ) -> tuple[QueryResponse | None, str | None, str | None]:
        """Execute one attempt. Returns (response, last_error, last_sql)."""
        try:
            parsed, result, error = await self._attempt_query(messages, session_id)
            sql = parsed.get("sql", "") if parsed else ""
            if error:
                return None, error, sql
            return self._build_success_response(parsed, result, session_id, question), None, sql
        except json.JSONDecodeError as e:
            logger.warning("[%s] JSON parse error: %s", session_id[:8], e)
            return None, f"Failed to parse LLM response as JSON: {e}", None
        except Exception as e:
            logger.error("[%s] Unexpected error: %s", session_id[:8], e, exc_info=True)
            return None, str(e), None

    async def query(self, question: str, session_id: Optional[str] = None) -> QueryResponse:
        """Process a natural language question and return BI results."""
        session_id = self._get_or_create_session(session_id)
        logger.info("[%s] Question: %s", session_id[:8], question)

        messages = self._build_messages(question, session_id)
        last_error: str | None = None
        last_sql: str | None = None

        for attempt in range(1, settings.MAX_RETRIES + 1):
            self._append_retry_context(messages, attempt, last_error, last_sql, session_id)
            response, last_error, attempt_sql = await self._run_single_attempt(messages, session_id, question)
            last_sql = attempt_sql or last_sql
            if response:
                return response

        return self._build_error_response(
            session_id, f"An error occurred: {last_error}",
            sql=last_sql or "", error=last_error or "Max retries exhausted",
        )

    def get_suggestions(self) -> list[str]:
        """Return example questions to get users started."""
        return [
            "What are the top 10 most ordered products?",
            "Show me the distribution of orders by day of week",
            "Which departments have the highest reorder rate?",
            "What hour of the day do most orders happen?",
            "What are the top 5 aisles by number of products?",
            "Show the average basket size (products per order)",
            "Which products are most commonly reordered?",
            "Compare reorder rates across the top 10 departments",
            "What is the average days between orders for repeat customers?",
            "Show me the top 10 aisles with highest reorder rate and their average cart position",
        ]
