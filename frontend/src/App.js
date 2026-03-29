import { useState } from "react";
import "./App.css";

const API = "http://localhost:3001";

const NAV = [
  { key: "idea",     label: "Idea",     agentId: "idea-parser" },
  { key: "product",  label: "Product",  agentId: "product"     },
  { key: "market",   label: "Market",   agentId: "market"      },
  { key: "business", label: "Business", agentId: "business"    },
  { key: "brand",    label: "Brand",    agentId: "brand"       },
  { key: "pitch",    label: "Pitch",    agentId: "pitch"       },
  { key: "team",     label: "Team",     agentId: "team-gen"    },
  { key: "tasks",    label: "Tasks"                            },
  { key: "reports",  label: "Reports"                         },
];

const AGENT_FIELDS = {
  idea:     { metrics: ["domain", "target_users"], highlights: ["problem"],    body: ["core_goal"] },
  product:  { metrics: ["tech_stack", "mvp_scope"], highlights: [],            body: ["features", "user_flow"] },
  market:   { metrics: ["market_size"],             highlights: ["market_gap"], body: ["competitors", "differentiation"] },
  business: { metrics: ["pricing", "revenue_model", "break_even"], highlights: [], body: ["cost_structure"] },
  brand:    { metrics: ["startup_name", "tone"],    highlights: ["tagline"],   body: ["colors"] },
  pitch:    { metrics: ["why_now", "ask"],           highlights: ["one_liner"], body: ["pitch_30s"] },
};

const AVATAR_COLORS = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6"];

function getInitials(role = "") {
  return role.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function StatusPill({ status }) {
  if (status === "approved") return <span className="pill pill-green">Approved</span>;
  if (status === "redirected") return <span className="pill pill-amber">Revised · Awaiting approval</span>;
  return <span className="pill pill-amber">Awaiting approval</span>;
}

function MetricCard({ label, value }) {
  const display = Array.isArray(value) ? value[0] : typeof value === "object" && value ? Object.values(value)[0] : value;
  const s = coerceString(display) || "—";
  const idx = s.indexOf(" — ");
  const inner = idx > 0
    ? <><span className="metric-hook">{s.slice(0, idx)}</span><span className="metric-detail"> — {s.slice(idx + 3)}</span></>
    : <span className="metric-hook">{s}</span>;
  return (
    <div className="metric-card">
      <div className="metric-label">{label.replace(/_/g, " ")}</div>
      <div className="metric-value">{inner}</div>
    </div>
  );
}

function coerceString(val) {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    const vals = Object.values(val).filter(v => typeof v === "string");
    return vals.join(" — ");
  }
  return String(val);
}

function boldHook(str) {
  const s = coerceString(str);
  const idx = s.indexOf(" — ");
  if (idx > 0) {
    return <><strong className="hook">{s.slice(0, idx)}</strong><span className="hook-sep"> — </span>{s.slice(idx + 3)}</>;
  }
  return s;
}

function FieldCard({ label, value }) {
  const renderContent = (v) => {
    if (Array.isArray(v)) {
      return (
        <ul className="checklist">
          {v.map((item, i) => (
            <li key={i}>
              <span className="check-circle">✓</span>
              <span>{typeof item === "object" ? JSON.stringify(item) : boldHook(item)}</span>
            </li>
          ))}
        </ul>
      );
    }
    if (v !== null && typeof v === "object") {
      return (
        <ul className="checklist">
          {Object.entries(v).map(([k, val]) => (
            <li key={k}>
              <span className="check-circle">✓</span>
              <span><strong className="hook">{k.replace(/_/g, " ")}</strong><span className="hook-sep"> — </span>{String(val)}</span>
            </li>
          ))}
        </ul>
      );
    }
    return <p className="body-text">{boldHook(v)}</p>;
  };

  return (
    <div className="field-card">
      <div className="field-card-label">{label.replace(/_/g, " ")}</div>
      {renderContent(value)}
    </div>
  );
}

