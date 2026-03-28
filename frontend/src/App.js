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
];

// Which fields to surface as metric cards and which as highlights
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
  return (
    <div className="metric-card">
      <div className="metric-label">{label.replace(/_/g, " ")}</div>
      <div className="metric-value">{String(display ?? "—")}</div>
    </div>
  );
}

function boldHook(str) {
  const s = String(str ?? "");
  const idx = s.indexOf(" — ");
  if (idx > 0 && idx < 60) {
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
            <li key={k}><span className="check-circle">✓</span><span><strong className="hook">{k.replace(/_/g, " ")}</strong><span className="hook-sep"> — </span>{String(val)}</span></li>
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

  const allKeys = Object.keys(data).filter(k => k !== "status");
  const bodyFields = cfg.body.length
    ? cfg.body.filter(k => allKeys.includes(k))
    : allKeys.filter(k => !cfg.metrics.includes(k) && !cfg.highlights.includes(k));

  return (
    <div className="agent-panel">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">{label} Agent</span>
        <StatusPill status={status} />
      </div>

      {/* Metrics row */}
      {cfg.metrics.length > 0 && (
        <div className="metrics-row">
          {cfg.metrics.filter(k => data[k] != null).map(k => (
            <MetricCard key={k} label={k} value={data[k]} />
          ))}
        </div>
      )}

      {/* Highlights */}
      {cfg.highlights.filter(k => data[k] != null).map(k => (
        <div key={k} className="highlight-text">{String(data[k])}</div>
      ))}

      {/* Body fields */}
      <div className="body-fields">
        {bodyFields.map(k => data[k] != null && (
          <FieldCard key={k} label={k} value={data[k]} />
        ))}
      </div>

      {/* Actions */}
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

function TeamPanel({ data, teamStatus, onApproveTeam, onRedirectTeam, prompt }) {
  const [addingRole, setAddingRole] = useState(false);

  const handleAddRole = async () => {
    setAddingRole(true);
    await onRedirectTeam(
      null, data,
      "Add one more critical founding role we are missing based on the product plan and business model. Return the full updated team array including this new role."
    );
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
            <div
              className="avatar"
              style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
            >
              {getInitials(member.role)}
            </div>
            <div className="member-role">{member.role}</div>
            <div className="member-task">{member.week1_task}</div>
            <div className="skill-pills">
              {member.skills?.map((s, j) => <span key={j} className="skill-pill">{s}</span>)}
            </div>
            <ul className="member-resp">
              {member.responsibilities?.map((r, j) => <li key={j}>{r}</li>)}
            </ul>
            {!teamStatus[i] ? (
              <button className="btn-approve" style={{ marginTop: "auto" }} onClick={() => onApproveTeam(i)}>
                ✓ Approve
              </button>
            ) : (
              <div className="ready-status">✓ Ready to start</div>
            )}
          </div>
        ))}

        {/* Add role card */}
        <button className="team-card add-role-card" onClick={handleAddRole} disabled={addingRole}>
          {addingRole
            ? <><div className="spinner-sm" /> Adding role...</>
            : <><span className="add-icon">+</span> Add role</>}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [prompt, setPrompt]         = useState("");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [agentStatus, setAgentStatus] = useState({});
  const [teamStatus, setTeamStatus] = useState({});
  const [selected, setSelected]     = useState("idea");
  const [error, setError]           = useState("");

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setResult({});
    setAgentStatus({});
    setTeamStatus({});
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
          setResult(prev => ({ ...prev, [key]: data }));
          setSelected(key);
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

  const approvedCount = NAV.filter(n => {
    if (n.key === "team") return result?.team && Object.keys(teamStatus).length === result.team?.team?.length && result.team.team.length > 0;
    return agentStatus[n.key] === "approved";
  }).length;

  const getStatus = (key) => agentStatus[key] || "pending";

  const getDotColor = (key) => {
    const s = getStatus(key);
    if (!result?.[key]) return "#2a2a3a";
    if (s === "approved") return "#1D9E75";
    if (s === "redirected") return "#EF9F27";
    return "#EF9F27";
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
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">FounderOS</div>
          <div className="sidebar-prompt">"{prompt.length > 60 ? prompt.slice(0, 60) + "…" : prompt}"</div>
          <div className="progress-wrap">
            <div className="progress-label">{approvedCount} / 7 approved</div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${(approvedCount / 7) * 100}%` }} />
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
              {loading && !result?.[n.key] && <span className="nav-spinner" />}
            </button>
          ))}
        </nav>

        <button className="btn-new" onClick={() => { setResult(null); setPrompt(""); }}>
          + New idea
        </button>
      </aside>

      {/* Main */}
      <main className="main">
        {error && <div className="error-box">{error}</div>}
        {selected === "team" ? (
          <TeamPanel
            data={result.team}
            teamStatus={teamStatus}
            onApproveTeam={handleApproveTeam}
            onRedirectTeam={handleRedirectTeam}
            prompt={prompt}
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
