require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { calcScore, getVerdict, getVerdictReason } = require("./scoreCalc");

const app = express();
app.use(cors());
app.use(express.json());

const OPENCLAW_URL   = process.env.OPENCLAW_URL || "http://localhost:18789";
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";

app.get("/health", async (req, res) => {
  try {
    const r = await fetch(`${OPENCLAW_URL}/healthz`);
    res.json({ backend: "ok", openclaw: (await r.text()).trim() });
  } catch (e) {
    res.status(500).json({ backend: "ok", openclaw: "unreachable", error: e.message });
  }
});

// ── Streaming generate ────────────────────────────────────────────────────────
app.post("/generate", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (key, data) => res.write(`data: ${JSON.stringify({ key, data })}\n\n`);

  try {
    // ── Planning agents ────────────────────────────────────────────────────
    const idea = await callAgent("idea-parser", `
      You are the Idea Parser for a startup venture system.
      Startup idea: "${prompt}"
      Return ONLY valid JSON, no explanation, no markdown.
      Format every string value as "BOLD HOOK — supporting detail".
      {
        "problem": "CORE PROBLEM — one sentence describing it specifically",
        "target_users": "WHO — specific description of target users",
        "domain": "INDUSTRY — specific domain or vertical",
        "core_goal": "END STATE — what success looks like in one sentence",
        "score": {
          "M": 0,
          "D": 0,
          "R": 0,
          "E": 0,
          "penalties": {
            "saturated_market": false,
            "high_tech_risk": false,
            "no_monetization": false,
            "regulatory_risk": false
          },
          "dimension_notes": {
            "M": "one sentence why",
            "D": "one sentence why",
            "R": "one sentence why",
            "E": "one sentence why"
          },
          "main_risk": "single biggest risk in one honest sentence"
        }
      }

      Score this idea honestly across 4 dimensions. Use integers 0-100.
      Do not inflate. An average idea scores 55-65. A strong idea 75-85.
      Reserve 85+ for genuinely novel ideas with clear monetization and low competition.
      Base all scores on a solo bootstrapped founder with no funding.

      Dimension definitions:
      - M = Market opportunity: realistic size, growth, and timing for this specific idea
      - D = Differentiation: how unique is this vs existing competitors
      - R = Revenue clarity: how obvious and direct is the path to getting paid
      - E = Execution feasibility: can a solo founder realistically build this in 6 months

      Penalty rules (set true only if the condition clearly applies):
      - saturated_market: 3 or more dominant well-funded incumbents already exist
      - high_tech_risk: requires unproven, experimental, or very hard-to-build technology
      - no_monetization: no clear way to charge users or businesses
      - regulatory_risk: heavily regulated industry (healthcare, finance, legal, etc.)
    `);

    // Compute score server-side from raw dimensions + penalties
    if (idea.score) {
      const { M, D, R, E, penalties } = idea.score;
      const dims = { M: M || 0, D: D || 0, R: R || 0, E: E || 0 };
      const overall = calcScore(dims, penalties || {});
      idea.score.overall = overall;
      idea.score.verdict = getVerdict(overall);
      idea.score.verdict_reason = getVerdictReason(dims, penalties || {}, overall);
    }

    send("idea", idea);

    const context = `Startup idea: "${prompt}"\nParsed context: ${JSON.stringify(idea)}`;

    const product = await callAgent("product", `
      You are the Product Agent for a startup venture system.
      ${context}
      Return ONLY valid JSON, no markdown.
      Format every string value and array item as "BOLD HOOK — supporting detail".
      {
        "features": ["FEATURE NAME — what it does and why it matters", "FEATURE NAME — ...", "FEATURE NAME — ..."],
        "user_flow": "STEP 1 → STEP 2 → STEP 3 — brief description of the core journey",
        "tech_stack": "REACT + NODE — full specific stack with hosting",
        "mvp_scope": "4-WEEK SCOPE — exactly what ships, nothing more",
        "status": "MVP defined. Awaiting your approval."
      }
    `);
    send("product", product);

    const market = await callAgent("market", `
      You are the Market Agent for a startup venture system.
      ${context}
      Return ONLY valid JSON, no markdown.
      Format every string value and array item as "BOLD HOOK — supporting detail".
      Be realistic and conservative. No vanity numbers. Base estimates on a bootstrapped solo founder with no funding.
      For market_size: size it to the actual addressable market for THIS specific idea, not the broad industry.
      A local food delivery app is not a "$200B food delivery market" — it is the realistic slice this founder can reach.
      If the idea is local, niche, or early-stage, the honest SAM might be $500K–$5M. That is fine and more credible.
      Cite the reasoning: who are the real customers, how many of them exist, what would they pay, do the math.
      {
        "competitors": ["COMPANY NAME — what they do and why they fall short", "COMPANY NAME — ...", "COMPANY NAME — ..."],
        "market_size": "REALISTIC DOLLAR FIGURE — specific reasoning: X customers × $Y price × Z frequency",
        "market_gap": "THE GAP — specific unmet need none of them fill",
        "differentiation": "OUR EDGE — the one thing that makes this win",
        "status": "Market analysis complete. Awaiting your approval."
      }
    `);
    send("market", market);

    const business = await callAgent("business", `
      You are the Business Agent for a startup venture system.
      ${context}
      Return ONLY valid JSON, no markdown.
      Format every string value and array item as "BOLD HOOK — supporting detail".
      Be realistic and conservative. No vanity numbers. Base this on a bootstrapped solo founder with no funding.
      Pricing must match what real customers in this specific market actually pay — not aspirational enterprise rates.
      Break-even must be honest: account for slow early growth, churn, and the reality that the first 6 months often bring almost no revenue.
      Do NOT default to generic SaaS tiers — reason from the specific idea and customer type.
      {
        "pricing": "specific tier names and realistic prices — what each tier includes",
        "revenue_model": "MODEL TYPE — specific mechanics of how money is made",
        "cost_structure": ["BIGGEST COST — realistic % of budget and why", "SECOND COST — ...", "THIRD COST — ..."],
        "break_even": "HONEST MONTH ESTIMATE — show the math: how many paying customers needed, at what price, given realistic growth",
        "status": "Business model drafted. Awaiting your approval."
      }
    `);
    send("business", business);

    const brand = await callAgent("brand", `
      You are the Brand Agent for a startup venture system.
      ${context}
      Return ONLY valid JSON, no markdown.
      Format every string value and array item as "BOLD HOOK — supporting detail".
      {
        "startup_name": "one original memorable name",
        "tagline": "under 8 words",
        "tone": "BOLD — one word brand voice",
        "colors": ["#hexcode — color name", "#hexcode — color name"],
        "status": "Brand identity created. Awaiting your approval."
      }
    `);
    send("brand", brand);

    const pitch = await callAgent("pitch", `
      You are the Pitch Agent for a startup venture system.
      ${context}
      Return ONLY valid JSON, no markdown.
      Format why_now and ask as "BOLD HOOK — supporting detail".
      one_liner and pitch_30s should be plain compelling prose.
      Be realistic and conservative. No vanity numbers. Base this on a bootstrapped solo founder with no funding.
      For the ask: reason from first principles. What does this specific startup actually need to reach its first real milestone?
      Many bootstrapped ideas need $0 to start — sweat equity, free tiers, and nights-and-weekends time.
      If outside money is genuinely needed, size it to what is actually required — not what sounds impressive.
      A solo dev tool might need $0–$20K. A local service might need $5K–$30K. Only complex products with real infrastructure costs need more.
      Do NOT inflate the ask to seem like a "real" startup. Credibility comes from honest numbers.
      State exactly what the money funds and the specific milestone it hits.
      {
        "one_liner": "under 15 words, hooks immediately — no jargon",
        "pitch_30s": "3 punchy sentences: problem, solution, why now",
        "why_now": "THE SHIFT — specific real-world trend making this timely right now",
        "ask": "REALISTIC AMOUNT AND STAGE — exactly what it funds and the milestone it hits",
        "status": "Pitch ready. Awaiting your approval."
      }
    `);
    send("pitch", pitch);

    const team = await callAgent("team-gen", `
      You are the Team Generator for a startup venture system.
      ${context}
      Product plan: ${JSON.stringify(product)}
      Business model: ${JSON.stringify(business)}
      Return ONLY valid JSON, no markdown.
      Format responsibilities, skills, and week1_task as "BOLD HOOK — supporting detail".
      {
        "team": [
          {
            "role": "specific role title",
            "responsibilities": ["ACTION VERB — specific concrete outcome", "ACTION VERB — ..."],
            "skills": ["SKILL NAME — specific context or tool", "SKILL NAME — ..."],
            "week1_task": "FIRST PRIORITY — the single most important thing they do and why",
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

// ── Execute team — runs after founder approves all roles ──────────────────────
app.post("/execute-team", async (req, res) => {
  const { prompt, idea, product, market, business, brand, team } = req.body;
  if (!team?.length) return res.status(400).json({ error: "team required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (key, data) => res.write(`data: ${JSON.stringify({ key, data })}\n\n`);

  const startupName = typeof brand?.startup_name === "string"
    ? brand.startup_name.split(" — ")[0]
    : "the startup";

  try {
    // 1. Assign tasks
    const taskData = await callAgent("task-gen", `
      You are the Task Generator for FounderOS.
      Startup: "${startupName}" — ${prompt}
      Founding team: ${JSON.stringify(team)}
      Product plan: ${JSON.stringify(product)}
      Business model: ${JSON.stringify(business)}
      Market: ${JSON.stringify(market)}

      Assign exactly one concrete Week 1 task per team member.

      CRITICAL CONSTRAINT: Every task must produce a document, artifact, or piece of code that can be written right now.
      This is a pre-launch startup with no live product and no real users yet.
      NEVER assign tasks that require a live product, real users, or real-world actions. Forbidden examples:
      - "Acquire X users" or "Get beta signups" — there is no product to sign up for yet
      - "Run a marketing campaign" — there is no audience yet
      - "Onboard customers" — there are no customers yet
      - "Analyze user feedback" — there is no feedback yet
      - "Set up sales calls" — there is no pipeline yet
      Instead assign tasks whose output is a written artifact: code, spec, doc, wireframe, copy, plan, analysis, schema, contract template, pitch deck, etc.

      Return ONLY valid JSON:
      {
        "tasks": [
          {
            "task_id": "task_001",
            "assigned_to": "exact role title matching team",
            "title": "DELIVERABLE — what specific artifact gets produced",
            "description": "concrete written/coded output expected in plain terms",
            "depends_on": [],
            "status": "pending"
          }
        ]
      }
    `);
    send("tasks", taskData);

    // 2. Execute each worker — produce REAL deliverables
    const tasks = taskData.tasks || [];

    for (let i = 0; i < team.length; i++) {
      const member = team[i];
      const task = tasks.find(t => t.assigned_to === member.role)
        || tasks[i]
        || { title: member.week1_task || "Week 1 priority", description: "Complete your primary Week 1 task" };

      const taskTitle = String(task.title).split(" — ")[0];
      const roleSkills = (member.skills || []).map(s => String(s).split(" — ")[0]).join(", ");

      const report = await callAgent("worker", `
        You are the ${member.role} at ${startupName}.
        Skills: ${roleSkills}

        Your Week 1 task: "${taskTitle}"
        Description: "${task.description}"

        Startup context:
        - Idea: ${prompt}
        - Product: ${JSON.stringify(product)}
        - Market: ${JSON.stringify(market)}
        - Business: ${JSON.stringify(business)}

        IMPORTANT: Produce the ACTUAL deliverable — not a description of what you would make.
        Write the real thing. Examples:
        - Engineer → write actual working code (routes, schemas, functions)
        - PM → write an actual PRD with real feature specs and user stories
        - Marketer → write actual ad copy, taglines, email sequences
        - Designer → write an actual design spec with component details and UX flows
        - Analyst → write an actual analysis with real numbers and projections

        CRITICAL: This startup has no live product and no real users yet. Do not produce deliverables that assume otherwise.
        Never write things like "reach out to 20 users", "analyze signup data", or "run ads" — none of that exists yet.
        Everything you produce must be a document, plan, code file, or written artifact you can create from scratch right now.

        Be specific to ${startupName}. Never write generic placeholder content.

        Return ONLY valid JSON:
        {
          "role": "${member.role}",
          "task_title": "WHAT WAS MADE — specific name of the output",
          "deliverable_type": "code / spec / copy / analysis / design",
          "deliverable": "THE ACTUAL WORK AS A STRING — write the real content here. If code, write real runnable code. If copy, write real copy. If spec, write a real spec. Make it complete and usable.",
          "key_decisions": ["DECISION — rationale", "DECISION — rationale"],
          "blockers": [],
          "next_step": "NEXT ACTION — one specific next step",
          "status": "completed"
        }
      `);
      send(`report_${i}`, { ...report, _index: i });
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ key: "error", data: e.message })}\n\n`);
    res.end();
  }
});

