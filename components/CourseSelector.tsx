import React, { useMemo, useState } from 'react';
import type { CourseCategory, Lesson } from '../types';
import { parseLessonScript } from '../lessons/iot/registry';
import type { StudentLessonRecord } from '../services/studentRecords';

interface CourseSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CourseCategory[];
  currentLessonId: string;
  onSelectLesson: (lesson: Lesson) => void;
  studentLessonRecords: StudentLessonRecord[];
}

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

export const CourseSelector: React.FC<CourseSelectorProps> = ({ isOpen, onClose, categories, currentLessonId, onSelectLesson, studentLessonRecords }) => {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const recordByLessonId = useMemo(() => {
    const m = new Map<string, StudentLessonRecord>();
    (studentLessonRecords ?? []).forEach(r => m.set(r.lesson_id, r));
    return m;
  }, [studentLessonRecords]);

  const getWatchProgressPercent = (lessonId: string, systemPrompt?: string) => {
    const r = recordByLessonId.get(lessonId);
    const maxIdx = Number(r?.max_progress_index ?? 0);
    const script = systemPrompt ? parseLessonScript(systemPrompt) : [];
    if (!script.length || script.length <= 1) return 0;

    // Only count speech actions (same logic as the progress bar in StudentApp)
    const speechIdxs = script.map((a: any, i: number) => (a.type === 'speech' ? i : -1)).filter((i: number) => i >= 0);
    if (speechIdxs.length <= 1) return 0;

    // Map maxIdx to speech index (same as scriptIndexToSpeechIndex in StudentApp)
    let speechIdx = 0;
    const foundIdx = speechIdxs.findIndex((sp: number) => sp >= maxIdx);
    if (foundIdx === -1) speechIdx = speechIdxs.length - 1;
    else if (speechIdxs[foundIdx] === maxIdx) speechIdx = foundIdx;
    else speechIdx = Math.max(0, foundIdx - 1);

    const pct = (speechIdx / (speechIdxs.length - 1)) * 100;
    return clamp01(pct);
  };

  const getQuizScorePercent = (lessonId: string) => {
    const r = recordByLessonId.get(lessonId);
    return clamp01(Number(r?.quiz_total_score ?? 0));
  };

  // Effect to open the first category when categories are loaded (only once)
  React.useEffect(() => {
    if (categories.length > 0 && !hasInitialized) {
        setOpenCategoryId(categories[0].id);
        setHasInitialized(true);
    }
  }, [categories, hasInitialized]);

  const toggleCategory = (categoryId: string) => {
    setOpenCategoryId(prevId => prevId === categoryId ? null : categoryId);
  };

  const getLessonScore = (lessonId: string, systemPrompt?: string) => {
    const watch = getWatchProgressPercent(lessonId, systemPrompt);
    const quiz = getQuizScorePercent(lessonId);
    return Math.round(watch * 0.7 + quiz * 0.3);
  };

  const getCategoryTotalScore = (category: CourseCategory) => {
    const lessons = category.lessons ?? [];
    if (lessons.length === 0) return 0;
    const sum = lessons.reduce((acc, l) => acc + getLessonScore(l.id, l.system_prompt), 0);
    return Math.round(sum / lessons.length);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full w-72 max-w-[80vw] bg-slate-900 shadow-xl z-[70] transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex justify-between items-center p-3 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-base font-bold text-cyan-400">课程列表</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-700 transition-colors" aria-label="关闭课程选择">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
        </div>



        {/* Scrollable Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-1.5">
          {categories.map(category => (
            <div key={category.id}>
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full text-left flex justify-between items-center p-2 rounded-lg hover:bg-slate-800 transition-colors text-sm font-semibold text-slate-300"
              >
                <span>{category.name}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 flex-shrink-0 ${openCategoryId === category.id ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {openCategoryId === category.id && (
                <div className="pl-3 mt-1 border-l-2 border-slate-700 space-y-1">
                  {(() => {
                    const totalScore = getCategoryTotalScore(category);
                    return (
                      <div className="p-2 border-b border-slate-700 bg-slate-800/30 mb-2 rounded-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-semibold text-white">
                              成绩：<span className="text-cyan-300 tabular-nums">{totalScore}</span>
                            </div>
                            {/* Tooltip (问号悬浮灰字) */}
                            <div className="relative group">
                              <button
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-700/60 text-slate-300 hover:text-cyan-300 hover:bg-slate-700 transition-colors"
                                aria-label="成绩计算说明"
                                type="button"
                              >
                                ?
                              </button>
                              <div className="absolute left-1/2 -translate-x-1/2 max-w-[180px] w-max  mt-2 w-56 p-2 bg-slate-800 border border-slate-700 text-[11px] leading-snug text-slate-300 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                <span className="text-slate-400">
                                  成绩计算：每节课观看进度占 70%，答题最高分占 30%；总成绩为所有课程的平均分。
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 总课题下方：总成绩进度环 */}
                        <div className="mt-2 flex items-center justify-center">
                          <div className="flex flex-col items-center">
                            <ProgressRing
                              progress={totalScore}
                              size={56}
                              strokeWidth={4}
                              colorClassName="text-cyan-500"
                              trackClassName="text-slate-700/60"
                              showLabel
                            />
                            <div className="mt-1 text-[11px] text-slate-300">总成绩</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {category.lessons && category.lessons.length > 0 ? (
                    [...category.lessons].sort((a, b) => a.sort_order - b.sort_order).map(lesson => {
                      const watchProgress = getWatchProgressPercent(lesson.id, lesson.system_prompt);
                      const quizScore = getQuizScorePercent(lesson.id);
                      const lessonScore = Math.round(watchProgress * 0.7 + quizScore * 0.3);
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => onSelectLesson(lesson)}
                          className={`w-full text-left p-2 rounded-md transition-colors text-slate-200 flex items-center gap-2 ${currentLessonId === lesson.id ? 'bg-cyan-600/90 text-white' : 'hover:bg-slate-800/70'}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate">{lesson.title}</div>
                            <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                              本节成绩：<span className="text-slate-200">{lessonScore}</span>
                            </div>
                          </div>

                          {/* 两个进度环：观看进度 / 答题分数 */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex flex-col items-center">
                              <ProgressRing
                                progress={watchProgress}
                                size={28}
                                strokeWidth={3}
                                colorClassName={currentLessonId === lesson.id ? 'text-white' : 'text-cyan-500'}
                                trackClassName={currentLessonId === lesson.id ? 'text-white/25' : 'text-slate-700/70'}
                                showLabel
                              />
                              <div className={`mt-0.5 text-[10px] ${currentLessonId === lesson.id ? 'text-white/90' : 'text-slate-400'}`}>
                                观看
                              </div>
                            </div>
                            <div className="flex flex-col items-center">
                              <ProgressRing
                                progress={quizScore}
                                size={28}
                                strokeWidth={3}
                                colorClassName={currentLessonId === lesson.id ? 'text-white' : 'text-emerald-500'}
                                trackClassName={currentLessonId === lesson.id ? 'text-white/25' : 'text-slate-700/70'}
                                showLabel
                              />
                              <div className={`mt-0.5 text-[10px] ${currentLessonId === lesson.id ? 'text-white/90' : 'text-slate-400'}`}>
                                答题
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <p className="p-2 text-slate-500 italic text-xs">暂无课程</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </>
  );
};