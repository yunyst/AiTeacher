import { supabase } from './supabaseClient';

export type StudentLessonRecord = {
  user_id: string;
  lesson_id: string;
  max_progress_index: number;
  quiz_total_score: number;
  quiz_attempts?: Record<string, number>;
  completed_at?: string | null;
  updated_at?: string;
};

export async function fetchStudentLessonRecord(userId: string, lessonId: string) {
  return await supabase
    .from('student_lesson_records')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .maybeSingle();
}

export async function upsertMaxProgressIndex(userId: string, lessonId: string, newIndex: number) {
  return await supabase
    .from('student_lesson_records')
    .upsert(
      { user_id: userId, lesson_id: lessonId, max_progress_index: newIndex },
      { onConflict: 'user_id,lesson_id', ignoreDuplicates: false }
    )
    .select('*')
    .single();
}

export async function submitQuizAttempt(params: {
  userId: string;
  lessonId: string;
  quizId: string;
  earnedScore: number; // 0..100 (this quiz's contribution)
}) {
  // Read-modify-write is ok here (single-user row, small json).
  const { data: existing, error: readError } = await fetchStudentLessonRecord(params.userId, params.lessonId);
  if (readError) return { data: null, error: readError };

  const attempts: Record<string, number> = (existing?.quiz_attempts as any) ?? {};
  const prev = attempts[params.quizId] ?? 0;
  // Keep raw score (do NOT round individual quiz scores — rounding is done only on the final total)
  const next = Math.max(prev, params.earnedScore);
  attempts[params.quizId] = next;

  const total = Math.min(
    100,
    Math.max(0, Math.round(Object.values(attempts).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0)))
  );

  return await supabase
    .from('student_lesson_records')
    .upsert(
      {
        user_id: params.userId,
        lesson_id: params.lessonId,
        quiz_attempts: attempts,
        quiz_total_score: total,
      },
      { onConflict: 'user_id,lesson_id', ignoreDuplicates: false }
    )
    .select('*')
    .single();
}

