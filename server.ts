import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getAI(): GoogleGenAI {
  if (!ai && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  if (!ai) {
    throw new Error('Gemini API key is not configured in environment (GEMINI_API_KEY).');
  }
  return ai;
}

function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

// Resilient wrapper with exponential backoff and model cascade for transient 503 / 429 quota errors
async function generateContentWithRetry(prompt: string, maxRetries = 2): Promise<string> {
  const aiClient = getAI();
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of models) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const response = await aiClient.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const text = response.text;
        if (!text) {
          throw new Error('Empty response received from AI model.');
        }
        return text;
      } catch (err: any) {
        lastError = err;
        attempt++;
        const errMsg = err?.message || String(err);
        const isQuotaExceeded =
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('Quota exceeded');

        if (isQuotaExceeded) {
          console.warn(`Model ${model} quota exhausted. Trying next fallback model...`);
          break; // break retry loop to try next model in cascade
        }

        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand');

        if (isTransient && attempt < maxRetries) {
          const delayMs = attempt * 1000;
          console.warn(`Transient error on ${model} (attempt ${attempt}). Retrying in ${delayMs}ms...`);
          await new Promise((res) => setTimeout(res, delayMs));
          continue;
        }
        break;
      }
    }
  }

  // Format error cleanly
  let message = lastError?.message || 'Failed to generate response.';
  try {
    const parsed = JSON.parse(message);
    if (parsed.error?.message) {
      message = parsed.error.message;
    }
  } catch {
    // leave as is
  }
  throw new Error(message);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasKey: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString(),
  });
});

// 1. RESUME ANALYZER
app.post('/api/resume-analyzer', async (req, res) => {
  try {
    const { resumeText, targetRole } = req.body;
    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({ error: 'Resume text is required.' });
    }
    if (!targetRole || !targetRole.trim()) {
      return res.status(400).json({ error: 'Target job role is required.' });
    }

    const prompt = `You are an expert career counselor and senior technical recruiter for college students, fresh graduates, and internship seekers.
Analyze the following resume text specifically for the target role: "${targetRole}".

CRITICAL INSTRUCTIONS:
- Do NOT invent, assume, or fabricate any qualifications, experience, degrees, projects, or metrics not explicitly stated in the resume text.
- Be honest, objective, encouraging, and constructive for early-career job seekers.
- Return ONLY a valid JSON object matching the requested schema.

RESUME TEXT:
"""
${resumeText.slice(0, 15000)}
"""

TARGET ROLE: ${targetRole}

Provide your analysis in this exact JSON structure:
{
  "readinessScore": <number between 0 and 100 representing overall readiness for this role>,
  "presentationScore": <number between 0 and 100 for readability, layout, formatting, clarity>,
  "summary": "<2-3 sentence executive summary of the student's profile relative to the target role>",
  "technicalSkills": {
    "detected": ["<skill 1>", "<skill 2>"],
    "missingForRole": ["<crucial missing skill 1>", "<crucial missing skill 2>"]
  },
  "educationAssessment": "<Evaluation of education section, relevance of coursework, degrees, and recommendations>",
  "projectsAssessment": "<Evaluation of personal/academic projects, technical depth, impact, and how to improve them>",
  "experienceAssessment": "<Evaluation of internships, leadership, clubs, or freelance experience, or advice if none exists>",
  "presentationAssessment": "<Critique of resume structure, action verbs, bullet point clarity, and formatting>",
  "relevantKeywords": {
    "present": ["<keyword 1>", "<keyword 2>"],
    "recommendedToAdd": ["<keyword 3>", "<keyword 4>"]
  },
  "strengths": [
    "<Specific strength verified from the text>",
    "<Specific strength verified from the text>",
    "<Specific strength verified from the text>"
  ],
  "weaknesses": [
    "<Specific weakness or gap observed in the text>",
    "<Specific weakness or gap observed in the text>"
  ],
  "recommendations": [
    "<Actionable step 1>",
    "<Actionable step 2>",
    "<Actionable step 3>",
    "<Actionable step 4>"
  ]
}`;

    const rawText = await generateContentWithRetry(prompt);
    const parsed = JSON.parse(cleanJsonString(rawText));
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/resume-analyzer:', error);
    return res.status(500).json({
      error: error.message || 'Failed to analyze resume. Please verify the API key and try again.',
    });
  }
});

