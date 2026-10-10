import React, { useMemo, useState } from 'react';
import {
  Compass,
  Play,
  CheckCircle2,
  CalendarClock,
  X,
  RefreshCw,
  ShieldAlert,
  Undo2,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { getTodayISO, useLifeOS } from '../context/LifeOSContext';
import { CalendarEvent, Task } from '../types/lifeos';

export const WhatShouldIDoNowModal: React.FC = () => {
  const {
    isWhatNowOpen,
    setIsWhatNowOpen,
    tasks,
    preferences,
    projectsGoals,
    startFocusForTask,
    toggleTaskCompletion,
    updateTask,
    showToast,
  } = useLifeOS();

  const [availableMinutes, setAvailableMinutes] = useState<number>(45);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const today = getTodayISO();

  const scoredRecommendations = useMemo(() => {
    const openTasks = tasks.filter(
      (t) => !t.completed && !t.archived && !dismissedIds.includes(t.id)
    );

    const scored = openTasks.map((t) => {
      const reasons: string[] = [];
      let rank = 0;

      // 1. Check unfinished dependencies
      const blockedBy = (t.dependencyIds || []).filter((depId) => {
        const depTask = tasks.find((x) => x.id === depId);
        return depTask && !depTask.completed;
      });
      if (blockedBy.length > 0) {
        rank -= 100;
        reasons.push('Waiting on prerequisite task');
      }

      // 2. Overdue or Due Today
      if (t.dueDate && t.dueDate < today) {
        rank += 50;
        reasons.push(`overdue (${t.dueDate})`);
      } else if (t.dueDate === today) {
        rank += 35;
        reasons.push('due today');
      } else if (t.dueDate) {
        reasons.push(`due ${t.dueDate}`);
      }

      // 3. Top 3 Priority or Task Priority
      if (preferences.topPriorities.includes(t.id)) {
        rank += 40;
        reasons.push('pinned as a Top 3 daily priority');
      }
      if (t.priority === 'urgent') {
        rank += 30;
        reasons.push('urgent priority');
      } else if (t.priority === 'high') {
        rank += 20;
        reasons.push('high priority');
      } else if (t.priority === 'normal') {
        rank += 10;
      }

      // 4. Energy match
      if (t.energyRequired === preferences.energyLevel) {
        rank += 20;
        reasons.push(`matches your ${preferences.energyLevel} energy level`);
      } else if (t.energyRequired === 'any') {
        rank += 8;
      } else if (
        preferences.energyLevel === 'low' &&
        t.energyRequired === 'high'
      ) {
        rank -= 20;
      }

      // 5. Available time fit
      const est = t.estimatedMinutes || 30;
      const fitsTime = est <= availableMinutes;
      if (fitsTime) {
        rank += 25;
        reasons.push(`fits your ${availableMinutes}-minute window (${est}m est.)`);
      } else {
        rank -= 15;
        reasons.push(`estimated at ${est}m (longer than ${availableMinutes}m window)`);
      }

      // 6. Active project importance
      if (t.projectId) {
        const proj = projectsGoals.find((p) => p.id === t.projectId);
        if (proj && proj.status === 'active') {
          rank += 12;
          reasons.push(`advances active project "${proj.name}"`);
        }
      }

      const explanation =
        reasons.length > 0
          ? `Recommended because this task is ${reasons.join(', ')}.`
          : 'Recommended as your next open action item.';

      return { task: t, rank, fitsTime, explanation };
    });

    scored.sort((a, b) => b.rank - a.rank);
    return scored;
  }, [tasks, preferences, projectsGoals, availableMinutes, dismissedIds, today]);

  if (!isWhatNowOpen) return null;

  const fitting = scoredRecommendations.filter((r) => r.fitsTime);
  const primary = fitting[0] || scoredRecommendations[0] || null;
  const alternatives = (fitting.length > 1 ? fitting.slice(1, 3) : scoredRecommendations.slice(1, 3));

  const postponeToTomorrow = async (task: Task) => {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    const tmrStr = tmr.toISOString().slice(0, 10);
    await updateTask(task.id, { dueDate: tmrStr });
    showToast(`Rescheduled "${task.title}" to tomorrow (${tmrStr})`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#171E19] border border-[#29342C] p-5 sm:p-6 text-[#F0F4F0] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1D2620] border border-[#29342C] flex items-center justify-center text-[#79D99A]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">What Should I Do Now?</h2>
              <p className="text-xs text-[#99A69C]">
                Context-aware action selector · Energy: <span className="capitalize text-[#F0F4F0]">{preferences.energyLevel}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsWhatNowOpen(false)}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#99A69C] hover:text-[#F0F4F0]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Available Time Selector */}
        <div className="mb-5">
          <label className="block text-xs text-[#99A69C] mb-2">
            How much time do you have right now?
          </label>
          <div className="grid grid-cols-6 gap-1.5">
            {[15, 30, 45, 60, 90, 120].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setAvailableMinutes(mins)}
                className={`min-h-[38px] rounded-xl text-xs font-mono tabular-nums transition-colors ${
                  availableMinutes === mins
                    ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                    : 'bg-[#111713] border border-[#29342C] text-[#99A69C]'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>

        {!primary ? (
          <div className="p-6 rounded-2xl bg-[#111713] border border-[#29342C] text-center">
            <p className="text-sm font-medium text-[#F0F4F0] mb-1">All clear for now</p>
            <p className="text-xs text-[#99A69C] mb-4">
              You have no open tasks matching your criteria, or you dismissed all current suggestions.
            </p>
            {dismissedIds.length > 0 && (
              <button
                onClick={() => setDismissedIds([])}
                className="min-h-[40px] px-4 rounded-xl bg-[#1D2620] text-xs font-medium text-[#79D99A]"
              >
                Reset Dismissed Suggestions
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {fitting.length === 0 && (
              <div className="p-3 rounded-xl bg-[#E8B86D]/10 border border-[#E8B86D]/30 text-xs text-[#E8B86D]">
                No open task is shorter than {availableMinutes} minutes. Showing your highest-impact task below—you can start a {availableMinutes}m focus block to make headway or increase your available time above.
              </div>
            )}

            {/* Primary Recommendation */}
            <div className="p-4 rounded-2xl bg-[#1D2620] border border-[#79D99A]/40 space-y-3">
              <div className="flex items-center justify-between text-xs text-[#79D99A] font-medium">
                <span>Primary Recommendation</span>
                <span className="font-mono tabular-nums">
                  {primary.task.estimatedMinutes}m est. · {primary.task.priority}
                </span>
              </div>
              <h3 className="text-base font-semibold text-[#F0F4F0]">{primary.task.title}</h3>
              <p className="text-xs text-[#99A69C] leading-relaxed">{primary.explanation}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <button
                  onClick={() => {
                    setIsWhatNowOpen(false);
                    startFocusForTask(primary.task.id);
                  }}
                  className="min-h-[40px] px-3 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Start Focus
                </button>
                <button
                  onClick={() => toggleTaskCompletion(primary.task.id)}
                  className="min-h-[40px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs font-medium text-[#F0F4F0] flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#79D99A]" /> Complete
                </button>
                <button
                  onClick={() => postponeToTomorrow(primary.task)}
                  className="min-h-[40px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs font-medium text-[#99A69C] hover:text-[#F0F4F0] flex items-center justify-center gap-1.5"
                >
                  <CalendarClock className="w-3.5 h-3.5" /> Tomorrow
                </button>
                <button
                  onClick={() => setDismissedIds((prev) => [...prev, primary.task.id])}
                  className="min-h-[40px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs font-medium text-[#99A69C] hover:text-[#F0F4F0]"
                >
                  Skip for Now
                </button>
              </div>
            </div>

            {/* Up to 2 Alternatives */}
            {alternatives.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-[#99A69C] mb-2">Alternative Options</h4>
                <div className="space-y-2">
                  {alternatives.map((alt) => (
                    <div
                      key={alt.task.id}
                      className="p-3.5 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#F0F4F0] truncate">
                          {alt.task.title}
                        </p>
                        <p className="text-xs text-[#99A69C] mt-0.5 line-clamp-2">
                          {alt.explanation}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setIsWhatNowOpen(false);
                          startFocusForTask(alt.task.id);
                        }}
                        className="min-h-[38px] px-3 rounded-xl bg-[#1D2620] border border-[#29342C] text-xs font-medium text-[#79D99A] shrink-0 flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" /> Start
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Plan Recovery Feature (#13)
interface RecoveryActionItem {
  taskId: string;
  title: string;
  priority: string;
  originalTime: string;
  action: 'reschedule_today' | 'shorten_today' | 'defer_tomorrow';
  proposedStart: string;
  proposedEnd: string;
  proposedDate: string;
  rationale: string;
}

export const PlanRecoveryModal: React.FC = () => {
  const {
    isPlanRecoveryOpen,
    setIsPlanRecoveryOpen,
    tasks,
    events,
    preferences,
    updateTask,
    createCalendarEvent,
    updateCalendarEvent,
    showToast,
  } = useLifeOS();

  const today = getTodayISO();
  const [restartTime, setRestartTime] = useState<string>(() => {
    const now = new Date();
    const h = Math.max(9, Math.min(20, now.getHours() + 1));
    return `${String(h).padStart(2, '0')}:00`;
  });

  const [previousSnapshot, setPreviousSnapshot] = useState<
    { taskId: string; dueDate: string; scheduledStart: string; scheduledEnd: string }[] | null
  >(null);

  const recoveryPlan = useMemo(() => {
    const fixedAppointments: CalendarEvent[] = events.filter(
      (e) => e.date === today && e.isFixed && !e.completed
    );

    const unfinishedTodayOrOverdue = tasks.filter(
      (t) =>
        !t.completed &&
        !t.archived &&
        (t.dueDate === today || (t.dueDate && t.dueDate < today) || preferences.topPriorities.includes(t.id))
    );

    const [startH, startM] = (restartTime || '14:00').split(':').map(Number);
    const [endH, endM] = (preferences.workEndHour || '18:00').split(':').map(Number);
    let cursor = startH * 60 + (startM || 0);
    const endMinutes = Math.max(cursor + 60, endH * 60 + (endM || 0));

    const occupied = fixedAppointments.map((ev) => {
      const [sh, sm] = ev.startTime.split(':').map(Number);
      const [eh, em] = ev.endTime.split(':').map(Number);
      return { start: sh * 60 + sm, end: eh * 60 + em, title: ev.title };
    });

    const fmt = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    const tomorrowISO = tmr.toISOString().slice(0, 10);

    const sorted = [...unfinishedTodayOrOverdue].sort((a, b) => {
      const aTop = preferences.topPriorities.includes(a.id) ? 0 : 1;
      const bTop = preferences.topPriorities.includes(b.id) ? 0 : 1;
      if (aTop !== bTop) return aTop - bTop;
      const pOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
    });

    const proposals: RecoveryActionItem[] = [];

    for (const t of sorted) {
      const origTime =
        t.scheduledStart && t.scheduledEnd ? `${t.scheduledStart}–${t.scheduledEnd}` : 'Unscheduled';
      let dur = Math.min(Math.max(t.estimatedMinutes || 30, 15), 90);
      let placed = false;

      // Try placing full duration, or shortened 25m block if high priority
      while (cursor + 25 <= endMinutes) {
        const effectiveDur = cursor + dur <= endMinutes ? dur : 25;
        const conflict = occupied.find(
          (o) => cursor < o.end && cursor + effectiveDur > o.start
        );
        if (conflict) {
          cursor = conflict.end + 10;
        } else {
          const isShortened = effectiveDur < dur;
          proposals.push({
            taskId: t.id,
            title: t.title,
            priority: t.priority,
            originalTime: origTime,
            action: isShortened ? 'shorten_today' : 'reschedule_today',
            proposedStart: fmt(cursor),
            proposedEnd: fmt(cursor + effectiveDur),
            proposedDate: today,
            rationale: isShortened
              ? `Shortened from ${dur}m to ${effectiveDur}m focused sprint to fit before ${preferences.workEndHour}.`
              : `Rescheduled into open afternoon slot with 10m buffer around fixed events.`,
          });
          occupied.push({ start: cursor, end: cursor + effectiveDur, title: t.title });
          cursor += effectiveDur + 10;
          placed = true;
          break;
        }
      }

      if (!placed) {
        proposals.push({
          taskId: t.id,
          title: t.title,
          priority: t.priority,
          originalTime: origTime,
          action: 'defer_tomorrow',
          proposedStart: '',
          proposedEnd: '',
          proposedDate: tomorrowISO,
          rationale: `Insufficient remaining capacity before ${preferences.workEndHour}; safely deferred to tomorrow (${tomorrowISO}) without deleting task.`,
        });
      }
    }

    return { fixedAppointments, proposals };
  }, [tasks, events, preferences, restartTime, today]);

  if (!isPlanRecoveryOpen) return null;

  const applyRevisedPlan = async () => {
    // Save snapshot for Undo
    const snap = recoveryPlan.proposals.map((p) => {
      const t = tasks.find((x) => x.id === p.taskId);
      return {
        taskId: p.taskId,
        dueDate: t?.dueDate || today,
        scheduledStart: t?.scheduledStart || '',
        scheduledEnd: t?.scheduledEnd || '',
      };
    });
    setPreviousSnapshot(snap);

    for (const item of recoveryPlan.proposals) {
      if (item.action === 'defer_tomorrow') {
        await updateTask(item.taskId, {
          dueDate: item.proposedDate,
          scheduledStart: '',
          scheduledEnd: '',
        });
      } else {
        await updateTask(item.taskId, {
          dueDate: today,
          scheduledStart: item.proposedStart,
          scheduledEnd: item.proposedEnd,
        });
        const existingBlock = events.find(
          (e) => e.taskId === item.taskId && e.kind === 'timeblock' && e.date === today
        );
        if (existingBlock) {
          await updateCalendarEvent(existingBlock.id, {
            startTime: item.proposedStart,
            endTime: item.proposedEnd,
          });
        } else {
          await createCalendarEvent({
            title: item.title,
            kind: 'timeblock',
            date: today,
            startTime: item.proposedStart,
            endTime: item.proposedEnd,
            taskId: item.taskId,
            isFixed: false,
          });
        }
      }
    }
    showToast('Applied recovered schedule — fixed appointments protected');
  };

  const handleUndo = async () => {
    if (!previousSnapshot) return;
    for (const s of previousSnapshot) {
      await updateTask(s.taskId, {
        dueDate: s.dueDate,
        scheduledStart: s.scheduledStart,
        scheduledEnd: s.scheduledEnd,
      });
    }
    setPreviousSnapshot(null);
    showToast('Reverted to original schedule');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-[#171E19] border border-[#29342C] p-5 sm:p-6 text-[#F0F4F0] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1D2620] border border-[#29342C] flex items-center justify-center text-[#E8B86D]">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Plan Recovery</h2>
              <p className="text-xs text-[#99A69C]">
                Reorganize unfinished work while protecting fixed commitments
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsPlanRecoveryOpen(false)}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#99A69C] hover:text-[#F0F4F0]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#111713] border border-[#29342C] mb-4">
          <div className="text-xs text-[#99A69C]">
            Resume schedule from:{' '}
            <input
              type="time"
              value={restartTime}
              onChange={(e) => setRestartTime(e.target.value)}
              className="ml-1.5 px-2.5 py-1 rounded-lg bg-[#171E19] border border-[#29342C] text-[#F0F4F0] font-mono tabular-nums"
            />
          </div>
          <div className="text-xs text-[#99A69C] font-mono tabular-nums">
            Work day ends: {preferences.workEndHour}
          </div>
        </div>

        {/* Protected Fixed Commitments */}
        <div className="mb-4">
          <h3 className="text-xs font-medium text-[#99A69C] mb-2 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#79D99A]" />
            Protected Fixed Appointments ({recoveryPlan.fixedAppointments.length})
          </h3>
          {recoveryPlan.fixedAppointments.length === 0 ? (
            <p className="text-xs text-[#68766D] bg-[#111713] border border-[#29342C] rounded-xl p-3">
              No fixed appointments remaining today — all remaining time is flexible.
            </p>
          ) : (
            <div className="space-y-1.5">
              {recoveryPlan.fixedAppointments.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-xs"
                >
                  <span className="font-medium text-[#F0F4F0]">{ev.title}</span>
                  <span className="font-mono tabular-nums text-[#79D99A]">
                    {ev.startTime}–{ev.endTime} · Fixed
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Proposed Revised Schedule */}
        <div className="mb-5">
          <h3 className="text-xs font-medium text-[#99A69C] mb-2">
            Proposed Recovery Plan ({recoveryPlan.proposals.length} unfinished items)
          </h3>
          {recoveryPlan.proposals.length === 0 ? (
            <p className="text-xs text-[#68766D] bg-[#111713] border border-[#29342C] rounded-xl p-4 text-center">
              You have no unfinished or overdue tasks requiring recovery today.
            </p>
          ) : (
            <div className="space-y-2">
              {recoveryPlan.proposals.map((item) => (
                <div
                  key={item.taskId}
                  className="p-3.5 rounded-xl bg-[#111713] border border-[#29342C] space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[#F0F4F0] truncate">
                      {item.title}
                    </span>
                    <span
                      className={`text-xs font-mono tabular-nums shrink-0 ${
                        item.action === 'defer_tomorrow'
                          ? 'text-[#E8B86D]'
                          : 'text-[#79D99A]'
                      }`}
                    >
                      {item.originalTime}{' '}
                      <ArrowRight className="inline w-3 h-3 mx-0.5" />{' '}
                      {item.action === 'defer_tomorrow'
                        ? `Defer (${item.proposedDate})`
                        : `${item.proposedStart}–${item.proposedEnd}`}
                    </span>
                  </div>
                  <p className="text-xs text-[#99A69C]">{item.rationale}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#29342C]">
          {previousSnapshot ? (
            <button
              type="button"
              onClick={handleUndo}
              className="min-h-[42px] px-4 rounded-xl bg-[#111713] border border-[#E8B86D]/50 text-xs font-semibold text-[#E8B86D] flex items-center gap-1.5"
            >
              <Undo2 className="w-3.5 h-3.5" /> Undo Applied Recovery
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[#99A69C]">
              <ShieldAlert className="w-3.5 h-3.5 text-[#79D99A]" />
              <span>Zero tasks will be deleted</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlanRecoveryOpen(false)}
              className="min-h-[42px] px-4 rounded-xl bg-[#111713] border border-[#29342C] text-xs font-medium text-[#99A69C]"
            >
              Close
            </button>
            {recoveryPlan.proposals.length > 0 && (
              <button
                type="button"
                onClick={applyRevisedPlan}
                className="min-h-[42px] px-5 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold hover:bg-[#B5DDBF] transition-colors"
              >
                Approve & Apply Schedule
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