// ── Score Card ────────────────────────────────────────────────────────────────
function ScoreCard({ score }) {
  if (!score || score.overall == null) return null;

  const { overall, verdict, verdict_reason, M, D, R, E, penalties, dimension_notes, main_risk } = score;

  const scoreColor = overall >= 75 ? "var(--green)" : overall >= 65 ? "var(--amber)" : "var(--red)";

  const dims = [
    { key: "M", label: "Market",      val: M },
    { key: "D", label: "Differentiation", val: D },
    { key: "R", label: "Revenue",     val: R },
    { key: "E", label: "Execution",   val: E },
  ];

  const activePenalties = penalties
    ? Object.entries(penalties).filter(([, v]) => v).map(([k]) => k.replace(/_/g, " "))
    : [];

  return (
    <div className="score-card">
      <div className="score-top">
        <div className="score-overall-block">
          <div className="score-number" style={{ color: scoreColor }}>{overall}</div>
          <div className="score-verdict" style={{ color: scoreColor }}>{verdict}</div>
        </div>
        <div className="score-dims">
          {dims.map(d => (
            <div key={d.key} className="score-dim">
              <div className="score-dim-label">{d.label}</div>
              <div className="score-dim-bar-track">
                <div className="score-dim-bar-fill" style={{ width: `${d.val}%`, background: d.val >= 75 ? "var(--green)" : d.val >= 55 ? "var(--amber)" : "var(--red)" }} />
              </div>
              <div className="score-dim-val">{d.val}</div>
            </div>
          ))}
        </div>
      </div>

      {verdict_reason && <div className="score-reason">{verdict_reason}</div>}

      {dims.some(d => dimension_notes?.[d.key]) && (
        <div className="score-notes">
          {dims.filter(d => dimension_notes?.[d.key]).map(d => (
            <div key={d.key} className="score-note">
              <span className="score-note-key">{d.key}</span>
              <span className="score-note-text">{dimension_notes[d.key]}</span>
            </div>
          ))}
        </div>
      )}

      {activePenalties.length > 0 && (
        <div className="score-penalties">
          {activePenalties.map(p => (
            <span key={p} className="score-penalty-pill">⚠ {p}</span>
          ))}
        </div>
      )}

      {main_risk && (
        <div className="score-risk">
          <span className="score-risk-label">Main risk</span>
          <span className="score-risk-text">{main_risk}</span>
        </div>
      )}
    </div>
  );
}

