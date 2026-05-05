import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';
import type { CourseCategory, Lesson } from '../types';

interface StudentImportResult {
    student_name: string;
    student_id: string;
    success: boolean;
    error?: string;
    user_id?: string;
}

interface StudentDeleteResult {
    user_id: string;
    student_id: string;
    student_name: string;
    success: boolean;
    error?: string;
}

interface SystemStats {
    totalStudents: number;
    activeUsers: number;
    totalStudyTime: number;
}

// interface ActivityLog {
//     id: string;
//     time: string;
//     action: string;
//     user: string;
//     status: string;
// }

  interface ExpandedCategories {
    [key: string]: boolean;
}

interface StudentInfo {
    student_id: string;
    student_name: string;
    class_number: string;
}

export const AdminPanel: React.FC<{ session: any; profile: any }> = ({ session, profile }) => {
    const [importResults, setImportResults] = useState<StudentImportResult[]>([]);
    const [deleteResults, setDeleteResults] = useState<StudentDeleteResult[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletePrefix, setDeletePrefix] = useState('');
    const [activeTab, setActiveTab] = useState<'import' | 'delete' | 'stats' | 'courseDelete'>('import');
    const [stats, setStats] = useState<SystemStats>({ totalStudents: 0, activeUsers: 0, totalStudyTime: 0 });
    // const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    
    // 课程删除相关状态
    const [categories, setCategories] = useState<CourseCategory[]>([]);
    const [isLoadingCourses, setIsLoadingCourses] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<ExpandedCategories>({});
    
    // 确认对话框相关状态
    const [showImportConfirm, setShowImportConfirm] = useState(false);
    const [importConfirmData, setImportConfirmData] = useState<StudentInfo[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmData, setDeleteConfirmData] = useState<StudentInfo[]>([]);
    
    // 学生列表相关状态
    const [allStudents, setAllStudents] = useState<StudentInfo[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
    const [showTableDeleteConfirm, setShowTableDeleteConfirm] = useState(false);
    const [tableDeleteData, setTableDeleteData] = useState<StudentInfo[]>([]);

    // 获取课程数据
    const fetchCourses = useCallback(async () => {
        setIsLoadingCourses(true);
        try {
            const { data, error } = await supabase
                .from('course_categories')
                .select(`*, lessons (*)`);
            
            if (error) {
                console.error('获取课程数据失败:', error);
            } else {
                setCategories(data as CourseCategory[]);
            }
        } catch (error) {
            console.error('获取课程数据失败:', error);
        } finally {
            setIsLoadingCourses(false);
        }
    }, []);

    // 切换课程分类的展开/折叠状态
    const toggleCategory = (categoryId: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [categoryId]: !prev[categoryId]
        }));
    };

    // 删除课程小节
    const handleDeleteLesson = async (lessonId: string, lessonTitle: string) => {
        const confirmed = window.confirm(`确定要删除课程「${lessonTitle}」吗？此操作不可撤销！`);
        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('lessons')
                .delete()
                .eq('id', lessonId);
            
            if (error) {
                alert('删除课程失败: ' + error.message);
            } else {
                alert('课程删除成功！');
                fetchCourses();
            }
        } catch (error) {
            console.error('删除课程失败:', error);
            alert('删除课程失败');
        }
    };

    // 删除课程分类
    const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
        const confirmed = window.confirm(
            `确定要删除课程分类「${categoryName}」吗？该分类下的所有课程也会被一并删除，此操作不可撤销！`
        );
        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('course_categories')
                .delete()
                .eq('id', categoryId);
            
            if (error) {
                alert('删除分类失败: ' + error.message);
            } else {
                alert('分类删除成功！');
                fetchCourses();
            }
        } catch (error) {
            console.error('删除分类失败:', error);
            alert('删除分类失败');
        }
    };

    // 退出登录
    const handleLogout = async () => {
        const confirmed = window.confirm('确定要退出登录吗？');
        if (!confirmed) return;
        
        try {
            await supabase.auth.signOut();
            window.location.reload();
        } catch (error) {
            console.error('退出登录失败:', error);
            alert('退出登录失败，请重试');
        }
    };

    // 当切换到删除课程选项卡时加载课程数据
    useEffect(() => {
        if (activeTab === 'courseDelete') {
            fetchCourses();
        }
    }, [activeTab, fetchCourses]);

    // 当切换到批量删除选项卡时加载所有学生数据
    useEffect(() => {
        const fetchAllStudents = async () => {
            if (activeTab === 'delete') {
                setIsLoadingStudents(true);
                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('id, student_id, student_name, class_number')
                        .eq('role', 'student')
                        .order('student_id', { ascending: true });

                    if (error) {
                        console.error('获取学生数据失败:', error);
                        alert('获取学生数据失败');
                    } else {
                        setAllStudents(data as any[]);
                    }
                } catch (error) {
                    console.error('获取学生数据失败:', error);
                    alert('获取学生数据失败');
                } finally {
                    setIsLoadingStudents(false);
                }
            }
        };

        fetchAllStudents();
    }, [activeTab]);

    // 重置页码当切换标签页时
    useEffect(() => {
        setCurrentPage(1);
        setSelectedStudents(new Set());
    }, [activeTab]);

    // 获取统计数据
    useEffect(() => {
        const fetchStats = async () => {
            setIsLoadingStats(true);
            try {
                // 获取学生总数
                const { count: studentCount } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', 'student');

                // 获取最近30天有学习记录的用户数（活跃用户）
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                
                const { data: records } = await supabase
                    .from('student_lesson_records')
                    .select('user_id')
                    .gte('updated_at', thirtyDaysAgo.toISOString());

                const uniqueUserIds = new Set((records || []).map(r => r.user_id));
                const activeCount = uniqueUserIds.size;

                // 计算总学习时长（假设每条记录平均学习10分钟）
                const { count: totalRecords } = await supabase
                    .from('student_lesson_records')
                    .select('*', { count: 'exact', head: true });
                
                const totalStudyHours = totalRecords ? Math.round(totalRecords * 10 / 60) : 0;

                setStats({
                    totalStudents: studentCount || 0,
                    activeUsers: activeCount || 0,
                    totalStudyTime: totalStudyHours
                });
            } catch (error) {
                console.error('获取统计数据失败:', error);
            } finally {
                setIsLoadingStats(false);
            }
        };

        // const fetchActivities = async () => {
        //     try {
        //         // 获取最近的学生注册记录（从 auth.users 无法直接查询，这里用 profiles 替代）
        //         const { data: recentProfiles } = await supabase
        //             .from('profiles')
        //             .select('id, created_at, role, email, student_name')
        //             .in('role', ['student', 'teacher'])
        //             .order('created_at', { ascending: false })
        //             .limit(10);

        //         const activityLogs: ActivityLog[] = (recentProfiles || []).map(p => ({
        //             id: p.id,
        //             time: new Date(p.created_at || '').toLocaleString('zh-CN', {
        //                 year: 'numeric',
        //                 month: '2-digit',
        //                 day: '2-digit',
        //                 hour: '2-digit',
        //                 minute: '2-digit'
        //             }).replace(/\//g, '-'),
        //             action: p.role === 'student' ? '学生注册' : '教师注册',
        //             user: p.email || '',
        //             status: '成功'
        //         }));

        //         setActivities(activityLogs);
        //     } catch (error) {
        //         console.error('获取活动日志失败:', error);
        //     }
        // };

        if (activeTab === 'stats') {
            fetchStats();
            // fetchActivities();
        }
    }, [activeTab]);

    // 下载Excel模板
    const downloadTemplate = () => {
        const link = document.createElement('a');
        link.href = '/students_template.xls';
        link.download = 'students_template.xls';
        link.click();
    };

    // 处理Excel文件上传
    // const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    //     const file = e.target.files?.[0];
    //     if (!file) return;

    //     setIsImporting(true);
    //     setImportResults([]);

    //     try {
    //         const arrayBuffer = await file.arrayBuffer();
    //         const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    //         const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            
    //         const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
            
    //         const students = jsonData.slice(1).map((row: any[]) => ({
    //             student_id: String(row[2] || '').trim(),
    //             student_name: String(row[3] || '').trim(),
    //             class_number: String(row[1] || '').trim()
    //         })).filter(s => s.student_id && s.student_name);

    //         if (students.length === 0) {
    //             alert('未找到有效的学生数据，请检查Excel格式');
    //             setIsImporting(false);
    //             return;
    //         }

    //         const token = session.access_token;
    //         const response = await fetch(
    //             `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-import-students`,
    //             {
    //                 method: 'POST',
    //                 headers: {
    //                     'Authorization': `Bearer ${token}`,
    //                     'Content-Type': 'application/json'
    //                 },
    //                 body: JSON.stringify({ students })
    //             }
    //         );

    //         if (!response.ok) {
    //             throw new Error(`导入失败: ${response.statusText}`);
    //         }

    //         const data = await response.json();
    //         setImportResults(data.results || []);

    //     } catch (error) {
    //         console.error('导入错误:', error);
    //         alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    //     } finally {
    //         setIsImporting(false);
    //     }
    // };
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportResults([]);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

            if (jsonData.length < 2) {
                alert('Excel 至少需要包含表头行和一行数据');
                setIsImporting(false);
                return;
            }

            // 获取表头行，trim 并统一中间空格，方便匹配
            const headerRow = jsonData[0].map((cell: any) => String(cell || '').trim().replace(/\s+/g, ''));

            // 匹配列索引（支持常见别称）
            const studentIdIndex = headerRow.findIndex(
                (h: string) => h.includes('学号') || h === 'student_id' || h === 'studentId'
            );
            const studentNameIndex = headerRow.findIndex(
                (h: string) => h.includes('姓名') || h === 'student_name' || h === 'studentName' || h === 'name'
            );
            const classNumberIndex = headerRow.findIndex(
                (h: string) => h.includes('行政班') || h.includes('班级') || h === 'class_number' || h === 'classNumber' || h === 'class'
            );

            if (studentIdIndex === -1 || studentNameIndex === -1) {
                alert('表头中缺少"学号"或"姓名"列，请检查 Excel 格式');
                setIsImporting(false);
                return;
            }

            // 从第二行开始读取数据，直到空行结束
            const students: any[] = [];
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                // 跳过完全空行
                if (!row || row.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '')) {
                    continue;
                }
                const sid = String(row[studentIdIndex] || '').trim();
                const sname = String(row[studentNameIndex] || '').trim();
                const sclass = classNumberIndex !== -1 ? String(row[classNumberIndex] || '').trim() : '';

                if (sid && sname) {
                    students.push({
                        student_id: sid,
                        student_name: sname,
                        class_number: sclass
                    });
                }
            }

            if (students.length === 0) {
                alert('未找到有效的学生数据，请检查学号和姓名是否填写');
                setIsImporting(false);
                return;
            }

            // 显示确认对话框
            setImportConfirmData(students);
            setShowImportConfirm(true);
            setIsImporting(false);
        } catch (error) {
            console.error('导入错误:', error);
            alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
            setIsImporting(false);
        }
    };

    // 确认导入学生
    const handleConfirmImport = async () => {
        setIsImporting(true);
        setShowImportConfirm(false);

        try {
            const token = session.access_token;
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-import-students`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ students: importConfirmData })
                }
            );

            if (!response.ok) {
                throw new Error(`导入失败: ${response.statusText}`);
            }

            const data = await response.json();
            setImportResults(data.results || []);
        } catch (error) {
            console.error('导入错误:', error);
            alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsImporting(false);
            setImportConfirmData([]);
        }
    };

    // 取消导入
    const handleCancelImport = () => {
        setShowImportConfirm(false);
        setImportConfirmData([]);
    };

    // 批量删除学生
    const handleBatchDelete = async () => {
        if (!deletePrefix.trim()) {
            alert('请输入学号前缀');
            return;
        }

        setIsDeleting(true);

        try {
            // 先查询符合条件的学生信息
            const { data: students, error } = await supabase
                .from('profiles')
                .select('student_id, student_name, class_number')
                .eq('role', 'student')
                .like('student_id', `${deletePrefix.trim()}%`);

            if (error) {
                throw new Error('查询学生数据失败: ' + error.message);
            }

            if (!students || students.length === 0) {
                alert('未找到匹配的学生');
                setIsDeleting(false);
                return;
            }

            // 显示确认对话框
            setDeleteConfirmData(students as StudentInfo[]);
            setShowDeleteConfirm(true);
            setIsDeleting(false);
        } catch (error) {
            console.error('查询错误:', error);
            alert(`查询失败: ${error instanceof Error ? error.message : '未知错误'}`);
            setIsDeleting(false);
        }
    };

    // 确认删除学生
    const handleConfirmDelete = async () => {
        setIsDeleting(true);
        setShowDeleteConfirm(false);

        try {
            const token = session.access_token;
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-delete-students`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        condition: 'prefix',
                        prefix: deletePrefix.trim()
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`删除失败: ${response.statusText}`);
            }

            const data = await response.json();
            setDeleteResults(data.results || []);

            // 刷新学生列表
            const { data: updatedStudents, error } = await supabase
                .from('profiles')
                .select('id, student_id, student_name, class_number')
                .eq('role', 'student')
                .order('student_id', { ascending: true });

            if (!error && updatedStudents) {
                setAllStudents(updatedStudents);
            }

            const successCount = data.results?.filter((r: any) => r.success).length || 0;
            alert(`删除完成！成功删除 ${successCount} 个学生账户。`);
        } catch (error) {
            console.error('删除错误:', error);
            alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsDeleting(false);
            setDeleteConfirmData([]);
            setDeletePrefix('');
        }
    };

    // 取消删除
    const handleCancelDelete = () => {
        setShowDeleteConfirm(false);
        setDeleteConfirmData([]);
    };

    // 处理学生选择
    const handleSelectStudent = (studentId: string) => {
        setSelectedStudents(prev => {
            const newSet = new Set(prev);
            if (newSet.has(studentId)) {
                newSet.delete(studentId);
            } else {
                newSet.add(studentId);
            }
            return newSet;
        });
    };

    // 处理全选/取消全选
    const handleSelectAll = () => {
        if (selectedStudents.size === allStudents.length) {
            setSelectedStudents(new Set());
        } else {
            setSelectedStudents(new Set(allStudents.map(s => s.student_id)));
        }
    };

    // 处理表格批量删除
    const handleTableBatchDelete = () => {
        if (selectedStudents.size === 0) {
            alert('请先选择要删除的学生');
            return;
        }

        const selectedStudentsData = allStudents.filter(s => selectedStudents.has(s.student_id));
        setTableDeleteData(selectedStudentsData);
        setShowTableDeleteConfirm(true);
    };

    // 确认表格批量删除
    const handleConfirmTableDelete = async () => {
        setIsDeleting(true);
        setShowTableDeleteConfirm(false);

        try {
            const studentIds = Array.from(selectedStudents);
            const token = session.access_token;
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-delete-students`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        condition: 'ids',
                        ids: studentIds
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`删除失败: ${response.statusText}`);
            }

            const data = await response.json();
            setDeleteResults(data.results || []);

            // 刷新学生列表
            const { data: updatedStudents, error } = await supabase
                .from('profiles')
                .select('id, student_id, student_name, class_number')
                .eq('role', 'student')
                .order('student_id', { ascending: true });

            if (!error && updatedStudents) {
                setAllStudents(updatedStudents);
            }

            const successCount = data.results?.filter((r: any) => r.success).length || 0;
            alert(`删除完成！成功删除 ${successCount} 个学生账户。`);
            setSelectedStudents(new Set());
        } catch (error) {
            console.error('删除错误:', error);
            alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsDeleting(false);
            setTableDeleteData([]);
        }
    };

    // 取消表格批量删除
    const handleCancelTableDelete = () => {
        setShowTableDeleteConfirm(false);
        setTableDeleteData([]);
    };

    // 计算分页数据
    const totalPages = Math.ceil(allStudents.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const currentStudents = allStudents.slice(startIndex, endIndex);

    return (
        <div className="admin-layout">
            {/* 侧边栏 */}
            <aside className="admin-sidebar">
                <div className="admin-sidebar-brand">
                    <h1>Admin Panel</h1>
                </div>
                
                <nav className="admin-sidebar-nav">
                    <div 
                        className={`admin-nav-item ${activeTab === 'import' ? 'active' : ''}`}
                        onClick={() => setActiveTab('import')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span>批量导入</span>
                    </div>
                    
                    <div 
                        className={`admin-nav-item ${activeTab === 'delete' ? 'active' : ''}`}
                        onClick={() => setActiveTab('delete')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>批量删除</span>
                    </div>
                    
                    <div 
                        className={`admin-nav-item ${activeTab === 'courseDelete' ? 'active' : ''}`}
                        onClick={() => setActiveTab('courseDelete')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span>删除课程</span>
                    </div>
                    
                    <div 
                        className={`admin-nav-item ${activeTab === 'stats' ? 'active' : ''}`}
                        onClick={() => setActiveTab('stats')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>数据统计</span>
                    </div>
                </nav>
                
                <div className="admin-sidebar-footer">
                    <div className="admin-notice admin-notice-info">
                        <div className="admin-notice-content">
                            <p className="admin-notice-title">系统状态</p>
                            <p className="admin-notice-message">所有服务运行正常</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* 主内容区域 */}
            <main className="admin-main">
                {/* 顶部状态栏 */}
                <header className="admin-header">
                    <div className="admin-header-left">
                        <h2 className="admin-header-title">
                            {activeTab === 'import' && '批量导入学生'}
                            {activeTab === 'delete' && '批量删除学生'}
                            {activeTab === 'courseDelete' && '删除课程'}
                            {activeTab === 'stats' && '数据统计'}
                        </h2>
                    </div>
                    
                    <div className="admin-header-right">
                        <div className="admin-user-info">
                            <div className="admin-user-avatar">
                                {profile?.student_name?.[0] || 'A'}
                            </div>
                            <div>
                                <p className="admin-user-name">{profile?.student_name || 'Admin'}</p>
                                <p className="admin-user-role">管理员</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="admin-btn admin-btn-secondary"
                            title="退出登录"
                            style={{ marginLeft: '16px' }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span style={{ marginLeft: '6px' }}>退出登录</span>
                        </button>
                    </div>
                </header>

                {/* 内容区域 */}
                <div className="admin-content">
                    {activeTab === 'import' && (
                        <div className="admin-fade-in">
                            <div className="admin-card">
                                <div className="admin-card-header">
                                    <h3 className="admin-card-title">Excel 格式要求</h3>
                                    <p className="admin-card-subtitle">请按照指定格式准备学生信息</p>
                                </div>
                                
                                <div className="admin-card-content">
                                    <div className="admin-notice admin-notice-info" style={{ marginBottom: '20px' }}>
                                        <div className="admin-notice-content">
                                            <p className="admin-notice-message">
                                                Excel 文件必须包含以下列：行政班、学号、姓名<br />
                                                学号和姓名为必填项<br />
                                                系统会自动创建邮箱：学号@chd.edu.cn<br />
                                                初始密码统一为：123456
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        <button 
                                            onClick={downloadTemplate}
                                            className="admin-btn admin-btn-secondary"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            下载 Excel 模板
                                        </button>

                                        <label className="admin-btn admin-btn-primary" style={{ cursor: 'pointer' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            选择 Excel 文件
                                            <input
                                                type="file"
                                                accept=".xls,.xlsx"
                                                onChange={handleFileUpload}
                                                disabled={isImporting}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                    </div>

                                    {isImporting && (
                                        <div className="admin-loading">
                                            <div className="admin-loading-dot"></div>
                                            <div className="admin-loading-dot"></div>
                                            <div className="admin-loading-dot"></div>
                                            <span style={{ marginLeft: '12px', color: 'rgba(255,255,255,0.7)' }}>正在导入学生...</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {importResults.length > 0 && (
                                <div className="admin-card admin-fade-in-delay-1">
                                    <div className="admin-card-header">
                                        <h3 className="admin-card-title">导入结果</h3>
                                        <p className="admin-card-subtitle">共处理 {importResults.length} 条记录</p>
                                    </div>
                                    
                                    <div className="admin-card-content">
                                        <div className="admin-table-container">
                                            <table className="admin-table">
                                                <thead>
                                                    <tr>
                                                        <th>姓名</th>
                                                        <th>学号</th>
                                                        <th>状态</th>
                                                        <th>详情</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {importResults.map((result, index) => (
                                                        <tr key={index}>
                                                            <td style={{ fontFamily: 'monospace' }}>{result.student_name}</td>
                                                            <td style={{ fontFamily: 'monospace' }}>{result.student_id}</td>
                                                            <td>
                                                                {result.success ? (
                                                                    <span className="admin-badge admin-badge-success">成功</span>
                                                                ) : (
                                                                    <span className="admin-badge admin-badge-error">失败</span>
                                                                )}
                                                            </td>
                                                            <td style={{ color: 'rgba(255,255,255,0.6)' }}>
                                                                {result.success ? '账户创建成功' : result.error}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'delete' && (
                        <div className="admin-fade-in">
                            {/* 批量删除卡片 */}
                            <div className="admin-card">
                                <div className="admin-card-header">
                                    <h3 className="admin-card-title">按学号前缀批量删除</h3>
                                    <p className="admin-card-subtitle">按学号前缀批量删除学生账户</p>
                                </div>
                                
                                <div className="admin-card-content">
                                    <div className="admin-notice admin-notice-error" style={{ marginBottom: '20px' }}>
                                        <div className="admin-notice-content">
                                            <p className="admin-notice-title">⚠️ 危险操作</p>
                                            <p className="admin-notice-message">
                                                此操作将永久删除匹配条件的学生账户及其所有数据，无法恢复。请谨慎操作！
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
                                        <div style={{ flex: 1, minWidth: '200px' }}>
                                            <label style={{ 
                                                display: 'block', 
                                                fontSize: '13px', 
                                                fontWeight: 500, 
                                                color: 'rgba(255,255,255,0.7)', 
                                                marginBottom: '8px' 
                                            }}>
                                                学号前缀
                                            </label>
                                            <input
                                                type="text"
                                                value={deletePrefix}
                                                onChange={(e) => setDeletePrefix(e.target.value)}
                                                placeholder="例如：2022"
                                                className="admin-input"
                                            />
                                        </div>

                                        <button
                                            onClick={handleBatchDelete}
                                            disabled={isDeleting || !deletePrefix.trim()}
                                            className="admin-btn admin-btn-danger"
                                        >
                                            {isDeleting ? (
                                                <>
                                                    <div className="admin-loading">
                                                        <div className="admin-loading-dot"></div>
                                                        <div className="admin-loading-dot"></div>
                                                        <div className="admin-loading-dot"></div>
                                                    </div>
                                                    <span>删除中...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    批量删除
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                                        示例：输入 <code style={{ 
                                            padding: '4px 10px', 
                                            background: 'rgba(255,255,255,0.05)', 
                                            borderRadius: '6px', 
                                            fontSize: '12px',
                                            border: '1px solid rgba(255,255,255,0.08)'
                                        }}>2022</code> 将删除所有学号以 "2022" 开头的学生
                                    </p>
                                </div>
                            </div>

                            {/* 删除结果显示 */}
                            {deleteResults.length > 0 && (
                                <div className="admin-card admin-fade-in-delay-1">
                                    <div className="admin-card-header">
                                        <h3 className="admin-card-title">删除结果</h3>
                                        <p className="admin-card-subtitle">共处理 {deleteResults.length} 条记录</p>
                                    </div>
                                    
                                    <div className="admin-card-content">
                                        <div className="admin-table-container">
                                            <table className="admin-table">
                                                <thead>
                                                    <tr>
                                                        <th>学号</th>
                                                        <th>姓名</th>
                                                        <th>状态</th>
                                                        <th>详情</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {deleteResults.map((result, index) => (
                                                        <tr key={index}>
                                                            <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{result.student_id}</td>
                                                            <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{result.student_name}</td>
                                                            <td>
                                                                {result.success ? (
                                                                    <span className="admin-badge admin-badge-success">成功</span>
                                                                ) : (
                                                                    <span className="admin-badge admin-badge-error">失败</span>
                                                                )}
                                                            </td>
                                                            <td style={{ color: 'rgba(255,255,255,0.6)' }}>
                                                                {result.success ? '账户删除成功' : result.error}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 所有学生列表表格 */}
                            <div className="admin-card admin-fade-in-delay-2" style={{ marginTop: '24px' }}>
                                <div className="admin-card-header">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <h3 className="admin-card-title">所有学生列表</h3>
                                            <p className="admin-card-subtitle">
                                                共 {allStudents.length} 名学生 · 当前已选择 {selectedStudents.size} 名
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleTableBatchDelete}
                                            disabled={isDeleting || selectedStudents.size === 0}
                                            className="admin-btn admin-btn-danger"
                                        >
                                            {isDeleting ? (
                                                <>
                                                    <div className="admin-loading">
                                                        <div className="admin-loading-dot"></div>
                                                        <div className="admin-loading-dot"></div>
                                                        <div className="admin-loading-dot"></div>
                                                    </div>
                                                    <span>删除中...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    批量删除
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="admin-card-content">
                                    {isLoadingStudents ? (
                                        <div className="admin-loading">
                                            <div className="admin-loading-dot"></div>
                                            <div className="admin-loading-dot"></div>
                                            <div className="admin-loading-dot"></div>
                                            <span style={{ marginLeft: '12px', color: 'rgba(255,255,255,0.7)' }}>加载学生数据中...</span>
                                        </div>
                                    ) : allStudents.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
                                            暂无学生数据
                                        </div>
                                    ) : (
                                        <>
                                            <div className="admin-table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                                <table className="admin-table">
                                                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                                        <tr>
                                                            <th style={{ width: '50px', padding: '12px', textAlign: 'center' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedStudents.size === allStudents.length && allStudents.length > 0}
                                                                    onChange={handleSelectAll}
                                                                    style={{ 
                                                                        width: '18px', 
                                                                        height: '18px', 
                                                                        cursor: 'pointer',
                                                                        accentColor: '#667eea'
                                                                    }}
                                                                />
                                                            </th>
                                                            <th style={{ padding: '12px' }}>序号</th>
                                                            <th style={{ padding: '12px' }}>学号</th>
                                                            <th style={{ padding: '12px' }}>姓名</th>
                                                            <th style={{ padding: '12px' }}>班级</th>
                                                            {/* <th style={{ padding: '12px', width: '80px', textAlign: 'center' }}>选择</th> */}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {currentStudents.map((student, index) => (
                                                            <tr key={student.student_id} style={{
                                                                backgroundColor: selectedStudents.has(student.student_id) ? 'rgba(102, 126, 234, 0.1)' : 'transparent'
                                                            }}>
                                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedStudents.has(student.student_id)}
                                                                        onChange={() => handleSelectStudent(student.student_id)}
                                                                        style={{ 
                                                                            width: '18px', 
                                                                            height: '18px', 
                                                                            cursor: 'pointer',
                                                                            accentColor: '#667eea'
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '12px', color: 'rgba(255,255,255,0.6)' }}>
                                                                    {startIndex + index + 1}
                                                                </td>
                                                                <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                                                                    {student.student_id}
                                                                </td>
                                                                <td style={{ padding: '12px' }}>
                                                                    {student.student_name}
                                                                </td>
                                                                <td style={{ padding: '12px', color: 'rgba(255,255,255,0.7)' }}>
                                                                    {student.class_number || '-'}
                                                                </td>
                                                                {/* <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedStudents.has(student.student_id)}
                                                                        onChange={() => handleSelectStudent(student.student_id)}
                                                                        style={{ 
                                                                            width: '18px', 
                                                                            height: '18px', 
                                                                            cursor: 'pointer',
                                                                            accentColor: '#667eea'
                                                                        }}
                                                                    />
                                                                </td> */}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* 分页控制 */}
                                            <div style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center', 
                                                marginTop: '16px',
                                                padding: '12px',
                                                background: 'rgba(255,255,255,0.05)',
                                                borderRadius: '8px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                                                        每页显示：
                                                    </span>
                                                    <select
                                                        value={pageSize}
                                                        onChange={(e) => {
                                                            setPageSize(Number(e.target.value));
                                                            setCurrentPage(1);
                                                        }}
                                                        style={{
                                                            padding: '6px 12px',
                                                            background: 'rgba(88, 88, 88, 0.82)',
                                                            border: '1px solid rgba(255,255,255,0.2)',
                                                            borderRadius: '6px',
                                                            color: '#ffffff',
                                                            fontSize: '13px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <option value="10">10条</option>
                                                        <option value="20">20条</option>
                                                        <option value="50">50条</option>
                                                        <option value="100">100条</option>
                                                    </select>
                                                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                                                        · 共 {totalPages} 页 · {allStudents.length} 条记录
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        onClick={() => setCurrentPage(1)}
                                                        disabled={currentPage === 1}
                                                        style={{
                                                            padding: '6px 12px',
                                                            background: currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                                                            border: '1px solid rgba(255,255,255,0.2)',
                                                            borderRadius: '6px',
                                                            color: currentPage === 1 ? 'rgba(255,255,255,0.3)' : '#fff',
                                                            fontSize: '13px',
                                                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        首页
                                                    </button>
                                                    <button
                                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                        disabled={currentPage === 1}
                                                        style={{
                                                            padding: '6px 12px',
                                                            background: currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                                                            border: '1px solid rgba(255,255,255,0.2)',
                                                            borderRadius: '6px',
                                                            color: currentPage === 1 ? 'rgba(255,255,255,0.3)' : '#fff',
                                                            fontSize: '13px',
                                                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        上一页
                                                    </button>
                                                    <span style={{ 
                                                        padding: '8px 16px',
                                                        background: 'linear-gradient(135deg, #5568d3 0%, #6b3fa0 100%)',
                                                        border: '1px solid #4a5bc4',
                                                        borderRadius: '8px',
                                                        color: '#ffffff',
                                                        fontSize: '14px',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.5px',
                                                        boxShadow: '0 2px 8px rgba(85, 104, 211, 0.4)',
                                                        textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                                                        minWidth: '50px',
                                                        textAlign: 'center',
                                                        display: 'inline-block'
                                                    }}>
                                                        {currentPage}
                                                    </span>
                                                    <button
                                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                        disabled={currentPage === totalPages}
                                                        style={{
                                                            padding: '6px 12px',
                                                            background: currentPage === totalPages ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                                                            border: '1px solid rgba(255,255,255,0.2)',
                                                            borderRadius: '6px',
                                                            color: currentPage === totalPages ? 'rgba(255,255,255,0.3)' : '#fff',
                                                            fontSize: '13px',
                                                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        下一页
                                                    </button>
                                                    <button
                                                        onClick={() => setCurrentPage(totalPages)}
                                                        disabled={currentPage === totalPages}
                                                        style={{
                                                            padding: '6px 12px',
                                                            background: currentPage === totalPages ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                                                            border: '1px solid rgba(255,255,255,0.2)',
                                                            borderRadius: '6px',
                                                            color: currentPage === totalPages ? 'rgba(255,255,255,0.3)' : '#fff',
                                                            fontSize: '13px',
                                                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        末页
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'courseDelete' && (
                        <div className="admin-fade-in">
                            <div className="admin-card">
                                <div className="admin-card-header">
                                    <h3 className="admin-card-title">删除课程</h3>
                                    <p className="admin-card-subtitle">管理课程分类和课程内容</p>
                                </div>
                                
                                <div className="admin-card-content">
                                    <div className="admin-notice admin-notice-error" style={{ marginBottom: '20px' }}>
                                        <div className="admin-notice-content">
                                            <p className="admin-notice-title">⚠️ 危险操作</p>
                                            <p className="admin-notice-message">
                                                删除操作不可恢复！请谨慎操作。删除课程分类会同时删除该分类下的所有课程。
                                            </p>
                                        </div>
                                    </div>

                                    {isLoadingCourses ? (
                                        <div className="admin-loading">
                                            <div className="admin-loading-dot"></div>
                                            <div className="admin-loading-dot"></div>
                                            <div className="admin-loading-dot"></div>
                                            <span style={{ marginLeft: '12px', color: 'rgba(255,255,255,0.7)' }}>加载课程数据中...</span>
                                        </div>
                                    ) : categories.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
                                            暂无课程数据
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {categories.map(category => (
                                                <div key={category.id} className="border border-white/10 rounded-xl overflow-hidden">
                                                    {/* 课程分类标题 */}
                                                    <div 
                                                        className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/8 transition-colors cursor-pointer"
                                                        onClick={() => toggleCategory(category.id)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <svg 
                                                                xmlns="http://www.w3.org/2000/svg" 
                                                                className={`h-5 w-5 text-white/70 transition-transform ${expandedCategories[category.id] ? 'rotate-90' : ''}`}
                                                                fill="none" 
                                                                viewBox="0 0 24 24" 
                                                                stroke="currentColor"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                                </svg>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-white">{category.name}</h4>
                                                                <p className="text-sm text-white/50">{category.lessons?.length || 0} 个课程</p>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteCategory(category.id, category.name);
                                                            }}
                                                            className="px-3 py-2 text-sm rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all flex items-center gap-2"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            删除分类
                                                        </button>
                                                    </div>

                                                    {/* 课程列表 */}
                                                    {expandedCategories[category.id] && category.lessons && category.lessons.length > 0 && (
                                                        <div className="p-5 pt-0 space-y-2">
                                                            {[...category.lessons].sort((a, b) => a.sort_order - b.sort_order).map(lesson => (
                                                                <div key={lesson.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/8 transition-all">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-sm font-bold text-white">
                                                                            {lesson.title.charAt(0)}
                                                                        </div>
                                                                        <div>
                                                                            <p className="font-medium text-white text-sm">{lesson.title}</p>
                                                                            <p className="text-xs text-white/50">{lesson.description}</p>
                                                                        </div>
                                                                    </div>
                                                                    <button 
                                                                        onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                                                                        className="p-2 rounded-lg hover:bg-red-500/10 text-white/60 hover:text-red-400 transition-colors"
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {expandedCategories[category.id] && (!category.lessons || category.lessons.length === 0) && (
                                                        <div className="p-4 pt-0">
                                                            <p className="text-sm text-white/40 text-center py-4">该分类下暂无课程</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'stats' && (
                        <div className="admin-fade-in">
                            {isLoadingStats ? (
                                <div className="admin-card">
                                    <div className="admin-card-content">
                                        <div className="admin-loading">
                                            <div className="admin-loading-dot"></div>
                                            <div className="admin-loading-dot"></div>
                                            <div className="admin-loading-dot"></div>
                                            <span style={{ marginLeft: '12px', color: 'rgba(255,255,255,0.7)' }}>加载数据中...</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                                        <div className="admin-stat-card">
                                            <div className="admin-stat-icon" style={{ background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '24px', height: '24px', color: '#667eea' }}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="admin-stat-value">{stats.totalStudents.toLocaleString()}</div>
                                                <div className="admin-stat-label">总学生数</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                                                    role = student 的用户总数
                                                </div>
                                                <div className="admin-stat-change positive">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '14px', height: '14px' }}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                    </svg>
                                                    <span>实时数据</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="admin-stat-card">
                                            <div className="admin-stat-icon" style={{ background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '24px', height: '24px', color: '#4ade80' }}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="admin-stat-value">{stats.activeUsers.toLocaleString()}</div>
                                                <div className="admin-stat-label">活跃用户 (30天)</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                                                    最近30天有学习记录的用户数
                                                </div>
                                                <div className="admin-stat-change positive">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '14px', height: '14px' }}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                    </svg>
                                                    <span>实时数据</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="admin-stat-card">
                                            <div className="admin-stat-icon" style={{ background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.2) 0%, rgba(245, 158, 11, 0.2) 100%)' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '24px', height: '24px', color: '#facc15' }}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="admin-stat-value">{stats.totalStudyTime.toLocaleString()}</div>
                                                <div className="admin-stat-label">学习时长 (小时)</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                                                    基于学习记录总数估算（每条10分钟）
                                                </div>
                                                <div className="admin-stat-change positive">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '14px', height: '14px' }}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                    </svg>
                                                    <span>实时数据</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* <div className="admin-card">
                                        <div className="admin-card-header">
                                            <h3 className="admin-card-title">最近注册</h3>
                                            <p className="admin-card-subtitle">系统实时操作记录</p>
                                        </div>
                                        
                                        <div className="admin-card-content">
                                            {activities.length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
                                                    暂无注册记录
                                                </div>
                                            ) : (
                                                <div className="admin-table-container">
                                                    <table className="admin-table">
                                                        <thead>
                                                            <tr>
                                                                <th>时间</th>
                                                                <th>操作类型</th>
                                                                <th>用户</th>
                                                                <th>状态</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {activities.map((activity) => (
                                                                <tr key={activity.id}>
                                                                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>{activity.time}</td>
                                                                    <td>{activity.action}</td>
                                                                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{activity.user}</td>
                                                                    <td><span className="admin-badge admin-badge-success">{activity.status}</span></td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div> */}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* 导入确认对话框 */}
            {showImportConfirm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#1a1a2e',
                        borderRadius: '12px',
                        maxWidth: '800px',
                        maxHeight: '80vh',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{
                            padding: '20px',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h3 style={{
                                margin: 0,
                                fontSize: '18px',
                                fontWeight: 600,
                                color: '#fff'
                            }}>
                                确认导入学生
                            </h3>
                            <span style={{
                                fontSize: '14px',
                                color: 'rgba(255, 255, 255, 0.6)'
                            }}>
                                共 {importConfirmData.length} 名学生
                            </span>
                        </div>

                        <div style={{
                            padding: '20px',
                            overflowY: 'auto',
                            flex: 1
                        }}>
                            <div style={{
                                backgroundColor: 'rgba(74, 222, 128, 0.1)',
                                border: '1px solid rgba(74, 222, 128, 0.3)',
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '16px'
                            }}>
                                <p style={{
                                    margin: 0,
                                    fontSize: '14px',
                                    color: '#4ade80',
                                    lineHeight: 1.5
                                }}>
                                    ✓ 请核对以下学生信息，确认无误后点击"确认导入"
                                </p>
                            </div>

                            <div style={{
                                maxHeight: '300px',
                                overflowY: 'auto',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px'
                            }}>
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: '13px'
                                }}>
                                    <thead style={{
                                        position: 'sticky',
                                        top: 0,
                                        backgroundColor: '#1a1a2e',
                                        zIndex: 1
                                    }}>
                                        <tr>
                                            <th style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                序号
                                            </th>
                                            <th style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                学号
                                            </th>
                                            <th style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                姓名
                                            </th>
                                            <th style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                班级
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importConfirmData.map((student, index) => (
                                            <tr key={index} style={{
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                                            }}>
                                                <td style={{
                                                    padding: '10px',
                                                    color: 'rgba(255, 255, 255, 0.6)',
                                                    width: '60px'
                                                }}>
                                                    {index + 1}
                                                </td>
                                                <td style={{
                                                    padding: '10px',
                                                    color: '#fff',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    {student.student_id}
                                                </td>
                                                <td style={{
                                                    padding: '10px',
                                                    color: '#fff'
                                                }}>
                                                    {student.student_name}
                                                </td>
                                                <td style={{
                                                    padding: '10px',
                                                    color: 'rgba(255, 255, 255, 0.7)'
                                                }}>
                                                    {student.class_number || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{
                            padding: '20px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px'
                        }}>
                            <button
                                onClick={handleCancelImport}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: 'transparent',
                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#667eea',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#5a6fd6';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#667eea';
                                }}
                            >
                                确认导入
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 表格批量删除确认对话框 */}
            {showTableDeleteConfirm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#1a1a2e',
                        borderRadius: '12px',
                        maxWidth: '800px',
                        maxHeight: '80vh',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{
                            padding: '20px',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h3 style={{
                                margin: 0,
                                fontSize: '18px',
                                fontWeight: 600,
                                color: '#fff'
                            }}>
                                确认删除选中学生
                            </h3>
                            <span style={{
                                fontSize: '14px',
                                color: 'rgba(255, 255, 255, 0.6)'
                            }}>
                                共 {tableDeleteData.length} 名学生
                            </span>
                        </div>

                        <div style={{
                            padding: '20px',
                            overflowY: 'auto',
                            flex: 1
                        }}>
                            <div style={{
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '16px'
                            }}>
                                <p style={{
                                    margin: 0,
                                    fontSize: '14px',
                                    color: '#ef4444',
                                    lineHeight: 1.5,
                                    fontWeight: 500
                                }}>
                                    ⚠️ 警告：此操作将永久删除以下选中学生账户及其所有数据，无法恢复！
                                </p>
                            </div>

                            <div style={{
                                maxHeight: '300px',
                                overflowY: 'auto',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px'
                            }}>
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: '13px'
                                }}>
                                    <thead style={{
                                        position: 'sticky',
                                        top: 0,
                                        backgroundColor: '#1a1a2e',
                                        zIndex: 1
                                    }}>
                                        <tr>
                                            <th style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                序号
                                            </th>
                                            <th style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                学号
                                            </th>
                                            <th style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                姓名
                                            </th>
                                            <th style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                班级
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableDeleteData.map((student, index) => (
                                            <tr key={index} style={{
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                                            }}>
                                                <td style={{
                                                    padding: '10px',
                                                    color: 'rgba(255, 255, 255, 0.6)',
                                                    width: '60px'
                                                }}>
                                                    {index + 1}
                                                </td>
                                                <td style={{
                                                    padding: '10px',
                                                    color: '#fff',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    {student.student_id}
                                                </td>
                                                <td style={{
                                                    padding: '10px',
                                                    color: '#fff'
                                                }}>
                                                    {student.student_name}
                                                </td>
                                                <td style={{
                                                    padding: '10px',
                                                    color: 'rgba(255, 255, 255, 0.7)'
                                                }}>
                                                    {student.class_number || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{
                            padding: '20px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px'
                        }}>
                            <button
                                onClick={handleCancelTableDelete}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: 'transparent',
                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirmTableDelete}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#ef4444',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#dc2626';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#ef4444';
                                }}
                            >
                                确认删除
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 删除确认对话框 */}
            {showDeleteConfirm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#1a1a2e',
                        borderRadius: '12px',
                        maxWidth: '800px',
                        maxHeight: '80vh',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{
                            padding: '20px',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h3 style={{
                                margin: 0,
                                fontSize: '18px',
                                fontWeight: 600,
                                color: '#fff'
                            }}>
                                确认删除学生
                            </h3>
                            <span style={{
                                fontSize: '14px',
                                color: 'rgba(255, 255, 255, 0.6)'
                            }}>
                                共 {deleteConfirmData.length} 名学生
                            </span>
                        </div>

                        <div style={{
                            padding: '20px',
                            overflowY: 'auto',
                            flex: 1
                        }}>
                            <div style={{
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '16px'
                            }}>
                                <p style={{
                                    margin: 0,
                                    fontSize: '14px',
                                    color: '#ef4444',
                                    lineHeight: 1.5,
                                    fontWeight: 500
                                }}>
                                    ⚠️ 警告：此操作将永久删除以下学生账户及其所有数据，无法恢复！
                                </p>
                            </div>

                            <div style={{
                                maxHeight: '300px',
                                overflowY: 'auto',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px'
                            }}>
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: '13px'
                                }}>
                                    <thead style={{
                                        position: 'sticky',
                                        top: 0,
                                        backgroundColor: '#1a1a2e',
                                        zIndex: 1
                                    }}>
                                        <tr>
                                            <th style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                序号
                                            </th>
                                            <th style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                学号
                                            </th>
                                            <th style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                姓名
                                            </th>
                                            <th style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                班级
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deleteConfirmData.map((student, index) => (
                                            <tr key={index} style={{
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                                            }}>
                                                <td style={{
                                                    padding: '10px',
                                                    color: 'rgba(255, 255, 255, 0.6)',
                                                    width: '60px'
                                                }}>
                                                    {index + 1}
                                                </td>
                                                <td style={{
                                                    padding: '10px',
                                                    color: '#fff',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    {student.student_id}
                                                </td>
                                                <td style={{
                                                    padding: '10px',
                                                    color: '#fff'
                                                }}>
                                                    {student.student_name}
                                                </td>
                                                <td style={{
                                                    padding: '10px',
                                                    color: 'rgba(255, 255, 255, 0.7)'
                                                }}>
                                                    {student.class_number || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{
                            padding: '20px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px'
                        }}>
                            <button
                                onClick={handleCancelDelete}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: 'transparent',
                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#ef4444',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#dc2626';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#ef4444';
                                }}
                            >
                                确认删除
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
