import logging
from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    QueryRequest,
    QueryResponse,
    HealthResponse,
    SchemaResponse,
    SuggestionsResponse,
)
from app.services.database import DatabaseService
from app.services.agent import BIAgent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["BI Agent"])

# These will be injected at startup via set_services()
_db: DatabaseService | None = None
_agent: BIAgent | None = None


def set_services(db: DatabaseService, agent: BIAgent) -> None:
    global _db, _agent
    _db = db
    _agent = agent


@router.get("/health", response_model=HealthResponse, responses={503: {"description": "Database not initialized"}})
async def health_check():
    """Health check endpoint with database status."""
    if not _db:
        raise HTTPException(status_code=503, detail="Database not initialized")
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        tables_loaded=_db.tables_loaded,
        total_rows=_db.row_counts,
    )


@router.get("/schema", response_model=SchemaResponse, responses={503: {"description": "Database not initialized"}})
async def get_schema():
    """Return database schema information."""
    if not _db:
        raise HTTPException(status_code=503, detail="Database not initialized")
    return SchemaResponse(
        tables=_db.get_schema_info(),
        relationships=[
            "orders.order_id → order_products_prior.order_id",
            "orders.order_id → order_products_train.order_id",
            "order_products_*.product_id → products.product_id",
            "products.aisle_id → aisles.aisle_id",
            "products.department_id → departments.department_id",
        ],
    )


@router.post("/query", response_model=QueryResponse, responses={503: {"description": "Agent not initialized"}})
async def process_query(request: QueryRequest):
    """Process a natural language BI question."""
    if not _agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    logger.info("Received query: %s", request.question)
    result = await _agent.query(
        question=request.question,
        session_id=request.session_id,
    )
    return result


@router.get("/suggestions", response_model=SuggestionsResponse, responses={503: {"description": "Agent not initialized"}})
async def get_suggestions():
    """Return example questions to help users get started."""
    if not _agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    return SuggestionsResponse(suggestions=_agent.get_suggestions())
