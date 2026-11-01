"""Database models. SQLAlchemy keeps the schema portable: set DATABASE_URL to a
postgresql+psycopg URL to move off SQLite without code changes."""

from collections.abc import Iterator
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

from .config import get_settings


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Dataset(Base):
    """Provenance record for every batch of observations in the database."""

    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    # simulated | csv_upload | provider
    source_type: Mapped[str] = mapped_column(String(32))
    source_detail: Mapped[str] = mapped_column(Text, default="")
    is_simulated: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    rows_received: Mapped[int] = mapped_column(Integer, default=0)
    rows_imported: Mapped[int] = mapped_column(Integer, default=0)
    rows_rejected: Mapped[int] = mapped_column(Integer, default=0)
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    validation: Mapped[dict] = mapped_column(JSON, default=dict)


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    river: Mapped[str] = mapped_column(String(200), default="")
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    is_simulated: Mapped[bool] = mapped_column(default=False)
    # User-configurable alert levels in metres. These are project settings,
    # never official agency thresholds.
    advisory_level_m: Mapped[float] = mapped_column(Float)
    warning_level_m: Mapped[float] = mapped_column(Float)
    critical_level_m: Mapped[float] = mapped_column(Float)
    rise_rate_advisory_m_per_h: Mapped[float] = mapped_column(Float, default=0.15)
    threshold_source: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")

    observations: Mapped[list["Observation"]] = relationship(back_populates="station", cascade="all, delete-orphan")


class Observation(Base):
    __tablename__ = "observations"
    __table_args__ = (
        UniqueConstraint("station_id", "observed_at", name="uq_station_time"),
        Index("ix_obs_station_time", "station_id", "observed_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    station_id: Mapped[str] = mapped_column(ForeignKey("stations.id", ondelete="CASCADE"))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    water_level_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    rainfall_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))

    station: Mapped[Station] = relationship(back_populates="observations")
    dataset: Mapped[Dataset] = relationship()


_settings = get_settings()
engine = create_engine(
    _settings.database_url,
    connect_args={"check_same_thread": False} if _settings.database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def init_db() -> None:
    Base.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


def as_utc(dt: datetime) -> datetime:
    """SQLite drops tzinfo on read; every stored timestamp is UTC."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
