import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.services.database import DatabaseService
from app.services.agent import BIAgent
from app.api.routes import router, set_services

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: load data into DuckDB and initialize agent."""
    logger.info("Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)
    logger.info("Data directory: %s", settings.DATA_DIR)
    logger.info("LLM model: %s", settings.OPENAI_MODEL)

    # Initialize database
    db = DatabaseService(data_dir=settings.DATA_DIR)
    db.initialize()

    if not db.tables_loaded:
        logger.error("No tables loaded! Check data directory.")
    else:
        logger.info("Tables loaded: %s", db.tables_loaded)
        for table, count in db.row_counts.items():
            logger.info("  %s: %s rows", table, f"{count:,}")

    # Initialize agent
    agent = BIAgent(db=db)

    # Inject into routes
    set_services(db, agent)

    logger.info("Application ready")
    yield

    logger.info("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered Business Intelligence agent that converts natural language to SQL queries and visualizations over the Instacart Market Basket dataset.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    return {"message": f"{settings.APP_NAME} v{settings.APP_VERSION}", "docs": "/docs"}
