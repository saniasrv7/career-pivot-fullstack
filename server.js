// server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API endpoint
app.post('/api/analyse-pivot', async (req, res) => {
  const { from, to } = req.body;

  if (!from || !to) {
    return res.status(400).json({ error: 'Missing from or to role' });
  }

  const prompt = `You are an expert career coach and talent strategist. Analyse a career pivot from "${from}" to "${to}".

Return ONLY valid JSON matching this exact structure. No markdown, no explanation, just the JSON object.

{
  "summary": {
    "skills_to_build": <integer 4-10>,
    "transferable_count": <integer 4-8>,
    "plan_months": 6,
    "roles_to_target": <integer 3-5>
  },
  "skills_have": [
    { "name": "<skill name>", "level": <integer 60-95>, "relevance": "<why this matters for target role in 1 sentence>", "tag": "strong" }
  ],
  "skills_need": [
    { "name": "<skill name>", "priority": <integer 1-10>, "gap": <integer 20-80>, "why": "<why this is needed in 1 sentence>", "tag": "gap|partial" }
  ],
  "radar": {
    "axes": ["<skill 1>", "<skill 2>", "<skill 3>", "<skill 4>", "<skill 5>", "<skill 6>"],
    "current": [<0-100>, <0-100>, <0-100>, <0-100>, <0-100>, <0-100>],
    "target": [<0-100>, <0-100>, <0-100>, <0-100>, <0-100>, <0-100>]
  },
  "transferable": [
    { "name": "<transferable skill>", "desc": "<how this transfers specifically, 2 sentences>", "strength": "<HIGH|MEDIUM>" }
  ],
  "timeline": [
    {
      "phase": "Phase 1",
      "period": "Weeks 1-4",
      "title": "<phase title>",
      "actions": [
        { "week": "Wk 1-2", "action": "<specific action>", "detail": "<what exactly to do>" },
        { "week": "Wk 3-4", "action": "<specific action>", "detail": "<what exactly to do>" }
      ],
      "milestone": "<concrete deliverable at end of this phase>"
    }
  ],
  "job_titles": [
    {
      "step": 1,
      "title": "<exact job title>",
      "subtitle": "<typical company context>",
      "requirements": ["<req 1>", "<req 2>", "<req 3>"],
      "salary_range": "<e.g. £35,000-£45,000>",
      "timeline": "<e.g. Months 1-3>",
      "is_current": <true if this is their starting point, else false>,
      "is_target": <true if this is their end goal>
    }
  ],
  "honest": {
    "good": [
      { "title": "<strength>", "text": "<honest explanation 2 sentences>" }
    ],
    "hard": [
      { "title": "<challenge>", "text": "<honest explanation 2 sentences>" }
    ],
    "truth": "<one honest paragraph, 3-4 sentences, no cheerleading, real talk about what this transition actually involves>"
  },
  "resources": [
    {
      "category": "<e.g. Courses>",
      "title": "<section title>",
      "items": [
        { "icon": "<single emoji>", "name": "<resource name>", "desc": "<what it is and why it helps, 1 sentence>", "tag": "<free|paid|community|book>" }
      ]
    }
  ]
}

Rules (keep concise):
- skills_have: exactly 5 items, realistic levels based on the FROM role
- skills_need: exactly 5 items, sorted by priority
- radar: exactly 6 axes, short names (max 2 words each)
- transferable: exactly 4 items, 1-2 sentences each
- timeline: exactly 3 phases (Weeks 1-4, Month 2-3, Month 4-6), exactly 2 actions per phase, keep action detail under 15 words
- job_titles: exactly 3 rungs, requirements max 3 short phrases each, UK salary ranges
- honest.good: exactly 3 items, 1-2 sentences each
- honest.hard: exactly 3 items, 1-2 sentences each  
- honest.truth: max 3 sentences
- resources: exactly 3 categories, exactly 3 items each, desc under 15 words
- Be specific to "${from}" to "${to}" but keep all text concise`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert career coach. Always respond with valid JSON only, no markdown or explanation.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 8000,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Groq API error:', error);
      return res.status(response.status).json({ 
        error: 'API request failed',
        details: error 
      });
    }

    const raw = await response.json();
    const text = raw.choices?.[0]?.message?.content || '';
    
    let clean = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    
    const jsonStart = clean.indexOf('{');
    const jsonEnd = clean.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      return res.status(500).json({ error: 'No valid JSON in response' });
    }
    
    clean = clean.slice(jsonStart, jsonEnd + 1);
    const data = JSON.parse(clean);

    return res.json(data);

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
