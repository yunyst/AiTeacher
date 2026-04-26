import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import type { CourseCategory } from '../types';
import type { StudentLessonRecord } from '../services/studentRecords';
import { parseLessonScript } from '../lessons/iot/registry';

// ── Progress Ring (reused from CourseSelector) ──────────────────────────────

const clamp01 = (n: number) => Math.min(100, Math.max(0, n));

const ProgressRing: React.FC<{
  progress: number;
  size: number;
  strokeWidth: number;
  colorClassName: string;
  trackClassName?: string;
  showLabel?: boolean;
}> = ({ progress, size, strokeWidth, colorClassName, trackClassName = 'text-slate-700/80', showLabel = true }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = `${circumference} ${circumference}`;
  const p = clamp01(progress);
  const strokeDashoffset = circumference - (p / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          className={trackClassName}
        />
        <circle
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray,
            strokeDashoffset,
            transition: 'stroke-dashoffset 0.5s ease',
          }}
          strokeLinecap="round"
          className={colorClassName}
        />
      </svg>
      {showLabel && (
        <span
          className="absolute font-semibold text-white tabular-nums"
          style={{ fontSize: Math.max(8, Math.round(size * 0.25)) }}
        >
          {Math.round(p)}%
        </span>
      )}
    </div>
  );
};

// ── Types ───────────────────────────────────────────────────────────────────

interface StudentProfile {
  id: string;
  email?: string;
  student_id?: string;
  student_name?: string;
}

interface StudentScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CourseCategory[];
  categoryId: string | null;
}

// ── Helper: calculate watch progress from max_progress_index ────────────────

function getWatchProgressPercent(maxProgressIndex: number, systemPrompt?: string): number {
  const script = systemPrompt ? parseLessonScript(systemPrompt) : [];
  if (!script.length || script.length <= 1) return 0;

  const speechIdxs = script.map((a: any, i: number) => (a.type === 'speech' ? i : -1)).filter((i: number) => i >= 0);
  if (speechIdxs.length <= 1) return 0;

  let speechIdx = 0;
  const foundIdx = speechIdxs.findIndex((sp: number) => sp >= maxProgressIndex);
  if (foundIdx === -1) speechIdx = speechIdxs.length - 1;
  else if (speechIdxs[foundIdx] === maxProgressIndex) speechIdx = foundIdx;
  else speechIdx = Math.max(0, foundIdx - 1);

  const pct = (speechIdx / (speechIdxs.length - 1)) * 100;
  return clamp01(pct);
}

// ── Main Component ──────────────────────────────────────────────────────────

