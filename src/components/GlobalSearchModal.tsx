import React, { useMemo, useState } from 'react';
import { Search, X, CheckSquare, FileText, Lightbulb, FolderKanban, Repeat } from 'lucide-react';
import { useLifeOS } from '../context/LifeOSContext';

export const GlobalSearchModal: React.FC = () => {
  const {
    isSearchOpen,
    setIsSearchOpen,
    tasks,
    knowledge,
    projectsGoals,
    habitsLogs,
    setActiveTab,
    toggleTaskCompletion,
  } = useLifeOS();

  const [queryText, setQueryText] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'tasks' | 'notes' | 'ideas' | 'projects' | 'habits'>('all');

  const results = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    const out: {
      id: string;
      kind: 'tasks' | 'notes' | 'ideas' | 'projects' | 'habits';
      title: string;
      subtitle: string;
      completed?: boolean;
      targetTab: 'today' | 'planner' | 'inbox' | 'projects' | 'insights';
    }[] = [];

    if (filterType === 'all' || filterType === 'tasks') {
      for (const t of tasks) {
        if (
          !q ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
        ) {
          out.push({
            id: t.id,
            kind: 'tasks',
            title: t.title,
            subtitle: `Task · ${t.priority} · ${t.dueDate || 'Unscheduled'} · ${t.category}`,
            completed: t.completed,
            targetTab: 'today',
          });
        }
      }
    }

    if (filterType === 'all' || filterType === 'notes' || filterType === 'ideas') {
      for (const k of knowledge) {
        const isIdea = k.itemType === 'idea';
        if (filterType === 'notes' && isIdea) continue;
        if (filterType === 'ideas' && !isIdea) continue;
        if (
          !q ||
          k.title.toLowerCase().includes(q) ||
          k.content.toLowerCase().includes(q) ||
          k.tags.some((tag) => tag.toLowerCase().includes(q))
        ) {
          out.push({
            id: k.id,
            kind: isIdea ? 'ideas' : 'notes',
            title: k.title,
            subtitle: `${isIdea ? `Idea (${k.ideaStatus})` : k.itemType} · ${k.category}`,
            targetTab: 'inbox',
          });
        }
      }
    }

    if (filterType === 'all' || filterType === 'projects') {
      for (const p of projectsGoals) {
        if (
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        ) {
          out.push({
            id: p.id,
            kind: 'projects',
            title: p.name,
            subtitle: `${p.recordType.toUpperCase()} · ${p.status} · ${p.progress}%`,
            targetTab: 'projects',
          });
        }
      }
    }

    if (filterType === 'all' || filterType === 'habits') {
      for (const h of habitsLogs.filter((x) => x.logType === 'habit')) {
        if (!q || h.title.toLowerCase().includes(q) || h.category.toLowerCase().includes(q)) {
          out.push({
            id: h.id,
            kind: 'habits',
            title: h.title,
            subtitle: `Habit · ${h.scheduleType}`,
            targetTab: 'insights',
          });
        }
      }
    }

    return out.slice(0, 40);
  }, [queryText, filterType, tasks, knowledge, projectsGoals, habitsLogs]);

  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6 pt-12">
      <div className="w-full max-w-xl rounded-2xl bg-[#171E19] border border-[#29342C] p-4 sm:p-5 shadow-2xl max-h-[82vh] flex flex-col">
        <div className="flex items-center gap-3 pb-3 border-b border-[#29342C]">
          <Search className="w-4 h-4 text-[#79D99A] shrink-0" />
          <input
            type="text"
            autoFocus
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search tasks, notes, ideas, projects, tags..."
            className="flex-1 bg-transparent text-sm text-[#F0F4F0] placeholder-[#68766D] focus:outline-none"
          />
          <button
            onClick={() => setIsSearchOpen(false)}
            className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-[#99A69C] hover:text-[#F0F4F0]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-3">
          {(['all', 'tasks', 'notes', 'ideas', 'projects', 'habits'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium capitalize whitespace-nowrap shrink-0 transition-colors ${
                filterType === f
                  ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                  : 'bg-[#111713] text-[#99A69C] hover:text-[#F0F4F0]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#29342C]">
          {results.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#68766D]">
              No matching records found in your personal database.
            </div>
          ) : (
            results.map((r) => (
              <div
                key={`${r.kind}_${r.id}`}
                className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-[#1D2620]/60 rounded-xl transition-colors"
              >
                <button
                  onClick={() => {
                    setActiveTab(r.targetTab);
                    setIsSearchOpen(false);
                  }}
                  className="flex items-center gap-3 text-left flex-1 min-w-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#111713] border border-[#29342C] flex items-center justify-center text-[#79D99A] shrink-0">
                    {r.kind === 'tasks' && <CheckSquare className="w-4 h-4" />}
                    {r.kind === 'notes' && <FileText className="w-4 h-4" />}
                    {r.kind === 'ideas' && <Lightbulb className="w-4 h-4" />}
                    {r.kind === 'projects' && <FolderKanban className="w-4 h-4" />}
                    {r.kind === 'habits' && <Repeat className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium truncate ${
                        r.completed ? 'line-through text-[#68766D]' : 'text-[#F0F4F0]'
                      }`}
                    >
                      {r.title}
                    </p>
                    <p className="text-xs text-[#99A69C] truncate">{r.subtitle}</p>
                  </div>
                </button>

                {r.kind === 'tasks' && (
                  <button
                    onClick={() => toggleTaskCompletion(r.id)}
                    className="min-h-[34px] px-2.5 rounded-lg bg-[#111713] border border-[#29342C] text-xs text-[#99A69C] hover:text-[#79D99A]"
                  >
                    {r.completed ? 'Reopen' : 'Done'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
