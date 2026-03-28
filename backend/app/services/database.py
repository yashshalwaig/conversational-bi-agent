import logging
import time
from pathlib import Path
from typing import Any

import duckdb

logger = logging.getLogger(__name__)


class DatabaseService:
    """DuckDB-based analytical database service for Instacart dataset.
    
    Why DuckDB:
    - Columnar storage handles 32M+ rows efficiently in-memory
    - Native CSV ingestion with auto type detection
    - PostgreSQL-compatible SQL syntax
    - No server process — embedded, zero-config
    - OLAP-optimized: aggregations, joins, window functions are fast
    """

    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.conn = duckdb.connect(":memory:")
        self._tables_loaded: list[str] = []
        self._row_counts: dict[str, int] = {}

    _ORDERS_FILE = "orders.csv"

    def _resolve_data_dir(self) -> Path:
        """Resolve actual data directory — handles Kaggle's archive/ subfolder."""
        if (self.data_dir / self._ORDERS_FILE).exists():
            return self.data_dir
        archive_dir = self.data_dir / "archive"
        if archive_dir.exists() and (archive_dir / self._ORDERS_FILE).exists():
            logger.info("Found data in archive subfolder: %s", archive_dir)
            return archive_dir
        return self.data_dir

    def initialize(self) -> None:
        """Load all CSV files into DuckDB. Called once at startup."""
        resolved_dir = self._resolve_data_dir()

        table_files = {
            "orders": self._ORDERS_FILE,
            "order_products_prior": "order_products__prior.csv",
            "order_products_train": "order_products__train.csv",
            "products": "products.csv",
            "aisles": "aisles.csv",
            "departments": "departments.csv",
        }

        for table_name, filename in table_files.items():
            filepath = resolved_dir / filename
            if not filepath.exists():
                logger.warning("Data file not found: %s", filepath)
                continue

            try:
                start = time.time()
                self.conn.execute(
                    f"CREATE TABLE {table_name} AS SELECT * FROM read_csv_auto('{filepath}')"
                )
                count = self.conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                elapsed = time.time() - start

                self._tables_loaded.append(table_name)
                self._row_counts[table_name] = count
                logger.info("Loaded %s: %s rows in %.2fs", table_name, f"{count:,}", elapsed)
            except Exception as e:
                logger.error("Failed to load %s: %s", table_name, e)

        logger.info("Database initialized: %s tables loaded", len(self._tables_loaded))

    @property
    def tables_loaded(self) -> list[str]:
        return self._tables_loaded

    @property
    def row_counts(self) -> dict[str, int]:
        return self._row_counts

    def get_schema_info(self) -> dict[str, list[dict]]:
        """Return schema information for all loaded tables."""
        schema = {}
        for table in self._tables_loaded:
            columns = self.conn.execute(
                f"SELECT column_name, data_type FROM information_schema.columns "
                f"WHERE table_name = '{table}' ORDER BY ordinal_position"
            ).fetchall()
            schema[table] = [{"name": col[0], "type": col[1]} for col in columns]
        return schema

    def execute_query(self, sql: str, max_rows: int = 500) -> dict[str, Any]:
        """Execute a SQL query and return structured results.
        
        Returns:
            dict with keys: columns, data, row_count, execution_time_ms
        """
        start = time.time()
        try:
            result = self.conn.execute(sql)
            columns = [desc[0] for desc in result.description]
            rows = result.fetchmany(max_rows)
            total_count = len(rows)

            # Try to get full count if we hit the limit
            if total_count == max_rows:
                try:
                    count_sql = f"SELECT COUNT(*) FROM ({sql}) AS _count_subquery"
                    total_count = self.conn.execute(count_sql).fetchone()[0]
                except Exception:
                    pass  # Use fetched count as fallback

            elapsed_ms = (time.time() - start) * 1000

            data = []
            for row in rows:
                record = {}
                for i, col in enumerate(columns):
                    val = row[i]
                    # Convert DuckDB types to JSON-serializable types
                    if val is None:
                        record[col] = None
                    elif isinstance(val, (int, float, str, bool)):
                        record[col] = val
                    else:
                        record[col] = str(val)
                data.append(record)

            return {
                "columns": columns,
                "data": data,
                "row_count": total_count,
                "execution_time_ms": round(elapsed_ms, 2),
                "error": None,
            }
        except Exception as e:
            elapsed_ms = (time.time() - start) * 1000
            logger.error("Query execution failed: %s\nSQL: %s", e, sql)
            return {
                "columns": [],
                "data": [],
                "row_count": 0,
                "execution_time_ms": round(elapsed_ms, 2),
                "error": str(e),
            }

    def get_sample_data(self, table: str, limit: int = 5) -> list[dict]:
        """Get sample rows from a table for context."""
        result = self.execute_query(f"SELECT * FROM {table} LIMIT {limit}")
        return result["data"]
