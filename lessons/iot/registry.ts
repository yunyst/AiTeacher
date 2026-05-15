import type { AIAction } from '../../types';
import type { CourseCategory } from '../../types';
import { supabase } from '../../services/supabaseClient';

export type IotLessonBundle = {
  id: string;
  title: string;
  lessonScript: AIAction[];
  lessonSummary: string;
};

/**
 * 安全解析课程脚本 JSON 字符串为 AIAction 数组。
 * 数据库 lessons.system_prompt 字段存储的是 JSON 格式的 AIAction[] 脚本。
 */
export function parseLessonScript(systemPrompt: string): AIAction[] {
  
  if (!systemPrompt || !systemPrompt.trim()) return [];
  try {
    
    const parsed = JSON.parse(systemPrompt);
    if (Array.isArray(parsed)) return parsed as AIAction[];
    return [];
  } catch(e) {
    // 不是合法 JSON，返回空脚本
    console.warn('[registry] Failed to parse lesson script as JSON, returning empty script',e);
    return [];
  }
}

/**
 * 从数据库获取课程分类和课程列表
 */
export async function fetchIotCourseCategories(): Promise<CourseCategory[]> {
  const { data, error } = await supabase
    .from('course_categories')
    .select('*, lessons (*)');

  if (error) {
    console.error('[registry] Failed to fetch course categories:', error);
    return [];
  }
  return (data as CourseCategory[]) ?? [];
}

/**
 * 从数据库获取指定课程的脚本和摘要（异步版本，用于需要单独获取课程的场景）
 */
export async function fetchIotLessonBundle(lessonId: string | undefined): Promise<IotLessonBundle> {
  if (!lessonId) {
    return { id: '', title: '', lessonScript: [], lessonSummary: '' };
  }

  const { data, error } = await supabase
    .from('lessons')
    .select('id, title, system_prompt, lesson_summary')
    .eq('id', lessonId)
    .single();

  if (error || !data) {
    console.error('[registry] Failed to fetch lesson bundle:', error);
    return { id: lessonId, title: '', lessonScript: [], lessonSummary: '' };
  }

  return {
    id: data.id,
    title: data.title,
    lessonScript: parseLessonScript(data.system_prompt),
    lessonSummary: data.lesson_summary?.trim() ?? '',
  };
}

/**
 * 从已有的 Lesson 对象直接构建 IotLessonBundle（同步，无需额外数据库查询）
 * 适用于组件中已经持有 Lesson 对象的场景
 */
export function buildIotLessonBundleFromLesson(lesson: { id: string; title: string; system_prompt: string; lesson_summary: string }): IotLessonBundle {
  return {
    id: lesson.id,
    title: lesson.title,
    lessonScript: parseLessonScript(lesson.system_prompt),
    lessonSummary: lesson.lesson_summary?.trim() ?? '',
  };
}