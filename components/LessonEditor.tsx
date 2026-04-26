import React, { useState, useEffect, useRef } from 'react';
import type { Lesson, LessonData } from '../types';
import { supabase } from '../services/supabaseClient';

interface LessonEditorProps {
    lesson: Lesson | null;
    onSave: (lessonData: LessonData) => void;
    onDelete: (lessonId: string) => void;
    onClose: () => void;
}

export const LessonEditor: React.FC<LessonEditorProps> = ({ lesson, onSave, onDelete, onClose }) => {
    const [sortOrder, setSortOrder] = useState(1);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [lessonSummary, setLessonSummary] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const [uploadedFileType, setUploadedFileType] = useState<'pdf' | 'video' | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const systemPromptRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (lesson) {
            setSortOrder(lesson.sort_order);
            setTitle(lesson.title);
            setDescription(lesson.description);
            setLessonSummary(lesson.lesson_summary);
            setSystemPrompt(lesson.system_prompt);
        } else {
            setSortOrder(1);
            setTitle('');
            setDescription('');
            setLessonSummary('');
            setSystemPrompt('');
        }
        setUploadedUrl(null);
        setUploadError(null);
        setUploadedFileType(null);
    }, [lesson]);

    const handleSave = async () => {
        if (!title || !systemPrompt) {
            alert('Title and System Prompt are required.');
            return;
        }
        setIsSaving(true);
        await onSave({ sort_order: sortOrder, title, description, lesson_summary: lessonSummary, system_prompt: systemPrompt });
        setIsSaving(false);
    };

    const handleDelete = () => {
        if (lesson && window.confirm('Are you sure you want to delete this lesson? This action cannot be undone.')) {
            onDelete(lesson.id);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadedUrl(null);
        setUploadError(null);
        setUploadedFileType(null);
        
        try {
            const filePath = `public/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('lesson_materials')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage
                .from('lesson_materials')
                .getPublicUrl(filePath);
            
            if (data.publicUrl) {
                setUploadedUrl(data.publicUrl);
                if (file.type.startsWith('video/')) {
                    setUploadedFileType('video');
                } else {
                    setUploadedFileType('pdf');
                }
            } else {
                throw new Error("Could not get public URL.");
            }

        } catch (error: any) {
            console.error("Error uploading file:", error);
            setUploadError(`Upload failed: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleInsertUrl = () => {
        if (!uploadedUrl || !systemPromptRef.current) return;
        
        // REFACTOR: Generate a JSON object for the command, consistent with the new simplified action format.
        const commandObject = {
            type: 'command',
            payload: {
                name: uploadedFileType === 'video' ? 'show_video' : 'show_pdf',
                args: {
                    url: uploadedUrl,
                    ...(uploadedFileType === 'pdf' && { page: 1 })
                }
            }
        };
        
        const commandString = JSON.stringify(commandObject, null, 2);
            
        const textarea = systemPromptRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = systemPrompt.substring(0, start) + commandString + systemPrompt.substring(end);
        setSystemPrompt(newText);
        // Focus and move cursor to after the inserted command
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + commandString.length, start + commandString.length);
        }, 0);
    };

    const isFormValid = title.trim() !== '' && systemPrompt.trim() !== '';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-[90] flex items-center justify-center backdrop-blur-sm animate-fade-in">
            <style>{`
                @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
            <div className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-3xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-cyan-400">{lesson ? '编辑课程' : '新增课程'}</h2>
                    <div className="flex items-center gap-4">
                        {lesson && (
                            <button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                删除
                            </button>
                        )}
                        <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                            取消
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={!isFormValid || isSaving}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? '保存中...' : '保存'}
                        </button>
                    </div>
                </header>
                <main className="p-6 flex-grow overflow-y-auto">
                    <form className="space-y-6">
                        <div>
                            <label htmlFor="sortOrder" className="block text-sm font-medium text-slate-300 mb-1">课程序号</label>
                            <input
                                id="sortOrder"
                                type="number"
                                value={sortOrder}
                                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                                placeholder="请输入序号，数字越小排序越靠前"
                                className="w-full bg-slate-900 border border-slate-600 rounded-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-1">课程名称</label>
                            <input
                                id="title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="请输入课程名称，例如：第1讲 项目全景概览与需求拆解"
                                className="w-full bg-slate-900 border border-slate-600 rounded-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1">描述</label>
                            <input
                                id="description"
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="本描述用于提示学生本节课主要内容，推荐输入20字左右"
                                className="w-full bg-slate-900 border border-slate-600 rounded-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="lessonSummary" className="block text-sm font-medium text-slate-300 mb-1">课程总结</label>
                            <textarea
                                id="lessonSummary"
                                value={lessonSummary}
                                onChange={(e) => setLessonSummary(e.target.value)}
                                placeholder="请输入课程总结，概述本节课的核心内容、关键知识点，用于提示ai助手根据此内容回答学生问题"
                                className="w-full bg-slate-900 border border-slate-600 rounded-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 min-h-[80px]"
                            />
                        </div>

                        {/* Uploader Section */}
                        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                            <label className="block text-sm font-medium text-slate-300 mb-2">上传课程资料 (PDF/视频)</label>
                            <input
                                type="file"
                                accept=".pdf,.mp4,.webm"
                                onChange={handleFileUpload}
                                disabled={isUploading}
                                className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700 disabled:opacity-50"
                            />
                            {isUploading && <p className="text-sm text-cyan-400 mt-2 animate-pulse">上传中...</p>}
                            {uploadError && <p className="text-sm text-red-400 mt-2">{uploadError}</p>}
                            {uploadedUrl && (
                                <div className="mt-3 p-2 bg-slate-900 rounded-md">
                                    <p className="text-sm text-green-400 mb-2">上传成功! ({uploadedFileType})</p>
                                    <input
                                        type="text"
                                        readOnly
                                        value={uploadedUrl}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-md p-1 text-xs text-slate-300"
                                    />
                                    <div className="flex gap-2 mt-2">
                                        <button type="button" onClick={() => navigator.clipboard.writeText(uploadedUrl)} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded">复制 URL</button>
                                        <button type="button" onClick={handleInsertUrl} className="text-xs bg-cyan-700 hover:bg-cyan-600 px-3 py-1 rounded">插入指令</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="systemPrompt" className="block text-sm font-medium text-slate-300 mb-1">课程脚本</label>
                            <textarea
                                id="systemPrompt"
                                ref={systemPromptRef}
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                className="w-full h-96 bg-slate-900 border border-slate-600 rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                                placeholder="请输入课程脚本（JSON格式的AIAction数组），定义AI导师的讲课流程和界面操作指令..."
                                required
                            />
                        </div>
                    </form>
                </main>
            </div>
        </div>
    );
};