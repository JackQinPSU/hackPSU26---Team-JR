import { useState } from "react";
import "./App.css";

const API = "http://localhost:3001";

const AGENT_LABELS = {
  product: "Product Agent",
  market: "Market Agent",
  business: "Business Agent",
  brand: "Brand Agent",
  pitch: "Pitch Agent",
};

function AgentCard({ agentKey, data, prompt, onApprove, onRevise, approved }) {
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRevise = async () => {
    if (!feedback.trim()) return;
    setLoading(true);
    await onRevise(agentKey, data, feedback);
    setFeedback("");
    setLoading(false);
  };

  return (
    <div className={`agent-card ${approved ? "approved" : ""}`}>
      <div className="agent-header">
        <span className="agent-title">{AGENT_LABELS[agentKey]}</span>
        <span className="agent-status">{data.status}</span>
      </div>
      <div className="agent-body">
        {Object.entries(data)
          .filter(([k]) => k !== "status")
          .map(([k, v]) => (
            <div key={k} className="agent-field">
              <span className="field-label">{k.replace(/_/g, " ")}</span>
              <span className="field-value">
                {Array.isArray(v) ? v.join(", ") : v}
              </span>
            </div>
          ))}
      </div>
      {!approved && (
        <div className="agent-actions">
          <button className="btn-approve" onClick={() => onApprove(agentKey)}>
            ✓ Approve
          </button>
          <div className="redirect-row">
            <input
              className="feedback-input"
              placeholder="Give feedback to redirect this agent..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={loading}
            />
            <button className="btn-redirect" onClick={handleRevise} disabled={loading}>
              {loading ? "..." : "↺ Redirect"}
            </button>
          </div>
        </div>
      )}
      {approved && <div className="approved-badge">✓ Approved</div>}
    </div>
  );
}

function TeamCard({ member, index, approved, onApprove }) {
  return (
    <div className={`team-card ${approved ? "approved" : ""}`}>
      <div className="team-role">{member.role}</div>
      <div className="team-task">Week 1: {member.week1_task}</div>
      <div className="team-skills">Skills: {member.skills?.join(", ")}</div>
      <div className="team-resp">
        {member.responsibilities?.map((r, i) => (
          <div key={i} className="resp-item">• {r}</div>
        ))}
      </div>
      <div className="team-status">{member.status}</div>
      {!approved && (
        <button className="btn-approve" onClick={() => onApprove(index)}>
          ✓ Approve
        </button>
      )}
      {approved && <div className="approved-badge">✓ Approved</div>}
    </div>
  );
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [approvedAgents, setApprovedAgents] = useState({});
  const [approvedTeam, setApprovedTeam] = useState({});
  const [error, setError] = useState("");

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setResult({});
    setApprovedAgents({});
    setApprovedTeam({});

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
          setResult((prev) => ({ ...prev, [key]: data }));
        }
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleApprove = (agentKey) => {
    setApprovedAgents((prev) => ({ ...prev, [agentKey]: true }));
  };

  const handleRevise = async (agentKey, originalOutput, feedback) => {
    const res = await fetch(`${API}/redirect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: AGENT_LABELS[agentKey], originalOutput, feedback, prompt }),
    });
    const revised = await res.json();
    setResult((prev) => ({ ...prev, [agentKey]: revised }));
  };

  const handleApproveTeam = (index) => {
    setApprovedTeam((prev) => ({ ...prev, [index]: true }));
  };

  const allAgentsApproved =
    result && Object.keys(AGENT_LABELS).every((k) => approvedAgents[k]);

  const teamMembers = result?.team?.team ?? [];
  const allTeamApproved =
    teamMembers.length > 0 &&
    teamMembers.every((_, i) => approvedTeam[i]);

  return (
    <div className="app">
      <div className="header">
        <h1>FounderOS</h1>
        <p>Drop your idea. Get a functioning team.</p>
      </div>

      <div className="input-section">
        <textarea
          className="idea-input"
          rows={3}
          placeholder="Describe your startup idea..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
        />
        <button
          className="btn-generate"
          onClick={generate}
          disabled={loading || !prompt.trim()}
        >
          {loading ? "Spinning up your team..." : "Launch →"}
        </button>
        {error && <div className="error">{error}</div>}
      </div>

      {loading && !result?.idea && (
        <div className="loading-panel">
          <div className="spinner" />
          <p>Agents are working on your idea...</p>
        </div>
      )}

      {result && Object.keys(result).length > 0 && (
        <>
          <div className="idea-summary">
            <h2>Idea Parsed</h2>
            <div className="idea-grid">
              {Object.entries(result.idea || {}).map(([k, v]) => (
                <div key={k} className="idea-item">
                  <span className="field-label">{k.replace(/_/g, " ")}</span>
                  <span className="field-value">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="section-title">
            Your AI Team — Review &amp; Approve Each Agent
          </div>

          <div className="agents-grid">
            {Object.keys(AGENT_LABELS).map((key) =>
              result[key] ? (
                <AgentCard
                  key={key}
                  agentKey={key}
                  data={result[key]}
                  prompt={prompt}
                  onApprove={handleApprove}
                  onRevise={handleRevise}
                  approved={!!approvedAgents[key]}
                />
              ) : loading ? (
                <div key={key} className="agent-card agent-pending">
                  <div className="agent-title">{AGENT_LABELS[key]}</div>
                  <div className="pending-row"><div className="spinner-sm" /> Working...</div>
                </div>
              ) : null
            )}
          </div>

          {allAgentsApproved && teamMembers.length > 0 && (
            <>
              <div className="section-title">Your Founding Team</div>
              <div className="team-grid">
                {teamMembers.map((member, i) => (
                  <TeamCard
                    key={i}
                    index={i}
                    member={member}
                    approved={!!approvedTeam[i]}
                    onApprove={handleApproveTeam}
                  />
                ))}
              </div>
            </>
          )}

          {allTeamApproved && (
            <div className="launch-banner">
              🚀 All systems go. Your founding team is assembled and approved.
            </div>
          )}
        </>
      )}
    </div>
  );
}