// ── Redirect (planner or worker) ──────────────────────────────────────────────
app.post("/redirect", async (req, res) => {
  const { agentId, agent, originalOutput, feedback, prompt } = req.body;
  if (!agent || !feedback) return res.status(400).json({ error: "agent and feedback required" });

  try {
    const result = await callAgent(agentId || "worker", `
      Original startup idea: "${prompt}"
      You are the ${agent} for this startup.
      Your previous output was: ${JSON.stringify(originalOutput)}
      The founder reviewed your work and said: "${feedback}"
      Revise your output based on this feedback. Return ONLY valid JSON in the exact same format as before.
      Update the "status" field to: "Revised based on founder feedback. Awaiting approval."
    `);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Build MVP — generates a runnable HTML app ─────────────────────────────────
app.post("/build", async (req, res) => {
  const { prompt, product, brand, reports } = req.body;
  if (!product) return res.status(400).json({ error: "product plan required" });

  const startupName = typeof brand?.startup_name === "string"
    ? brand.startup_name.split(" — ")[0]
    : "Startup";

  const brandColors = Array.isArray(brand?.colors) ? brand.colors.slice(0, 2).map(c => String(c).split(" — ")[0]).join(", ") : "#6366f1, #0ea5e9";
  const tagline = brand?.tagline || "";

  const workerSummary = (reports || []).map(r =>
    `${r.role}: ${r.task_title || ""}\n${typeof r.deliverable === "string" ? r.deliverable.slice(0, 800) : JSON.stringify(r.deliverable || {}).slice(0, 400)}`
  ).join("\n\n");

  try {
    const result = await callAgent("builder", `
      You are building an MVP for: "${startupName}"
      Tagline: "${tagline}"
      Idea: "${prompt}"
      Brand colors: ${brandColors}

      Product plan:
      Features: ${JSON.stringify(product.features || [])}
      User flow: ${product.user_flow || ""}
      Tech stack note: ${product.tech_stack || ""}
      MVP scope: ${product.mvp_scope || ""}

      Team deliverables:
      ${workerSummary}

      Build a complete, working web app that implements the core product.
      A real user must open it and immediately be able to use it.

      Return ONLY valid JSON — the html field must be a complete HTML document:
      {
        "project_slug": "kebab-case-app-name",
        "app_name": "${startupName}",
        "description": "one sentence of what the user can do",
        "html": "<!DOCTYPE html>... complete HTML with Tailwind CDN, all JS inline, all features working ..."
      }
    `);

    if (!result.html) {
      return res.status(500).json({ error: "Builder did not return HTML" });
    }

    const slug = (result.project_slug || startupName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")).slice(0, 40);
    const previewDir = path.join(__dirname, "previews");
    fs.mkdirSync(previewDir, { recursive: true });
    fs.writeFileSync(path.join(previewDir, `${slug}.html`), result.html, "utf8");

    res.json({
      url: `http://localhost:3001/preview/${slug}`,
      slug,
      app_name: result.app_name,
      description: result.description,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve generated previews
app.use("/preview", express.static(path.join(__dirname, "previews"), { extensions: ["html"] }));

// ── OpenClaw client ───────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function callAgent(agentId, prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const r = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENCLAW_TOKEN}`,
      },
      body: JSON.stringify({
        model: `openclaw/${agentId}`,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if ((r.status === 429 || r.status === 503) && attempt < retries) {
      await sleep(4000 * attempt);
      continue;
    }

    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`OpenClaw error ${r.status}: ${errText}`);
    }

    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    try { return JSON.parse(clean); }
    catch { return { raw: text }; }
  }
}

app.listen(3001, () => console.log("Backend running on http://localhost:3001"));
