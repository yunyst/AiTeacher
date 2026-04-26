// import { createClient } from '@supabase/supabase-js';

// // Use the provided static Supabase credentials
// const supabaseUrl = 'https://stdukafgtrhklodlywmz.supabase.co';
// const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZHVrYWZndHJoa2xvZGx5d216Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2Mjk1OTMsImV4cCI6MjA3NDIwNTU5M30.ZauNBcwh_YFGS6Kq9nES3JI6TmYXTZrl7l3HFBwNXQI';

// if (!supabaseUrl || !supabaseAnonKey) {
//   // A console error is used here instead of throwing an error to prevent crashing the app
//   // in environments where the keys might not be immediately available.
//   console.error("Supabase credentials are not set.");
// }

// export const supabase = createClient(supabaseUrl!, supabaseAnonKey!);


import { createClient } from '@supabase/supabase-js';

/**
 * 使用你在 Supabase 控制台创建的项目：
 * Project Settings → API → Project URL、anon public key
 *
 * 在仓库根目录创建 `.env.local`（已被 git 忽略），例如：
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] 未配置 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY。请复制 .env.example 为 .env.local 并填入你在 supabase.com 申请的项目信息。'
  );
}

/**
 * 自定义 Lock 实现，绕过浏览器 Navigator LockManager 兼容问题。
 * 某些浏览器（特别是 WebView 或旧版 Chromium 内核）在调用
 * navigator.locks.request() 不带 ifAvailable 时会返回 null lock，
 * 导致 gotrue-js 报错并触发会话刷新 → 整个 App 状态重置。
 *
 * 签名需匹配 @supabase/gotrue-js 的 LockFunc：
 *   <R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R>
 */
const noOpLock = <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  return fn();
};

/** 未配置时使用占位值，避免模块初始化崩溃；实际请求会失败，直到你填写正确环境变量 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'sb-placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'teacher13-auth',
      // 使用无操作锁替代 Navigator LockManager，彻底避免兼容性报错
      lock: noOpLock,
    },
  }
);
