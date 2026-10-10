import React, { useMemo, useState } from 'react';
import {
  FolderKanban,
  Target,
  Plus,
  CheckCircle2,
  Circle,
  Sparkles,
  Trash2,
  ChevronRight,
  Flag,
} from 'lucide-react';
import { generateId, getTodayISO, useLifeOS } from '../context/LifeOSContext';
import { PriorityLevel, ProjectOrGoal, ProjectStatus, Task } from '../types/lifeos';
import { TaskDetailModal } from '../components/QuickAddModal';

export const ProjectsGoalsView: React.FC = () => {
  const {
    projectsGoals,
    tasks,
    knowledge,
    createProjectOrGoal,
    updateProjectOrGoal,
    deleteProjectOrGoal,
    createTask,
    toggleTaskCompletion,
    getProjectProgress,
    openQuickAdd,
    showToast,
  } = useLifeOS();

  const [mode, setMode] = useState<'projects' | 'goals'>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [inspectTask, setInspectTask] = useState<Task | null>(null);

  // Milestone & Task creation inside Project Detail
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedMilestoneForTask, setSelectedMilestoneForTask] = useState('');

  // AI Task Breakdown state
  const [breakdownGoalInput, setBreakdownGoalInput] = useState('');
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownProposal, setBreakdownProposal] = useState<{
    overview: string;
    tasks: {
      title: string;
      description: string;
      estimatedMinutes: number;
      priority: PriorityLevel;
      energyRequired: any;
      subtasks: string[];
    }[];
  } | null>(null);

  const projects = useMemo(
    () => projectsGoals.filter((p) => p.recordType === 'project'),
    [projectsGoals]
  );

  const goals = useMemo(
    () => projectsGoals.filter((p) => p.recordType === 'goal'),
    [projectsGoals]
  );

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || projects[0] || null,
    [projects, selectedProjectId]
  );

  const projectMilestones = useMemo(
    () =>
      selectedProject
        ? projectsGoals.filter(
            (m) =>
              m.recordType === 'milestone' && m.parentProjectId === selectedProject.id
          )
        : [],
    [projectsGoals, selectedProject]
  );

  const projectTasks = useMemo(
    () =>
      selectedProject
        ? tasks.filter((t) => t.projectId === selectedProject.id && !t.archived)
        : [],
    [tasks, selectedProject]
  );

  const projectLinkedNotes = useMemo(
    () =>
      selectedProject
        ? knowledge.filter((k) => k.linkedProjectId === selectedProject.id)
        : [],
    [knowledge, selectedProject]
  );

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newMilestoneName.trim()) return;
    await createProjectOrGoal({
      recordType: 'milestone',
      name: newMilestoneName.trim(),
      parentProjectId: selectedProject.id,
      status: 'not_started',
    });
    setNewMilestoneName('');
    showToast('Milestone added to project');
  };

  const handleAddProjectTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newTaskTitle.trim()) return;
    await createTask({
      title: newTaskTitle.trim(),
      projectId: selectedProject.id,
      milestoneId: selectedMilestoneForTask,
      dueDate: getTodayISO(),
      category: selectedProject.category || 'Project',
    });
    setNewTaskTitle('');
    showToast('Task added to project');
  };

  const runAITaskBreakdown = async () => {
    const queryTitle = breakdownGoalInput.trim() || selectedProject?.name || '';
    if (!queryTitle) return;
    setBreakdownLoading(true);
    try {
      const res = await fetch('/api/ai/task-breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalTitle: queryTitle,
          context: selectedProject?.description || '',
        }),
      });
      const data = await res.json();
      setBreakdownProposal(data);
    } catch {
      showToast('Could not generate task breakdown');
    } finally {
      setBreakdownLoading(false);
    }
  };

  const approveBreakdownTasks = async () => {
    if (!breakdownProposal) return;
    for (const item of breakdownProposal.tasks) {
      await createTask({
        title: item.title,
        description: item.description,
        estimatedMinutes: Number(item.estimatedMinutes) || 30,
        priority: item.priority || 'normal',
        energyRequired: item.energyRequired || 'moderate',
        projectId: selectedProject?.id || '',
        dueDate: getTodayISO(),
        subtasks: (item.subtasks || []).map((st) => ({
          id: generateId('sub'),
          title: st,
          completed: false,
        })),
      });
    }
    setBreakdownProposal(null);
    setBreakdownGoalInput('');
    showToast('Approved and created breakdown tasks');
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F0F4F0]">
            Projects, Milestones & Goals
          </h1>
          <p className="text-xs text-[#99A69C]">
            Connect long-term outcomes with concrete milestones and daily execution
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#171E19] border border-[#29342C] p-1 rounded-xl">
            <button
              onClick={() => setMode('projects')}
              className={`min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                mode === 'projects'
                  ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                  : 'text-[#99A69C]'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Projects ({projects.length})</span>
            </button>
            <button
              onClick={() => setMode('goals')}
              className={`min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                mode === 'goals'
                  ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                  : 'text-[#99A69C]'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Goals ({goals.length})</span>
            </button>
          </div>

          <button
            onClick={() => openQuickAdd(mode === 'projects' ? 'project' : 'goal')}
            className="min-h-[40px] px-3.5 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New {mode === 'projects' ? 'Project' : 'Goal'}</span>
          </button>
        </div>
      </div>

      {/* AI Task Breakdown Bar */}
      <div className="p-4 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#79D99A] shrink-0">
            <Sparkles className="w-4 h-4" />
            <span>AI Task Breakdown:</span>
          </div>
          <input
            type="text"
            value={breakdownGoalInput}
            onChange={(e) => setBreakdownGoalInput(e.target.value)}
            placeholder='Enter a vague goal (e.g., "Prepare for my English test" or "Launch portfolio website")...'
            className="flex-1 min-h-[40px] px-3.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] placeholder-[#68766D]"
          />
          <button
            onClick={runAITaskBreakdown}
            disabled={breakdownLoading}
            className="min-h-[40px] px-4 rounded-xl bg-[#1D2620] border border-[#79D99A]/40 text-xs font-semibold text-[#79D99A] shrink-0"
          >
            {breakdownLoading ? 'Breaking down...' : 'Generate Concrete Steps'}
          </button>
        </div>

        {breakdownProposal && (
          <div className="p-4 rounded-xl bg-[#111713] border border-[#79D99A]/50 space-y-3">
            <p className="text-xs font-semibold text-[#79D99A]">
              Proposed Task Sequence (Review before saving): {breakdownProposal.overview}
            </p>
            <div className="space-y-2">
              {breakdownProposal.tasks.map((t, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-[#171E19] border border-[#29342C] text-xs"
                >
                  <div className="flex items-center justify-between font-semibold text-[#F0F4F0]">
                    <span>
                      0{i + 1}. {t.title}
                    </span>
                    <span className="font-mono tabular-nums text-[#79D99A]">
                      {t.estimatedMinutes}m · {t.priority}
                    </span>
                  </div>
                  <p className="text-[#99A69C] mt-0.5">{t.description}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setBreakdownProposal(null)}
                className="min-h-[36px] px-3 rounded-lg bg-[#171E19] text-xs text-[#99A69C]"
              >
                Discard
              </button>
              <button
                onClick={approveBreakdownTasks}
                className="min-h-[36px] px-4 rounded-lg bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold"
              >
                Approve & Add Tasks
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PROJECTS VIEW */}
      {mode === 'projects' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Projects List (4 cols) */}
          <div className="lg:col-span-4 space-y-2.5">
            {projects.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#171E19] border border-[#29342C] text-center space-y-3">
                <p className="text-sm font-medium text-[#F0F4F0]">No projects yet</p>
                <p className="text-xs text-[#99A69C]">
                  Create a project to organize milestones, tasks, and notes toward a clear target outcome.
                </p>
                <button
                  onClick={() => openQuickAdd('project')}
                  className="min-h-[38px] px-4 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold"
                >
                  + Create First Project
                </button>
              </div>
            ) : (
              projects.map((p) => {
                const pct = getProjectProgress(p.id);
                const isSelected = selectedProject?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`w-full p-4 rounded-2xl border text-left transition-colors space-y-2 ${
                      isSelected
                        ? 'bg-[#1D2620] border-[#79D99A]'
                        : 'bg-[#171E19] border-[#29342C] hover:border-[#79D99A]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#F0F4F0] truncate">
                        {p.name}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-[#79D99A]">
                        {pct}%
                      </span>
                    </div>
                    <p className="text-xs text-[#99A69C] font-mono tabular-nums">
                      {p.status.replace('_', ' ')} · {p.priority}
                      {p.targetDate ? ` · Due ${p.targetDate}` : ''}
                    </p>
                    <div className="w-full h-1.5 bg-[#111713] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#79D99A] origin-left transition-transform"
                        style={{ transform: `scaleX(${pct / 100})` }}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Project Detail Screen (8 cols) */}
          <div className="lg:col-span-8">
            {!selectedProject ? (
              <div className="p-12 rounded-2xl bg-[#171E19] border border-[#29342C] text-center text-xs text-[#99A69C]">
                Select or create a project to inspect milestones, tasks, and linked notes.
              </div>
            ) : (
              <div className="p-5 sm:p-6 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#29342C]">
                  <div className="space-y-1 flex-1 min-w-[200px]">
                    <input
                      type="text"
                      value={selectedProject.name}
                      onChange={(e) =>
                        updateProjectOrGoal(selectedProject.id, { name: e.target.value })
                      }
                      className="bg-transparent text-xl font-bold text-[#F0F4F0] focus:outline-none w-full"
                    />
                    <textarea
                      rows={2}
                      value={selectedProject.description}
                      onChange={(e) =>
                        updateProjectOrGoal(selectedProject.id, {
                          description: e.target.value,
                        })
                      }
                      placeholder="Project description & scope..."
                      className="w-full bg-transparent text-xs text-[#99A69C] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedProject.status}
                      onChange={(e) =>
                        updateProjectOrGoal(selectedProject.id, {
                          status: e.target.value as ProjectStatus,
                        })
                      }
                      className="min-h-[36px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#79D99A]"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="active">Active</option>
                      <option value="on_hold">On Hold</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                    <button
                      onClick={() => deleteProjectOrGoal(selectedProject.id)}
                      className="min-w-[36px] min-h-[36px] rounded-xl bg-[#111713] border border-[#29342C] text-[#E87979] flex items-center justify-center"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Mode (Calculated vs Manual) & Next Action */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl bg-[#111713] border border-[#29342C] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#99A69C]">
                        Progress ({selectedProject.isManualProgress ? 'Manual' : 'Calculated from tasks/milestones'})
                      </span>
                      <span className="font-mono tabular-nums font-bold text-[#79D99A]">
                        {getProjectProgress(selectedProject.id)}%
                      </span>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-[#99A69C]">
                      <input
                        type="checkbox"
                        checked={selectedProject.isManualProgress}
                        onChange={(e) =>
                          updateProjectOrGoal(selectedProject.id, {
                            isManualProgress: e.target.checked,
                          })
                        }
                        className="accent-[#79D99A]"
                      />
                      <span>Override with manual progress slider</span>
                    </label>
                    {selectedProject.isManualProgress && (
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={selectedProject.progress}
                        onChange={(e) =>
                          updateProjectOrGoal(selectedProject.id, {
                            progress: Number(e.target.value),
                          })
                        }
                        className="w-full accent-[#79D99A]"
                      />
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#111713] border border-[#29342C] space-y-1.5">
                    <label className="block text-xs text-[#99A69C]">
                      Immediate Next Action
                    </label>
                    <input
                      type="text"
                      value={selectedProject.nextAction}
                      onChange={(e) =>
                        updateProjectOrGoal(selectedProject.id, {
                          nextAction: e.target.value,
                        })
                      }
                      placeholder="Define the very next physical action..."
                      className="w-full min-h-[36px] px-3 rounded-lg bg-[#171E19] border border-[#29342C] text-xs text-[#F0F4F0]"
                    />
                  </div>
                </div>

                {/* Milestones Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-[#F0F4F0] flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-[#79D99A]" />
                    Milestones ({projectMilestones.filter((m) => m.status === 'completed').length}/
                    {projectMilestones.length})
                  </h3>

                  <div className="space-y-2">
                    {projectMilestones.map((ms) => (
                      <div
                        key={ms.id}
                        className="p-3 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-between gap-3"
                      >
                        <button
                          onClick={() =>
                            updateProjectOrGoal(ms.id, {
                              status: ms.status === 'completed' ? 'active' : 'completed',
                            })
                          }
                          className="flex items-center gap-2.5 text-left flex-1"
                        >
                          {ms.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-[#79D99A] shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-[#68766D] shrink-0" />
                          )}
                          <span
                            className={`text-xs font-semibold ${
                              ms.status === 'completed'
                                ? 'line-through text-[#68766D]'
                                : 'text-[#F0F4F0]'
                            }`}
                          >
                            {ms.name}
                          </span>
                        </button>
                        <button
                          onClick={() => deleteProjectOrGoal(ms.id)}
                          className="text-[#68766D] hover:text-[#E87979] p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddMilestone} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newMilestoneName}
                      onChange={(e) => setNewMilestoneName(e.target.value)}
                      placeholder="Add a project milestone..."
                      className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
                    />
                    <button
                      type="submit"
                      className="min-h-[38px] px-3.5 rounded-xl bg-[#1D2620] text-xs font-medium text-[#79D99A]"
                    >
                      + Milestone
                    </button>
                  </form>
                </div>

                {/* Associated Project Tasks */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-[#F0F4F0]">
                    Project Tasks ({projectTasks.filter((t) => t.completed).length}/
                    {projectTasks.length})
                  </h3>

                  <div className="space-y-2">
                    {projectTasks.map((t) => {
                      const ms = projectMilestones.find((m) => m.id === t.milestoneId);
                      return (
                        <div
                          key={t.id}
                          className="p-3 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <button
                              onClick={() => toggleTaskCompletion(t.id)}
                              className="text-[#79D99A]"
                            >
                              {t.completed ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <Circle className="w-4 h-4 text-[#68766D]" />
                              )}
                            </button>
                            <button
                              onClick={() => setInspectTask(t)}
                              className="text-left min-w-0 flex-1"
                            >
                              <p
                                className={`text-xs font-medium truncate ${
                                  t.completed ? 'line-through text-[#68766D]' : 'text-[#F0F4F0]'
                                }`}
                              >
                                {t.title}
                              </p>
                              <p className="text-[11px] font-mono tabular-nums text-[#99A69C]">
                                {t.priority} · {t.dueDate || 'No date'}
                                {ms ? ` · Milestone: ${ms.name}` : ''}
                              </p>
                            </button>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[#68766D]" />
                        </div>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={handleAddProjectTask}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Add task to this project..."
                      className="flex-1 min-w-[180px] min-h-[38px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
                    />
                    {projectMilestones.length > 0 && (
                      <select
                        value={selectedMilestoneForTask}
                        onChange={(e) => setSelectedMilestoneForTask(e.target.value)}
                        className="min-h-[38px] px-2.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#99A69C]"
                      >
                        <option value="">No Milestone</option>
                        {projectMilestones.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="submit"
                      className="min-h-[38px] px-3.5 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold"
                    >
                      + Add Task
                    </button>
                  </form>
                </div>

                {/* Linked Second Brain Notes & Ideas */}
                {projectLinkedNotes.length > 0 && (
                  <div className="pt-3 border-t border-[#29342C] space-y-2">
                    <h3 className="text-xs font-semibold text-[#99A69C]">
                      Linked Second Brain Notes & Ideas ({projectLinkedNotes.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {projectLinkedNotes.map((k) => (
                        <div
                          key={k.id}
                          className="p-2.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs"
                        >
                          <p className="font-semibold text-[#F0F4F0] truncate">{k.title}</p>
                          <p className="text-[#99A69C] line-clamp-1 mt-0.5">{k.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* GOALS VIEW */}
      {mode === 'goals' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.length === 0 ? (
            <div className="md:col-span-2 p-10 rounded-2xl bg-[#171E19] border border-[#29342C] text-center space-y-3">
              <p className="text-sm font-medium text-[#F0F4F0]">No goals defined yet</p>
              <p className="text-xs text-[#99A69C]">
                Define short-, medium-, and long-term goals with measurable outcomes and link them to execution projects.
              </p>
              <button
                onClick={() => openQuickAdd('goal')}
                className="min-h-[38px] px-4 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold"
              >
                + Define First Goal
              </button>
            </div>
          ) : (
            goals.map((g) => (
              <div
                key={g.id}
                className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[#F0F4F0]">{g.name}</h3>
                    <p className="text-xs text-[#79D99A] mt-0.5">
                      Outcome: {g.measurableOutcome || 'Complete all milestones'}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteProjectOrGoal(g.id)}
                    className="text-[#68766D] hover:text-[#E87979]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {g.description && (
                  <p className="text-xs text-[#99A69C]">{g.description}</p>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-[#99A69C]">
                      Target: {g.targetDate || 'Ongoing'}
                    </span>
                    <span className="text-[#79D99A] font-semibold">{g.progress}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={g.progress}
                    onChange={(e) =>
                      updateProjectOrGoal(g.id, { progress: Number(e.target.value) })
                    }
                    className="w-full accent-[#79D99A]"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <TaskDetailModal task={inspectTask} onClose={() => setInspectTask(null)} />
    </div>
  );
};
