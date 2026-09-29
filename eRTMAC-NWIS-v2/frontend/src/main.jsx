
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  MapContainer, TileLayer, Marker, Popup, Circle, Polyline
} from "react-leaflet";
import L from "leaflet";
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, BrainCircuit, CheckCircle2,
  ChevronRight, CircleHelp, Database, FileText, Gauge, GitBranch, Layers3,
  MapPinned, Menu, RefreshCcw, Search, Settings2, ShieldCheck, Sparkles,
  Upload, Users, Workflow, X, Zap
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, AreaChart, Area
} from "recharts";
import "leaflet/dist/leaflet.css";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

async function api(path, options = {}) {
  const response = await fetch(API + path, options);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

const markerIcon = (kind = "well") =>
  L.divIcon({
    className: "nwis-marker-wrap",
    html: `<div class="nwis-marker ${kind}">${kind === "current" ? "◆" : kind === "risk" ? "!" : "•"}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const ICONS = {
  current: markerIcon("current"),
  well: markerIcon("well"),
  risk: markerIcon("risk"),
};

function Badge({ children, tone = "neutral", dot = false }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <i className="badge-dot" />}
      {children}
    </span>
  );
}

function Button({ children, onClick, variant = "secondary", icon, disabled = false }) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick} disabled={disabled}>
      {icon}
      {children}
    </button>
  );
}

function MetricCard({ label, value, sub, icon: Icon, tone = "blue" }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon metric-${tone}`}><Icon size={17} /></div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function MapPanel({ wells, selectedWell, onSelect }) {
  const current = [27.733, 95.040];
  const track = wells.slice(0, 4).map((w) => [w.lat, w.lon]);
  return (
    <div className="map-panel">
      <MapContainer center={current} zoom={13} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle center={current} radius={2500} pathOptions={{ color: "#4ade80", weight: 1, fillOpacity: 0.035 }} />
        {track.length > 1 && <Polyline positions={track} pathOptions={{ color: "#5b7595", weight: 1, opacity: 0.35, dashArray: "5 7" }} />}
        <Marker position={current} icon={ICONS.current}>
          <Popup><b>W-121</b><br />Current simulated well<br />Depth: 2735 m</Popup>
        </Marker>
        {wells.map((w) => (
          <Marker
            key={w.id}
            position={[w.lat, w.lon]}
            icon={w.similarity?.overall >= 85 ? ICONS.risk : ICONS.well}
            eventHandlers={{ click: () => onSelect(w) }}
          >
            <Popup>
              <b>{w.id}</b><br />
              DNA relevance: {w.similarity?.overall ?? "—"}%<br />
              {w.distance_km} km from current location
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="map-overlay top-left">
        <div className="map-title">OFFSET FIELD</div>
        <div className="map-subtitle">25 km intelligence radius</div>
      </div>
      <div className="map-overlay bottom-left map-legend">
        <span><i className="legend-dot current" /> Current well</span>
        <span><i className="legend-dot normal" /> Offset well</span>
        <span><i className="legend-dot risk" /> High relevance</span>
      </div>
    </div>
  );
}

function RiskHorizon({ risk, events, compact = false }) {
  const min = 2480, max = 2920;
  const height = compact ? 360 : 520;
  const y = (depth) => Math.max(0, Math.min(height, ((depth - min) / (max - min)) * height));
  const horizonHeight = Math.max(24, y(risk.risk_horizon.bottom) - y(risk.risk_horizon.top));

  return (
    <section className={`card risk-card ${compact ? "compact" : ""}`}>
      <div className="section-head">
        <div>
          <div className="eyebrow">DEPTH INTELLIGENCE</div>
          <h2>Historical Risk Horizon</h2>
        </div>
        <Badge tone={risk.state.toLowerCase()} dot>{risk.label}</Badge>
      </div>

      <div className="risk-summary">
        <div><strong>{risk.risk_horizon.distance} m</strong><span>ahead of horizon</span></div>
        <div><strong>{risk.formation_match}</strong><span>formation match</span></div>
        <div><strong>{risk.historical_evidence}</strong><span>historical evidence</span></div>
      </div>

      <div className="depth-chart" style={{ height }}>
        <div className="formation-zone" style={{ top: y(2520), height: y(2870) - y(2520) }}>
          <span>Fm-X / correlated interval</span>
        </div>

        <div className="risk-zone" style={{ top: y(risk.risk_horizon.top), height: horizonHeight }}>
          <span>HISTORICAL RISK HORIZON</span>
          <small>{risk.risk_horizon.top}–{risk.risk_horizon.bottom} m</small>
        </div>

        {[2500, 2600, 2700, 2800, 2900].map((depth) => (
          <div className="depth-tick" key={depth} style={{ top: y(depth) }}>
            <span>{depth} m</span><i />
          </div>
        ))}

        {events.filter((e) => e.formation === "Fm-X").map((event) => (
          <div
            className={`event-marker ${event.severity.toLowerCase()}`}
            key={event.id}
            style={{ top: y(event.depth) }}
            title={`${event.event_type} — ${event.well_id}`}
          >
            <i />
            {!compact && <span>{event.event_type} · {event.well_id} · {event.depth}m</span>}
          </div>
        ))}

        <div className="current-depth" style={{ top: y(risk.telemetry.depth) }}>
          <b>W-121 CURRENT</b>
          <span>{risk.telemetry.depth} m</span>
        </div>
      </div>

      <div className="risk-explain">
        <div className="explain-icon"><AlertTriangle size={16} /></div>
        <div>
          <strong>Why is this context appearing?</strong>
          <p>Multiple indexed offset events occur in the same formation corridor. The current simulated well is approaching the correlated interval.</p>
        </div>
      </div>
    </section>
  );
}

function OffsetTable({ wells, onSelect }) {
  return (
    <div className="offset-list">
      {wells.slice(0, 5).map((well, i) => (
        <button className="offset-row" key={well.id} onClick={() => onSelect(well)}>
          <span className="rank">{String(i + 1).padStart(2, "0")}</span>
          <span className="well-id"><b>{well.id}</b><small>{well.distance_km} km · {well.trajectory}</small></span>
          <span className="well-events">{well.similarity?.historical ?? 0}<small>memory</small></span>
          <span className="dna">{well.similarity?.overall}%<small>DNA</small></span>
          <ChevronRight size={15} />
        </button>
      ))}
    </div>
  );
}

function Correlation({ events }) {
  const wells = ["W-108", "W-112", "W-119", "W-121"];
  const min = 2400, max = 2900, H = 380;
  const y = (d) => ((d - min) / (max - min)) * H;
  return (
    <section className="card">
      <div className="section-head">
        <div><div className="eyebrow">FORMATION-NORMALISED VIEW</div><h2>Offset Well Correlation</h2></div>
        <Badge>Fm-X</Badge>
      </div>
      <div className="correlation-chart">
        {[2500, 2600, 2700, 2800].map((d) => (
          <div className="corr-grid" key={d} style={{ top: y(d) }}><span>{d}m</span></div>
        ))}
        <div className="corr-risk" style={{ top: y(2780), height: y(2830) - y(2780) }}>RISK INTERVAL</div>
        {wells.map((well, i) => (
          <div className="corr-column" key={well} style={{ left: `${15 + i * 24}%` }}>
            <b>{well}</b><i />
            {events.filter((e) => e.well_id === well && e.formation === "Fm-X").map((event) => (
              <div className="corr-event" key={event.id} style={{ top: y(event.depth) - 5 }}>
                <i /> <span>{event.event_type}<small>{event.depth}m</small></span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function TelemetryPanel({ risk, onRisk }) {
  const [running, setRunning] = useState(false);
  const [series, setSeries] = useState([]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      try {
        const next = await api("/telemetry/step", { method: "POST" });
        onRisk(next);
        setSeries((prev) => [...prev.slice(-18), {
          depth: next.telemetry.depth,
          torque: next.telemetry.torque,
          rop: next.telemetry.rop,
        }]);
      } catch { setRunning(false); }
    }, 1200);
    return () => clearInterval(id);
  }, [running, onRisk]);

  const t = risk.telemetry;
  const metrics = [
    ["Depth", `${t.depth} m`], ["ROP", `${t.rop} m/hr`],
    ["WOB", `${t.wob} klb`], ["RPM", t.rpm],
    ["Torque", `${t.torque} kN·m`], ["SPP", `${t.spp} psi`],
    ["Flow", `${t.flow} gpm`], ["Mud", `${t.mud_weight} SG`],
  ];

  return (
    <section className="card">
      <div className="section-head">
        <div><div className="eyebrow">ACTIVE WELL MODE</div><h2>Live Telemetry <Badge>SIMULATED</Badge></h2></div>
        <Button variant={running ? "danger" : "primary"} icon={<Activity size={14} />} onClick={() => setRunning(!running)}>
          {running ? "Stop simulation" : "Start simulation"}
        </Button>
      </div>
      <div className="telemetry-grid">
        {metrics.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}
      </div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={series.length ? series : [{ depth: t.depth, torque: t.torque, rop: t.rop }]}>
            <CartesianGrid stroke="#233142" strokeDasharray="3 3" />
            <XAxis dataKey="depth" stroke="#64748b" fontSize={9} />
            <YAxis stroke="#64748b" fontSize={9} />
            <Tooltip contentStyle={{ background: "#0b121a", border: "1px solid #263548", fontSize: 10 }} />
            <Line type="monotone" dataKey="torque" stroke="#f59e0b" strokeWidth={2} dot={false} name="Torque" />
            <Line type="monotone" dataKey="rop" stroke="#60a5fa" strokeWidth={2} dot={false} name="ROP" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function DrillMind() {
  const [query, setQuery] = useState("What happened in Formation X around 2600m?");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    try { setResult(await api("/rag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) })); }
    finally { setBusy(false); }
  }

  return (
    <section className="card drillmind">
      <div className="section-head">
        <div><div className="eyebrow">EVIDENCE-GROUNDED RAG</div><h2>DrillMind</h2></div>
        <Badge tone="green" dot>Evidence-backed</Badge>
      </div>
      <div className="prompt-chips">
        {["Mud loss near 2600m", "Stuck pipe in Fm-X", "Relevant offset wells"].map((q) => (
          <button key={q} onClick={() => setQuery(q)}>{q}</button>
        ))}
      </div>
      <div className="askbar">
        <BrainCircuit size={17} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
        <Button variant="primary" icon={<Search size={14} />} onClick={ask}>{busy ? "Searching…" : "Ask DrillMind"}</Button>
      </div>
      {result && (
        <div className="answer-card">
          <div className="answer-top"><Badge>DETERMINISTIC FALLBACK</Badge><span>Evidence strength: <b>{result.evidence_strength}</b></span></div>
          <p>{result.answer}</p>
          <div className="evidence-stack">
            {result.evidence.map((e) => (
              <div className="evidence-row" key={e.id}>
                <div className="source-icon"><FileText size={14} /></div>
                <div><b>{e.event_type} · {e.well_id}</b><small>{e.depth}m · {e.formation} · {e.source} p.{e.page}</small></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function DocumentIntelligence() {
  const [file, setFile] = useState(null), [result, setResult] = useState(null), [busy, setBusy] = useState(false);
  async function process() {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.append("well_id", "W-108");
    form.append("document_type", "DDR");
    form.append("file", file);
    try { setResult(await api("/upload", { method: "POST", body: form })); }
    finally { setBusy(false); }
  }
  return (
    <section className="card document-card">
      <div className="section-head"><div><div className="eyebrow">DOCUMENT INTELLIGENCE</div><h2>Historical Well Document</h2></div><Badge>PDF pipeline</Badge></div>
      <div className="upload-layout">
        <label className="dropzone">
          <Upload size={24} />
          <b>{file ? file.name : "Drop a WCR / DDR PDF here"}</b>
          <span>Text extraction first · OCR fallback architecture</span>
          <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <div className="pipeline-card">
          {["UPLOAD", "TEXT / OCR", "ENTITY EXTRACTION", "CONFLICT CHECK", "INDEX", "DRILLMIND"].map((x, i) => (
            <div key={x}><span>{String(i + 1).padStart(2, "0")}</span><b>{x}</b>{i < 5 && <ArrowRight size={13} />}</div>
          ))}
        </div>
      </div>
      <Button variant="primary" disabled={!file || busy} onClick={process} icon={<Sparkles size={14} />}>{busy ? "Processing document…" : "Process document"}</Button>
      {result && (
        <div className="extraction-panel">
          <div className="section-head"><div><div className="eyebrow">EXTRACTION REVIEW</div><h3>Structured fields</h3></div><Badge tone="green">Confidence {result.extracted.confidence}%</Badge></div>
          <div className="field-grid">{Object.entries(result.extracted).map(([k, v]) => <div key={k}><span>{k}</span><b>{String(v)}</b></div>)}</div>
          {result.conflicts?.length > 0 && (
            <div className="conflict-card"><AlertTriangle size={18} /><div><b>Data conflict detected — review required</b><p>DDR 2760m · WCR 2780m · Mud Log 2770m · historical interval 2760–2780m.</p></div></div>
          )}
          <div className="pipeline-status">{result.pipeline.join("  →  ")}</div>
        </div>
      )}
    </section>
  );
}

function ScenarioLab({ risk, onRisk }) {
  const [scenario, setScenario] = useState("Combined Risk");
  const [before, setBefore] = useState(null);
  async function run() {
    setBefore(risk);
    onRisk(await api("/scenario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario }) }));
  }
  return (
    <section className="card scenario-card">
      <div className="section-head"><div><div className="eyebrow">SAFE SIMULATION</div><h2>Scenario Lab</h2></div><Badge tone="yellow">Simulation only</Badge></div>
      <p className="muted large">Test how the same historical knowledge layer changes context under different simulated drilling conditions.</p>
      <div className="scenario-controls">
        <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
          {["Normal Drilling", "Historical Risk", "Mud Loss", "Stuck Pipe", "Torque Anomaly", "Combined Risk"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <Button variant="primary" icon={<PlayIcon />} onClick={run}>Run scenario</Button>
      </div>
      {before && (
        <div className="scenario-compare">
          <div><span>BEFORE</span><strong>{before.telemetry.depth} m</strong><Badge tone={before.state.toLowerCase()}>{before.label}</Badge></div>
          <ArrowRight size={22} />
          <div><span>AFTER · {scenario}</span><strong>{risk.telemetry.depth} m</strong><Badge tone={risk.state.toLowerCase()}>{risk.label}</Badge></div>
        </div>
      )}
    </section>
  );
}
const PlayIcon = () => <Zap size={14} />;

function EvidenceGraph() {
  const chains = [
    ["W-108", "Mud Loss", "W108_DDR.pdf · p.14"],
    ["W-112", "Mud Loss", "W112_WCR.pdf · p.16"],
    ["W-119", "Stuck Pipe", "W119_DDR.pdf · p.25"],
  ];
  return (
    <section className="card evidence-graph-card">
      <div className="section-head"><div><div className="eyebrow">TRACEABILITY</div><h2>Risk Evidence Graph</h2></div><Badge>Source linked</Badge></div>
      <div className="graph-root"><div className="graph-node primary-node">FORMATION X</div><ArrowDown/><div className="graph-node risk-node">RISK HORIZON<br /><small>2780–2830 m</small></div><ArrowDown /></div>
      <div className="graph-columns">{chains.map(([well, event, source]) => <div className="graph-chain" key={well}><div className="graph-node well-node">{well}</div><span>↓</span><div className="graph-node event-node">{event}</div><span>↓</span><div className="graph-node source-node"><FileText size={12} />{source}</div></div>)}</div>
    </section>
  );
}
const ArrowDown = () => <div className="arrow-down">↓</div>;

function WellExplorer({ wells, events, selected, onSelect }) {
  const [active, setActive] = useState(selected?.id || wells[0]?.id);
  const well = wells.find((w) => w.id === active) || selected || wells[0];
  if (!well) return null;
  return (
    <div className="explorer-grid">
      <section className="card">
        <div className="section-head"><div><div className="eyebrow">OFFSET WELL INTELLIGENCE</div><h2>Well Explorer</h2></div><Badge>{well.id}</Badge></div>
        <div className="well-selector">{wells.map((w) => <button className={w.id === well.id ? "selected" : ""} key={w.id} onClick={() => { setActive(w.id); onSelect(w); }}><b>{w.id}</b><span>{w.similarity.overall}%</span></button>)}</div>
        <div className="well-hero"><div><span>Well ID</span><strong>{well.id}</strong></div><div><span>Distance</span><strong>{well.distance_km} km</strong></div><div><span>Total depth</span><strong>{well.total_depth} m</strong></div><div><span>Trajectory</span><strong>{well.trajectory}</strong></div></div>
        <h3>Well DNA</h3>
        <div className="dna-grid">{Object.entries(well.similarity).map(([k, v]) => <div key={k}><span>{k}</span><b>{v}%</b><i><em style={{ width: `${v}%` }} /></i></div>)}</div>
      </section>
      <section className="card">
        <div className="section-head"><div><div className="eyebrow">HISTORICAL MEMORY</div><h2>Events in {well.id}</h2></div><Badge>{events.filter(e => e.well_id === well.id).length} events</Badge></div>
        {events.filter(e => e.well_id === well.id).map((e) => (
          <div className="timeline-row" key={e.id}><div className={`timeline-dot ${e.severity.toLowerCase()}`} /><div className="timeline-depth">{e.depth}m</div><div><b>{e.event_type}</b><span>{e.formation} · {e.severity} · {e.outcome}</span><small>{e.source} · page {e.page}</small></div></div>
        ))}
      </section>
    </div>
  );
}

function LocationIntelligence({ wells, onSelect }) {
  const [lat, setLat] = useState("27.733"), [lon, setLon] = useState("95.040"), [radius, setRadius] = useState("25"), [result, setResult] = useState(null), [busy, setBusy] = useState(false);
  async function analyze() {
    setBusy(true);
    try { setResult(await api("/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: Number(lat), lon: Number(lon), radius_km: Number(radius) }) })); }
    finally { setBusy(false); }
  }
  const rows = result?.wells || wells;
  return <div className="location-grid">
    <section className="card">
      <div className="eyebrow">MODE A · LOCATION / OFFSET INTELLIGENCE</div>
      <h2>Proposed Location</h2>
      <p className="muted large">Search the nearby-well memory before a new well is planned.</p>
      <div className="location-form"><label>Latitude<input value={lat} onChange={e => setLat(e.target.value)} /></label><label>Longitude<input value={lon} onChange={e => setLon(e.target.value)} /></label><label>Radius<select value={radius} onChange={e => setRadius(e.target.value)}><option>5</option><option>10</option><option>25</option><option>50</option></select></label></div>
      <Button variant="primary" icon={<Search size={14} />} onClick={analyze}>{busy ? "Analyzing…" : "Analyze location"}</Button>
      {result && <div className="location-result"><strong>{result.found}</strong><span>wells found</span><i /><strong>{result.relevant}</strong><span>high-relevance offsets</span></div>}
      <OffsetTable wells={rows} onSelect={onSelect} />
    </section>
    <section className="card location-map"><MapPanel wells={rows} onSelect={onSelect} /></section>
  </div>;
}

function Report() {
  const [report, setReport] = useState(null);
  useEffect(() => { api("/report").then(setReport); }, []);
  if (!report) return <section className="card loading">Generating evidence-backed site assessment…</section>;
  return <section className="card report">
    <div className="report-head"><div><div className="eyebrow">EVIDENCE-BASED DECISION SUPPORT</div><h2>{report.title}</h2><p>Generated {new Date(report.generated).toLocaleString()}</p></div><Button variant="primary" onClick={() => window.print()} icon={<FileText size={14} />}>Print / Save PDF</Button></div>
    <div className="report-grid"><div><span>Current well</span><b>{report.current_well.well_id} · {report.current_well.depth}m</b></div><div><span>Risk horizon</span><b>{report.risk.risk_horizon.top}–{report.risk.risk_horizon.bottom}m</b></div><div><span>Location</span><b>{report.location.lat}, {report.location.lon}</b></div><div><span>Context</span><Badge tone={report.risk.state.toLowerCase()}>{report.risk.label}</Badge></div></div>
    <h3>Relevant offset wells</h3><table><thead><tr><th>Well</th><th>Distance</th><th>DNA</th></tr></thead><tbody>{report.offset_wells.map(w => <tr key={w.id}><td>{w.id}</td><td>{w.distance_km} km</td><td>{w.similarity}%</td></tr>)}</tbody></table>
    <h3>Historical evidence</h3><table><thead><tr><th>Well</th><th>Depth</th><th>Formation</th><th>Event</th><th>Source</th></tr></thead><tbody>{report.events.map(e => <tr key={e.id}><td>{e.well_id}</td><td>{e.depth}m</td><td>{e.formation}</td><td>{e.event_type}</td><td>{e.source} p.{e.page}</td></tr>)}</tbody></table>
    <div className="limitations"><b>Prototype limitations</b>{report.limitations.map(x => <span key={x}>• {x}</span>)}</div>
  </section>;
}

function App() {
  const [page, setPage] = useState("Command Center");
  const [overview, setOverview] = useState(null);
  const [risk, setRisk] = useState(null);
  const [selected, setSelected] = useState(null);
  const [connectionError, setConnectionError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  async function load() {
    setConnectionError("");
    try {
      const data = await api("/overview");
      setOverview(data); setRisk(data.risk);
    } catch (e) {
      setConnectionError("Backend is not reachable. Start FastAPI on http://localhost:8000 and retry.");
    }
  }
  useEffect(() => { load(); }, []);

  if (!overview) return (
    <div className="boot">
      <div className="boot-card">
        <div className="boot-logo">N</div>
        <h1>eRTMAC-NWIS</h1>
        <p>Nearby Wells Intelligence System</p>
        {connectionError ? <><div className="connection-error"><AlertTriangle size={18} /><span>{connectionError}</span></div><Button variant="primary" onClick={load} icon={<RefreshCcw size={14} />}>Retry connection</Button><code>uvicorn backend.main:app --reload --port 8000</code></> : <div className="loading-line">Loading engineering intelligence…</div>}
      </div>
    </div>
  );

  const nav = [
    ["Command Center", Activity, "Overview"],
    ["Location Intelligence", MapPinned, "Mode A"],
    ["Well Explorer", Database, "Offsets"],
    ["Depth Correlation", GitBranch, "Correlation"],
    ["Live Telemetry", Gauge, "Mode B"],
    ["Scenario Lab", Workflow, "Simulation"],
    ["Document Intelligence", FileText, "Ingestion"],
    ["DrillMind", BrainCircuit, "RAG"],
    ["Evidence Graph", GitBranch, "Traceability"],
    ["Site Report", ShieldCheck, "Export"],
  ];

  const comparable = overview.wells.filter((w) => w.similarity.overall >= 75).length;
  const setPageState = (p) => { setPage(p); setMobileNav(false); };

  return (
    <div className="shell">
      <aside className={mobileNav ? "sidebar open" : "sidebar"}>
        <div className="brand"><div className="brand-mark">N</div><div><b>NWIS</b><span>eRTMAC intelligence</span></div></div>
        <div className="demo-banner"><span>●</span> DEMO ENVIRONMENT <small>Synthetic data</small></div>
        <nav>{nav.map(([name, Icon, sub]) => <button key={name} className={page === name ? "active" : ""} onClick={() => setPageState(name)}><Icon size={16} /><span><b>{name}</b><small>{sub}</small></span></button>)}</nav>
        <div className="sidebar-bottom"><div><span>Current well</span><b>W-121</b></div><div><span>Depth</span><b>{risk.telemetry.depth} m</b></div><Button onClick={async () => { await api("/reset", { method: "POST" }); await load(); }} icon={<RefreshCcw size={13} />}>Reset demo</Button></div>
      </aside>

      <main>
        <header className="topbar">
          <div className="mobile-menu"><button onClick={() => setMobileNav(!mobileNav)}>{mobileNav ? <X /> : <Menu />}</button></div>
          <div><div className="eyebrow">SMART INDIA HACKATHON · PS121 · SMART AUTOMATION</div><h1>{page}</h1></div>
          <div className="top-status"><Badge tone={risk.state.toLowerCase()} dot>{risk.label}</Badge><span className="current-chip"><Activity size={12} /> W-121 · {risk.telemetry.depth}m</span></div>
        </header>

        {page === "Command Center" && <CommandCenter overview={overview} risk={risk} onRisk={setRisk} onSelect={(w) => { setSelected(w); setPageState("Well Explorer"); }} comparable={comparable} />}
        {page === "Location Intelligence" && <LocationIntelligence wells={overview.wells} onSelect={(w) => { setSelected(w); setPageState("Well Explorer"); }} />}
        {page === "Well Explorer" && <WellExplorer wells={overview.wells} events={overview.events} selected={selected} onSelect={setSelected} />}
        {page === "Depth Correlation" && <div className="twocol"><Correlation events={overview.events} /><RiskHorizon risk={risk} events={overview.events} /></div>}
        {page === "Live Telemetry" && <div className="twocol"><TelemetryPanel risk={risk} onRisk={setRisk} /><RiskHorizon risk={risk} events={overview.events} /></div>}
        {page === "Scenario Lab" && <ScenarioLab risk={risk} onRisk={setRisk} />}
        {page === "Document Intelligence" && <DocumentIntelligence />}
        {page === "DrillMind" && <DrillMind />}
        {page === "Evidence Graph" && <EvidenceGraph />}
        {page === "Site Report" && <Report />}
      </main>
    </div>
  );
}

function CommandCenter({ overview, risk, onRisk, onSelect, comparable }) {
  return <>
    <div className="metrics">
      <MetricCard label="Current Depth" value={`${risk.telemetry.depth} m`} sub="W-121 · simulated" icon={Activity} />
      <MetricCard label="Risk Horizon" value={`${risk.risk_horizon.distance} m`} sub={`${risk.risk_horizon.top}–${risk.risk_horizon.bottom} m`} icon={AlertTriangle} tone="amber" />
      <MetricCard label="Comparable Wells" value={comparable} sub="relevance ≥ 75%" icon={Users} tone="violet" />
      <MetricCard label="Evidence Strength" value="HIGH" sub={`${overview.events.length} indexed events`} icon={ShieldCheck} tone="green" />
    </div>

    <div className="command-grid">
      <section className="card map-card">
        <div className="section-head">
          <div><div className="eyebrow">FIELD INTELLIGENCE</div><h2>Offset Well Map</h2></div>
          <Badge>25 km radius</Badge>
        </div>
        <MapPanel wells={overview.wells} onSelect={onSelect} />
      </section>
      <RiskHorizon risk={risk} events={overview.events} />
    </div>

    <div className="twocol">
      <section className="card">
        <div className="section-head"><div><div className="eyebrow">MULTI-DIMENSIONAL RELEVANCE</div><h2>Relevant Offset Wells</h2></div><Button onClick={() => document.querySelector("nav button:nth-child(3)")?.click()} icon={<ArrowRight size={13} />}>Open explorer</Button></div>
        <OffsetTable wells={overview.wells} onSelect={onSelect} />
      </section>
      <section className="card">
        <div className="section-head"><div><div className="eyebrow">DECISION CONTEXT</div><h2>Why the alert exists</h2></div><Badge tone="green">Traceable</Badge></div>
        <div className="driver-list">
          <Driver icon={<Layers3 />} title="Formation match" value="HIGH" text="Current well and relevant offset wells share the Fm-X corridor." />
          <Driver icon={<Database />} title="Historical memory" value={`${overview.events.filter(e => e.formation === "Fm-X").length} events`} text="Indexed torque, mud-loss and stuck-pipe history supports the context." />
          <Driver icon={<Zap />} title="Depth proximity" value={`${risk.risk_horizon.distance} m`} text="Current simulated depth is approaching the historical risk interval." />
        </div>
      </section>
    </div>

    <div className="twocol">
      <TelemetryPanel risk={risk} onRisk={onRisk} />
      <DrillMind />
    </div>
  </>;
}

function Driver({ icon, title, value, text }) {
  return <div className="driver"><div className="driver-icon">{icon}</div><div><span>{title}</span><b>{value}</b><p>{text}</p></div></div>;
}

createRoot(document.getElementById("root")).render(<App />);