// 2. STUDENT SKILL ASSESSMENT
app.post('/api/skill-assessment', async (req, res) => {
  try {
    const { categorizedSkills, notes } = req.body;
    if (!categorizedSkills || Object.keys(categorizedSkills).length === 0) {
      return res.status(400).json({ error: 'Skill list is required.' });
    }

    const prompt = `You are a career readiness and technical skill evaluator for college students and recent grads.
Evaluate the following categorized student skills:

${JSON.stringify(categorizedSkills, null, 2)}
${notes ? `Additional student context/goals: ${notes}` : ''}

Assess their current profile across Programming, AI, Cybersecurity, Communication, and Technical Support.
Return ONLY a valid JSON object in this format:
{
  "overallReadinessLevel": "<e.g., Early Learner, Developing Junior, Job-Ready Intern, Strong Entry-Level>",
  "profileOverview": "<2-3 sentence encouraging evaluation of their breadth and depth>",
  "pillarRatings": [
    {
      "category": "Programming",
      "rating": <number 1-10>,
      "feedback": "<concise feedback on their programming tools and stack>"
    },
    {
      "category": "Artificial Intelligence",
      "rating": <number 1-10>,
      "feedback": "<concise feedback on AI/ML exposure>"
    },
    {
      "category": "Cybersecurity",
      "rating": <number 1-10>,
      "feedback": "<concise feedback on security awareness/skills>"
    },
    {
      "category": "Communication",
      "rating": <number 1-10>,
      "feedback": "<concise feedback on soft skills and teamwork>"
    },
    {
      "category": "Technical Support",
      "rating": <number 1-10>,
      "feedback": "<concise feedback on troubleshooting and systems>"
    }
  ],
  "topPillars": ["<strongest 1 or 2 areas>"],
  "highImpactNextSkills": [
    {
      "skill": "<Skill name>",
      "category": "<Category>",
      "reason": "<Why learning this now opens high-value entry-level doors>"
    }
  ],
  "suggestedProject": "<A beginner-friendly portfolio project that combines at least two of their current skills>"
}`;

    const rawText = await generateContentWithRetry(prompt);
    const parsed = JSON.parse(cleanJsonString(rawText));
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/skill-assessment:', error);
    return res.status(500).json({
      error: error.message || 'Failed to assess skills. Please check your connection and try again.',
    });
  }
});

