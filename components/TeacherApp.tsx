import React, { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import type { CourseCategory, Profile, Lesson, LessonData } from '../types';
import { LessonEditor } from './LessonEditor';
import { StudentScoreModal } from './StudentScoreModal';

// REFACTOR: The help modal is updated with new instructions for the simplified, sequential JSON action system.

const TeacherHelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center modal-overlay animate-fade-in" onClick={onClose}>
        <div className="glass-card p-8 max-w-4xl w-11/12 relative text-slate-300 modal-content animate-fade-in-scale max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold modern-title">课程脚本创建指南</h2>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors group" aria-label="关闭">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white/60 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-base">
                <p>您的课程脚本（System Prompt）是驱动AI导师的核心。AI的每一个回复都必须是一个独立的、单一的动作指令，格式为JSON对象。</p>
                
                <div className="p-3 bg-red-900/50 rounded-lg border border-red-700">
                    <h3 className="font-semibold text-red-300 mb-2">⚠️ 重要约定</h3>
                    <ul className="list-disc list-inside space-y-2 text-sm">
                        <li><strong>输入格式严格要求：</strong>课程脚本必须是严格的 JSON 格式，任何多余的文本、注释或格式错误都会导致解析失败。</li>
                        <li><strong>视频后必须 show_pdf：</strong>在播放完视频 (<code>show_video</code>) 之后，如果需要重新展示 PDF，必须使用 <code>show_pdf</code> 指令，不能直接使用 <code>goto_page</code>。</li>
                        <li><strong>课程必须以此结尾：</strong>每个课程脚本的最后两条指令必须是：
                            <code className="block bg-slate-900 p-2 mt-1 rounded text-yellow-300 whitespace-pre-wrap">{`{
  "type": "command",
  "payload": { "name": "complete_lesson", "args": {} }
},
{
  "type": "command",
  "payload": { "name": "start_qa", "args": {} }
}`}</code>
                        </li>
                    </ul>
                </div>

                <div className="p-3 bg-slate-700/50 rounded-lg">
                    <h3 className="font-semibold text-white mb-2">核心JSON动作结构</h3>
                    <p className="mb-2">AI的每一个回复都必须是以下两种结构之一：</p>
                    <code className="block bg-slate-900 p-2 rounded text-sm text-yellow-300 whitespace-pre-wrap">
{`// 用于对话
{
  "type": "speech",
  "payload": { "text": "这是AI导师要讲的话。" }
}

// 用于执行界面操作
{
  "type": "command",
  "payload": {
    "name": "command_name",
    "args": { "key": "value" }
  }
}`}
                    </code>
                </div>

                <div className="p-3 bg-slate-700/50 rounded-lg">
                    <h3 className="font-semibold text-white mb-2">可用指令 (`name`) 及其 `args`</h3>
                    <ul className="space-y-2 text-sm">
                        <li><strong>show_pdf</strong>: 在黑板上显示PDF。
                            <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300">{`"args": {"url": "...", "page": 1}`}</code>
                        </li>
                        <li><strong>goto_page</strong>: 翻到PDF的指定页码。
                             <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300">{`"args": {"page": 3}`}</code>
                        </li>
                        <li><strong>show_video</strong>: 在黑板上播放视频。
                            <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300">{`"args": {"url": "..."}`}</code>
                        </li>
                        <li><strong>draw</strong>: 在黑板上绘制图形或文字。
                             <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300">{`"args": {"operations": [ ... ]}`}</code>
                        </li>
                         <li><strong>clear_blackboard</strong>: 清空黑板（包括PDF/视频和所有绘图）。
                             <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300">{`"args": {}`}</code>
                        </li>
                    </ul>
                </div>
                
                <div className="p-3 bg-slate-700/50 rounded-lg">
                    <h3 className="font-semibold text-white mb-2">绘制操作 (`draw` command)</h3>
                    <p>`draw` 指令的 `operations` 是一个操作数组，会按顺序执行。坐标和尺寸都使用百分比（0-100），使布局自适应。</p>
                     <ul className="space-y-2 text-sm mt-2">
                        <li><strong>background</strong>: 改变黑板背景色。
                            <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300">{`{"type": "background", "color": "black" | "white" | "transparent"}`}</code>
                        </li>
                         <li><strong>clear</strong>: 清除所有之前的绘图（不影响背景色）。
                            <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300">{`{"type": "clear"}`}</code>
                        </li>
                        <li><strong>text</strong>: 显示文字或LaTeX公式。
                            <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300">{`{"type": "text", "text": "E = mc^2", "x": 50, "y": 10, "fontSize": 24, "color": "#FFFF00"}`}</code>
                        </li>
                         <li><strong>line</strong>: 画一条线。
                            <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300">{`{"type": "line", "x1": 10, "y1": 20, "x2": 90, "y2": 20, "lineWidth": 3, "color": "white"}`}</code>
                        </li>
                         <li><strong>rect</strong>: 画一个矩形。
                            <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300">{`{"type": "rect", "x": 10, "y": 30, "width": 80, "height": 40, "fill": "rgba(0, 100, 255, 0.5)"}`}</code>
                        </li>
                         <li><strong>circle</strong>: 画一个圆形。
                            <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300">{`{"type": "circle", "cx": 50, "cy": 50, "radius": 20, "color": "red", "lineWidth": 2}`}</code>
                        </li>
                    </ul>
                </div>

                <div className="p-3 bg-indigo-900/50 rounded-lg border border-indigo-700">
                    <h3 className="font-semibold text-indigo-300 mb-2">题型选择指南</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-800 rounded-lg">
                            <h4 className="text-purple-300 font-medium mb-1">🎯 计分测验: <code>show_quiz</code></h4>
                            <p className="text-sm text-slate-400">弹窗式题目，会计入成绩。适用于：</p>
                            <ul className="list-disc list-inside text-xs text-slate-400 mt-1">
                                <li>需要评估掌握程度的单选/多选/判断题</li>
                                <li>正式的知识点考核</li>
                                <li>需要记录分数的场景</li>
                            </ul>
                        </div>
                        <div className="p-3 bg-slate-800 rounded-lg">
                            <h4 className="text-cyan-300 font-medium mb-1">💬 互动讨论: <code>present_choices</code> / <code>present_multi_choices</code></h4>
                            <p className="text-sm text-slate-400">非弹窗式，不计算分数。<strong>推荐用于开放性互动题目。</strong></p>
                            <ul className="list-disc list-inside text-xs text-slate-400 mt-1">
                                <li>课堂投票、意见收集、开放性讨论</li>
                                <li>非标准答案的思考题</li>
                                <li>引导学生主动思考的互动环节</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="p-3 bg-slate-700/50 rounded-lg">
                    <h3 className="font-semibold text-white mb-2">计分测验详细说明 (`show_quiz`)</h3>
                    <p className="text-sm mb-2">用于需要评估和记录分数的正式题目。</p>
                    <ul className="space-y-2 text-sm">
                        <li><strong>show_quiz (单选)</strong>:
                            <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300 whitespace-pre-wrap">{`"args": {
  "quizId": "q1",
  "type": "single",
  "question": "2+2等于几？",
  "options": ["3", "4", "5"],
  "answer": [1],
  "scoreWeight": 1,
  "explanationCorrect": "正确！",
  "explanationWrong": "再想想，2+2=4。"
}`}</code>
                        </li>
                        <li><strong>show_quiz (多选)</strong>:
                            <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300 whitespace-pre-wrap">{`"args": {
  "quizId": "q2",
  "type": "multiple",
  "question": "以下哪些是水果？",
  "options": ["苹果", "香蕉", "胡萝卜"],
  "answer": [0, 1],
  "scoreWeight": 1,
  ...
}`}</code>
                        </li>
                        <li><strong>show_quiz (判断)</strong>:
                            <code className="block bg-slate-900 p-2 mt-1 rounded text-cyan-300 whitespace-pre-wrap">{`"args": {
  "quizId": "q3",
  "type": "boolean",
  "question": "地球是圆的。",
  "answer": [0], // 0表示“对”
  "scoreWeight": 1,
  ...
}`}</code>
                        </li>
                    </ul>
                </div>

                <div className="p-3 bg-cyan-900/50 rounded-lg border border-cyan-700">
                    <h3 className="font-semibold text-cyan-300 mb-2">课程流程 (`next_step` 约定)</h3>
                    <p>课程是按顺序进行的。在一个动作（如 `speech` 或 `show_pdf`）完成后，应用会自动向AI发送 `next_step` 消息以请求下一步。您需要在脚本中定义当AI收到 `next_step` 时应该返回哪个动作。</p>
                    <p className="mt-2">这个流程只在 <code>present_choices</code>、<code>present_multi_choices</code> 和 <code>show_quiz</code> 命令处暂停，等待用户的实际选择作为下一条消息。</p>
                    <blockquote className="mt-2 border-l-4 border-cyan-500 pl-4 py-2 bg-slate-900 rounded-r-lg">
                        <p className="italic text-slate-300">"当用户说 'next_step' 时，你的回复必须是下一个 'command' 动作，用于翻到PDF的第2页。"</p>
                    </blockquote>
                </div>

                <div className="p-3 bg-slate-700/50 rounded-lg">
                    <h3 className="font-semibold text-white mb-2">完整脚本示例</h3>
                    <p className="text-sm mb-2">下面是一个完整的课程脚本JSON数组，展示了常用类型指令的用法和顺序。</p>
                    <code className="block bg-slate-900 p-2 rounded text-sm text-yellow-300 whitespace-pre-wrap overflow-x-auto">{`[
    {
      "type": "command",
      "payload": {
        "name": "show_pdf",
        "args": {
          "url": "__PDF_PAGE_1__",
          "page": 1
        }
      }
    },
    {
      "type": "speech",
      "payload": { "text": "同学们好！" }
    },
    {
      "type": "command",
      "payload": {
        "name": "present_choices",
        "args": {
          "options": ["准备好了", "先自己看两眼讲义"]
        }
      }
    },
    {
      "type": "command",
      "payload": {
        "name": "goto_page",
        "args": { "page": 2 }
      }
    },
    {
      "type": "speech",
      "payload": { "text": "视频播放" }
    },
    {
      "type": "command",
      "payload": {
        "name": "show_video",
        "args": {
          "url": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
        }
      }
    },
    {
      "type": "command",
      "payload": {
        "name": "show_pdf",
        "args": {
          "url": "__PDF_PAGE_1__",
          "page": 1
        }
      }
    },
    {
      "type": "speech",
      "payload": { "text": "单选题。" }
    },
    {
      "type": "command",
      "payload": {
        "name": "show_quiz",
        "args": {
          "quizId": "iot1_q1",
          "type": "single",
          "question": "RFID 读卡与人体检测在 IoT 分层中通常更接近哪一层？",
          "options": ["应用层", "感知层", "物理层（仅指电缆）", "传输层（仅指 TCP）"],
          "answer": [1],
          "scoreWeight": 1,
          "explanationCorrect": "正确。RFID 读卡与人体检测属于对物理世界的感知与采集，通常划在感知层。",
          "explanationWrong": "应用层更偏向小程序/业务展示；感知层才是传感器与识别设备所在。"
        }
      }
    },
    {
      "type": "command",
      "payload": {
        "name": "goto_page",
        "args": { "page": 5 }
      }
    },
    {
      "type": "speech",
      "payload": { "text": "多选题" }
    },
    {
      "type": "command",
      "payload": {
        "name": "show_quiz",
        "args": {
          "quizId": "iot1_q2",
          "type": "multiple",
          "question": "请选出「本课设中一定会涉及」的环节（可多选）。",
          "options": [
            "SPI 连接 RFID（ESP32 与 RFID 模块的板级连接）",
            "RFID 读卡后上报（MQTT/HTTP）",
            "OneNet 平台侧接收/管理数据与下发",
            "小程序端拉取并展示/交互座位状态",
            "仅模拟电路调谐，不涉及软件与平台",
            "仅蓝牙音频耳机配对"
          ],
          "answer": [0, 1, 2, 3],
          "scoreWeight": 1,
          "explanationCorrect": "很好。课设中既有 SPI 等板级连接，也有云平台协议与小程序端 API 消费，体现端到端数据流。",
          "explanationWrong": "本课设核心是嵌入式采集 + 云平台 + 小程序，而不是纯模拟或音频场景。"
        }
      }
    },
    {
      "type": "command",
      "payload": {
        "name": "goto_page",
        "args": { "page": 8 }
      }
    },
    {
      "type": "speech",
      "payload": { "text": "判断题" }
    },
    {
      "type": "command",
      "payload": {
        "name": "show_quiz",
        "args": {
          "quizId": "iot1_q3",
          "type": "boolean",
          "question": "微信小程序主要负责座位状态展示与交互，可视为应用层的一种实现形式。",
          "answer": [0],
          "scoreWeight": 1,
          "explanationCorrect": "对。小程序面向最终用户，完成可视化与操作，是典型的应用层软件形态之一。",
          "explanationWrong": "应用层不仅指“云”，也包括手机侧/网页侧业务软件；本课设小程序正是应用层。"
        }
      }
    },
    {
      "type": "speech",
      "payload": { "text": "投票题" }
    },
    {
      "type": "command",
      "payload": {
        "name": "present_multi_choices",
        "args": {
          "options": ["RFID 读卡与 SPI", "红外检测与状态机", "MQTT/HTTP 与 OneNet", "小程序端数据绑定"]
        }
      }
    },
    {
      "type": "speech",
      "payload": {
        "text": "收到。刚才你们看到：PDF、黑板标注、视频播放、单选/多选/判断题、以及无标准答案的投票题，全部都能在同一节课的脚本里组织起来。\\n\\n本讲小结：记住三层分工与数据流，后面每一讲会分别深入 RFID、显示、传感、协议、状态机与小程序绑定。\\n\\n下节课见！"
      }
    },
    {
      "type": "command",
      "payload": { "name": "complete_lesson", "args": {} }
    },
    {
      "type": "command",
      "payload": { "name": "start_qa", "args": {} }
    }
  ]`}</code>
                </div>

                <div className="p-3 bg-slate-700/50 rounded-lg">
                    <h3 className="font-semibold text-white mb-2">完整 TypeScript 类型定义</h3>
                    <p className="text-sm mb-2">以下是系统中使用的 <code>AIAction</code> 类型定义可参考。</p>
                    <code className="block bg-slate-900 p-2 rounded text-sm text-green-300 whitespace-pre-wrap overflow-x-auto">{`export type AIAction = {
  type: 'speech';
  payload: {
    text: string;
  };
} | {
  type: 'command';
  payload: {
    name: 'show_pdf' | 'goto_page' | 'show_video' | 'present_choices' | 'present_multi_choices' | 'show_quiz' | 'clear_blackboard' | 'complete_lesson' | 'start_qa' | 'draw';
    // Use a flexible args object for different commands.
    args: {
      url?: string;
      page?: number;
      options?: string[];
      correctAnswer?: string;       // for single-choice / true-false
      correctAnswers?: string[];    // for multi-choice (present_multi_choices)
      operations?: DrawingOperation[];
      // show_quiz
      quizId?: string;
      type?: 'single' | 'multiple' | 'boolean';
      question?: string;
      answer?: number[]; // option indexes
      scoreWeight?: number;
      explanationCorrect?: string;
      explanationWrong?: string;
    };
  };
};`}</code>
                </div>
            </div>
        </div>
    </div>
);


export const TeacherApp: React.FC<{ session: Session; profile: Profile | null; }> = ({ session, profile }) => {
    const [categories, setCategories] = useState<CourseCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [showHelp, setShowHelp] = useState(false);
    const [showStudentScore, setShowStudentScore] = useState(false);
    const [scoreCategoryId, setScoreCategoryId] = useState<string | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
    const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);

    const fetchCourses = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('course_categories')
            .select(`*, lessons (*)`);
        
        if (error) {
            console.error("Error fetching courses:", error);
            alert("Failed to load course data.");
        } else {
            setCategories(data as CourseCategory[]);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchCourses();
    }, [fetchCourses]);

    const handleAddNewLesson = (categoryId: string) => {
        setCurrentLesson(null);
        setCurrentCategoryId(categoryId);
        setIsEditorOpen(true);
    };

    const handleEditLesson = (lesson: Lesson) => {
        setCurrentLesson(lesson);
        setCurrentCategoryId(lesson.category_id);
        setIsEditorOpen(true);
    };

    const handleCloseEditor = () => {
        setIsEditorOpen(false);
        setCurrentLesson(null);
        setCurrentCategoryId(null);
    };

    const handleSaveLesson = async (lessonData: LessonData) => {
        if (currentLesson) { // Editing existing lesson
            const { error } = await supabase
                .from('lessons')
                .update(lessonData)
                .eq('id', currentLesson.id);
            if (error) {
                alert('Error updating lesson: ' + error.message);
            }
        } else { // Creating new lesson
            const { error } = await supabase
                .from('lessons')
                .insert({ ...lessonData, category_id: currentCategoryId });
            if (error) {
                alert('Error creating lesson: ' + error.message);
            }
        }
        handleCloseEditor();
        fetchCourses();
    };

    const handleDeleteLesson = async (lessonId: string) => {
        const { error } = await supabase
            .from('lessons')
            .delete()
            .eq('id', lessonId);
        if (error) {
            alert('Error deleting lesson: ' + error.message);
        }
        handleCloseEditor();
        fetchCourses();
    };

    const handleAddNewCategory = async () => {
        const name = prompt("Enter the name for the new category:");
        if (name) {
            const { error } = await supabase
                .from('course_categories')
                .insert({ name });
            if (error) {
                alert('Error creating category: ' + error.message);
            } else {
                fetchCourses();
            }
        }
    };

    const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
        const confirmed = window.confirm(`确定要删除课程分类「${categoryName}」吗？该分类下的所有课程也会被一并删除，此操作不可撤销！`);
        if (!confirmed) return;

        const { error } = await supabase
            .from('course_categories')
            .delete()
            .eq('id', categoryId);
        if (error) {
            alert('删除分类失败: ' + error.message);
        } else {
            fetchCourses();
        }
    };

    return (
        <div className="min-h-screen text-white font-sans relative">
            {showHelp && <TeacherHelpModal onClose={() => setShowHelp(false)} />}
            {showStudentScore && <StudentScoreModal isOpen={showStudentScore} onClose={() => setShowStudentScore(false)} categories={categories} categoryId={scoreCategoryId} />}
            {isEditorOpen && (
                <LessonEditor 
                    lesson={currentLesson}
                    onSave={handleSaveLesson}
                    onClose={handleCloseEditor}
                    onDelete={handleDeleteLesson}
                />
            )}
            <header className="glass-card border-0 border-b border-white/10 p-6 flex justify-between items-center sticky top-0 z-50 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg animate-pulse-glow">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold modern-title">教师仪表盘</h1>
                        <p className="text-white/50 text-sm font-medium">课程内容管理中心</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {profile?.email && (
                        <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-xs font-bold">
                                {profile.email.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-white/80">{profile.email}</span>
                        </div>
                    )}
                    <button 
                        onClick={() => setShowHelp(true)}
                        className="modern-button-secondary flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="hidden sm:inline">课程脚本指南</span>
                    </button>
                    <button 
                        onClick={() => supabase.auth.signOut()} 
                        className="modern-button flex items-center gap-2" aria-label="登出">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="hidden sm:inline">登出</span>
                    </button>
                </div>
            </header>
            <main className="p-8 max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-3xl font-bold mb-2 modern-title">课程列表</h2>
                        <p className="text-white/50">管理和创建您的课程内容</p>
                    </div>
                    <button onClick={handleAddNewCategory} className="modern-button flex items-center gap-2 text-base">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        新增分类
                    </button>
                </div>

                {loading ? (
                     <div className="flex h-96 items-center justify-center">
                        <div className="text-center space-y-4">
                            <div className="loading-dots mx-auto">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                            <p className="text-white/50 font-medium">正在加载课程...</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {categories.map(category => (
                            <div key={category.id} className="glass-card p-6 card-hover-effect">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold gradient-text">{category.name}</h3>
                                            <p className="text-white/50 text-sm">{category.lessons.length} 个课程</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { setScoreCategoryId(category.id); setShowStudentScore(true); }} className="modern-button-secondary text-sm py-2 px-4 flex items-center gap-2 bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/50">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            查看成绩
                                        </button>
                                        <button onClick={() => handleAddNewLesson(category.id)} className="modern-button-secondary text-sm py-2 px-4 flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            新增课程
                                        </button>
                                        <button onClick={() => handleDeleteCategory(category.id, category.name)} className="text-sm py-2 px-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            删除分类
                                        </button>
                                    </div>
                                </div>
                                <div className="grid gap-4">
                                    {[...category.lessons].sort((a, b) => a.sort_order - b.sort_order).map(lesson => (
                                        <div key={lesson.id} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/8 transition-all cursor-pointer group" onClick={() => handleEditLesson(lesson)}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-lg font-bold text-white shadow-lg group-hover:scale-110 transition-transform">
                                                    {lesson.title.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-white group-hover:text-purple-400 transition-colors">{lesson.title}</p>
                                                    <p className="text-sm text-white/50 mt-1">{lesson.description}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={(e) => { e.stopPropagation(); handleEditLesson(lesson); }} className="p-2 rounded-lg hover:bg-white/10 transition-colors group-hover:bg-white/10">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/60 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {category.lessons.length === 0 && (
                                        <div className="text-center py-12 text-white/40">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                            </svg>
                                            <p className="font-medium">该分类下暂无课程</p>
                                            <p className="text-sm mt-1">点击"新增课程"开始创建</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {categories.length === 0 && (
                            <div className="glass-card p-12 text-center">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-6 animate-float">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold mb-3 gradient-text">还没有课程分类</h3>
                                <p className="text-white/50 mb-6">创建第一个分类开始您的课程创作之旅</p>
                                <button onClick={handleAddNewCategory} className="modern-button text-lg">
                                    创建分类
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};