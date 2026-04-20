from __future__ import annotations

import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "listings.csv"
DB_PATH = BASE_DIR / "homeatlas.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {key: row[key] for key in row.keys()}


def init_db() -> None:
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS listings (
            id INTEGER PRIMARY KEY,
            address TEXT NOT NULL,
            city TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            price REAL NOT NULL,
            beds INTEGER NOT NULL,
            baths REAL NOT NULL,
            sqft REAL NOT NULL,
            url TEXT,
            realtor_name TEXT,
            realtor_phone TEXT,
            mortgage_contact TEXT,
            image_url TEXT
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            message TEXT,
            selected_property_id INTEGER,
            selected_property_address TEXT,
            created_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS saved_scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scenario_name TEXT NOT NULL,
            property_id INTEGER NOT NULL,
            property_address TEXT NOT NULL,
            annual_income REAL NOT NULL,
            monthly_debts REAL NOT NULL,
            down_payment REAL NOT NULL,
            interest_rate REAL NOT NULL,
            amort_years INTEGER NOT NULL,
            property_tax REAL NOT NULL,
            heating_cost REAL NOT NULL,
            condo_fee REAL NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )

    if CSV_PATH.exists():
        df = pd.read_csv(CSV_PATH)

        expected_columns = [
            "id",
            "address",
            "city",
            "lat",
            "lng",
            "price",
            "beds",
            "baths",
            "sqft",
            "url",
            "realtor_name",
            "realtor_phone",
            "mortgage_contact",
            "image_url",
        ]

        for col in expected_columns:
            if col not in df.columns:
                df[col] = None

        df = df[expected_columns]

        for text_col in [
            "address",
            "city",
            "url",
            "realtor_name",
            "realtor_phone",
            "mortgage_contact",
            "image_url",
        ]:
            df[text_col] = df[text_col].astype("string").fillna("").str.strip()

        cur.execute("DELETE FROM listings")

        rows = df.to_dict(orient="records")
        cur.executemany(
            """
            INSERT OR REPLACE INTO listings (
                id, address, city, lat, lng, price, beds, baths, sqft,
                url, realtor_name, realtor_phone, mortgage_contact, image_url
            )
            VALUES (
                :id, :address, :city, :lat, :lng, :price, :beds, :baths, :sqft,
                :url, :realtor_name, :realtor_phone, :mortgage_contact, :image_url
            )
            """,
            rows,
        )

    conn.commit()
    conn.close()


class LeadCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=200)
    phone: str = Field(default="", max_length=50)
    message: str = Field(default="", max_length=2000)
    selected_property_id: int | None = None
    selected_property_address: str | None = None


class ScenarioCreate(BaseModel):
    scenario_name: str = Field(..., min_length=2, max_length=100)
    property_id: int
    property_address: str
    annual_income: float
    monthly_debts: float
    down_payment: float
    interest_rate: float
    amort_years: int
    property_tax: float
    heating_cost: float
    condo_fee: float


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="HomeAtlas API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "HomeAtlas API is running"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/listings")
def get_listings() -> list[dict[str, Any]]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM listings ORDER BY price DESC").fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]


@app.get("/listings/{listing_id}")
def get_listing(listing_id: int) -> dict[str, Any]:
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM listings WHERE id = ?",
        (listing_id,),
    ).fetchone()
    conn.close()

    if row is None:
        raise HTTPException(status_code=404, detail="Listing not found")

    return row_to_dict(row)


@app.get("/stats")
def get_stats() -> dict[str, float | int]:
    conn = get_conn()
    row = conn.execute(
        """
        SELECT
            COUNT(*) AS count,
            AVG(price) AS average_price,
            MIN(price) AS min_price,
            MAX(price) AS max_price
        FROM listings
        """
    ).fetchone()
    conn.close()

    return {
        "count": int(row["count"] or 0),
        "average_price": float(row["average_price"] or 0),
        "min_price": float(row["min_price"] or 0),
        "max_price": float(row["max_price"] or 0),
    }


@app.post("/leads")
def create_lead(payload: LeadCreate) -> dict[str, Any]:
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO leads (
            name, email, phone, message,
            selected_property_id, selected_property_address, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.name,
            payload.email,
            payload.phone,
            payload.message,
            payload.selected_property_id,
            payload.selected_property_address,
            datetime.utcnow().isoformat(),
        ),
    )

    conn.commit()
    lead_id = cur.lastrowid
    conn.close()

    return {
        "ok": True,
        "lead_id": lead_id,
        "message": "Lead submitted successfully",
    }


@app.get("/leads")
def get_leads() -> list[dict[str, Any]]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM leads ORDER BY id DESC").fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]


@app.post("/saved-scenarios")
def save_scenario(payload: ScenarioCreate) -> dict[str, Any]:
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO saved_scenarios (
            scenario_name,
            property_id,
            property_address,
            annual_income,
            monthly_debts,
            down_payment,
            interest_rate,
            amort_years,
            property_tax,
            heating_cost,
            condo_fee,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.scenario_name,
            payload.property_id,
            payload.property_address,
            payload.annual_income,
            payload.monthly_debts,
            payload.down_payment,
            payload.interest_rate,
            payload.amort_years,
            payload.property_tax,
            payload.heating_cost,
            payload.condo_fee,
            datetime.utcnow().isoformat(),
        ),
    )

    conn.commit()
    scenario_id = cur.lastrowid
    conn.close()

    return {
        "ok": True,
        "scenario_id": scenario_id,
        "message": "Scenario saved successfully",
    }


@app.get("/saved-scenarios")
def get_saved_scenarios() -> list[dict[str, Any]]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM saved_scenarios ORDER BY id DESC").fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]
