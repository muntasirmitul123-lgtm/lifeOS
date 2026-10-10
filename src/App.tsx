/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Sun,
  Calendar,
  Inbox,
  FolderKanban,
  BarChart3,
  Plus,
  Search,
  Settings,
  Cloud,
} from 'lucide-react';
import { LifeOSProvider, useLifeOS } from './context/LifeOSContext';
import { PrimaryNavTab } from './types/lifeos';
import { TodayView } from './views/TodayView';
import { PlannerView } from './views/PlannerView';
import { InboxBrainView } from './views/InboxBrainView';
import { ProjectsGoalsView } from './views/ProjectsGoalsView';
import { InsightsView } from './views/InsightsView';
import { QuickAddModal } from './components/QuickAddModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { FocusTimerModal } from './components/FocusTimerModal';
import { PlanRecoveryModal, WhatShouldIDoNowModal } from './components/WhatShouldIDoNowModal';
import { SettingsModal } from './components/SettingsModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallBanner';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMsg: error instanceof Error ? error.message : String(error),
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0F0D] text-[#F0F4F0] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#171E19] border border-[#E87979]/40 p-6 space-y-4">
            <h1 className="text-lg font-bold text-[#E87979]">
              Application State Error
            </h1>
            <p className="text-xs text-[#99A69C] break-words font-mono">
              {this.state.errorMsg}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] rounded-xl bg-[#79D99A] text-[#0B0F0D] font-semibold text-sm"
            >
              Reload LifeOS
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const LifeOSShell: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    openQuickAdd,
    setIsSearchOpen,
    setIsSettingsOpen,
    user,
    syncStatus,
    toastMessage,
  } = useLifeOS();

  const navItems: { id: PrimaryNavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'today', label: 'Today', icon: <Sun className="w-5 h-5" /> },
    { id: 'planner', label: 'Planner', icon: <Calendar className="w-5 h-5" /> },
    { id: 'inbox', label: 'Inbox', icon: <Inbox className="w-5 h-5" /> },
    { id: 'projects', label: 'Projects', icon: <FolderKanban className="w-5 h-5" /> },
    { id: 'insights', label: 'Insights', icon: <BarChart3 className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F0D] text-[#F0F4F0] flex flex-col">
      <OfflineIndicator />

      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-30 bg-[#0B0F0D]/90 backdrop-blur-md border-b border-[#29342C] pt-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            onClick={() => setActiveTab('today')}
            className="text-lg font-bold tracking-tight text-[#F0F4F0] whitespace-nowrap shrink-0"
          >
            LifeOS
          </button>

          {/* Zone 2: 5 clean single-line text navigation links on desktop */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#99A69C]">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  activeTab === item.id
                    ? 'text-[#F0F4F0] border-[#79D99A] font-semibold'
                    : 'border-transparent hover:text-[#F0F4F0]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Contextual actions + primary Quick Add CTA */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />

            <button
              onClick={() => setIsSearchOpen(true)}
              className="min-w-[40px] min-h-[40px] rounded-xl bg-[#171E19] border border-[#29342C] flex items-center justify-center text-[#99A69C] hover:text-[#F0F4F0]"
              aria-label="Global Search"
              title="Search (Tasks, Notes, Ideas, Projects)"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="min-h-[40px] px-2.5 rounded-xl bg-[#171E19] border border-[#29342C] flex items-center gap-1.5 text-xs text-[#99A69C] hover:text-[#F0F4F0]"
              aria-label="Settings and Cloud Sync"
              title="Settings & Cloud Sync"
            >
              <Cloud
                className={`w-3.5 h-3.5 ${
                  user && syncStatus === 'synced' ? 'text-[#79D99A]' : 'text-[#99A69C]'
                }`}
              />
              <Settings className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => openQuickAdd('task')}
              className="hidden sm:flex min-h-[40px] px-3.5 py-2 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold items-center gap-1.5 hover:bg-[#B5DDBF] transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Quick Add</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 pb-24 md:pb-10">
        {activeTab === 'today' && <TodayView />}
        {activeTab === 'planner' && <PlannerView />}
        {activeTab === 'inbox' && <InboxBrainView />}
        {activeTab === 'projects' && <ProjectsGoalsView />}
        {activeTab === 'insights' && <InsightsView />}
      </main>

      {/* Floating Quick-Add Action Button for Mobile One-Handed Reach */}
      <button
        onClick={() => openQuickAdd('task')}
        className="md:hidden fixed right-4 bottom-20 z-30 w-13 h-13 rounded-2xl bg-[#79D99A] text-[#0B0F0D] shadow-xl flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Quick Add"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Compact Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Primary Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#111713]/95 backdrop-blur-md border-t border-[#29342C] pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-15 px-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
                  active ? 'text-[#79D99A]' : 'text-[#99A69C] hover:text-[#F0F4F0]'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-medium tracking-tight mt-1 whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Toast Notification Feedback */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#1D2620] border border-[#79D99A]/50 text-xs font-medium text-[#F0F4F0] shadow-xl whitespace-nowrap"
        >
          {toastMessage}
        </div>
      )}

      {/* Global Contextual Modals */}
      <QuickAddModal />
      <GlobalSearchModal />
      <FocusTimerModal />
      <WhatShouldIDoNowModal />
      <PlanRecoveryModal />
      <SettingsModal />
    </div>
  );
};

export default function App() {
  return (
    <AppErrorBoundary>
      <LifeOSProvider>
        <LifeOSShell />
      </LifeOSProvider>
    </AppErrorBoundary>
  );
}
