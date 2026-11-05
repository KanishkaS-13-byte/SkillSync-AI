export type NavigationTab =
  | 'dashboard'
  | 'resume-analyzer'
  | 'skill-assessment'
  | 'skill-gap'
  | 'career-recommendation'
  | 'internship-prep'
  | 'interview-prep'
  | 'hr-communication';

export interface ResumeAnalysis {
  readinessScore: number;
  presentationScore: number;
  summary: string;
  technicalSkills: {
    detected: string[];
    missingForRole: string[];
  };
  educationAssessment: string;
  projectsAssessment: string;
  experienceAssessment: string;
  presentationAssessment: string;
  relevantKeywords: {
    present: string[];
    recommendedToAdd: string[];
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface SkillCategoryMap {
  programming: string[];
  ai: string[];
  cybersecurity: string[];
  communication: string[];
  technicalSupport: string[];
}

export interface SkillAssessmentResult {
  overallReadinessLevel: string;
  profileOverview: string;
  pillarRatings: {
    category: string;
    rating: number;
    feedback: string;
  }[];
  topPillars: string[];
  highImpactNextSkills: {
    skill: string;
    category: string;
    reason: string;
  }[];
  suggestedProject: string;
}

export interface SkillGapResult {
  targetRole: string;
  matchPercentage: number;
  alignmentSummary: string;
  existingSkills: string[];
  matchingSkills: string[];
  missingSkills: string[];
  learningPriorities: {
    skill: string;
    priority: 'Critical Priority' | 'High Priority' | 'Medium Priority';
    whyImportant: string;
    recommendedResourceOrTopic: string;
  }[];
  improvementRoadmap: {
    week: string;
    focus: string;
    actionItems: string[];
    milestone: string;
  }[];
  beginnerTips: string[];
}

export interface CareerRoleRecommendation {
  roleTitle: string;
  suitabilityMatch: number;
  suitabilityTier: 'High Match' | 'Strong Potential' | 'Exciting Adjacent';
  whySuitable: string;
  dayToDayResponsibilities: string[];
  strengthsTheyHave: string[];
  bridgeSkillsToLearn: string[];
  starterProjectIdea: string;
  entryLevelOutlook: string;
}

export interface InternshipPrepChecklist {
  role: string;
  overview: string;
  technicalChecklist: {
    id: string;
    task: string;
    category: string;
    whyItMatters: string;
  }[];
  communicationChecklist: {
    id: string;
    task: string;
    category: string;
    whyItMatters: string;
  }[];
  projectChecklist: {
    id: string;
    task: string;
    category: string;
    whyItMatters: string;
  }[];
  applicationChecklist: {
    id: string;
    task: string;
    category: string;
    whyItMatters: string;
  }[];
  mentorTip: string;
}

export interface InterviewQuestion {
  id: string;
  type: 'Technical' | 'HR / Behavioral';
  question: string;
  whyAsked: string;
  sampleAnswer: string;
  structureTip: string;
  commonMistake: string;
}

export interface InterviewPrepResult {
  targetRole: string;
  interviewTips: string[];
  questions: InterviewQuestion[];
}

export interface InterviewEvaluation {
  score: number;
  strengths: string[];
  improvements: string[];
  improvedModelAnswer: string;
  coachFeedback: string;
}

export interface HRCommResult {
  commType: string;
  subjectFormal: string;
  subjectFriendly: string;
  formalVersion: string;
  friendlyVersion: string;
  customizationTips: string[];
}

export interface ActivityItem {
  id: string;
  tool: NavigationTab;
  title: string;
  timestamp: string;
  badge: string;
}

export interface DashboardMetrics {
  resumesAnalysed: number;
  skillsAssessed: number;
  skillGapsIdentified: number;
  interviewSessionsCompleted: number;
}
