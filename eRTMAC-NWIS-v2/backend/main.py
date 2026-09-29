
from fastapi import FastAPI,UploadFile,File,Form,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from math import radians,sin,cos,sqrt,atan2
from datetime import datetime
import sqlite3,json,re,shutil

ROOT=Path(__file__).resolve().parent.parent
UPLOADS=ROOT/"uploads"; UPLOADS.mkdir(exist_ok=True)
DATA=ROOT/"data"
DB=ROOT/"nwis.db"
app=FastAPI(title="eRTMAC-NWIS",version="1.0-demo")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["*"],allow_headers=["*"])

def load(n): return json.loads((DATA/n).read_text())
WELLS=load("wells.json"); EVENTS=load("events.json"); DOCS=load("documents.json")
CURRENT={"well_id":"W-121","depth":2735.0,"scenario":"Normal Drilling"}

def con():
    c=sqlite3.connect(DB); c.row_factory=sqlite3.Row; return c
c=con()
c.executescript("""CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY,well_id TEXT,context TEXT,relevant INTEGER,note TEXT,ts TEXT);
CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY,well_id TEXT,filename TEXT,document_type TEXT,ts TEXT,status TEXT,confidence REAL,text TEXT);""")
c.commit(); c.close()

def distance(a,b,c,d):
    R=6371;p1=radians(a);p2=radians(c);dp=radians(c-a);dl=radians(d-b)
    x=sin(dp/2)**2+cos(p1)*cos(p2)*sin(dl/2)**2
    return 2*R*atan2(sqrt(x),sqrt(1-x))

def events_for(wid=None): return [e for e in EVENTS if wid is None or e["well_id"]==wid]
def dna(w):
    dist=max(0,100-w.get("distance_km",0)*3.2)
    form=100 if "Fm-X" in w["formations"] else 58
    depth=max(0,100-abs(w["total_depth"]-CURRENT["depth"])*.12)
    traj={"Directional":95,"Deviated":88,"Vertical":80}.get(w["trajectory"],75)
    hist=min(100,55+len(events_for(w["id"]))*12)
    overall=round(.28*dist+.28*form+.18*depth+.12*traj+.14*hist)
    return {"distance":round(dist),"formation":round(form),"depth":round(depth),"trajectory":round(traj),"historical":round(hist),"overall":overall}

def horizon():
    # Prototype formation-relative correlation: Fm-X events cluster into a historical interval.
    return {"top":2780,"bottom":2830,"distance":round(max(0,2780-CURRENT["depth"]))}

def risk():
    s=CURRENT["scenario"]; t=14.2; rop=18.2
    if s=="Historical Risk": t,rop=19,12
    if s=="Mud Loss": t,rop=17.8,13
    if s=="Torque Anomaly": t,rop=22.5,10.5
    if s=="Stuck Pipe": t,rop=24,7
    if s=="Combined Risk": t,rop=22.5,8
    h=horizon()
    state="GREEN" if h["distance"]>150 else "YELLOW"
    if h["distance"]<=80 or t>=18: state="ORANGE"
    if CURRENT["depth"]>=h["top"] or s in ("Stuck Pipe","Combined Risk"): state="RED"
    return {"state":state,"label":{"GREEN":"NORMAL","YELLOW":"APPROACHING","ORANGE":"ELEVATED HISTORICAL RISK CONTEXT","RED":"HIGH HISTORICAL RISK CONTEXT"}[state],
      "historical_evidence":"HIGH","formation_match":"HIGH","torque_trend":"RISING" if t>=17 else "STABLE","rop_trend":"DECREASING" if rop<15 else "STABLE",
      "telemetry":{"depth":CURRENT["depth"],"rop":rop,"wob":31,"rpm":118,"torque":t,"spp":1840,"flow":420,"mud_weight":1.18,"pit_volume":100},"risk_horizon":h}

