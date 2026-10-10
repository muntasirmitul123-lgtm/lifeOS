import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Repeat,
  BookOpen,
  Trophy,
  Plus,
  Sparkles,
  Check,
  SkipForward,
  Trash2,
  Award,
} from 'lucide-react';
import { getTodayISO, useLifeOS } from '../context/LifeOSContext';

export const InsightsView: React.FC = () => {
  const {
    tasks,
    projectsGoals,
    habitsLogs,
    preferences,
    createHabitOrLog,
    deleteHabitOrLog,
    toggleHabitOccurrence,
    getHabitStreak,
    getProjectProgress,
    totalXP,
    currentLevel,
    xpInLevel,
    xpForNextLevel,
    openQuickAdd,
    showToast,
  } = useLifeOS();

  const [subTab, setSubTab] = useState<'analytics' | 'habits' | 'reviews' | 'progress'>(
    'analytics'
  );

  const today = getTodayISO();

  // Last 7 days array for habit matrix and focus bar chart
  const last7Days = useMemo(() => {
    const arr: string[] = [];
    const d = new Date();
    for (let i = 6; i >= 0; i--) {
      const c = new Date(d);
      c.setDate(d.getDate() - i);
      arr.push(c.toISOString().slice(0, 10));
    }
    return arr;
  }, []);

  // Genuine Analytics Calculations
  const analytics = useMemo(() => {
    const activeTasks = tasks.filter((t) => !t.archived);
    const completedTasks = activeTasks.filter((t) => t.completed);
    const completionRate =
      activeTasks.length > 0
        ? Math.round((completedTasks.length / activeTasks.length) * 100)
        : 0;

    const totalEstimatedMins = activeTasks.reduce(
      (s, t) => s + (t.estimatedMinutes || 0),
      0
    );
    const totalActualMins = activeTasks.reduce(
      (s, t) => s + (t.actualMinutes || 0),
      0
    );

    const focusSessions = habitsLogs.filter((h) => h.logType === 'focus_session');
    const totalFocusMinutes = focusSessions.reduce(
      (s, f) => s + (f.durationMinutes || 0),
      0
    );

    const focusByDay = last7Days.map((dateStr) => {
      const mins = focusSessions
        .filter((f) => f.date === dateStr)
        .reduce((s, f) => s + (f.durationMinutes || 0), 0);
      return { date: dateStr.slice(5), fullDate: dateStr, minutes: mins };
    });

    // Time allocation by category
    const catMap = new Map<string, number>();
    for (const t of activeTasks) {
      const cat = t.category || 'General';
      catMap.set(cat, (catMap.get(cat) || 0) + (t.estimatedMinutes || 30));
    }
    const categoryAllocation = Array.from(catMap.entries()).map(([category, minutes]) => ({
      category,
      minutes,
    }));

    // Most productive time period — only report if >= 3 recorded sessions/completed scheduled tasks exist
    const completedWithTime = completedTasks.filter((t) => t.scheduledStart);
    let productivePeriod = 'Insufficient recorded data (requires 3+ timed completions)';
    if (completedWithTime.length >= 3) {
      let morning = 0,
        afternoon = 0,
        evening = 0;
      for (const t of completedWithTime) {
        const h = parseInt(t.scheduledStart.split(':')[0] || '9', 10);
        if (h < 12) morning++;
        else if (h < 17) afternoon++;
        else evening++;
      }
      if (morning >= afternoon && morning >= evening) productivePeriod = 'Morning (06:00–12:00)';
      else if (afternoon >= evening) productivePeriod = 'Afternoon (12:00–17:00)';
      else productivePeriod = 'Evening (17:00–22:00)';
    }

    return {
      totalTasks: activeTasks.length,
      completedCount: completedTasks.length,
      completionRate,
      totalEstimatedMins,
      totalActualMins,
      totalFocusMinutes,
      focusSessionsCount: focusSessions.length,
      focusByDay,
      categoryAllocation,
      productivePeriod,
    };
  }, [tasks, habitsLogs, last7Days]);

  // Habits list
  const habits = useMemo(
    () => habitsLogs.filter((h) => h.logType === 'habit' && !h.archived),
    [habitsLogs]
  );

  // Daily Review Form State
  const [wentWell, setWentWell] = useState('');
  const [completedNotes, setCompletedNotes] = useState('');
  const [unfinishedNotes, setUnfinishedNotes] = useState('');
  const [learnedNotes, setLearnedNotes] = useState('');
  const [tomorrowChange, setTomorrowChange] = useState('');

  // Weekly Review State
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyAiDraft, setWeeklyAiDraft] = useState<{
    observedFacts: string[];
    aiInterpretations: string[];
    suggestedNextWeekPriorities: string[];
  } | null>(null);
  const [weeklyCustomNotes, setWeeklyCustomNotes] = useState('');

  const handleSaveDailyReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const entries = [
      `Went well: ${wentWell}`,
      `Completed: ${completedNotes}`,
      `Unfinished: ${unfinishedNotes}`,
      `Learned: ${learnedNotes}`,
      `Change tomorrow: ${tomorrowChange}`,
    ];
    await createHabitOrLog({
      logType: 'daily_review',
      title: `Daily Review — ${today}`,
      description: wentWell || 'End-of-day reflection',
      date: today,
      entries,
      occurrenceStatus: 'completed',
    });
    setWentWell('');
    setCompletedNotes('');
    setUnfinishedNotes('');
    setLearnedNotes('');
    setTomorrowChange('');
    showToast('Saved Daily Review');
  };

  const generateWeeklyReviewSuggestion = async () => {
    setWeeklyLoading(true);
    try {
      const overdueCount = tasks.filter(
        (t) => !t.completed && t.dueDate && t.dueDate < today
      ).length;
      const res = await fetch('/api/ai/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stats: {
            completedTasksCount: analytics.completedCount,
            totalTasksCount: analytics.totalTasks,
            focusMinutes: analytics.totalFocusMinutes,
            focusSessionsCount: analytics.focusSessionsCount,
            overdueCount,
          },
        }),
      });
      const data = await res.json();
      setWeeklyAiDraft(data);
    } catch {
      showToast('Could not generate weekly review');
    } finally {
      setWeeklyLoading(false);
    }
  };

  const handleSaveWeeklyReview = async () => {
    const entries = [
      ...(weeklyAiDraft?.observedFacts || []).map((f) => `[Observed] ${f}`),
      ...(weeklyAiDraft?.aiInterpretations || []).map((i) => `[AI Interpretation] ${i}`),
      ...(weeklyAiDraft?.suggestedNextWeekPriorities || []).map((p) => `[Priority] ${p}`),
      weeklyCustomNotes ? `[Personal Reflection] ${weeklyCustomNotes}` : '',
    ].filter(Boolean);

    await createHabitOrLog({
      logType: 'weekly_review',
      title: `Weekly Review — ${today}`,
      description: weeklyCustomNotes || 'Weekly synthesis & next week priorities',
      date: today,
      entries,
      occurrenceStatus: 'completed',
    });
    setWeeklyAiDraft(null);
    setWeeklyCustomNotes('');
    showToast('Saved Weekly Review (+20 XP)');
  };

  const savedReviews = useMemo(
    () =>
      habitsLogs.filter(
        (h) => h.logType === 'daily_review' || h.logType === 'weekly_review'
      ),
    [habitsLogs]
  );

  // Derived Achievements based on genuine user milestones
  const achievements = useMemo(() => {
    const completedTasksCount = tasks.filter((t) => t.completed).length;
    const focusSessionsCount = habitsLogs.filter((h) => h.logType === 'focus_session').length;
    const maxStreak = habits.reduce((max, h) => Math.max(max, getHabitStreak(h.id)), 0);
    const completedProjectsCount = projectsGoals.filter(
      (p) => p.recordType === 'project' && (p.status === 'completed' || getProjectProgress(p.id) === 100)
    ).length;

    return [
      {
        id: 'ach_first_task',
        title: 'First Execution',
        desc: 'Complete your first task in LifeOS',
        unlocked: completedTasksCount >= 1,
      },
      {
        id: 'ach_deep_focus',
        title: 'Deep Work Initiate',
        desc: 'Complete at least 1 recorded Focus Timer session',
        unlocked: focusSessionsCount >= 1,
      },
      {
        id: 'ach_habit_streak',
        title: 'Consistent Routine',
        desc: 'Reach a 3-day streak on any scheduled habit',
        unlocked: maxStreak >= 3,
      },
      {
        id: 'ach_project_finisher',
        title: 'Project Finisher',
        desc: 'Reach 100% completion on a Project',
        unlocked: completedProjectsCount >= 1,
      },
      {
        id: 'ach_weekly_reviewer',
        title: 'Reflective Strategist',
        desc: 'Complete and save a Weekly Review',
        unlocked: savedReviews.some((r) => r.logType === 'weekly_review'),
      },
    ];
  }, [tasks, habitsLogs, habits, projectsGoals, savedReviews]);

  const maxFocusBar = Math.max(60, ...analytics.focusByDay.map((d) => d.minutes));

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Sub-Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F0F4F0]">
            Insights, Habits & Reviews
          </h1>
          <p className="text-xs text-[#99A69C]">
            Real personal analytics, routine tracking, journaling, and progression
          </p>
        </div>

        <div className="flex items-center bg-[#171E19] border border-[#29342C] p-1 rounded-xl self-start overflow-x-auto max-w-full">
          {(
            [
              { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-3.5 h-3.5" /> },
              { id: 'habits', label: 'Habits', icon: <Repeat className="w-3.5 h-3.5" /> },
              { id: 'reviews', label: 'Reviews', icon: <BookOpen className="w-3.5 h-3.5" /> },
              { id: 'progress', label: 'Progress & XP', icon: <Trophy className="w-3.5 h-3.5" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                subTab === t.id
                  ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                  : 'text-[#99A69C] hover:text-[#F0F4F0]'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 1. ANALYTICS TAB */}
      {subTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-[#171E19] border border-[#29342C]">
              <p className="text-xs text-[#99A69C]">Task Completion Rate</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[#79D99A] mt-1">
                {analytics.completionRate}%
              </p>
              <p className="text-xs text-[#99A69C] font-mono tabular-nums mt-0.5">
                {analytics.completedCount} of {analytics.totalTasks} tasks
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#171E19] border border-[#29342C]">
              <p className="text-xs text-[#99A69C]">Total Focus Time</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[#F0F4F0] mt-1">
                {analytics.totalFocusMinutes}m
              </p>
              <p className="text-xs text-[#99A69C] font-mono tabular-nums mt-0.5">
                Across {analytics.focusSessionsCount} sessions
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#171E19] border border-[#29342C]">
              <p className="text-xs text-[#99A69C]">Planned vs Actual</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[#F0F4F0] mt-1">
                {analytics.totalEstimatedMins}m / {analytics.totalActualMins}m
              </p>
              <p className="text-xs text-[#99A69C] mt-0.5">Estimated vs logged</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#171E19] border border-[#29342C]">
              <p className="text-xs text-[#99A69C]">Peak Productive Window</p>
              <p className="text-sm font-semibold text-[#F0F4F0] mt-1.5">
                {analytics.productivePeriod}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 7-Day Focus Time Chart */}
            <div className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-4">
              <h2 className="text-sm font-semibold text-[#F0F4F0]">
                Focus Time — Last 7 Days (Minutes)
              </h2>
              <div className="grid grid-cols-7 gap-2 items-end h-40 pt-4 px-2 bg-[#111713] border border-[#29342C] rounded-xl">
                {analytics.focusByDay.map((d) => {
                  const hPct = Math.max(6, Math.round((d.minutes / maxFocusBar) * 100));
                  return (
                    <div
                      key={d.fullDate}
                      className="flex flex-col items-center justify-end h-full gap-1.5"
                    >
                      <span className="text-[10px] font-mono tabular-nums text-[#79D99A]">
                        {d.minutes}m
                      </span>
                      <div className="w-full max-w-[28px] bg-[#1D2620] rounded-t-lg overflow-hidden flex items-end h-24">
                        <div
                          className="w-full bg-[#79D99A] rounded-t-lg"
                          style={{ height: `${hPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-[#99A69C] pb-1">
                        {d.date}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Allocation */}
            <div className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-4">
              <h2 className="text-sm font-semibold text-[#F0F4F0]">
                Planned Time Allocation by Category
              </h2>
              {analytics.categoryAllocation.length === 0 ? (
                <p className="text-xs text-[#99A69C] p-6 bg-[#111713] rounded-xl text-center">
                  No categorized tasks recorded yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {analytics.categoryAllocation.map((c) => {
                    const pct = Math.min(
                      100,
                      Math.round(
                        (c.minutes / Math.max(1, analytics.totalEstimatedMins)) * 100
                      )
                    );
                    return (
                      <div key={c.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#F0F4F0] font-medium">{c.category}</span>
                          <span className="font-mono tabular-nums text-[#99A69C]">
                            {c.minutes}m ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#111713] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#79D99A] origin-left"
                            style={{ transform: `scaleX(${pct / 100})` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. HABITS & ROUTINES TAB */}
      {subTab === 'habits' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#F0F4F0]">
              Habit Tracker & 7-Day History ({habits.length})
            </h2>
            <button
              onClick={() => openQuickAdd('habit')}
              className="min-h-[38px] px-3.5 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Habit
            </button>
          </div>

          {habits.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#171E19] border border-[#29342C] text-center space-y-3">
              <p className="text-sm font-medium text-[#F0F4F0]">No habits tracked yet</p>
              <p className="text-xs text-[#99A69C]">
                Add daily or weekday habits like Reading, Exercise, or Evening Planning.
              </p>
              <button
                onClick={() => openQuickAdd('habit')}
                className="min-h-[38px] px-4 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold"
              >
                + Add First Habit
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {habits.map((h) => {
                const streak = getHabitStreak(h.id);
                return (
                  <div
                    key={h.id}
                    className="p-4 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[#F0F4F0]">{h.title}</h3>
                        <p className="text-xs text-[#99A69C] font-mono tabular-nums">
                          Schedule: {h.scheduleType} · Current Streak: {streak} days
                        </p>
                      </div>
                      <button
                        onClick={() => deleteHabitOrLog(h.id)}
                        className="text-[#68766D] hover:text-[#E87979] p-1"
                        title="Delete Habit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 7-Day Interactive History Grid */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {last7Days.map((dStr) => {
                        const occ = habitsLogs.find(
                          (o) =>
                            o.logType === 'habit_occurrence' &&
                            o.sourceEntityId === h.id &&
                            o.date === dStr
                        );
                        const st = occ?.occurrenceStatus || 'none';
                        return (
                          <div
                            key={dStr}
                            className="p-2 rounded-xl bg-[#111713] border border-[#29342C] flex flex-col items-center gap-1.5"
                          >
                            <span className="text-[10px] font-mono tabular-nums text-[#99A69C]">
                              {dStr.slice(5)}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  toggleHabitOccurrence(
                                    h.id,
                                    dStr,
                                    st === 'completed' ? 'none' : 'completed'
                                  )
                                }
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                  st === 'completed'
                                    ? 'bg-[#79D99A] text-[#0B0F0D]'
                                    : 'bg-[#1D2620] text-[#99A69C]'
                                }`}
                                title="Mark Completed"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  toggleHabitOccurrence(
                                    h.id,
                                    dStr,
                                    st === 'skipped' ? 'none' : 'skipped'
                                  )
                                }
                                className={`w-6 h-7 rounded-lg flex items-center justify-center text-[10px] ${
                                  st === 'skipped'
                                    ? 'bg-[#E8B86D]/25 text-[#E8B86D]'
                                    : 'bg-[#171E19] text-[#68766D]'
                                }`}
                                title="Skip Occurrence"
                              >
                                <SkipForward className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. JOURNAL & REVIEWS TAB */}
      {subTab === 'reviews' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* End-of-Day Daily Review */}
          <form
            onSubmit={handleSaveDailyReview}
            className="lg:col-span-6 p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3.5"
          >
            <h2 className="text-sm font-semibold text-[#F0F4F0]">
              End-of-Day Daily Review ({today})
            </h2>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">
                1. What went well today?
              </label>
              <input
                type="text"
                value={wentWell}
                onChange={(e) => setWentWell(e.target.value)}
                className="w-full min-h-[38px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">
                2. What did I complete?
              </label>
              <input
                type="text"
                value={completedNotes}
                onChange={(e) => setCompletedNotes(e.target.value)}
                className="w-full min-h-[38px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">
                3. What remains unfinished?
              </label>
              <input
                type="text"
                value={unfinishedNotes}
                onChange={(e) => setUnfinishedNotes(e.target.value)}
                className="w-full min-h-[38px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">
                4. What did I learn?
              </label>
              <input
                type="text"
                value={learnedNotes}
                onChange={(e) => setLearnedNotes(e.target.value)}
                className="w-full min-h-[38px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">
                5. What should change tomorrow?
              </label>
              <input
                type="text"
                value={tomorrowChange}
                onChange={(e) => setTomorrowChange(e.target.value)}
                className="w-full min-h-[38px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              />
            </div>
            <button
              type="submit"
              className="w-full min-h-[42px] rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold"
            >
              Save Daily Review
            </button>
          </form>

          {/* Weekly Review + AI Synthesis */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#F0F4F0]">
                  Weekly Review & AI Synthesis
                </h2>
                <button
                  type="button"
                  onClick={generateWeeklyReviewSuggestion}
                  disabled={weeklyLoading}
                  className="min-h-[36px] px-3 rounded-xl bg-[#1D2620] text-xs font-medium text-[#79D99A] flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{weeklyLoading ? 'Analyzing...' : 'Generate AI Weekly Summary'}</span>
                </button>
              </div>

              {weeklyAiDraft && (
                <div className="p-3.5 rounded-xl bg-[#111713] border border-[#79D99A]/40 space-y-2.5 text-xs">
                  <div>
                    <p className="font-semibold text-[#F0F4F0]">Observed Facts (From Stored Records):</p>
                    {weeklyAiDraft.observedFacts.map((f, i) => (
                      <p key={i} className="text-[#99A69C]">• {f}</p>
                    ))}
                  </div>
                  <div>
                    <p className="font-semibold text-[#79D99A]">AI Interpretations & Suggestions:</p>
                    {weeklyAiDraft.aiInterpretations.map((interp, i) => (
                      <p key={i} className="text-[#99A69C]">• {interp}</p>
                    ))}
                  </div>
                </div>
              )}

              <textarea
                rows={3}
                value={weeklyCustomNotes}
                onChange={(e) => setWeeklyCustomNotes(e.target.value)}
                placeholder="Add your own lessons learned and top priorities for next week..."
                className="w-full p-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              />

              <button
                type="button"
                onClick={handleSaveWeeklyReview}
                className="w-full min-h-[42px] rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold"
              >
                Save Weekly Review (+20 XP)
              </button>
            </div>

            {/* Past Saved Reviews */}
            {savedReviews.length > 0 && (
              <div className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-2.5">
                <h3 className="text-xs font-semibold text-[#99A69C]">
                  Saved Review History ({savedReviews.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {savedReviews.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold text-[#F0F4F0]">
                        <span>{r.title}</span>
                        <span className="font-mono text-[#79D99A]">{r.date}</span>
                      </div>
                      {r.entries.map((line, idx) => (
                        <p key={idx} className="text-[#99A69C]">
                          {line}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. PERSONAL PROGRESS (RPG XP & ACHIEVEMENTS) */}
      {subTab === 'progress' && (
        <div className="space-y-6">
          {!preferences.gamificationEnabled ? (
            <div className="p-8 rounded-2xl bg-[#171E19] border border-[#29342C] text-center text-xs text-[#99A69C]">
              Personal Progress (XP & Levels) is currently disabled in Settings. Enable it any time in Settings.
            </div>
          ) : (
            <>
              <div className="p-6 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono text-[#79D99A]">PERSONAL OPERATING LEVEL</p>
                    <h2 className="text-3xl font-bold font-mono tabular-nums text-[#F0F4F0] mt-0.5">
                      Level {currentLevel}
                    </h2>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <p className="text-lg font-bold text-[#79D99A]">{totalXP} Total XP</p>
                    <p className="text-xs text-[#99A69C]">
                      {xpInLevel} / {xpForNextLevel} XP to Level {currentLevel + 1}
                    </p>
                  </div>
                </div>

                <div className="w-full h-3 bg-[#111713] rounded-full overflow-hidden border border-[#29342C]">
                  <div
                    className="h-full bg-[#79D99A] origin-left transition-transform"
                    style={{ transform: `scaleX(${xpInLevel / xpForNextLevel})` }}
                  />
                </div>

                <p className="text-xs text-[#99A69C]">
                  Rewards Formula: Standard Task (+10 XP) · High/Urgent Task (+15 XP) · Focus Session (+10 XP) · Habit (+5 XP) · Milestone (+30 XP) · Weekly Review (+20 XP). Reversing an action automatically revokes its XP to prevent duplicate farming.
                </p>
              </div>

              {/* Achievements Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {achievements.map((ach) => (
                  <div
                    key={ach.id}
                    className={`p-4 rounded-2xl border flex items-start gap-3 ${
                      ach.unlocked
                        ? 'bg-[#171E19] border-[#79D99A]/50'
                        : 'bg-[#111713] border-[#29342C] opacity-60'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        ach.unlocked
                          ? 'bg-[#79D99A]/20 text-[#79D99A]'
                          : 'bg-[#1D2620] text-[#68766D]'
                      }`}
                    >
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#F0F4F0]">{ach.title}</p>
                      <p className="text-xs text-[#99A69C] mt-0.5">{ach.desc}</p>
                      <p className="text-[11px] font-mono mt-1.5 text-[#79D99A]">
                        {ach.unlocked ? 'Unlocked' : 'Locked'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