// 3. SKILL GAP ANALYZER
app.post('/api/skill-gap', async (req, res) => {
  try {
    const { currentSkills, targetRole, requiredJobSkills } = req.body;
    if (!currentSkills || !Array.isArray(currentSkills) || currentSkills.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one current skill.' });
    }
    if (!targetRole || !targetRole.trim()) {
      return res.status(400).json({ error: 'Target role is required.' });
    }

    const prompt = `You are a career development specialist for students and fresh graduates.
Analyze the skill gap between the student's current skills and the target role: "${targetRole}".

Student Current Skills:
${currentSkills.join(', ')}

${requiredJobSkills ? `Industry Required Skills specified for ${targetRole}: ${requiredJobSkills}` : `Identify standard industry requirements for entry-level ${targetRole}.`}

CRITICAL REQUIREMENTS:
- Identify existing skills, matching skills, and missing skills.
- Categorize learning priorities into Critical Priority (must learn first), High Priority (essential for day 1), and Medium Priority (good to have).
- Generate a practical, step-by-step 4-week beginner-friendly learning roadmap with specific free resources or project milestones.

Return ONLY a valid JSON object matching this schema:
{
  "targetRole": "${targetRole}",
  "matchPercentage": <number 0-100>,
  "alignmentSummary": "<2-3 sentence encouraging explanation of their current fit>",
  "existingSkills": ["<skill>", "<skill>"],
  "matchingSkills": ["<skill that directly matches the job>", "<skill>"],
  "missingSkills": ["<skill required but not yet possessed>", "<skill>"],
  "learningPriorities": [
    {
      "skill": "<Missing skill name>",
      "priority": "Critical Priority" | "High Priority" | "Medium Priority",
      "whyImportant": "<Brief practical reason for entry-level roles>",
      "recommendedResourceOrTopic": "<Specific beginner resource, doc, or topic to learn>"
    }
  ],
  "improvementRoadmap": [
    {
      "week": "Week 1: Fundamentals",
      "focus": "<Core topic>",
      "actionItems": ["<Item 1>", "<Item 2>"],
      "milestone": "<Concrete outcome>"
    },
    {
      "week": "Week 2: Practical Application",
      "focus": "<Core topic>",
      "actionItems": ["<Item 1>", "<Item 2>"],
      "milestone": "<Concrete outcome>"
    },
    {
      "week": "Week 3: Tooling & Integration",
      "focus": "<Core topic>",
      "actionItems": ["<Item 1>", "<Item 2>"],
      "milestone": "<Concrete outcome>"
    },
    {
      "week": "Week 4: Portfolio Proof & Capstone",
      "focus": "<Core topic>",
      "actionItems": ["<Item 1>", "<Item 2>"],
      "milestone": "<Concrete outcome>"
    }
  ],
  "beginnerTips": [
    "<Practical actionable tip for fresh graduates/interns>",
    "<Practical actionable tip for fresh graduates/interns>"
  ]
}`;

    const rawText = await generateContentWithRetry(prompt);
    const parsed = JSON.parse(cleanJsonString(rawText));
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/skill-gap:', error);
    return res.status(500).json({
      error: error.message || 'Failed to analyze skill gap. Please try again.',
    });
  }
});

// 4. CAREER RECOMMENDATION
app.post('/api/career-recommendation', async (req, res) => {
  try {
    const { skills, interests, coursework } = req.body;
    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ error: 'Please provide some skills or interests.' });
    }

    const prompt = `You are an expert career counselor for university students and recent grads.
Recommend 4 suitable entry-level career roles based strictly on the student's entered skills and interests.

STUDENT PROFILE:
- Skills: ${skills.join(', ')}
${interests ? `- Interests / Aspirations: ${interests}` : ''}
${coursework ? `- Relevant Coursework / Degree: ${coursework}` : ''}

Explain why each role may be suitable based on what they already know. Provide beginner-accessible career pathways.
Return ONLY a valid JSON object matching this schema:
{
  "recommendations": [
    {
      "roleTitle": "<e.g., Junior Frontend Developer>",
      "suitabilityMatch": <percentage number 60-98>,
      "suitabilityTier": "High Match" | "Strong Potential" | "Exciting Adjacent",
      "whySuitable": "<Clear 2-3 sentence explanation connecting their specific entered skills to this role>",
      "dayToDayResponsibilities": ["<Responsibility 1>", "<Responsibility 2>", "<Responsibility 3>"],
      "strengthsTheyHave": ["<Skill from their list>", "<Skill from their list>"],
      "bridgeSkillsToLearn": ["<Skill 1 to learn>", "<Skill 2 to learn>"],
      "starterProjectIdea": "<A concrete beginner project idea they can build to qualify for this role>",
      "entryLevelOutlook": "<Realistic market demand and junior career growth path>"
    }
  ]
}`;

    const rawText = await generateContentWithRetry(prompt);
    const parsed = JSON.parse(cleanJsonString(rawText));
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/career-recommendation:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate career recommendations.',
    });
  }
});