@app.get("/api/overview")
def overview():
    arr=[]
    for w in WELLS:
        if w["id"]=="W-121": continue
        x=dict(w); x["distance_km"]=round(distance(27.733,95.040,w["lat"],w["lon"]),2); x["similarity"]=dna(x); arr.append(x)
    arr.sort(key=lambda x:x["similarity"]["overall"],reverse=True)
    return {"current_well":CURRENT,"risk":risk(),"wells":arr,"events":EVENTS,"documents":DOCS}

@app.get("/api/wells")
def wells():
    return overview()["wells"]

@app.get("/api/wells/{wid}")
def well(wid):
    w=next((x for x in WELLS if x["id"]==wid),None)
    if not w: raise HTTPException(404,"Well not found")
    x=dict(w); x["distance_km"]=0 if wid=="W-121" else round(distance(27.733,95.040,w["lat"],w["lon"]),2)
    x["similarity"]=None if wid=="W-121" else dna(x); x["events"]=events_for(wid); return x

class Loc(BaseModel): lat:float; lon:float; radius_km:float=25
@app.post("/api/location")
def location(r:Loc):
    out=[]
    for w in WELLS:
        if w["id"]=="W-121": continue
        d=distance(r.lat,r.lon,w["lat"],w["lon"])
        if d<=r.radius_km:
            x=dict(w); x["distance_km"]=round(d,2); x["similarity"]=dna(x); out.append(x)
    out.sort(key=lambda x:x["similarity"]["overall"],reverse=True)
    return {"found":len(out),"relevant":sum(x["similarity"]["overall"]>=75 for x in out),"wells":out}

@app.get("/api/events")
def events(): return EVENTS

@app.get("/api/risk")
def get_risk(): return risk()

@app.post("/api/telemetry/step")
def step(step:float=5):
    CURRENT["depth"]=round(CURRENT["depth"]+step,1); return risk()

class Scenario(BaseModel): scenario:str
@app.post("/api/scenario")
def scenario(r:Scenario):
    if r.scenario not in ["Normal Drilling","Historical Risk","Mud Loss","Stuck Pipe","Torque Anomaly","Combined Risk"]: raise HTTPException(400,"Invalid scenario")
    CURRENT["scenario"]=r.scenario
    CURRENT["depth"]={"Normal Drilling":2735,"Historical Risk":2790,"Mud Loss":2805,"Stuck Pipe":2820,"Torque Anomaly":2800,"Combined Risk":2810}[r.scenario]
    return risk()

@app.post("/api/reset")
def reset():
    CURRENT.update(well_id="W-121",depth=2735.0,scenario="Normal Drilling"); return risk()

def pdf_text(path):
    try:
        from pypdf import PdfReader
        return "\n".join((p.extract_text() or "") for p in PdfReader(str(path)).pages).strip()
    except Exception: return ""

@app.post("/api/upload")
async def upload(well_id:str=Form(...),document_type:str=Form("DDR"),file:UploadFile=File(...)):
    if not file.filename.lower().endswith(".pdf"): raise HTTPException(400,"PDF only")
    safe=re.sub(r"[^a-zA-Z0-9_.-]","_",file.filename); dest=UPLOADS/safe
    with open(dest,"wb") as f: shutil.copyfileobj(file.file,f)
    text=pdf_text(dest)
    def num(p,d): 
        m=re.search(p,text,re.I); return float(m.group(1)) if m else d
    extracted={"well_id":well_id,"depth":num(r"depth\s*[:=]?\s*(\d{3,5})\s*m",2570),
      "formation":"Fm-X" if re.search(r"Fm[- ]?X",text,re.I) else "Unknown",
      "event":"Mud Loss" if re.search(r"mud\s+loss",text,re.I) else "Unknown",
      "torque":num(r"torque\s*[:=]?\s*([\d.]+)",14.2),"rop":num(r"rop\s*[:=]?\s*([\d.]+)",18.2),
      "confidence":92 if text else 65,"extraction_method":"PDF text" if text else "OCR required"}
    conflicts=[]
    if well_id=="W-108":
        conflicts=[{"field":"event_depth","values":[{"source":"DDR","value":2760},{"source":"WCR","value":2780},{"source":"MudLog","value":2770}],"status":"REVIEW_REQUIRED","interval":"2760–2780m"}]
    c=con(); c.execute("INSERT INTO documents(well_id,filename,document_type,ts,status,confidence,text) VALUES(?,?,?,?,?,?,?)",
      (well_id,safe,document_type,datetime.now().isoformat(),"PROCESSED",extracted["confidence"],text)); c.commit(); c.close()
    return {"extracted":extracted,"conflicts":conflicts,"pipeline":["UPLOAD","TEXT EXTRACTION" if text else "OCR REQUIRED","ENTITY EXTRACTION","EVENT EXTRACTION","CONFLICT CHECK","INDEXING","AVAILABLE TO DRILLMIND"]}

