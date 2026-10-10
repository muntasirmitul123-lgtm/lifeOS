import React, { useMemo, useState } from 'react';
import {
  Inbox,
  FileText,
  Lightbulb,
  Sparkles,
  Plus,
  Pin,
  Trash2,
  ArrowRight,
  CheckSquare,
  FolderKanban,
  AlertCircle,
  Search,
} from 'lucide-react';
import { generateId, getTodayISO, useLifeOS } from '../context/LifeOSContext';
import { BrainDumpCandidate, IdeaStatus, KnowledgeItem } from '../types/lifeos';

export const InboxBrainView: React.FC = () => {
  const {
    knowledge,
    projectsGoals,
    createKnowledgeItem,
    updateKnowledgeItem,
    deleteKnowledgeItem,
    createTask,
    createProjectOrGoal,
    convertIdeaToProject,
    showToast,
  } = useLifeOS();

  const [subTab, setSubTab] = useState<'inbox' | 'notes' | 'ideas' | 'brain_dump'>('inbox');
  const [searchFilter, setSearchFilter] = useState('');

  // Quick Inbox Capture
  const [inboxInput, setInboxInput] = useState('');
  const [inboxDetails, setInboxDetails] = useState('');

  // Selected Note / Idea editor
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [noteSummaryResult, setNoteSummaryResult] = useState<{
    summary: string;
    keyTakeaways: string[];
    suggestedActions: string[];
    aiMeta?: { model: string };
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Idea-to-Project Conversion modal state
  const [convertingIdea, setConvertingIdea] = useState<KnowledgeItem | null>(null);
  const [conversionMilestones, setConversionMilestones] = useState<
    { name: string; tasks: string[] }[]
  >([
    { name: 'Milestone 1: Scope & Foundation', tasks: ['Define core deliverables', 'Set up initial structure'] },
    { name: 'Milestone 2: Execution & Launch', tasks: ['Complete primary implementation', 'Review and finalize'] },
  ]);
  const [ideaAiLoading, setIdeaAiLoading] = useState(false);

  // Brain Dump State
  const [dumpText, setDumpText] = useState('');
  const [dumpLoading, setDumpLoading] = useState(false);
  const [dumpCandidates, setDumpCandidates] = useState<BrainDumpCandidate[]>([]);
  const [dumpAmbiguities, setDumpAmbiguities] = useState<string[]>([]);
  const [dumpMeta, setDumpMeta] = useState<{ model: string; usedFallback: boolean } | null>(null);

  const inboxItems = useMemo(
    () =>
      knowledge.filter(
        (k) =>
          k.itemType === 'inbox' &&
          !k.archived &&
          (!searchFilter ||
            k.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
            k.content.toLowerCase().includes(searchFilter.toLowerCase()))
      ),
    [knowledge, searchFilter]
  );

  const notesList = useMemo(
    () =>
      knowledge
        .filter(
          (k) =>
            (k.itemType === 'note' || k.itemType === 'brain_dump') &&
            !k.archived &&
            (!searchFilter ||
              k.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
              k.content.toLowerCase().includes(searchFilter.toLowerCase()))
        )
        .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1)),
    [knowledge, searchFilter]
  );

  const ideasList = useMemo(
    () =>
      knowledge.filter(
        (k) =>
          k.itemType === 'idea' &&
          !k.archived &&
          (!searchFilter ||
            k.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
            k.content.toLowerCase().includes(searchFilter.toLowerCase()))
      ),
    [knowledge, searchFilter]
  );

  const handleInboxCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboxInput.trim()) return;
    await createKnowledgeItem({
      itemType: 'inbox',
      title: inboxInput.trim(),
      content: inboxDetails.trim(),
    });
    setInboxInput('');
    setInboxDetails('');
    showToast('Saved to Inbox');
  };

  const processInboxToTask = async (item: KnowledgeItem) => {
    await createTask({
      title: item.title,
      description: item.content,
      dueDate: getTodayISO(),
      priority: 'normal',
    });
    await deleteKnowledgeItem(item.id);
    showToast('Processed Inbox item into Task');
  };

  const processInboxToNote = async (item: KnowledgeItem) => {
    await updateKnowledgeItem(item.id, { itemType: 'note' });
    showToast('Moved Inbox item to Notes');
  };

  const processInboxToIdea = async (item: KnowledgeItem) => {
    await updateKnowledgeItem(item.id, { itemType: 'idea', ideaStatus: 'raw' });
    showToast('Moved Inbox item to Ideas');
  };

  const handleSummarizeNote = async (note: KnowledgeItem) => {
    setSummaryLoading(true);
    setNoteSummaryResult(null);
    try {
      const res = await fetch('/api/ai/summarize-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: note.title, content: note.content }),
      });
      const data = await res.json();
      setNoteSummaryResult(data);
    } catch {
      showToast('Failed to summarize note');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleDevelopIdeaWithAI = async (idea: KnowledgeItem) => {
    setIdeaAiLoading(true);
    try {
      const res = await fetch('/api/ai/idea-develop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: idea.title,
          content: idea.content,
          whyItMatters: idea.whyItMatters,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.milestones) && data.milestones.length > 0) {
        setConversionMilestones(
          data.milestones.map((m: any) => ({
            name: m.name || 'Milestone',
            tasks: Array.isArray(m.suggestedTasks) ? m.suggestedTasks : [],
          }))
        );
      }
      if (data.immediateNextStep) {
        await updateKnowledgeItem(idea.id, { nextAction: data.immediateNextStep });
      }
      showToast('AI expanded idea into milestones & next steps');
    } catch {
      showToast('Could not expand idea');
    } finally {
      setIdeaAiLoading(false);
    }
  };

  // Brain Dump Parser
  const handleAnalyzeBrainDump = async () => {
    if (!dumpText.trim()) return;
    setDumpLoading(true);
    try {
      const res = await fetch('/api/ai/brain-dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: dumpText }),
      });
      const data = await res.json();
      const cands: BrainDumpCandidate[] = (data.items || []).map((it: any) => ({
        id: generateId('cand'),
        type: ['task', 'idea', 'note', 'project'].includes(it.type) ? it.type : 'task',
        title: it.title || 'Untitled item',
        description: it.description || '',
        priority: ['low', 'normal', 'high', 'urgent'].includes(it.priority)
          ? it.priority
          : 'normal',
        explicitDeadline: it.explicitDeadline || '',
        category: it.category || 'General',
        estimatedMinutes: Number(it.estimatedMinutes) || 30,
        suggestedSubtasks: Array.isArray(it.suggestedSubtasks) ? it.suggestedSubtasks : [],
        selected: true,
      }));
      setDumpCandidates(cands);
      setDumpAmbiguities(Array.isArray(data.ambiguities) ? data.ambiguities : []);
      setDumpMeta(data.aiMeta || null);
    } catch {
      showToast('Error analyzing Brain Dump');
    } finally {
      setDumpLoading(false);
    }
  };

  const handleCommitBrainDump = async () => {
    const selected = dumpCandidates.filter((c) => c.selected && c.title.trim());
    // 1. Always preserve the original messy text as a source note in Second Brain
    await createKnowledgeItem({
      itemType: 'brain_dump',
      title: `Brain Dump Source (${getTodayISO()})`,
      content: dumpText,
      category: 'Brain Dump Archive',
    });

    // 2. Save approved items
    for (const c of selected) {
      if (c.type === 'task') {
        await createTask({
          title: c.title.trim(),
          description: c.description,
          priority: c.priority,
          dueDate: c.explicitDeadline || '', // Never silently invent a deadline
          category: c.category,
          estimatedMinutes: c.estimatedMinutes,
          subtasks: (c.suggestedSubtasks || []).map((st) => ({
            id: generateId('sub'),
            title: st,
            completed: false,
          })),
        });
      } else if (c.type === 'idea') {
        await createKnowledgeItem({
          itemType: 'idea',
          title: c.title.trim(),
          content: c.description,
          ideaStatus: 'raw',
          category: c.category,
        });
      } else if (c.type === 'note') {
        await createKnowledgeItem({
          itemType: 'note',
          title: c.title.trim(),
          content: c.description,
          category: c.category,
        });
      } else if (c.type === 'project') {
        await createProjectOrGoal({
          recordType: 'project',
          name: c.title.trim(),
          description: c.description,
          priority: c.priority,
          targetDate: c.explicitDeadline || '',
          category: c.category,
          status: 'active',
        });
      }
    }

    setDumpText('');
    setDumpCandidates([]);
    setDumpAmbiguities([]);
    showToast(`Saved ${selected.length} approved items & preserved original Brain Dump note`);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Sub-navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F0F4F0]">
            Second Brain & Knowledge
          </h1>
          <p className="text-xs text-[#99A69C]">
            Capture thoughts, organize notes, incubate ideas, and parse Brain Dumps
          </p>
        </div>

        <div className="flex items-center bg-[#171E19] border border-[#29342C] p-1 rounded-xl self-start">
          {(
            [
              { id: 'inbox', label: 'Inbox', icon: <Inbox className="w-3.5 h-3.5" /> },
              { id: 'notes', label: 'Notes', icon: <FileText className="w-3.5 h-3.5" /> },
              { id: 'ideas', label: 'Ideas', icon: <Lightbulb className="w-3.5 h-3.5" /> },
              { id: 'brain_dump', label: 'Brain Dump', icon: <Sparkles className="w-3.5 h-3.5" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSubTab(t.id);
                setSelectedItem(null);
              }}
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

      {/* Filter Bar for Inbox / Notes / Ideas */}
      {subTab !== 'brain_dump' && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#171E19] border border-[#29342C]">
          <Search className="w-4 h-4 text-[#99A69C] ml-1" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={`Search ${subTab}...`}
            className="flex-1 bg-transparent text-xs text-[#F0F4F0] placeholder-[#68766D] focus:outline-none"
          />
        </div>
      )}

      {/* 1. INBOX TAB */}
      {subTab === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleInboxCapture}
            className="lg:col-span-5 p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3"
          >
            <h2 className="text-sm font-semibold text-[#F0F4F0]">
              Quick Inbox Capture
            </h2>
            <p className="text-xs text-[#99A69C]">
              Save raw thoughts immediately without choosing a category or project. Process them when ready.
            </p>
            <input
              type="text"
              required
              value={inboxInput}
              onChange={(e) => setInboxInput(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0]"
            />
            <textarea
              rows={3}
              value={inboxDetails}
              onChange={(e) => setInboxDetails(e.target.value)}
              placeholder="Optional supporting notes..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
            />
            <button
              type="submit"
              className="w-full min-h-[42px] rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold hover:bg-[#B5DDBF] transition-colors"
            >
              Capture to Inbox
            </button>
          </form>

          <div className="lg:col-span-7 p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3">
            <h2 className="text-sm font-semibold text-[#F0F4F0]">
              Unprocessed Inbox Items ({inboxItems.length})
            </h2>
            {inboxItems.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#111713] border border-[#29342C] text-center text-xs text-[#99A69C]">
                Inbox zero! Captured thoughts will appear here chronologically for processing.
              </div>
            ) : (
              <div className="space-y-2.5">
                {inboxItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-[#111713] border border-[#29342C] space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#F0F4F0]">{item.title}</p>
                        {item.content && (
                          <p className="text-xs text-[#99A69C] mt-0.5">{item.content}</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteKnowledgeItem(item.id)}
                        className="text-[#68766D] hover:text-[#E87979] p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#29342C]">
                      <span className="text-[11px] text-[#68766D]">Process as:</span>
                      <button
                        onClick={() => processInboxToTask(item)}
                        className="min-h-[32px] px-2.5 rounded-lg bg-[#1D2620] text-xs font-medium text-[#79D99A] flex items-center gap-1"
                      >
                        <CheckSquare className="w-3 h-3" /> Task
                      </button>
                      <button
                        onClick={() => processInboxToNote(item)}
                        className="min-h-[32px] px-2.5 rounded-lg bg-[#1D2620] text-xs font-medium text-[#F0F4F0] flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" /> Note
                      </button>
                      <button
                        onClick={() => processInboxToIdea(item)}
                        className="min-h-[32px] px-2.5 rounded-lg bg-[#1D2620] text-xs font-medium text-[#E8B86D] flex items-center gap-1"
                      >
                        <Lightbulb className="w-3 h-3" /> Idea
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. NOTES TAB */}
      {subTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F0F4F0]">
                Notes ({notesList.length})
              </h2>
              <button
                onClick={async () => {
                  const created = await createKnowledgeItem({
                    itemType: 'note',
                    title: 'Untitled Note',
                    content: '# Key Thoughts\n- ',
                  });
                  setSelectedItem(created);
                }}
                className="min-h-[34px] px-3 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> New Note
              </button>
            </div>

            {notesList.length === 0 ? (
              <p className="text-xs text-[#99A69C] p-6 bg-[#111713] rounded-xl text-center">
                No notes yet. Create a note to store reference material, checklists, or study summaries.
              </p>
            ) : (
              <div className="space-y-2">
                {notesList.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setSelectedItem(n);
                      setNoteSummaryResult(null);
                    }}
                    className={`w-full p-3.5 rounded-xl border text-left transition-colors ${
                      selectedItem?.id === n.id
                        ? 'bg-[#1D2620] border-[#79D99A]'
                        : 'bg-[#111713] border-[#29342C] hover:border-[#79D99A]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#F0F4F0] truncate">
                        {n.title}
                      </span>
                      {n.pinned && <Pin className="w-3.5 h-3.5 text-[#79D99A] shrink-0" />}
                    </div>
                    <p className="text-xs text-[#99A69C] line-clamp-2 mt-1">
                      {n.content || 'Empty note'}
                    </p>
                    <p className="text-[11px] font-mono text-[#68766D] mt-1.5">
                      {n.category} · Updated {n.updatedAt.slice(0, 10)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-7 p-5 rounded-2xl bg-[#171E19] border border-[#29342C]">
            {!selectedItem ? (
              <div className="py-16 text-center text-xs text-[#99A69C]">
                Select a note from the list or create a new note to edit and summarize.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <input
                    type="text"
                    value={selectedItem.title}
                    onChange={(e) => {
                      const next = { ...selectedItem, title: e.target.value };
                      setSelectedItem(next);
                      updateKnowledgeItem(selectedItem.id, { title: e.target.value });
                    }}
                    className="flex-1 bg-transparent text-lg font-bold text-[#F0F4F0] focus:outline-none border-b border-transparent focus:border-[#79D99A]"
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const pinned = !selectedItem.pinned;
                        setSelectedItem({ ...selectedItem, pinned });
                        updateKnowledgeItem(selectedItem.id, { pinned });
                      }}
                      className={`min-h-[34px] px-2.5 rounded-lg text-xs border ${
                        selectedItem.pinned
                          ? 'bg-[#79D99A]/15 border-[#79D99A] text-[#79D99A]'
                          : 'bg-[#111713] border-[#29342C] text-[#99A69C]'
                      }`}
                    >
                      {selectedItem.pinned ? 'Pinned' : 'Pin'}
                    </button>
                    <button
                      onClick={() => handleSummarizeNote(selectedItem)}
                      disabled={summaryLoading}
                      className="min-h-[34px] px-3 rounded-lg bg-[#1D2620] text-xs font-medium text-[#79D99A] flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{summaryLoading ? 'Summarizing...' : 'AI Summarize'}</span>
                    </button>
                    <button
                      onClick={() => {
                        deleteKnowledgeItem(selectedItem.id);
                        setSelectedItem(null);
                      }}
                      className="min-h-[34px] px-2.5 rounded-lg bg-[#111713] border border-[#29342C] text-xs text-[#E87979]"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-[#99A69C] mb-1">Category</label>
                    <input
                      type="text"
                      value={selectedItem.category}
                      onChange={(e) => {
                        setSelectedItem({ ...selectedItem, category: e.target.value });
                        updateKnowledgeItem(selectedItem.id, { category: e.target.value });
                      }}
                      className="w-full min-h-[36px] px-3 rounded-lg bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#99A69C] mb-1">Link to Project</label>
                    <select
                      value={selectedItem.linkedProjectId}
                      onChange={(e) => {
                        setSelectedItem({ ...selectedItem, linkedProjectId: e.target.value });
                        updateKnowledgeItem(selectedItem.id, { linkedProjectId: e.target.value });
                      }}
                      className="w-full min-h-[36px] px-3 rounded-lg bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
                    >
                      <option value="">No Linked Project</option>
                      {projectsGoals
                        .filter((p) => p.recordType === 'project')
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <textarea
                  rows={10}
                  value={selectedItem.content}
                  onChange={(e) => {
                    setSelectedItem({ ...selectedItem, content: e.target.value });
                    updateKnowledgeItem(selectedItem.id, { content: e.target.value });
                  }}
                  placeholder="Write structured notes, markdown headings, or checklists..."
                  className="w-full p-3.5 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0] leading-relaxed focus:outline-none focus:border-[#79D99A]"
                />

                {/* Non-destructive AI Summary Output */}
                {noteSummaryResult && (
                  <div className="p-4 rounded-xl bg-[#111713] border border-[#79D99A]/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#79D99A]">
                        AI Summary (Source note preserved)
                      </span>
                      <button
                        onClick={async () => {
                          await createKnowledgeItem({
                            itemType: 'note',
                            title: `Summary: ${selectedItem.title}`,
                            content: `${noteSummaryResult.summary}\n\nKey Takeaways:\n${noteSummaryResult.keyTakeaways
                              .map((k) => `- ${k}`)
                              .join('\n')}`,
                            category: selectedItem.category,
                            linkedProjectId: selectedItem.linkedProjectId,
                          });
                          showToast('Saved summary as a separate note');
                        }}
                        className="text-xs text-[#79D99A] underline"
                      >
                        Save as Separate Note
                      </button>
                    </div>
                    <p className="text-xs text-[#F0F4F0]">{noteSummaryResult.summary}</p>
                    {noteSummaryResult.suggestedActions.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-[#29342C]">
                        <p className="text-[11px] font-medium text-[#99A69C]">
                          Suggested Action Items (Click to create Task):
                        </p>
                        {noteSummaryResult.suggestedActions.map((act, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-[#F0F4F0]">• {act}</span>
                            <button
                              onClick={() =>
                                createTask({
                                  title: act,
                                  projectId: selectedItem.linkedProjectId,
                                  dueDate: getTodayISO(),
                                })
                              }
                              className="px-2 py-1 rounded bg-[#1D2620] text-[#79D99A] text-[11px] shrink-0"
                            >
                              + Create Task
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. IDEAS & IDEA-TO-EXECUTION PIPELINE */}
      {subTab === 'ideas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#F0F4F0]">
              Idea Incubator & Execution Pipeline ({ideasList.length})
            </h2>
            <button
              onClick={() =>
                createKnowledgeItem({
                  itemType: 'idea',
                  title: 'New Idea Concept',
                  ideaStatus: 'raw',
                  whyItMatters: 'High potential impact',
                })
              }
              className="min-h-[38px] px-3.5 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Capture Idea
            </button>
          </div>

          {ideasList.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#171E19] border border-[#29342C] text-center text-xs text-[#99A69C]">
              No ideas captured yet. Capture raw ideas here, explore their value, and convert worthy ones directly into structured Projects with Milestones and Tasks.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ideasList.map((idea) => {
                const linkedProj = projectsGoals.find((p) => p.id === idea.linkedProjectId);
                return (
                  <div
                    key={idea.id}
                    className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <input
                        type="text"
                        value={idea.title}
                        onChange={(e) =>
                          updateKnowledgeItem(idea.id, { title: e.target.value })
                        }
                        className="bg-transparent text-base font-semibold text-[#F0F4F0] focus:outline-none flex-1"
                      />
                      <select
                        value={idea.ideaStatus}
                        onChange={(e) =>
                          updateKnowledgeItem(idea.id, {
                            ideaStatus: e.target.value as IdeaStatus,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#111713] border border-[#29342C] text-xs text-[#79D99A] capitalize"
                      >
                        <option value="raw">Raw</option>
                        <option value="exploring">Exploring</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    <textarea
                      rows={2}
                      value={idea.content}
                      onChange={(e) =>
                        updateKnowledgeItem(idea.id, { content: e.target.value })
                      }
                      placeholder="Describe the idea and supporting notes..."
                      className="w-full px-3 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={idea.whyItMatters}
                        onChange={(e) =>
                          updateKnowledgeItem(idea.id, { whyItMatters: e.target.value })
                        }
                        placeholder="Why it matters..."
                        className="px-3 py-1.5 rounded-lg bg-[#111713] border border-[#29342C] text-xs text-[#99A69C]"
                      />
                      <input
                        type="text"
                        value={idea.nextAction}
                        onChange={(e) =>
                          updateKnowledgeItem(idea.id, { nextAction: e.target.value })
                        }
                        placeholder="Next action..."
                        className="px-3 py-1.5 rounded-lg bg-[#111713] border border-[#29342C] text-xs text-[#99A69C]"
                      />
                    </div>

                    {linkedProj && (
                      <div className="text-xs text-[#79D99A] font-mono">
                        Linked Project: {linkedProj.name} ({linkedProj.status})
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#29342C]">
                      <button
                        onClick={() => {
                          setConvertingIdea(idea);
                          handleDevelopIdeaWithAI(idea);
                        }}
                        className="min-h-[36px] px-3 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold flex items-center gap-1.5"
                      >
                        <FolderKanban className="w-3.5 h-3.5" />
                        <span>Convert to Project + Milestones</span>
                      </button>

                      <button
                        onClick={() => deleteKnowledgeItem(idea.id)}
                        className="text-xs text-[#99A69C] hover:text-[#E87979]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Idea-to-Project Conversion Modal */}
      {convertingIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#171E19] border border-[#29342C] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-[#F0F4F0]">
              Convert Idea to Project: {convertingIdea.title}
            </h3>
            <p className="text-xs text-[#99A69C]">
              Review the milestones and tasks to create. Your original idea will be preserved and linked to the new project.
            </p>
            {ideaAiLoading && (
              <p className="text-xs text-[#79D99A] font-mono">
                AI Assistant is generating suggested milestones and tasks...
              </p>
            )}
            <div className="space-y-3">
              {conversionMilestones.map((ms, mIdx) => (
                <div
                  key={mIdx}
                  className="p-3.5 rounded-xl bg-[#111713] border border-[#29342C] space-y-2"
                >
                  <input
                    type="text"
                    value={ms.name}
                    onChange={(e) => {
                      const copy = [...conversionMilestones];
                      copy[mIdx].name = e.target.value;
                      setConversionMilestones(copy);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#171E19] border border-[#29342C] text-xs font-semibold text-[#F0F4F0]"
                  />
                  <textarea
                    rows={2}
                    value={ms.tasks.join('\n')}
                    onChange={(e) => {
                      const copy = [...conversionMilestones];
                      copy[mIdx].tasks = e.target.value.split('\n');
                      setConversionMilestones(copy);
                    }}
                    placeholder="One task per line..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#171E19] border border-[#29342C] text-xs text-[#99A69C]"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConvertingIdea(null)}
                className="min-h-[40px] px-4 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#99A69C]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await convertIdeaToProject(convertingIdea.id, conversionMilestones);
                  setConvertingIdea(null);
                }}
                className="min-h-[40px] px-5 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold"
              >
                Create Project, Milestones & Tasks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. BRAIN DUMP MODE */}
      {subTab === 'brain_dump' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-[#F0F4F0]">
                  Brain Dump Mode
                </h2>
                <p className="text-xs text-[#99A69C]">
                  Write a messy paragraph of tasks, worries, ideas, and reminders. Review and edit every extracted item before saving.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDumpText(
                    'I need to revise English poems, finish ICT homework, research my website business idea, buy a notebook, and plan next week. Maybe I should also build a reading tracker.'
                  )
                }
                className="min-h-[34px] px-3 rounded-lg bg-[#111713] border border-[#29342C] text-xs text-[#79D99A]"
              >
                Insert Example Prompt
              </button>
            </div>

            <textarea
              rows={5}
              value={dumpText}
              onChange={(e) => setDumpText(e.target.value)}
              placeholder="Dump everything on your mind here..."
              className="w-full p-4 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0] placeholder-[#68766D] focus:outline-none focus:border-[#79D99A]"
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-[#68766D]">
                Original text is always preserved in your Second Brain archive.
              </span>
              <button
                type="button"
                onClick={handleAnalyzeBrainDump}
                disabled={dumpLoading || !dumpText.trim()}
                className="min-h-[42px] px-5 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{dumpLoading ? 'Extracting Items...' : 'Extract & Review Items'}</span>
              </button>
            </div>
          </div>

          {/* Brain Dump Review Screen */}
          {dumpCandidates.length > 0 && (
            <div className="p-5 rounded-2xl bg-[#171E19] border border-[#79D99A]/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#79D99A]">
                    Review Extracted Items ({dumpCandidates.filter((c) => c.selected).length} selected)
                  </h3>
                  <p className="text-xs text-[#99A69C]">
                    Edit titles, reclassify item types, or uncheck items you want to reject. Nothing is saved until you approve.
                  </p>
                </div>
                {dumpMeta && (
                  <span className="text-[11px] font-mono text-[#99A69C]">
                    Engine: {dumpMeta.model}
                  </span>
                )}
              </div>

              {dumpAmbiguities.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#E8B86D]/10 border border-[#E8B86D]/30 space-y-1">
                  <p className="text-xs font-semibold text-[#E8B86D] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Ambiguities Flagged (No Deadlines Invented):
                  </p>
                  {dumpAmbiguities.map((amb, i) => (
                    <p key={i} className="text-xs text-[#F0F4F0]">
                      • {amb}
                    </p>
                  ))}
                </div>
              )}

              <div className="space-y-2.5">
                {dumpCandidates.map((cand, idx) => (
                  <div
                    key={cand.id}
                    className={`p-3.5 rounded-xl border transition-colors ${
                      cand.selected
                        ? 'bg-[#111713] border-[#29342C]'
                        : 'bg-[#111713]/40 border-[#29342C]/40 opacity-60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={cand.selected}
                        onChange={(e) => {
                          const copy = [...dumpCandidates];
                          copy[idx].selected = e.target.checked;
                          setDumpCandidates(copy);
                        }}
                        className="accent-[#79D99A] w-4 h-4"
                      />

                      <select
                        value={cand.type}
                        onChange={(e) => {
                          const copy = [...dumpCandidates];
                          copy[idx].type = e.target.value as any;
                          setDumpCandidates(copy);
                        }}
                        className="min-h-[34px] px-2.5 rounded-lg bg-[#171E19] border border-[#29342C] text-xs font-medium text-[#79D99A]"
                      >
                        <option value="task">Task</option>
                        <option value="idea">Idea</option>
                        <option value="note">Note</option>
                        <option value="project">Project</option>
                      </select>

                      <input
                        type="text"
                        value={cand.title}
                        onChange={(e) => {
                          const copy = [...dumpCandidates];
                          copy[idx].title = e.target.value;
                          setDumpCandidates(copy);
                        }}
                        className="flex-1 min-w-[180px] min-h-[34px] px-3 rounded-lg bg-[#171E19] border border-[#29342C] text-xs text-[#F0F4F0]"
                      />

                      {cand.type === 'task' && (
                        <>
                          <select
                            value={cand.priority}
                            onChange={(e) => {
                              const copy = [...dumpCandidates];
                              copy[idx].priority = e.target.value as any;
                              setDumpCandidates(copy);
                            }}
                            className="min-h-[34px] px-2 rounded-lg bg-[#171E19] border border-[#29342C] text-xs text-[#99A69C]"
                          >
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                          <input
                            type="date"
                            value={cand.explicitDeadline}
                            onChange={(e) => {
                              const copy = [...dumpCandidates];
                              copy[idx].explicitDeadline = e.target.value;
                              setDumpCandidates(copy);
                            }}
                            className="min-h-[34px] px-2 rounded-lg bg-[#171E19] border border-[#29342C] text-xs text-[#F0F4F0] font-mono"
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDumpCandidates([])}
                  className="min-h-[40px] px-4 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#99A69C]"
                >
                  Discard Extraction
                </button>
                <button
                  type="button"
                  onClick={handleCommitBrainDump}
                  className="min-h-[40px] px-5 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold flex items-center gap-1.5"
                >
                  <span>Approve & Save Selected Items</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