// 5. INTERNSHIP PREPARATION
app.post('/api/internship-prep', async (req, res) => {
  try {
    const { targetRole, timelineWeeks, currentLevel } = req.body;
    if (!targetRole || !targetRole.trim()) {
      return res.status(400).json({ error: 'Target internship role is required.' });
    }

    const prompt = `You are a university internship coordinator and tech mentor.
Generate an actionable, structured internship preparation checklist for a student targeting: "${targetRole}".
Timeline: ${timelineWeeks || 4} weeks.
Current Level: ${currentLevel || 'Fresh Graduate / College Student'}.

Must include:
1. Technical Skills preparation (core topics, coding drills, tools)
2. Communication Skills preparation (introductions, behavioral answers, team communication)
3. Project Preparation (portfolio polish, GitHub repo hygiene, documentation)
4. Application & Outreach (resume tailoring, LinkedIn, follow-up cadence)

Return ONLY a valid JSON object:
{
  "role": "${targetRole}",
  "overview": "<2-sentence inspiring guideline for landing this internship>",
  "technicalChecklist": [
    {
      "id": "tech_1",
      "task": "<Specific technical preparation task>",
      "category": "Core Concept" | "Hands-on Practice" | "Tooling",
      "whyItMatters": "<Reason recruiters look for this>"
    }
  ],
  "communicationChecklist": [
    {
      "id": "comm_1",
      "task": "<Specific communication preparation task>",
      "category": "Self Introduction" | "Behavioral / STAR" | "Asking Questions",
      "whyItMatters": "<Why this makes interns stand out>"
    }
  ],
  "projectChecklist": [
    {
      "id": "proj_1",
      "task": "<Specific project preparation task>",
      "category": "Portfolio Polish" | "GitHub Standards" | "Live Demo",
      "whyItMatters": "<How this provides proof of ability>"
    }
  ],
  "applicationChecklist": [
    {
      "id": "app_1",
      "task": "<Specific application or networking task>",
      "category": "Resume / Profile" | "Outreach Strategy" | "Tracking",
      "whyItMatters": "<How this increases response rates>"
    }
  ],
  "mentorTip": "<One golden rule every intern applicant must know>"
}`;

    const rawText = await generateContentWithRetry(prompt);
    const parsed = JSON.parse(cleanJsonString(rawText));
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/internship-prep:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate internship preparation checklist.',
    });
  }
});

// 6. INTERVIEW PREPARATION
app.post('/api/interview-prep', async (req, res) => {
  try {
    const { targetRole, focusArea } = req.body;
    if (!targetRole || !targetRole.trim()) {
      return res.status(400).json({ error: 'Target job role is required.' });
    }

    const prompt = `You are an experienced hiring manager conducting entry-level and internship interviews for the role: "${targetRole}".
Focus: ${focusArea || 'Comprehensive Technical and HR'}.

Generate realistic, beginner-friendly interview questions with simple, high-scoring sample answers using the STAR (Situation, Task, Action, Result) method where applicable.

Provide:
- 4 Technical questions (fundamental concepts, practical scenarios suitable for college students)
- 4 HR / Behavioral questions (teamwork, handling deadlines, learning new tech, problem-solving)

Return ONLY a valid JSON object matching this schema:
{
  "targetRole": "${targetRole}",
  "interviewTips": [
    "<Concise practical tip 1 for students>",
    "<Concise practical tip 2 for students>"
  ],
  "questions": [
    {
      "id": "q1",
      "type": "Technical" | "HR / Behavioral",
      "question": "<Realistic interview question>",
      "whyAsked": "<What the interviewer is evaluating>",
      "sampleAnswer": "<Simple, clear, high-scoring answer tailored for a beginner>",
      "structureTip": "<Key elements to include, e.g., STAR framework or concept breakdown>",
      "commonMistake": "<Rookie mistake to avoid>"
    }
  ]
}`;

    const rawText = await generateContentWithRetry(prompt);
    const parsed = JSON.parse(cleanJsonString(rawText));
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/interview-prep:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate interview preparation questions.',
    });
  }
});