class Query(BaseModel): query:str
@app.post("/api/rag")
def rag(q:Query):
    terms=re.findall(r"[a-z0-9-]+",q.query.lower()); scored=[]
    for e in EVENTS:
        blob=f'{e["well_id"]} {e["formation"]} {e["event_type"]} {e["depth"]} {e["outcome"]}'.lower()
        score=sum(t in blob for t in terms)
        if score: scored.append((score,e))
    scored.sort(key=lambda x:x[0],reverse=True); top=[e for _,e in scored[:5]]
    if not top: return {"answer":"Insufficient indexed evidence to answer confidently.","evidence":[],"evidence_strength":"LOW","mode":"deterministic fallback"}
    ans="I found %d relevant historical events in the indexed synthetic knowledge base. "%len(top)
    ans+=" ".join(f'{e["well_id"]}: {e["event_type"]} at {e["depth"]}m in {e["formation"]}; source {e["source"]} p.{e["page"]}.' for e in top)
    return {"answer":ans,"evidence":top,"evidence_strength":"HIGH" if len(top)>=3 else "MEDIUM","mode":"deterministic fallback"}

@app.post("/api/feedback")
def feedback(well_id:str,context_name:str,relevant:bool,note:str=""):
    c=con(); c.execute("INSERT INTO feedback(well_id,context,relevant,note,ts) VALUES(?,?,?,?,?)",(well_id,context_name,int(relevant),note,datetime.now().isoformat())); c.commit(); c.close()
    return {"status":"stored","message":"Feedback stored"}

@app.get("/api/evidence")
def evidence():
    nodes=[{"id":"f","label":"Formation X","type":"formation"},{"id":"r","label":"Risk Horizon 2780–2830m","type":"risk"}]; edges=[["f","r"]]
    for i,w in enumerate(["W-108","W-112","W-119"]):
        e=next(x for x in EVENTS if x["well_id"]==w and x["formation"]=="Fm-X")
        nodes += [{"id":w,"label":w,"type":"well"},{"id":e["id"],"label":e["event_type"],"type":"event"},{"id":e["id"]+"s","label":e["source"]+" p."+str(e["page"]),"type":"source"}]
        edges += [["r",w],[w,e["id"]],[e["id"],e["id"]+"s"]]
    return {"nodes":nodes,"edges":edges}

@app.get("/api/report")
def report():
    rr=risk(); off=overview()["wells"][:4]
    return {"title":"NWIS Site Assessment — Demonstration","generated":datetime.now().isoformat(),"location":{"lat":27.733,"lon":95.040},
      "current_well":CURRENT,"risk":rr,"offset_wells":[{"id":w["id"],"distance_km":w["distance_km"],"similarity":w["similarity"]["overall"]} for w in off],
      "events":EVENTS,"limitations":["Synthetic demonstration data.","Illustrative similarity weights.","Prototype correlation logic.","Not OIL operational data."]}

@app.get("/api/health")
def health(): return {"status":"ok"}
