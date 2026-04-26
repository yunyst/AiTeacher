import React, { useMemo, useState } from 'react';

export type QuizType = 'single' | 'multiple' | 'boolean';

export type QuizPayload = {
  quizId: string;
  type: QuizType;
  question: string;
  options?: string[];
  answer: number[];
  scoreWeight?: number;
  explanationCorrect?: string;
  explanationWrong?: string;
};

type QuizCardProps = {
  quiz: QuizPayload;
  isSubmitting?: boolean;
  onSubmit: (selectedIndexes: number[]) => void | Promise<void>;
  onContinue: () => void;
};

export const QuizCard: React.FC<QuizCardProps> = ({ quiz, isSubmitting = false, onSubmit, onContinue }) => {
  const options = useMemo(() => {
    if (quiz.type === 'boolean') return ['正确', '错误'];
    return quiz.options ?? [];
  }, [quiz.type, quiz.options]);

  const [selected, setSelected] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const toggle = (idx: number) => {
    if (submitted) return;
    setSelected(prev => {
      if (quiz.type === 'multiple') {
        return prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx];
      }
      return [idx];
    });
  };

  const isCorrect = useMemo(() => {
    if (!submitted) return false;
    return selected.length === quiz.answer.length && quiz.answer.every(a => selected.includes(a));
  }, [submitted, selected, quiz.answer]);

  const canSubmit = selected.length > 0 && !isSubmitting && !submitted;

  const explanation = submitted
    ? (isCorrect ? quiz.explanationCorrect : quiz.explanationWrong)
    : undefined;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="w-[min(720px,92vw)] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="p-5 border-b border-slate-700">
          <div className="text-xs text-slate-400 mb-2">
            {quiz.type === 'single' && '单选题'}
            {quiz.type === 'multiple' && '多选题'}
            {quiz.type === 'boolean' && '判断题'}
          </div>
          <div className="text-lg font-semibold text-slate-100 whitespace-pre-wrap">{quiz.question}</div>
          {quiz.type === 'multiple' && (
            <div className="text-xs text-slate-400 mt-2">请选择所有你认为正确的选项，然后点击提交。</div>
          )}
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {options.map((opt, idx) => {
              const active = selected.includes(idx);
              const isRight = quiz.answer.includes(idx);
              const showKey = submitted;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggle(idx)}
                  disabled={isSubmitting}
                  className={[
                    'text-left rounded-xl border px-4 py-3 transition-all',
                    'focus:outline-none focus:ring-2 focus:ring-cyan-400/60',
                    showKey
                      ? (isRight
                          ? 'border-emerald-400/80 bg-emerald-500/10 text-slate-50'
                          : active
                            ? 'border-rose-400/80 bg-rose-500/10 text-slate-50'
                            : 'border-slate-700 bg-slate-950/30 text-slate-300')
                      : (active
                          ? 'border-cyan-400 bg-cyan-500/15 text-slate-50'
                          : 'border-slate-700 bg-slate-950/30 text-slate-200 hover:border-slate-500'),
                    isSubmitting ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <div className="font-medium">{opt}</div>
                </button>
              );
            })}
          </div>

          {submitted && (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/30 p-4">
              <div className={`font-semibold ${isCorrect ? 'text-emerald-300' : 'text-rose-300'}`}>
                {isCorrect ? '回答正确' : '回答错误'}
              </div>
              {explanation && (
                <div className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">{explanation}</div>
              )}
              {!explanation && (
                <div className="mt-2 text-sm text-slate-400">已标出正确选项（绿色）与本次选择（红色）。</div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-700 flex items-center justify-end gap-3">
          {!submitted ? (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={async () => {
                setSubmitted(true);
                await onSubmit(selected);
              }}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-xl shadow"
            >
              {isSubmitting ? '提交中…' : '提交答案'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onContinue}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow"
            >
              继续上课
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

