# HomeAtlas

HomeAtlas is a full-stack MVP concept for interactive home search, mortgage guidance, and property comparison.

It was built to show how a buyer or advisor could:
- explore homes on a map
- review property details and photos
- estimate mortgage and monthly carrying costs
- compare two properties side by side
- understand cash to close and 5-year equity
- submit a lead or save a scenario

## Live Demo

Frontend: `https://homeatlas-site.onrender.com/`  
Backend API: `https://homeatlas-315s.onrender.com/`

## Features

- Interactive map with property markers
- Buyer profile inputs for mortgage analysis
- Selected property dashboard
- Mortgage overview with affordability-style logic
- Investment snapshot
- Cash-to-close estimate
- 5-year equity projection
- Property comparison view
- Recommendation engine
- Lead submission
- Scenario saving
- Deployed frontend and backend

## Tech Stack

Frontend:
- HTML
- CSS
- Vanilla JavaScript
- Leaflet

Backend:
- FastAPI
- SQLite
- Pandas

Deployment:
- Render Web Service
- Render Static Site

## Project Structure

homeatlas/
- backend/
  - app.py
  - listings.csv
  - requirements.txt
  - homeatlas.db
- frontend/
  - index.html
  - assets/
- README.md

## How It Works

The frontend loads property data from the FastAPI backend and displays listings on an interactive map.  
When a user selects a property, the app calculates mortgage-related values, monthly ownership costs, and investment-style summaries using the current buyer profile inputs.  
The app also supports comparing two properties and submitting a lead or saving a scenario.

## Running Locally

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
