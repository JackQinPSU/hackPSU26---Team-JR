require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const OPENCLAW_URL = process.env.OPENCLAW_URL || "http://localhost:18789";
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";

// Health check
app.get("/health", async (req, res) => {
  try {
    const r = await fetch(`${OPENCLAW_URL}/healthz`);
    const txt = await r.text();
    res.json({ backend: "ok", openclaw: txt.trim() });
  } catch (e) {
    res.status(500).json({ backend: "ok", openclaw: "unreachable", error: e.message });
  }
});

// Streaming generate — sends each agent result as it finishes
app.post("/generate", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (key, data) => {
    res.write(`data: ${JSON.stringify({ key, data })}\n\n`);
  };

  try {
    const idea = await callOpenClaw(`
      You are an idea parser. Given this startup idea: "${prompt}"
      Return ONLY valid JSON, no explanation, no markdown:
      {
        "problem": "one sentence describing the problem",
        "target_users": "who this is for",
        "domain": "industry/domain",
        "core_goal": "what success looks like"
      }
    `);
    send("idea", idea);

    const context = `Startup idea: ${prompt}\nParsed context: ${JSON.stringify(idea)}`;

    const product = await callOpenClaw(`${context}
      You are the Product Agent for this startup. Return ONLY valid JSON, no markdown:
      {
        "features": ["feature 1", "feature 2", "feature 3"],
        "user_flow": "step-by-step how a user uses this",
        "tech_stack": "recommended technologies",
        "mvp_scope": "what to build first",
        "status": "MVP defined. Awaiting your approval."
      }`);
    send("product", product);

    const market = await callOpenClaw(`${context}
      You are the Market Agent for this startup. Return ONLY valid JSON, no markdown:
      {
        "competitors": ["competitor 1", "competitor 2"],
        "market_size": "estimated market size",
        "market_gap": "what gap this fills",
        "differentiation": "why this wins",
        "status": "Market analysis complete. Awaiting your approval."
      }`);
    send("market", market);

    const business = await callOpenClaw(`${context}
      You are the Business Agent for this startup. Return ONLY valid JSON, no markdown:
      {
        "pricing": "pricing strategy",
        "revenue_model": "how money is made",
        "cost_structure": "main costs",
        "break_even": "when it breaks even",
        "status": "Business model drafted. Awaiting your approval."
      }`);
    send("business", business);

    const brand = await callOpenClaw(`${context}
      You are the Brand Agent for this startup. Return ONLY valid JSON, no markdown:
      {
        "startup_name": "a catchy name",
        "tagline": "one-line tagline",
        "tone": "brand voice description",
        "colors": "suggested color palette",
        "status": "Brand identity created. Awaiting your approval."
      }`);
    send("brand", brand);

    const pitch = await callOpenClaw(`${context}
      You are the Pitch Agent for this startup. Return ONLY valid JSON, no markdown:
      {
        "one_liner": "one sentence pitch",
        "pitch_30s": "30-second elevator pitch",
        "why_now": "why this matters right now",
        "ask": "what you need to get started",
        "status": "Pitch ready. Awaiting your approval."
      }`);
    send("pitch", pitch);

    const team = await callOpenClaw(`
      ${context}
      Product plan: ${JSON.stringify(product)}
      Business model: ${JSON.stringify(business)}
      You are the Team Generator. Return ONLY valid JSON, no markdown:
      {
        "team": [
          {
            "role": "role title",
            "responsibilities": ["responsibility 1", "responsibility 2"],
            "skills": ["skill 1", "skill 2"],
            "week1_task": "their first concrete task",
            "status": "Ready to start. Awaiting your approval."
          }
        ]
      }
    `);
    send("team", team);

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ key: "error", data: e.message })}\n\n`);
    res.end();
  }
});

// Re-run a single agent with founder feedback
app.post("/redirect", async (req, res) => {
  const { agent, originalOutput, feedback, prompt } = req.body;
  if (!agent || !feedback) return res.status(400).json({ error: "agent and feedback required" });

  try {
    const result = await callOpenClaw(`
      Original startup idea: "${prompt}"
      You are the ${agent} agent.
      Your previous output was: ${JSON.stringify(originalOutput)}
      The founder reviewed your work and said: "${feedback}"
      Revise your output based on this feedback. Return ONLY valid JSON in the exact same format as before.
      Change the "status" field to: "Revised based on your feedback. Awaiting approval."
    `);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function callOpenClaw(prompt) {
  const r = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENCLAW_TOKEN}`,
    },
    body: JSON.stringify({
      model: "openclaw/default",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`OpenClaw error ${r.status}: ${errText}`);
  }

  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    return { raw: text };
  }
}

app.listen(3001, () => console.log("Backend running on http://localhost:3001"));
