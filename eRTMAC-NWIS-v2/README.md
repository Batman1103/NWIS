# eRTMAC-NWIS — Complete Working Prototype

A runnable Smart India Hackathon PS121 prototype for evidence-backed offset-well decision support.

## Features
Command Center, GIS nearby-well map, proposed-location analysis, transparent Well DNA, formation-relative correlation, visual Risk Horizon, historical events, PDF upload/extraction review, conflict detection, deterministic evidence-grounded DrillMind, simulated telemetry, Risk Context, Scenario Lab, engineer feedback, evidence graph and printable site report.

All data is synthetic/demo data. This prototype does not access OIL proprietary data and does not control drilling equipment.

## Run

Backend:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and backend docs at http://localhost:8000/docs.

Demo PDF: `data/documents/W108_DDR_demo.pdf`

## 5-minute demo
Command Center → Location Intelligence → W-108 → Depth Correlation → DrillMind → Document Intelligence → Live Telemetry → Scenario Lab → Feedback → Site Report.

Prototype correlation and similarity weights are illustrative and require domain validation for real deployment.


## Frontend dependency note (v2)
The frontend explicitly includes `react-leaflet` and uses Vite 5.4.x with the React plugin 4.3.x. If you already installed dependencies from an earlier version, remove `node_modules` and `package-lock.json` and run `npm install` again.

If the page shows the NWIS connection screen, that is intentional: it means the frontend cannot reach FastAPI. Start the backend first:
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```
Then start the frontend in a second terminal:
```bash
cd frontend
npm install
npm run dev
```
