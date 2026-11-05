import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:3000';

interface TestResult {
  suite: string;
  test: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const results: TestResult[] = [];

async function runTest(suite: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ suite, test: name, status: 'PASS' });
    console.log(`[PASS] ${suite} -> ${name}`);
  } catch (err: any) {
    results.push({ suite, test: name, status: 'FAIL', details: err.message });
    console.error(`[FAIL] ${suite} -> ${name}:`, err.message);
  }
}

async function main() {
  console.log('--- STARTING COMPREHENSIVE QA AUDIT ---\n');

  // 1. Health check
  await runTest('API Health', 'GET /api/health returns ok and hasKey: true', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Expected status: ok, got ${data.status}`);
    if (data.hasKey !== true) throw new Error(`Expected hasKey: true, got ${data.hasKey}`);
  });

  // 2. Resume Analyzer Validation
  await runTest('Resume Analyzer', 'Empty input returns 400 with validation message', async () => {
    const res = await fetch(`${BASE_URL}/api/resume-analyzer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText: '', targetRole: 'Frontend Developer' }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    const data = await res.json();
    if (!data.error) throw new Error('Expected validation error message');
  });

  await runTest('Resume Analyzer', 'Empty targetRole returns 400', async () => {
    const res = await fetch(`${BASE_URL}/api/resume-analyzer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText: 'Valid resume text...', targetRole: '   ' }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Resume Analyzer', 'Valid resume text generates analysis structure', async () => {
    const res = await fetch(`${BASE_URL}/api/resume-analyzer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeText: 'Alex Rivera. 3rd year CS student. Skills: React, TypeScript, Git, HTML, CSS. Projects: Campus Study Finder.',
        targetRole: 'Frontend Developer Intern',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('Missing data in response');
    const d = json.data;
    if (typeof d.readinessScore !== 'number') throw new Error('readinessScore missing or not a number');
    if (!Array.isArray(d.strengths)) throw new Error('strengths must be an array');
    if (!Array.isArray(d.weaknesses)) throw new Error('weaknesses must be an array');
    if (!Array.isArray(d.recommendations)) throw new Error('recommendations must be an array');
  });

  // 3. Skill Assessment Validation & Generation
  await runTest('Skill Assessment', 'Empty skill list returns 400', async () => {
    const res = await fetch(`${BASE_URL}/api/skill-assessment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categorizedSkills: {} }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Skill Assessment', 'Valid skills generate 5-pillar assessment', async () => {
    const res = await fetch(`${BASE_URL}/api/skill-assessment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categorizedSkills: {
          programming: ['JavaScript', 'Python'],
          ai: ['Prompt Engineering'],
          cybersecurity: ['Linux basics'],
          communication: ['Teamwork'],
          technicalSupport: ['Troubleshooting'],
        },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('Missing data');
    if (!Array.isArray(json.data.pillarRatings)) throw new Error('pillarRatings missing');
    if (json.data.pillarRatings.length < 5) throw new Error('Expected ratings for all 5 pillars');
  });

  // 4. Skill Gap Analyzer
  await runTest('Skill Gap Analyzer', 'Missing current skills returns 400', async () => {
    const res = await fetch(`${BASE_URL}/api/skill-gap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentSkills: [], targetRole: 'Backend Developer' }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Skill Gap Analyzer', 'Valid input generates matching, missing & 4-week roadmap', async () => {
    const res = await fetch(`${BASE_URL}/api/skill-gap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentSkills: ['HTML', 'CSS', 'JavaScript'],
        targetRole: 'Junior Frontend Developer',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('Missing data');
    const d = json.data;
    if (typeof d.matchPercentage !== 'number') throw new Error('matchPercentage not a number');
    if (!Array.isArray(d.missingSkills)) throw new Error('missingSkills array missing');
    if (!Array.isArray(d.improvementRoadmap)) throw new Error('improvementRoadmap missing');
  });

  // 5. Career Recommendation
  await runTest('Career Recommendation', 'Empty skills returns 400', async () => {
    const res = await fetch(`${BASE_URL}/api/career-recommendation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: [] }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Career Recommendation', 'Valid skills generate entry-level roles', async () => {
    const res = await fetch(`${BASE_URL}/api/career-recommendation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skills: ['Python', 'SQL', 'Data Preprocessing'],
        interests: 'Analytics and visualizations',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data?.recommendations) throw new Error('Missing recommendations');
    if (json.data.recommendations.length === 0) throw new Error('Empty recommendations list');
  });

  // 6. Internship Prep
  await runTest('Internship Prep', 'Empty targetRole returns 400', async () => {
    const res = await fetch(`${BASE_URL}/api/internship-prep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetRole: '' }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Internship Prep', 'Valid role generates technical, comm, project checklists', async () => {
    const res = await fetch(`${BASE_URL}/api/internship-prep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetRole: 'Software Engineering Intern', timelineWeeks: 4 }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('Missing data');
    const d = json.data;
    if (!Array.isArray(d.technicalChecklist)) throw new Error('technicalChecklist missing');
    if (!Array.isArray(d.communicationChecklist)) throw new Error('communicationChecklist missing');
    if (!Array.isArray(d.projectChecklist)) throw new Error('projectChecklist missing');
    if (!Array.isArray(d.applicationChecklist)) throw new Error('applicationChecklist missing');
  });

  // 7. Interview Prep & Mock Evaluation
  await runTest('Interview Prep', 'Empty role returns 400', async () => {
    const res = await fetch(`${BASE_URL}/api/interview-prep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetRole: '' }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Interview Prep', 'Valid role returns technical and HR questions with sample answers', async () => {
    const res = await fetch(`${BASE_URL}/api/interview-prep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetRole: 'Junior Backend Developer' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data?.questions) throw new Error('Missing questions');
    if (json.data.questions.length === 0) throw new Error('Expected at least 1 question');
  });

  await runTest('Interview Mock Evaluation', 'Empty practice answer returns 400', async () => {
    const res = await fetch(`${BASE_URL}/api/interview-eval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Explain REST', userAnswer: '', targetRole: 'Intern' }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Interview Mock Evaluation', 'Valid practice answer generates 1-10 score & feedback', async () => {
    const res = await fetch(`${BASE_URL}/api/interview-eval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Tell me about a time you handled a difficult technical bug.',
        userAnswer: 'In my web project, an API call was failing due to CORS. I checked browser console, updated the server headers, and verified it with Postman.',
        targetRole: 'Junior Full Stack Developer',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('Missing data');
    if (typeof json.data.score !== 'number') throw new Error('Score not a number');
    if (!json.data.improvedModelAnswer) throw new Error('Missing improved model answer');
  });

  // 8. HR Communication Generator
  await runTest('HR Communication', 'Missing company name returns 400', async () => {
    const res = await fetch(`${BASE_URL}/api/hr-communication`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commType: 'internship_enquiry', companyName: '' }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('HR Communication', 'Valid inputs generate formal and friendly versions', async () => {
    const res = await fetch(`${BASE_URL}/api/hr-communication`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commType: 'internship_enquiry',
        studentName: 'Alex',
        companyName: 'Acme Corp',
        roleTitle: 'Software Intern',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('Missing data');
    if (!json.data.formalVersion || !json.data.friendlyVersion) {
      throw new Error('Expected both formalVersion and friendlyVersion');
    }
  });

  console.log('\n--- AUDIT COMPLETE ---');
  console.log(`Total tests: ${results.length}`);
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Passed: ${passed}, Failed: ${failed}`);
}

main().catch(console.error);