export const StudentScoreModal: React.FC<StudentScoreModalProps> = ({ isOpen, onClose, categories, categoryId }) => {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [records, setRecords] = useState<StudentLessonRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'name' | 'totalScore'>('totalScore');
  const [sortAsc, setSortAsc] = useState(false);

  // Fetch all student profiles and their lesson records
  const fetchData = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      // Fetch student profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, student_id, student_name')
        .eq('role', 'student');

      if (profileError) {
        console.error('Error fetching student profiles:', profileError);
      } else {
        setStudents((profileData as StudentProfile[]) ?? []);
      }

      // Fetch all student lesson records
      const { data: recordData, error: recordError } = await supabase
        .from('student_lesson_records')
        .select('*');

      if (recordError) {
        console.error('Error fetching student records:', recordError);
      } else {
        setRecords((recordData as StudentLessonRecord[]) ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch student data:', err);
    }
    setLoading(false);
  }, [isOpen]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build a map: user_id -> StudentLessonRecord[]
  const recordsByUserId = useMemo(() => {
    const m = new Map<string, StudentLessonRecord[]>();
    records.forEach(r => {
      const list = m.get(r.user_id) ?? [];
      list.push(r);
      m.set(r.user_id, list);
    });
    return m;
  }, [records]);

  // Get the current category name
  const currentCategory = useMemo(() => {
    if (!categoryId) return null;
    return categories.find(c => c.id === categoryId) ?? null;
  }, [categories, categoryId]);

  // Get lessons filtered by the selected category
  const allLessons = useMemo(() => {
    const lessons: { id: string; title: string; category_name: string; system_prompt: string }[] = [];
    categories.forEach(cat => {
      // Only include lessons from the selected category
      if (categoryId && cat.id !== categoryId) return;
      (cat.lessons ?? []).forEach(lesson => {
        lessons.push({
          id: lesson.id,
          title: lesson.title,
          category_name: cat.name,
          system_prompt: lesson.system_prompt,
        });
      });
    });
    return lessons;
  }, [categories, categoryId]);

  // Calculate student total score and per-lesson details
  const studentScores = useMemo(() => {
    return students.map(student => {
      const studentRecords = recordsByUserId.get(student.id) ?? [];
      const recordByLessonId = new Map<string, StudentLessonRecord>();
      studentRecords.forEach(r => recordByLessonId.set(r.lesson_id, r));

      let totalWatchProgress = 0;
      let totalQuizScore = 0;
      let lessonCount = 0;

      const lessonDetails = allLessons.map(lesson => {
        const r = recordByLessonId.get(lesson.id);
        const maxIdx = Number(r?.max_progress_index ?? 0);
        const watchProgress = getWatchProgressPercent(maxIdx, lesson.system_prompt);
        const quizScore = clamp01(Number(r?.quiz_total_score ?? 0));
        const lessonScore = Math.round(watchProgress * 0.7 + quizScore * 0.3);
        const completed = !!r?.completed_at;

        totalWatchProgress += watchProgress;
        totalQuizScore += quizScore;
        lessonCount++;

        return {
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          categoryName: lesson.category_name,
          watchProgress,
          quizScore,
          lessonScore,
          completed,
          maxProgressIndex: maxIdx,
          updatedAt: r?.updated_at,
        };
      });

      // Total score = average of all lesson scores
      const totalScore = lessonCount > 0
        ? Math.round((totalWatchProgress * 0.7 + totalQuizScore * 0.3) / lessonCount * (lessonCount > 0 ? 1 : 0))
        : 0;
      
      // Actually, calculate as average of individual lesson scores for consistency with CourseSelector
      const totalScoreCorrect = lessonCount > 0
        ? Math.round(lessonDetails.reduce((sum, d) => sum + d.lessonScore, 0) / lessonCount)
        : 0;

      return {
        student,
        totalScore: totalScoreCorrect,
        lessonDetails,
        completedLessons: lessonDetails.filter(d => d.completed).length,
        totalLessons: lessonCount,
      };
    });
  }, [students, recordsByUserId, allLessons]);

  // Sort students
  const sortedStudents = useMemo(() => {
    const sorted = [...studentScores];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        const nameA = a.student.student_name ?? a.student.email ?? '';
        const nameB = b.student.student_name ?? b.student.email ?? '';
        cmp = nameA.localeCompare(nameB, 'zh-CN');
      } else {
        cmp = a.totalScore - b.totalScore;
      }
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [studentScores, sortField, sortAsc]);

  const handleSort = (field: 'name' | 'totalScore') => {
    if (sortField === field) {
      setSortAsc(prev => !prev);
    } else {
      setSortField(field);
      setSortAsc(field === 'name'); // name default asc, score default desc
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className="glass-card p-0 max-w-5xl w-11/12 relative text-slate-300 modal-content animate-fade-in-scale max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 pb-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold modern-title">学生成绩总览</h2>
              <p className="text-white/50 text-sm mt-0.5">
                {currentCategory ? `「${currentCategory.name}」课程进度和答题成绩` : '查看所有学生的课程进度和答题成绩'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors group" aria-label="关闭">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white/60 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Score explanation */}
        <div className="px-6 pt-4 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-white/40 bg-white/5 rounded-lg px-3 py-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>成绩计算：每节课观看进度占 70%，答题最高分占 30%；总成绩为所有课程的平均分。</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center space-y-4">
                <div className="loading-dots mx-auto">
                  <span></span><span></span><span></span>
                </div>
                <p className="text-white/50 font-medium">正在加载学生数据...</p>
              </div>
            </div>
          ) : sortedStudents.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-white/40 font-medium">暂无学生数据</p>
                <p className="text-white/30 text-sm mt-1">等待学生注册并开始学习后即可查看成绩</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {/* Table Header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2 text-xs font-semibold text-white/50 uppercase tracking-wider">
                <button onClick={() => handleSort('name')} className="text-left flex items-center gap-1 hover:text-white/70 transition-colors">
                  学生
                  {sortField === 'name' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${sortAsc ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                    </svg>
                  )}
                </button>
                <button onClick={() => handleSort('totalScore')} className="text-left flex items-center gap-1 hover:text-white/70 transition-colors">
                  总成绩
                  {sortField === 'totalScore' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${sortAsc ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                    </svg>
                  )}
                </button>
                <span>完成课次</span>
                <span>学号</span>
                <span className="w-8"></span>
              </div>

              {/* Student Rows */}
              {sortedStudents.map(({ student, totalScore, lessonDetails, completedLessons, totalLessons }) => {
                const isExpanded = expandedStudentId === student.id;
                const displayName = student.student_name || student.email?.split('@')[0] || '未知学生';

                return (
                  <div key={student.id} className="rounded-xl border border-white/10 overflow-hidden transition-all">
                    {/* Student Summary Row */}
                    <div
                      className={`grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 items-center cursor-pointer transition-colors ${isExpanded ? 'bg-purple-500/10 border-b border-white/10' : 'bg-white/5 hover:bg-white/8'}`}
                      onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                    >
                      {/* Student Name + Avatar */}
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">{displayName}</p>
                          {student.email && <p className="text-xs text-white/40 truncate">{student.email}</p>}
                        </div>
                      </div>

                      {/* Total Score with mini progress ring */}
                      <div className="flex items-center gap-2">
                        <ProgressRing
                          progress={totalScore}
                          size={32}
                          strokeWidth={3}
                          colorClassName={totalScore >= 60 ? 'text-emerald-400' : totalScore >= 30 ? 'text-yellow-400' : 'text-red-400'}
                          trackClassName="text-slate-700/60"
                        />
                        <span className={`font-bold tabular-nums ${totalScore >= 60 ? 'text-emerald-400' : totalScore >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {totalScore}
                        </span>
                      </div>

                      {/* Completed Lessons */}
                      <div className="text-sm">
                        <span className="text-white/80 tabular-nums">{completedLessons}</span>
                        <span className="text-white/40"> / {totalLessons}</span>
                      </div>

                      {/* Student ID */}
                      <div className="text-sm text-white/50 tabular-nums">
                        {student.student_id || '-'}
                      </div>

                      {/* Expand Arrow */}
                      <div className="w-8 flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-4 w-4 text-white/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded: Per-lesson Details */}
                    {isExpanded && (
                      <div className="bg-slate-800/50 p-4 animate-fade-in">
                        {lessonDetails.length === 0 ? (
                          <p className="text-white/40 text-sm text-center py-4">暂无课程数据</p>
                        ) : (
                          <div className="space-y-2">
                            {/* Lesson Detail Header */}
                            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-3 py-1 text-xs font-semibold text-white/40">
                              <span>课程名称</span>
                              <span className="text-center">观看进度</span>
                              <span className="text-center">答题成绩</span>
                              <span className="text-center">本课成绩</span>
                              <span className="text-center">状态</span>
                            </div>
                            {lessonDetails.map(detail => (
                              <div
                                key={detail.lessonId}
                                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-3 py-2.5 bg-white/5 rounded-lg items-center hover:bg-white/8 transition-colors"
                              >
                                {/* Lesson Title */}
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white truncate">{detail.lessonTitle}</p>
                                  <p className="text-xs text-white/30">{detail.categoryName}</p>
                                </div>

                                {/* Watch Progress */}
                                <div className="flex items-center justify-center gap-1.5">
                                  <ProgressRing
                                    progress={detail.watchProgress}
                                    size={24}
                                    strokeWidth={2.5}
                                    colorClassName="text-cyan-400"
                                    trackClassName="text-slate-700/50"
                                    showLabel
                                  />
                                </div>

                                {/* Quiz Score */}
                                <div className="flex items-center justify-center gap-1.5">
                                  <ProgressRing
                                    progress={detail.quizScore}
                                    size={24}
                                    strokeWidth={2.5}
                                    colorClassName="text-emerald-400"
                                    trackClassName="text-slate-700/50"
                                    showLabel
                                  />
                                </div>

                                {/* Lesson Score */}
                                <div className="text-center">
                                  <span className={`font-bold tabular-nums text-sm ${detail.lessonScore >= 60 ? 'text-emerald-400' : detail.lessonScore >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {detail.lessonScore}
                                  </span>
                                </div>

                                {/* Status */}
                                <div className="text-center">
                                  {detail.completed ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      已完成
                                    </span>
                                  ) : detail.watchProgress > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      进行中
                                    </span>
                                  ) : (
                                    <span className="text-xs text-white/30">未开始</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
