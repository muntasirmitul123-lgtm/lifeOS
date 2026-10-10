import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateStructuredWithHighThinking(
  prompt: string,
  systemInstruction: string,
  responseSchema: any
): Promise<{ data: any; modelUsed: string; thinkingLevel: string }> {
  const ai = getAIClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: 'application/json',
        responseSchema,
      },
    });
    const text = response.text || '{}';
    return {
      data: JSON.parse(text),
      modelUsed: 'gemini-3.1-pro-preview',
      thinkingLevel: 'HIGH',
    };
  } catch (primaryErr: any) {
    // Fallback to gemini-3.8-flash with HIGH thinking if paid model access is unavailable
    const fallbackResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: 'application/json',
        responseSchema,
      },
    });
    const text = fallbackResponse.text || '{}';
    return {
      data: JSON.parse(text),
      modelUsed: 'gemini-3.8-flash',
      thinkingLevel: 'HIGH',
    };
  }
}

// Deterministic local fallback parsers when AI is offline or unconfigured
function fallbackBrainDumpParse(rawText: string) {
  const sentences = rawText
    .split(/(?:[.\n;]+|\band\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const items: any[] = [];
  const ambiguities: string[] = [];

  for (const s of sentences) {
    const lower = s.toLowerCase();
    const isIdea =
      lower.includes('maybe') ||
      lower.includes('idea') ||
      lower.includes('could build') ||
      lower.includes('should also build') ||
      lower.includes('explore');
    const isProject =
      lower.includes('project') ||
      lower.includes('launch') ||
      lower.includes('website business');
    const isNote =
      lower.startsWith('note:') ||
      lower.includes('remember that') ||
      lower.includes('worry');

    let explicitDeadline = '';
    const dateMatch = s.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (dateMatch) {
      explicitDeadline = dateMatch[1];
    } else if (lower.includes('tomorrow') || lower.includes('next week')) {
      ambiguities.push(`"${s}" mentions a relative timeframe ("${lower.includes('tomorrow') ? 'tomorrow' : 'next week'}") — confirm exact date before setting a deadline.`);
    }

    const cleanedTitle = s
      .replace(/^(i need to|i should|maybe i should also|maybe|need to|also)\s+/i, '')
      .trim();
    const title = cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1);

    items.push({
      type: isIdea ? 'idea' : isProject ? 'project' : isNote ? 'note' : 'task',
      title: title || s,
      description: `Extracted from Brain Dump: "${s}"`,
      priority: lower.includes('urgent') || lower.includes('exam') || lower.includes('homework') ? 'high' : 'normal',
      explicitDeadline,
      category: lower.includes('study') || lower.includes('english') || lower.includes('ict') || lower.includes('homework') ? 'Study' : 'Personal',
      estimatedMinutes: 30,
      suggestedSubtasks: [],
    });
  }

  return {
    items,
    ambiguities,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. AI Connection Status Endpoint
  app.get('/api/ai/status', (_req, res) => {
    const ai = getAIClient();
    res.json({
      configured: Boolean(ai),
      primaryModel: 'gemini-3.1-pro-preview',
      fallbackModel: 'gemini-3.8-flash',
      thinkingLevel: 'HIGH',
      message: ai
        ? 'Gemini AI Assistant active (gemini-3.1-pro-preview with HIGH thinking mode).'
        : 'GEMINI_API_KEY is not configured. Deterministic local planning engine is active as fallback.',
    });
  });

  // 2. Brain Dump Parsing Endpoint
  app.post('/api/ai/brain-dump', async (req, res) => {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Brain dump text is required.' });
    }

    try {
      const result = await generateStructuredWithHighThinking(
        `Parse the following messy brain dump text into structured candidate items.
NEVER invent a deadline unless an explicit YYYY-MM-DD date is stated. If relative or vague dates are mentioned, note them in ambiguities.
Input text:
"""
${text}
"""`,
        'You are the LifeOS Second Brain parser. Extract tasks, ideas, notes, and project suggestions accurately without inventing facts or deadlines.',
        {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: 'task, idea, note, or project' },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  priority: { type: Type.STRING, description: 'low, normal, high, or urgent' },
                  explicitDeadline: { type: Type.STRING, description: 'YYYY-MM-DD only if explicitly stated, otherwise empty string' },
                  category: { type: Type.STRING },
                  estimatedMinutes: { type: Type.NUMBER },
                  suggestedSubtasks: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['type', 'title', 'description', 'priority', 'explicitDeadline', 'category', 'estimatedMinutes', 'suggestedSubtasks'],
              },
            },
            ambiguities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['items', 'ambiguities'],
        }
      );

      return res.json({
        ...result.data,
        aiMeta: { model: result.modelUsed, thinkingLevel: result.thinkingLevel, usedFallback: false },
      });
    } catch (err: any) {
      const fallback = fallbackBrainDumpParse(text);
      return res.json({
        ...fallback,
        aiMeta: {
          model: 'deterministic-local',
          thinkingLevel: 'NONE',
          usedFallback: true,
          reason: err?.message || 'AI service unavailable, used local parser.',
        },
      });
    }
  });

  // 3. Daily Plan Generator
  app.post('/api/ai/daily-plan', async (req, res) => {
    const { date, tasks = [], events = [], preferences = {} } = req.body || {};
    const workStart = preferences.workStartHour || '09:00';
    const workEnd = preferences.workEndHour || '18:00';
    const energyLevel = preferences.energyLevel || 'moderate';

    try {
      const result = await generateStructuredWithHighThinking(
        `Create a realistic daily time-blocked plan for ${date}.
User working hours: ${workStart} to ${workEnd}.
User energy level today: ${energyLevel}.
Fixed/existing events today: ${JSON.stringify(events)}
Open candidate tasks: ${JSON.stringify(tasks)}
Rules:
1. Never overlap with existing fixed events.
2. Include realistic 10-15 minute buffers between deep work blocks. Do not pack every minute.
3. Match task energy requirements and priority to the user's ${energyLevel} energy level.
4. Provide a clear rationale for each proposed block.`,
        'You are the LifeOS Executive Planning Assistant. Propose realistic, humane schedules with buffer time.',
        {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            proposedBlocks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  startTime: { type: Type.STRING, description: 'HH:mm (24h)' },
                  endTime: { type: Type.STRING, description: 'HH:mm (24h)' },
                  category: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                },
                required: ['taskId', 'title', 'startTime', 'endTime', 'category', 'rationale'],
              },
            },
            deferredTasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['taskId', 'title', 'reason'],
              },
            },
          },
          required: ['summary', 'proposedBlocks', 'deferredTasks'],
        }
      );

      return res.json({
        ...result.data,
        aiMeta: { model: result.modelUsed, thinkingLevel: result.thinkingLevel, usedFallback: false },
      });
    } catch (err: any) {
      // Deterministic local schedule builder with buffers
      const startHourNum = parseInt(workStart.split(':')[0] || '9', 10);
      const endHourNum = parseInt(workEnd.split(':')[0] || '18', 10);
      let cursorMinutes = startHourNum * 60;
      const maxMinutes = endHourNum * 60;

      const occupied = (events as any[]).map((ev) => {
        const [sh, sm] = (ev.startTime || '09:00').split(':').map(Number);
        const [eh, em] = (ev.endTime || '10:00').split(':').map(Number);
        return { start: sh * 60 + sm, end: eh * 60 + em };
      });

      const fmt = (m: number) =>
        `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

      const sortedTasks = [...(tasks as any[])].sort((a, b) => {
        const pOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
        return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
      });

      const proposedBlocks: any[] = [];
      const deferredTasks: any[] = [];

      for (const t of sortedTasks) {
        const dur = Math.min(Math.max(Number(t.estimatedMinutes) || 45, 15), 120);
        // Advance cursor if overlapping fixed events
        let placed = false;
        while (cursorMinutes + dur <= maxMinutes) {
          const conflict = occupied.find(
            (o) => cursorMinutes < o.end && cursorMinutes + dur > o.start
          );
          if (conflict) {
            cursorMinutes = conflict.end + 15; // 15m buffer after fixed event
          } else {
            proposedBlocks.push({
              taskId: t.id || '',
              title: t.title,
              startTime: fmt(cursorMinutes),
              endTime: fmt(cursorMinutes + dur),
              category: t.category || 'General',
              rationale: `Scheduled based on ${t.priority} priority with a 15m buffer for ${energyLevel} energy.`,
            });
            occupied.push({ start: cursorMinutes, end: cursorMinutes + dur });
            cursorMinutes += dur + 15; // 15-min buffer
            placed = true;
            break;
          }
        }
        if (!placed) {
          deferredTasks.push({
            taskId: t.id || '',
            title: t.title,
            reason: 'Exceeds remaining working hours once buffers and fixed commitments are respected.',
          });
        }
      }

      return res.json({
        summary: `Generated balanced schedule (${proposedBlocks.length} blocks with 15-minute buffers) respecting ${events.length} fixed commitments.`,
        proposedBlocks,
        deferredTasks,
        aiMeta: {
          model: 'deterministic-local',
          thinkingLevel: 'NONE',
          usedFallback: true,
          reason: err?.message || 'Used local time-blocking engine.',
        },
      });
    }
  });

  // 4. Task Breakdown Assistant
  app.post('/api/ai/task-breakdown', async (req, res) => {
    const { goalTitle, context = '' } = req.body || {};
    if (!goalTitle) {
      return res.status(400).json({ error: 'goalTitle is required' });
    }

    try {
      const result = await generateStructuredWithHighThinking(
        `Break down the following vague goal or complex work item into concrete, sequential, actionable tasks and subtasks:
Goal/Objective: "${goalTitle}"
Additional Context: "${context}"`,
        'You are the LifeOS Execution Architect. Turn vague goals into concrete, bite-sized steps.',
        {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  estimatedMinutes: { type: Type.NUMBER },
                  priority: { type: Type.STRING },
                  energyRequired: { type: Type.STRING },
                  subtasks: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['title', 'description', 'estimatedMinutes', 'priority', 'energyRequired', 'subtasks'],
              },
            },
          },
          required: ['overview', 'tasks'],
        }
      );

      return res.json({
        ...result.data,
        aiMeta: { model: result.modelUsed, thinkingLevel: result.thinkingLevel, usedFallback: false },
      });
    } catch (err: any) {
      return res.json({
        overview: `Structured 4-stage execution breakdown for "${goalTitle}".`,
        tasks: [
          {
            title: `Define scope and success criteria for ${goalTitle}`,
            description: 'Clarify key deliverables, constraints, and reference materials.',
            estimatedMinutes: 25,
            priority: 'high',
            energyRequired: 'moderate',
            subtasks: ['List core topics or requirements', 'Gather required materials and notes'],
          },
          {
            title: `Execute core work block 1: ${goalTitle}`,
            description: 'Complete the foundational draft or primary study module.',
            estimatedMinutes: 50,
            priority: 'high',
            energyRequired: 'high',
            subtasks: ['Complete first half of material', 'Write summary notes'],
          },
          {
            title: `Execute core work block 2 & practice: ${goalTitle}`,
            description: 'Address difficult sections and test understanding.',
            estimatedMinutes: 45,
            priority: 'normal',
            energyRequired: 'moderate',
            subtasks: ['Review weak spots', 'Verify against checklist'],
          },
          {
            title: `Final review and polish: ${goalTitle}`,
            description: 'Perform final quality check and wrap up open items.',
            estimatedMinutes: 20,
            priority: 'normal',
            energyRequired: 'low',
            subtasks: ['Final walkthrough', 'Archive reference notes'],
          },
        ],
        aiMeta: {
          model: 'deterministic-local',
          thinkingLevel: 'NONE',
          usedFallback: true,
        },
      });
    }
  });

  // 5. Note Summarization & Action Items
  app.post('/api/ai/summarize-note', async (req, res) => {
    const { title, content } = req.body || {};
    if (!content) {
      return res.status(400).json({ error: 'Note content is required.' });
    }

    try {
      const result = await generateStructuredWithHighThinking(
        `Summarize the following note concisely and suggest concrete action items without losing key facts.
Note Title: "${title || 'Untitled'}"
Content:
"""
${content}
"""`,
        'You are the LifeOS Second Brain synthesizer. Produce clear summaries and actionable next steps.',
        {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            suggestedActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['summary', 'keyTakeaways', 'suggestedActions'],
        }
      );

      return res.json({
        ...result.data,
        aiMeta: { model: result.modelUsed, thinkingLevel: result.thinkingLevel, usedFallback: false },
      });
    } catch {
      const lines = String(content)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      return res.json({
        summary: lines.slice(0, 2).join(' ') || 'Note summary generated from local content.',
        keyTakeaways: lines.slice(0, 4),
        suggestedActions: lines
          .filter((l) => /todo|need|must|action|next|\[\s*\]/i.test(l))
          .slice(0, 3),
        aiMeta: { model: 'deterministic-local', thinkingLevel: 'NONE', usedFallback: true },
      });
    }
  });

  // 6. Idea Expansion Assistant
  app.post('/api/ai/idea-develop', async (req, res) => {
    const { title, content, whyItMatters } = req.body || {};
    try {
      const result = await generateStructuredWithHighThinking(
        `Expand this idea into concrete objectives, potential risks, sequential milestones, and immediate next steps:
Idea: "${title}"
Details: "${content || ''}"
Why It Matters: "${whyItMatters || ''}"`,
        'You are the LifeOS Idea Incubator. Help users turn raw concepts into structured execution plans.',
        {
          type: Type.OBJECT,
          properties: {
            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            risks: { type: Type.ARRAY, items: { type: Type.STRING } },
            milestones: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  suggestedTasks: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['name', 'suggestedTasks'],
              },
            },
            immediateNextStep: { type: Type.STRING },
          },
          required: ['objectives', 'risks', 'milestones', 'immediateNextStep'],
        }
      );
      return res.json({
        ...result.data,
        aiMeta: { model: result.modelUsed, thinkingLevel: result.thinkingLevel, usedFallback: false },
      });
    } catch {
      return res.json({
        objectives: [
          `Validate core value proposition for "${title}"`,
          'Build a minimal working version within 2 weeks',
        ],
        risks: [
          'Over-scoping before testing initial assumptions',
          'Lack of dedicated time blocks on calendar',
        ],
        milestones: [
          {
            name: 'Milestone 1: Research & Specification',
            suggestedTasks: ['Write 1-page scope brief', 'Identify key technical or resource requirements'],
          },
          {
            name: 'Milestone 2: Prototype & First Iteration',
            suggestedTasks: ['Build core workflow', 'Test and gather initial feedback'],
          },
        ],
        immediateNextStep: `Spend 25 minutes outlining the minimal viable version of ${title}.`,
        aiMeta: { model: 'deterministic-local', thinkingLevel: 'NONE', usedFallback: true },
      });
    }
  });

  // 7. Weekly Review AI Analysis
  app.post('/api/ai/weekly-review', async (req, res) => {
    const { stats = {} } = req.body || {};
    try {
      const result = await generateStructuredWithHighThinking(
        `Analyze the user's weekly productivity records and generate a Weekly Review.
Strictly separate observed facts from AI interpretations/suggestions.
Recorded Data:
${JSON.stringify(stats)}`,
        'You are the LifeOS Weekly Review Analyst. Never conflate observed statistics with interpretations.',
        {
          type: Type.OBJECT,
          properties: {
            observedFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
            aiInterpretations: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedNextWeekPriorities: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['observedFacts', 'aiInterpretations', 'suggestedNextWeekPriorities'],
        }
      );
      return res.json({
        ...result.data,
        aiMeta: { model: result.modelUsed, thinkingLevel: result.thinkingLevel, usedFallback: false },
      });
    } catch {
      return res.json({
        observedFacts: [
          `Completed ${stats.completedTasksCount ?? 0} of ${stats.totalTasksCount ?? 0} tasks.`,
          `Logged ${stats.focusMinutes ?? 0} minutes of focus time across ${stats.focusSessionsCount ?? 0} sessions.`,
          `${stats.overdueCount ?? 0} overdue tasks remain open.`,
        ],
        aiInterpretations: [
          'Scheduling high-priority tasks into dedicated morning time blocks can help reduce carryover.',
          'Consider breaking any overdue tasks larger than 60 minutes into smaller subtasks.',
        ],
        suggestedNextWeekPriorities: [
          'Clear remaining overdue tasks first',
          'Schedule at least three 50-minute focus blocks',
        ],
        aiMeta: { model: 'deterministic-local', thinkingLevel: 'NONE', usedFallback: true },
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LifeOS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
