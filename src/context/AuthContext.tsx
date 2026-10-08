import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { name: string } | null;
  loading: boolean;
  profileLoading: boolean;
  isAdmin: boolean;
  isSales: boolean;
  signOut: () => Promise<void>;
  updateProfileName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_ACTIVITY_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSales, setIsSales] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create a new session record on login
  const createSessionRecord = useCallback(async (userId: string) => {
    const { data } = await (supabase.from('user_sessions' as any).insert({ user_id: userId }).select('id').single() as any);
    if (data?.id) {
      sessionIdRef.current = data.id;
    }
  }, []);

  // Update last_active_at periodically
  const updateActivity = useCallback(async () => {
    if (!sessionIdRef.current) return;
    await (supabase.from('user_sessions' as any).update({ last_active_at: new Date().toISOString() }).eq('id', sessionIdRef.current) as any);
  }, []);

  // Close session on logout
  const closeSessionRecord = useCallback(async () => {
    if (!sessionIdRef.current) return;
    await (supabase.from('user_sessions' as any).update({ logout_at: new Date().toISOString(), last_active_at: new Date().toISOString() }).eq('id', sessionIdRef.current) as any);
    sessionIdRef.current = null;
  }, []);

  // Start activity heartbeat
  const startActivityTracking = useCallback(() => {
    if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    activityTimerRef.current = setInterval(updateActivity, SESSION_ACTIVITY_INTERVAL);
  }, [updateActivity]);

  const stopActivityTracking = useCallback(() => {
    if (activityTimerRef.current) {
      clearInterval(activityTimerRef.current);
      activityTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);

      if (_event === 'SIGNED_IN' && session?.user && !sessionIdRef.current) {
        createSessionRecord(session.user.id);
        startActivityTracking();
      }
      if (_event === 'SIGNED_OUT') {
        closeSessionRecord();
        stopActivityTracking();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user && !sessionIdRef.current) {
        createSessionRecord(session.user.id);
        startActivityTracking();
      }
    });

    return () => {
      subscription.unsubscribe();
      stopActivityTracking();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch profile + role when session changes
  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      setProfileLoading(false);
      setIsAdmin(false);
      setIsSales(false);
      return;
    }
    setProfileLoading(true);

    // Fetch profile
    (supabase.from('profiles' as any)
      .select('name')
      .eq('id', session.user.id)
      .single() as any)
      .then(({ data }: any) => {
        setProfile(data ? { name: data.name } : { name: '' });
        setProfileLoading(false);
      });

    // Fetch roles
    (supabase.from('user_roles' as any)
      .select('role')
      .eq('user_id', session.user.id) as any)
      .then(({ data }: any) => {
        const roles = (data || []).map((r: any) => r.role);
        setIsAdmin(roles.includes('admin'));
        // CRM managers share the sales workspace while retaining their broader
        // database permissions through the CRM row-level-security policies.
        setIsSales(roles.includes('sales') || roles.includes('manager'));
      });
  }, [session?.user?.id]);

  const signOut = async () => {
    await closeSessionRecord();
    stopActivityTracking();
    await supabase.auth.signOut();
  };

  const updateProfileName = async (name: string) => {
    if (!session?.user) return;
    await (supabase.from('profiles' as any) as any)
      .upsert({ id: session.user.id, name });
    setProfile({ name });
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, profileLoading, isAdmin, isSales, signOut, updateProfileName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
