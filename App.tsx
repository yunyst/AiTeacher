import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabaseClient';
import type { Profile } from './types';
import { Auth } from './components/Auth';
import { StudentApp } from './components/StudentApp';
import { TeacherApp } from './components/TeacherApp';


const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // REMOVED: visibilitychange handler that re-fetched session.
    // It was causing the entire app to unmount/remount when switching windows,
    // because fetchSession → setSession → profile useEffect → setLoading(true)
    // → loading spinner → StudentApp unmounts → all course state is lost.

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      if (session) {
        // Only show full-page loading spinner on initial load, not on session updates.
        // Otherwise token refresh / auth events would unmount StudentApp.
        if (!profile) setLoading(true);
        try {
          const { data, error, status } = await supabase
            .from('profiles')
            .select(`role, email, student_id, student_name`)
            .eq('id', session.user.id)
            .single();

          if (error && status !== 406) {
            throw error;
          }

          if (data) {
            setProfile(data as Profile);
          }
        } catch (error: any) {
          console.error('[App] Error fetching user profile:', error);
          if (error.message === 'JWT expired') {
            supabase.auth.signOut();
          } else {
            alert(`Could not fetch user profile: ${error.message || 'An unknown error occurred.'}`);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    };

    fetchProfile();
    return () => { cancelled = true; };
  }, [session]);


  if (loading) {
    return (
      <div className="flex h-screen bg-slate-900 items-center justify-center text-white text-xl">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading Session...
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (profile?.role === 'teacher') {
    return <TeacherApp session={session} profile={profile} />;
  }

  return <StudentApp session={session} profile={profile} />;
};

export default App;