// ── Agent Panel ───────────────────────────────────────────────────────────────
function AgentPanel({ agentKey, data, status, onApprove, onRedirect, loading }) {
  const [showRedirect, setShowRedirect] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  const cfg = AGENT_FIELDS[agentKey] || { metrics: [], highlights: [], body: [] };
  const label = NAV.find(n => n.key === agentKey)?.label;
  const agentId = NAV.find(n => n.key === agentKey)?.agentId;

  const handleResubmit = async () => {
    if (!feedback.trim()) return;
    setRedirecting(true);
    await onRedirect(agentKey, agentId, data, feedback);
    setFeedback("");
    setShowRedirect(false);
    setRedirecting(false);
  };

  if (!data) {
    return (
      <div className="agent-panel">
        <div className="panel-empty">
          {loading ? <><div className="spinner-sm" /> Agent working...</> : "No data yet."}
        </div>
      </div>
    );
  }

  const allKeys = Object.keys(data).filter(k => k !== "status" && k !== "score");
  const bodyFields = cfg.body.length
    ? cfg.body.filter(k => allKeys.includes(k))
    : allKeys.filter(k => !cfg.metrics.includes(k) && !cfg.highlights.includes(k));

  return (
    <div className="agent-panel">
      <div className="panel-header">
        <span className="panel-title">{label} Agent</span>
        <StatusPill status={status} />
      </div>

      {cfg.metrics.length > 0 && (
        <div className="metrics-row">
          {cfg.metrics.filter(k => data[k] != null).map(k => (
            <MetricCard key={k} label={k} value={data[k]} />
          ))}
        </div>
      )}

      {agentKey === "idea" && <ScoreCard score={data.score} />}

      {cfg.highlights.filter(k => data[k] != null).map(k => (
        <div key={k} className="highlight-text">{String(data[k])}</div>
      ))}

      <div className="body-fields">
        {bodyFields.map(k => data[k] != null && (
          <FieldCard key={k} label={k} value={data[k]} />
        ))}
      </div>

      {status !== "approved" && (
        <div className="panel-actions">
          <div className="action-buttons">
            <button className="btn-approve" onClick={() => onApprove(agentKey)}>✓ Approve</button>
            <button className="btn-redirect-trigger" onClick={() => setShowRedirect(v => !v)}>
              {showRedirect ? "Cancel" : "↺ Redirect"}
            </button>
          </div>
          {showRedirect && (
            <div className="redirect-area">
              <textarea
                className="redirect-input"
                rows={3}
                placeholder="Tell the agent what to change..."
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                disabled={redirecting}
              />
              <button className="btn-resubmit" onClick={handleResubmit} disabled={redirecting || !feedback.trim()}>
                {redirecting ? <><span className="spinner-sm" /> Resubmitting...</> : "Resubmit to agent"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Team Panel ────────────────────────────────────────────────────────────────
function TeamPanel({ data, teamStatus, onApproveTeam, onRemoveTeam, onRedirectTeam, onExecuteTeam, executing }) {
  const [addingRole, setAddingRole] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [roleInput, setRoleInput] = useState("");

  const handleAddRole = async () => {
    if (!roleInput.trim()) return;
    setAddingRole(true);
    setShowAddInput(false);
    await onRedirectTeam(null, data,
      `Add a "${roleInput.trim()}" role to the founding team. Return the full updated team array including this new member with appropriate responsibilities, skills, and week1_task.`);
    setRoleInput("");
    setAddingRole(false);
  };

  if (!data?.team) {
    return <div className="agent-panel"><div className="panel-empty"><div className="spinner-sm" /> Generating team...</div></div>;
  }

  return (
    <div className="agent-panel">
      <div className="panel-header">
        <span className="panel-title">Founding Team</span>
        <span className="pill pill-amber">{Object.keys(teamStatus).length}/{data.team.length} approved</span>
      </div>
      <div className="team-grid">
        {data.team.map((member, i) => (
          <div key={i} className={`team-card ${teamStatus[i] ? "approved" : ""}`}>
            <div className="avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
              {getInitials(member.role)}
            </div>
            <div className="member-role">{member.role}</div>
            <div className="member-task">{boldHook(member.week1_task)}</div>
            <div className="skill-pills">
              {member.skills?.map((s, j) => (
                <span key={j} className="skill-pill">{String(s).split(" — ")[0]}</span>
              ))}
            </div>
            <ul className="member-resp">
              {member.responsibilities?.map((r, j) => <li key={j}>{boldHook(r)}</li>)}
            </ul>
            {!teamStatus[i] ? (
              <div className="team-card-actions">
                <button className="btn-approve" onClick={() => onApproveTeam(i)}>✓ Approve</button>
                <button className="btn-disapprove" onClick={() => onRemoveTeam(i)}>✕ Remove</button>
              </div>
            ) : (
              <div className="ready-status-row">
                <span className="ready-status">✓ Ready to start</span>
                <button className="btn-disapprove" onClick={() => onRemoveTeam(i)}>✕ Remove</button>
              </div>
            )}
          </div>
        ))}

        {/* Add role card */}
        {showAddInput ? (
          <div className="team-card add-role-input-card">
            <div className="add-role-label">What role do you need?</div>
            <input
              className="add-role-input"
              type="text"
              placeholder="e.g. UX Designer, Sales Lead..."
              value={roleInput}
              onChange={e => setRoleInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddRole()}
              autoFocus
            />
            <div className="add-role-buttons">
              <button className="btn-approve" onClick={handleAddRole} disabled={!roleInput.trim()}>
                Add role
              </button>
              <button className="btn-disapprove" onClick={() => { setShowAddInput(false); setRoleInput(""); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="team-card add-role-card" onClick={() => setShowAddInput(true)} disabled={addingRole}>
            {addingRole ? <><div className="spinner-sm" /> Adding role...</> : <><span className="add-icon">+</span> Add role</>}
          </button>
        )}
      </div>

      {/* Execute trigger */}
      {(() => {
        const allApproved = data.team.length > 0 && Object.keys(teamStatus).length === data.team.length;
        if (!allApproved) return null;
        return (
          <div className="execute-bar">
            {executing ? (
              <div className="execute-working"><span className="spinner-sm" /> Team is working on their tasks...</div>
            ) : (
              <>
                <p className="execute-hint">All roles approved. Ready to put them to work.</p>
                <button className="btn-execute" onClick={onExecuteTeam}>Execute Team →</button>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── Tasks Panel ───────────────────────────────────────────────────────────────
function TasksPanel({ tasks, reports, loading }) {
  if (!tasks.length) {
    return (
      <div className="agent-panel">
        <div className="panel-empty">
          {loading ? <><div className="spinner-sm" /> Assigning tasks...</> : "Tasks will appear after the team is generated."}
        </div>
      </div>
    );
  }

  const completedRoles = new Set(reports.map(r => r.role));

  return (
    <div className="agent-panel">
      <div className="panel-header">
        <span className="panel-title">Task Board</span>
        <span className={`pill ${reports.length === tasks.length ? "pill-green" : "pill-amber"}`}>
          {reports.length}/{tasks.length} completed
        </span>
      </div>
      <div className="task-list">
        {tasks.map((task, i) => {
          const done = completedRoles.has(task.assigned_to);
          return (
            <div key={i} className={`task-row ${done ? "done" : ""}`}>
              <div className="task-status-dot" style={{ background: done ? "#28cd41" : "#ff9500" }} />
              <div className="task-info">
                <div className="task-title">{boldHook(task.title)}</div>
                <div className="task-meta">{task.assigned_to}</div>
              </div>
              <span className={`pill ${done ? "pill-green" : "pill-amber"}`}>
                {done ? "Completed" : loading ? "Working..." : "Pending"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Report Card ───────────────────────────────────────────────────────────────
function ReportCard({ report, status, onApprove, onRedirect }) {
  const [showRedirect, setShowRedirect] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  const handleResubmit = async () => {
    if (!feedback.trim()) return;
    setRedirecting(true);
    await onRedirect(feedback);
    setFeedback("");
    setShowRedirect(false);
    setRedirecting(false);
  };

  const deliverable = report.deliverable;
  const isStringDeliverable = typeof deliverable === "string" && deliverable.length > 0;
  const deliverableEntries = !isStringDeliverable && deliverable && typeof deliverable === "object"
    ? Object.entries(deliverable).filter(([, v]) => v != null)
    : [];

  return (
    <div className="report-card">
      <div className="report-header">
        <div>
          <div className="report-role">{report.role}</div>
          {report.task_title && <div className="report-task-title">{boldHook(report.task_title)}</div>}
        </div>
        <StatusPill status={status} />
      </div>

      {isStringDeliverable && (
        <div className="field-card">
          <div className="field-card-label">{report.deliverable_type || "Deliverable"}</div>
          <pre className="deliverable-content">{deliverable}</pre>
        </div>
      )}
      {deliverableEntries.length > 0 && (
        <div className="body-fields">
          {deliverableEntries.map(([k, v]) => <FieldCard key={k} label={k} value={v} />)}
        </div>
      )}

      {report.key_decisions?.length > 0 && (
        <div className="field-card">
          <div className="field-card-label">Key Decisions</div>
          <ul className="checklist">
            {report.key_decisions.map((d, i) => (
              <li key={i}><span className="check-circle">✓</span><span>{boldHook(d)}</span></li>
            ))}
          </ul>
        </div>
      )}

      {report.blockers?.length > 0 && (
        <div className="field-card">
          <div className="field-card-label">Blockers</div>
          <ul className="checklist">
            {report.blockers.map((b, i) => (
              <li key={i}><span className="check-circle blocker">⚠</span><span>{boldHook(b)}</span></li>
            ))}
          </ul>
        </div>
      )}

      {report.next_step && (
        <div className="field-card">
          <div className="field-card-label">Next Step</div>
          <p className="body-text">{boldHook(report.next_step)}</p>
        </div>
      )}

      {status !== "approved" && (
        <div className="panel-actions">
          <div className="action-buttons">
            <button className="btn-approve" onClick={onApprove}>✓ Approve</button>
            <button className="btn-redirect-trigger" onClick={() => setShowRedirect(v => !v)}>
              {showRedirect ? "Cancel" : "↺ Redirect"}
            </button>
          </div>
          {showRedirect && (
            <div className="redirect-area">
              <textarea
                className="redirect-input"
                rows={3}
                placeholder="Tell the worker what to change..."
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                disabled={redirecting}
              />
              <button className="btn-resubmit" onClick={handleResubmit} disabled={redirecting || !feedback.trim()}>
                {redirecting ? <><span className="spinner-sm" /> Resubmitting...</> : "Resubmit to worker"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Reports Panel ─────────────────────────────────────────────────────────────
function ReportsPanel({ reports, reportStatus, onApproveReport, onRedirectReport, onBuild, building, builtUrl, loading }) {
  if (!reports.length) {
    return (
      <div className="agent-panel">
        <div className="panel-empty">
          {loading ? <><div className="spinner-sm" /> Workers executing tasks...</> : "Reports will appear as workers complete their tasks."}
        </div>
      </div>
    );
  }

  const approvedCount = Object.values(reportStatus).filter(v => v === "approved").length;

  return (
    <div className="agent-panel">
      <div className="panel-header">
        <span className="panel-title">Worker Reports</span>
        <span className={`pill ${approvedCount === reports.length ? "pill-green" : "pill-amber"}`}>
          {approvedCount}/{reports.length} approved
        </span>
      </div>
      <div className="reports-list">
        {reports.map((report, i) => (
          <ReportCard
            key={i}
            report={report}
            status={reportStatus[i] || "pending"}
            onApprove={() => onApproveReport(i)}
            onRedirect={(feedback) => onRedirectReport(i, report, feedback)}
          />
        ))}
      </div>

      {/* Build MVP bar */}
      <div className="execute-bar">
        {builtUrl ? (
          <div className="build-ready">
            <div>
              <div className="build-ready-label">MVP is live</div>
              <div className="build-ready-desc">{builtUrl.description}</div>
            </div>
            <a href={builtUrl.url} target="_blank" rel="noreferrer" className="btn-open-mvp">
              Open {builtUrl.app_name} →
            </a>
          </div>
        ) : building ? (
          <div className="execute-working"><span className="spinner-sm" /> Building MVP...</div>
        ) : (
          <>
            <p className="execute-hint">Team work complete. Build the actual product.</p>
            <button className="btn-execute" onClick={onBuild}>Build & Run MVP →</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [prompt, setPrompt]           = useState("");
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [agentStatus, setAgentStatus] = useState({});
  const [teamStatus, setTeamStatus]   = useState({});
  const [tasks, setTasks]             = useState([]);
  const [reports, setReports]         = useState([]);
  const [reportStatus, setReportStatus] = useState({});
  const [executing, setExecuting]     = useState(false);
  const [building, setBuilding]       = useState(false);
  const [builtUrl, setBuiltUrl]       = useState(null);
  const [selected, setSelected]       = useState("idea");
  const [error, setError]             = useState("");
  const [savedRuns, setSavedRuns]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("founderos_runs") || "[]"); }
    catch { return []; }
  });
  const [savedMsg, setSavedMsg]       = useState(false);

  const saveRun = () => {
    const run = {
      id: Date.now(),
      savedAt: new Date().toISOString(),
      prompt,
      result,
      agentStatus,
      teamStatus,
      tasks,
      reports,
      reportStatus,
      builtUrl,
    };
    const updated = [run, ...savedRuns].slice(0, 30);
    setSavedRuns(updated);
    localStorage.setItem("founderos_runs", JSON.stringify(updated));
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const loadRun = (run) => {
    setPrompt(run.prompt || "");
    setResult(run.result || {});
    setAgentStatus(run.agentStatus || {});
    setTeamStatus(run.teamStatus || {});
    setTasks(run.tasks || []);
    setReports(run.reports || []);
    setReportStatus(run.reportStatus || {});
    setBuiltUrl(run.builtUrl || null);
    setSelected("idea");
    setError("");
  };

  const deleteRun = (id) => {
    const updated = savedRuns.filter(r => r.id !== id);
    setSavedRuns(updated);
    localStorage.setItem("founderos_runs", JSON.stringify(updated));
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setResult({});
    setAgentStatus({});
    setTeamStatus({});
    setTasks([]);
    setReports([]);
    setReportStatus({});
    setBuiltUrl(null);
    setSelected("idea");

    try {
      const res = await fetch(`${API}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") { setLoading(false); return; }
          const { key, data } = JSON.parse(raw);
          if (key === "error") { setError(data); setLoading(false); return; }
          if (key === "tasks") {
            setTasks(data.tasks || []);
          } else if (key.startsWith("report_")) {
            setReports(prev => [...prev, data]);
          } else {
            setResult(prev => ({ ...prev, [key]: data }));
          }
        }
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleApprove = (key) => setAgentStatus(p => ({ ...p, [key]: "approved" }));

  const handleRedirect = async (key, agentId, originalOutput, feedback) => {
    setAgentStatus(p => ({ ...p, [key]: "redirected" }));
    const res = await fetch(`${API}/redirect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, agent: key, originalOutput, feedback, prompt }),
    });
    const revised = await res.json();
    setResult(p => ({ ...p, [key]: revised }));
    setAgentStatus(p => ({ ...p, [key]: "pending" }));
  };

  const handleApproveTeam = (i) => setTeamStatus(p => ({ ...p, [i]: true }));

  const handleRemoveTeam = (i) => {
    setResult(p => ({
      ...p,
      team: { ...p.team, team: p.team.team.filter((_, idx) => idx !== i) },
    }));
    setTeamStatus(p => {
      const next = {};
      Object.entries(p).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < i) next[ki] = v;
        else if (ki > i) next[ki - 1] = v;
      });
      return next;
    });
  };

  const handleRedirectTeam = async (_, originalOutput, feedback) => {
    const res = await fetch(`${API}/redirect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "team-gen", agent: "team", originalOutput, feedback, prompt }),
    });
    const revised = await res.json();
    setResult(p => ({ ...p, team: revised }));
    setTeamStatus({});
  };

  const executeTeam = async () => {
    setExecuting(true);
    setTasks([]);
    setReports([]);
    setReportStatus({});
    setSelected("tasks");

    try {
      const res = await fetch(`${API}/execute-team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          idea: result.idea,
          product: result.product,
          market: result.market,
          business: result.business,
          brand: result.brand,
          team: result.team?.team || [],
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") { setExecuting(false); return; }
          const { key, data } = JSON.parse(raw);
          if (key === "error") { setError(data); setExecuting(false); return; }
          if (key === "tasks") { setTasks(data.tasks || []); }
          else if (key.startsWith("report_")) { setReports(prev => [...prev, data]); }
        }
      }
    } catch (e) {
      setError(e.message);
    }
    setExecuting(false);
  };

  const buildMvp = async () => {
    setBuilding(true);
    setBuiltUrl(null);
    try {
      const res = await fetch(`${API}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          product: result.product,
          brand: result.brand,
          reports,
        }),
      });
      const data = await res.json();
      if (data.url) setBuiltUrl(data);
      else setError(data.error || "Build failed");
    } catch (e) {
      setError(e.message);
    }
    setBuilding(false);
  };

  const handleApproveReport = (i) => setReportStatus(p => ({ ...p, [i]: "approved" }));

  const handleRedirectReport = async (i, originalOutput, feedback) => {
    setReportStatus(p => ({ ...p, [i]: "redirected" }));
    const res = await fetch(`${API}/redirect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "worker", agent: originalOutput.role, originalOutput, feedback, prompt }),
    });
    const revised = await res.json();
    setReports(prev => prev.map((r, idx) => idx === i ? { ...revised, _index: i } : r));
    setReportStatus(p => ({ ...p, [i]: "pending" }));
  };

  const planningKeys = ["idea","product","market","business","brand","pitch"];
  const planningApproved = planningKeys.filter(k => agentStatus[k] === "approved").length;
  const teamApproved = result?.team?.team?.length > 0 && Object.keys(teamStatus).length === result.team.team.length ? 1 : 0;
  const reportsApproved = Object.values(reportStatus).filter(v => v === "approved").length === reports.length && reports.length > 0 ? 1 : 0;
  const approvedCount = planningApproved + teamApproved + reportsApproved;
  const totalCount = 8; // 6 planning + team + reports

  const getStatus = (key) => agentStatus[key] || "pending";

  const getDotColor = (key) => {
    if (key === "tasks") {
      if (!tasks.length) return "#d1d1d6";
      return reports.length === tasks.length ? "#28cd41" : "#ff9500";
    }
    if (key === "reports") {
      if (!reports.length) return "#d1d1d6";
      const approved = Object.values(reportStatus).filter(v => v === "approved").length;
      return approved === reports.length ? "#28cd41" : "#ff9500";
    }
    if (key === "team") {
      if (!result?.team) return "#d1d1d6";
      const t = result.team?.team || [];
      return t.length > 0 && Object.keys(teamStatus).length === t.length ? "#28cd41" : "#ff9500";
    }
    const s = getStatus(key);
    if (!result?.[key]) return "#d1d1d6";
    if (s === "approved") return "#28cd41";
    return "#ff9500";
  };

  const hasData = (key) => {
    if (key === "tasks") return tasks.length > 0;
    if (key === "reports") return reports.length > 0;
    return !!result?.[key];
  };

  // Landing
  if (!result || Object.keys(result).length === 0) {
    return (
      <div className="landing">
        <div className="landing-inner">
          <h1>FounderOS</h1>
          <p className="landing-sub">One idea. A functioning team in minutes.</p>
          <textarea
            className="idea-input"
            rows={3}
            placeholder="Describe your startup idea in one sentence..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={loading}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), generate())}
          />
          <button className="btn-launch" onClick={generate} disabled={loading || !prompt.trim()}>
            {loading ? <><span className="spinner-sm" /> Spinning up your team...</> : "Launch →"}
          </button>
          {error && <div className="error-box">{error}</div>}

          {savedRuns.length > 0 && (
            <div className="saved-runs">
              <div className="saved-runs-title">Past runs</div>
              <div className="run-list">
                {savedRuns.map(run => {
                  const name = run.result?.brand?.startup_name
                    ? coerceString(run.result.brand.startup_name).split(" — ")[0]
                    : null;
                  const date = new Date(run.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                  return (
                    <div key={run.id} className="run-card">
                      <div className="run-card-content">
                        <div className="run-card-name">{name || run.prompt.slice(0, 48) + (run.prompt.length > 48 ? "…" : "")}</div>
                        <div className="run-card-meta">{name ? (run.prompt.length > 55 ? run.prompt.slice(0, 55) + "…" : run.prompt) + " · " : ""}{date}</div>
                      </div>
                      <div className="run-card-actions">
                        <button className="btn-load-run" onClick={() => loadRun(run)}>Load</button>
                        <button className="btn-delete-run" onClick={() => deleteRun(run.id)}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">FounderOS</div>
          <div className="sidebar-prompt">"{prompt.length > 60 ? prompt.slice(0, 60) + "…" : prompt}"</div>
          <div className="progress-wrap">
            <div className="progress-label">{approvedCount} / {totalCount} approved</div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${(approvedCount / totalCount) * 100}%` }} />
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(n => (
            <button
              key={n.key}
              className={`nav-item ${selected === n.key ? "active" : ""}`}
              onClick={() => setSelected(n.key)}
            >
              <span className="nav-dot" style={{ background: getDotColor(n.key) }} />
              {n.label}
              {loading && !hasData(n.key) && <span className="nav-spinner" />}
            </button>
          ))}
        </nav>

        <button className="btn-save" onClick={saveRun}>
          {savedMsg ? "✓ Saved" : "Save run"}
        </button>
        <button className="btn-new" onClick={() => { setResult(null); setPrompt(""); setTasks([]); setReports([]); setReportStatus({}); setBuiltUrl(null); }}>
          + New idea
        </button>
      </aside>

      <main className="main">
        {error && <div className="error-box">{error}</div>}
        {selected === "team" ? (
          <TeamPanel
            data={result.team}
            teamStatus={teamStatus}
            onApproveTeam={handleApproveTeam}
            onRemoveTeam={handleRemoveTeam}
            onRedirectTeam={handleRedirectTeam}
            onExecuteTeam={executeTeam}
            executing={executing}
          />
        ) : selected === "tasks" ? (
          <TasksPanel tasks={tasks} reports={reports} loading={loading} />
        ) : selected === "reports" ? (
          <ReportsPanel
            reports={reports}
            reportStatus={reportStatus}
            onApproveReport={handleApproveReport}
            onRedirectReport={handleRedirectReport}
            onBuild={buildMvp}
            building={building}
            builtUrl={builtUrl}
            loading={loading || executing}
          />
        ) : (
          <AgentPanel
            agentKey={selected}
            data={result[selected]}
            status={getStatus(selected)}
            onApprove={handleApprove}
            onRedirect={handleRedirect}
            loading={loading}
          />
        )}
      </main>
    </div>
  );
}
