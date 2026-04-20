from pathlib import Path
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="HomeAtlas API")

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "listings.csv"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_df():
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Could not find CSV at {CSV_PATH}")
    return pd.read_csv(CSV_PATH)

def load_listings():
    df = load_df()
    return df.to_dict(orient="records")

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/listings")
def get_listings():
    return load_listings()

@app.get("/listings/{listing_id}")
def get_listing_by_id(listing_id: int):
    listings = load_listings()
    for listing in listings:
        if int(listing["id"]) == listing_id:
            return listing
    raise HTTPException(status_code=404, detail="Listing not found")

@app.get("/stats")
def get_stats():
    df = load_df()
    if df.empty:
        return {
            "count": 0,
            "average_price": 0,
            "min_price": 0,
            "max_price": 0
        }

    return {
        "count": int(len(df)),
        "average_price": float(df["price"].mean()),
        "min_price": float(df["price"].min()),
        "max_price": float(df["price"].max())
    }