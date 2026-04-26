import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [inviteCode, setInviteCode] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
        if (isLogin) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } else {
            // 前端校验：学生注册必须填写学号和姓名
            if (role === 'student' && (!studentId.trim() || !studentName.trim())) {
              throw new Error('学生注册必须填写学号和姓名');
            }

            // 前端校验：教师注册必须填写邀请码
            if (role === 'teacher' && !inviteCode.trim()) {
              throw new Error('教师注册必须填写邀请码');
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        role: role,
                        email: email,
                        invite_code: role === 'teacher' ? inviteCode.trim() : undefined,
                        student_id: role === 'student' ? studentId.trim() : undefined,
                        student_name: role === 'student' ? studentName.trim() : undefined,
                    },
                },
            });
            
            if (error) throw error;
            
            // 检查邮箱是否已确认
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.confirmed_at) {
                // 邮箱已确认，可能是重复注册，提示直接登录
                setMessage('该邮箱已注册完成，请直接登录。');
            } else {
                // 邮箱未确认，提示查看邮件
                setMessage('注册成功！请查看邮箱确认链接。如邮箱未收到确认邮件,请使用未注册过的邮箱重新注册。');
                
                // 检查是否有用户ID但没有确认邮件
                if (user && user.id) {
                    setMessage('注册成功！请查看邮箱确认链接。如果邮件未收到，可能已确认过，请直接尝试登录。');
                }
            }
        }
    } catch (error: any) {
        // 处理后端邀请码相关错误，翻译成中文友好提示
        const errMsg = error.message || error.error_description || '';
        console.log('注册错误详情:', error); // 调试日志
        
        if (errMsg.includes('教师注册必须提供邀请码')) {
          setError('教师注册必须填写邀请码');
        } else if (errMsg.includes('无效或已过期的邀请码')) {
          setError('邀请码无效或已被使用，请检查后重试');
        } else if (errMsg.includes('学号已被注册')) {
          setError('该学号已被注册，如非本人操作请联系管理员');
        } else if (errMsg.includes('Database error') || errMsg.includes('constraint violation')) {
          // 可能是数据库约束错误，比如邀请码已使用或学号重复
          setError('注册信息有误，请检查后重试');
        } else {
          setError(errMsg || '操作失败，请稍后重试');
        }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen font-sans relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="w-full max-w-md p-10 space-y-8 glass-card relative z-10 animate-fade-in-scale mx-4">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 animate-float shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-4xl font-bold modern-title">
            {isLogin ? '欢迎回来' : '创建账户'}
          </h2>
          <p className="text-base text-white/70 font-medium">
            智能AI导师系统
          </p>
        </div>

        <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
            <button 
              onClick={() => { setIsLogin(true); setInviteCode(''); setStudentId(''); setStudentName(''); setError(null); setMessage(null); }} 
              className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all duration-300 ${
                isLogin 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}>
                登录
            </button>
            <button 
              onClick={() => { setIsLogin(false); setInviteCode(''); setStudentId(''); setStudentName(''); setError(null); setMessage(null); }} 
              className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all duration-300 ${
                !isLogin 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}>
                注册
            </button>
        </div>

        <form className="space-y-5" onSubmit={handleAuth}>
          <div>
            <input
              id="email"
              type="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              className="modern-input input-focus-glow"
              placeholder="邮箱地址"
            />
          </div>

          <div>
            <input
              id="password"
              type="password"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
              className="modern-input input-focus-glow"
              placeholder="密码"
            />
          </div>
          
          {!isLogin && (
            <div>
              <span className="text-sm font-medium dark-mode-text-secondary">我是：</span>
              <div className="flex items-center mt-3 space-x-4">
                <label className="flex items-center space-x-3 cursor-pointer group" onClick={() => { setRole('student'); setInviteCode(''); setStudentId(''); setStudentName(''); setError(null); }}>
                  <div className={`relative w-5 h-5 rounded-full border-2 transition-all ${
                    role === 'student' 
                      ? 'border-purple-500 bg-purple-500' 
                      : 'border-white/30 group-hover:border-white/50'
                  }`}>
                    {role === 'student' && (
                      <div className="absolute inset-1 rounded-full bg-white animate-pulse"></div>
                    )}
                  </div>
                  <span className="text-white font-medium group-hover:text-purple-400 transition-colors">学生</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer group" onClick={() => { setRole('teacher'); setStudentId(''); setStudentName(''); setError(null); }}>
                  <div className={`relative w-5 h-5 rounded-full border-2 transition-all ${
                    role === 'teacher' 
                      ? 'border-pink-500 bg-pink-500' 
                      : 'border-white/30 group-hover:border-white/50'
                  }`}>
                    {role === 'teacher' && (
                      <div className="absolute inset-1 rounded-full bg-white animate-pulse"></div>
                    )}
                  </div>
                  <span className="text-white font-medium group-hover:text-pink-400 transition-colors">教师</span>
                </label>
              </div>
            </div>
          )}

          {!isLogin && role === 'student' && (
            <div className="space-y-3 animate-fade-in-up">
              <div>
                <input
                  id="studentId"
                  type="text"
                  value={studentId}
                  required
                  onChange={(e) => setStudentId(e.target.value)}
                  className="modern-input input-focus-glow"
                  placeholder="学号"
                />
              </div>
              <div>
                <input
                  id="studentName"
                  type="text"
                  value={studentName}
                  required
                  onChange={(e) => setStudentName(e.target.value)}
                  className="modern-input input-focus-glow"
                  placeholder="姓名"
                />
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-xs text-amber-400/90 leading-relaxed">请填写真实学号和姓名，提交后不可修改</p>
              </div>
            </div>
          )}

          {!isLogin && role === 'teacher' && (
            <div>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                required
                onChange={(e) => setInviteCode(e.target.value)}
                className="modern-input input-focus-glow animate-fade-in-up"
                placeholder="教师邀请码"
              />
              <p className="text-xs text-white/40 mt-2 ml-1">注册教师身份需要填写有效的邀请码</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center animate-fade-in-up">
              {error}
            </div>
          )}
          {message && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm text-center animate-fade-in-up">
              {message}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full modern-button text-base py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  处理中...
                </span>
              ) : (
                isLogin ? '登录' : '注册'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};