// 6b. INTERVIEW PRACTICE EVALUATOR (Practice Mode)
app.post('/api/interview-eval', async (req, res) => {
  try {
    const { question, userAnswer, targetRole } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required.' });
    }
    if (!userAnswer || !userAnswer.trim()) {
      return res.status(400).json({ error: 'Please enter your practice answer.' });
    }

    const prompt = `You are a supportive, insightful mock interview coach for university students.
The student answered this interview question for the role "${targetRole || 'Software Intern'}":

QUESTION:
"${question}"

STUDENT'S ANSWER:
"${userAnswer}"

Evaluate their answer objectively and constructively:
- Score from 1 to 10
- Highlight what was good
- Highlight areas of improvement (clarity, structure, technical accuracy, or STAR method)
- Provide an improved version of their answer keeping their own voice.

Return ONLY a valid JSON object:
{
  "score": <number 1-10>,
  "strengths": ["<Specific praise 1>", "<Specific praise 2>"],
  "improvements": ["<Actionable improvement 1>", "<Actionable improvement 2>"],
  "improvedModelAnswer": "<Polished version of their answer for an entry-level candidate>",
  "coachFeedback": "<Encouraging 1-2 sentence final tip>"
}`;

    const rawText = await generateContentWithRetry(prompt);
    const parsed = JSON.parse(cleanJsonString(rawText));
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/interview-eval:', error);
    return res.status(500).json({
      error: error.message || 'Failed to evaluate interview response.',
    });
  }
});

// 7. HR COMMUNICATION GENERATOR
app.post('/api/hr-communication', async (req, res) => {
  try {
    const {
      commType,
      studentName,
      recipientName,
      companyName,
      roleTitle,
      keyHighlights,
      context,
    } = req.body;

    if (!commType) {
      return res.status(400).json({ error: 'Communication type is required.' });
    }
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ error: 'Company name is required.' });
    }

    const typeNames: Record<string, string> = {
      internship_enquiry: 'Cold Internship Enquiry Email',
      linkedin_connect: 'LinkedIn Connection Note (< 300 characters + expanded follow-up message)',
      hr_followup: 'HR Follow-up Email (Post-application or post-interview)',
      interview_confirmation: 'Interview Confirmation & Availability Reply',
    };

    const requestedType = typeNames[commType] || commType;

    const prompt = `You are a professional business communication mentor for university students and fresh graduates.
Generate professional outreach messages for:
Type: ${requestedType}
Student Name: ${studentName || '[Your Name]'}
Recipient: ${recipientName || 'Hiring Manager / Recruiter'}
Company: ${companyName}
Target Role: ${roleTitle || 'Internship / Entry-Level Role'}
Key Highlights / Skills to mention: ${keyHighlights || 'Enthusiastic learner with relevant project coursework'}
Additional Context: ${context || 'None provided'}

Generate TWO writing styles:
1. Formal Style (Polite, structured, traditional corporate tone)
2. Friendly Style (Warm, modern tech company tone, personable yet professional)

Return ONLY a valid JSON object matching this schema:
{
  "commType": "${commType}",
  "subjectFormal": "<Clear, professional subject line for email (or 'N/A' for LinkedIn connection)>",
  "subjectFriendly": "<Engaging subject line for email (or 'N/A' for LinkedIn connection)>",
  "formalVersion": "<Full message text in formal tone, ready to copy and paste>",
  "friendlyVersion": "<Full message text in friendly tone, ready to copy and paste>",
  "customizationTips": [
    "<Tip on what detail to personalize before sending>",
    "<Tip on timing and etiquette>"
  ]
}`;

    const rawText = await generateContentWithRetry(prompt);
    const parsed = JSON.parse(cleanJsonString(rawText));
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/hr-communication:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate HR communication.',
    });
  }
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SkillSync AI server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
