/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { DashboardView } from './components/DashboardView';
import { ResumeAnalyzerView } from './components/ResumeAnalyzerView';
import { SkillAssessmentView } from './components/SkillAssessmentView';
import { SkillGapView } from './components/SkillGapView';
import { CareerRecommendationView } from './components/CareerRecommendationView';
import { InternshipPrepView } from './components/InternshipPrepView';
import { InterviewPrepView } from './components/InterviewPrepView';
import { HRCommunicationView } from './components/HRCommunicationView';

import { NavigationTab, DashboardMetrics, ActivityItem } from './types';
import {
  getDashboardMetrics,
  incrementMetric,
  resetDashboardMetrics,
  getRecentActivities,
  recordActivity,
} from './utils/storage';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [metrics, setMetrics] = useState<DashboardMetrics>(getDashboardMetrics());
  const [activities, setActivities] = useState<ActivityItem[]>(getRecentActivities());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync state on load
  useEffect(() => {
    setMetrics(getDashboardMetrics());
    setActivities(getRecentActivities());

    // Check API health silently
    fetch('/api/health')
      .then((res) => res.json())
      .catch((err) => console.log('API health check:', err));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Event handlers for each feature completion
  const handleResumeSuccess = (targetRole: string) => {
    const updatedMetrics = incrementMetric('resumesAnalysed');
    setMetrics({ ...updatedMetrics });
    const updatedActivities = recordActivity({
      tool: 'resume-analyzer',
      title: `Analyzed Resume for ${targetRole}`,
      badge: 'Resume Analysis',
    });
    setActivities([...updatedActivities]);
    showToast(`✓ Resume analysis for "${targetRole}" completed & logged to activity!`);
  };

  const handleSkillAssessmentSuccess = (count: number) => {
    const updatedMetrics = incrementMetric('skillsAssessed');
    setMetrics({ ...updatedMetrics });
    const updatedActivities = recordActivity({
      tool: 'skill-assessment',
      title: `Assessed Profile with ${count} Skills`,
      badge: 'Skill Assessment',
    });
    setActivities([...updatedActivities]);
    showToast(`✓ Evaluated ${count} skills across 5 core pillars!`);
  };

  const handleSkillGapSuccess = (targetRole: string) => {
    const updatedMetrics = incrementMetric('skillGapsIdentified');
    setMetrics({ ...updatedMetrics });
    const updatedActivities = recordActivity({
      tool: 'skill-gap',
      title: `Identified Skill Gaps for ${targetRole}`,
      badge: 'Skill Gap',
    });
    setActivities([...updatedActivities]);
    showToast(`✓ Generated 4-week roadmap for "${targetRole}"!`);
  };

  const handleCareerSuccess = (count: number) => {
    const updatedActivities = recordActivity({
      tool: 'career-recommendation',
      title: `Explored ${count} Recommended Entry-Level Roles`,
      badge: 'Career Roles',
    });
    setActivities([...updatedActivities]);
    showToast(`✓ Found ${count} suitable career matches!`);
  };

  const handleInternshipSuccess = (role: string) => {
    const updatedActivities = recordActivity({
      tool: 'internship-prep',
      title: `Created Preparation Checklist for ${role}`,
      badge: 'Internship Prep',
    });
    setActivities([...updatedActivities]);
    showToast(`✓ Checklist created for ${role}!`);
  };

  const handleInterviewSuccess = (targetRole: string) => {
    const updatedMetrics = incrementMetric('interviewSessionsCompleted');
    setMetrics({ ...updatedMetrics });
    const updatedActivities = recordActivity({
      tool: 'interview-prep',
      title: `Practiced Interview Questions for ${targetRole}`,
      badge: 'Interview Prep',
    });
    setActivities([...updatedActivities]);
    showToast(`✓ Interview questions and STAR answers ready for "${targetRole}"!`);
  };

  const handleHRSuccess = (commType: string) => {
    const names: Record<string, string> = {
      internship_enquiry: 'Cold Internship Enquiry',
      linkedin_connect: 'LinkedIn Connection Note',
      hr_followup: 'HR Follow-up Email',
      interview_confirmation: 'Interview Confirmation Reply',
    };
    const title = names[commType] || 'HR Outreach';
    const updatedActivities = recordActivity({
      tool: 'hr-communication',
      title: `Generated ${title}`,
      badge: 'HR Outreach',
    });
    setActivities([...updatedActivities]);
    showToast(`✓ Generated ${title} in Formal & Friendly styles!`);
  };

  const handleResetMetrics = () => {
    const reset = resetDashboardMetrics();
    setMetrics({ ...reset });
    showToast('Dashboard metrics reset.');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 animate-fade-in flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar currentTab={currentTab} onSelectTab={(tab) => setCurrentTab(tab)} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'dashboard' && (
          <DashboardView
            metrics={metrics}
            activities={activities}
            onSelectTab={(tab) => setCurrentTab(tab)}
            onResetMetrics={handleResetMetrics}
          />
        )}

        {currentTab === 'resume-analyzer' && (
          <ResumeAnalyzerView onSuccess={handleResumeSuccess} />
        )}

        {currentTab === 'skill-assessment' && (
          <SkillAssessmentView
            onSuccess={handleSkillAssessmentSuccess}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />
        )}

        {currentTab === 'skill-gap' && (
          <SkillGapView onSuccess={handleSkillGapSuccess} />
        )}

        {currentTab === 'career-recommendation' && (
          <CareerRecommendationView
            onSuccess={handleCareerSuccess}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />
        )}

        {currentTab === 'internship-prep' && (
          <InternshipPrepView onSuccess={handleInternshipSuccess} />
        )}

        {currentTab === 'interview-prep' && (
          <InterviewPrepView onSuccess={handleInterviewSuccess} />
        )}

        {currentTab === 'hr-communication' && (
          <HRCommunicationView onSuccess={handleHRSuccess} />
        )}
      </main>

      {/* Footer */}
      <Footer onSelectTab={(tab) => setCurrentTab(tab)} />
    </div>
  );
}
