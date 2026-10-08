import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { Eye, EyeOff } from 'lucide-react';
import autoSorsaLogo from '@/assets/autsorsa-logo-hires.png';
import autoSorsaLogoDark from '@/assets/autsorsa-logo-dark.png';

export default function Register() {
  const { session, loading } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      toast({ title: t('auth.registrationFailed'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('auth.registrationSuccess') });
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="flex justify-center">
          <img src={autoSorsaLogo} alt="Autsorsa" className="h-14 w-auto object-contain dark:hidden" fetchPriority="high" />
          <img src={autoSorsaLogoDark} alt="Autsorsa" className="h-14 w-auto object-contain hidden dark:block" fetchPriority="high" />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t('auth.signUp')}</h1>
            <p className="text-sm text-muted-foreground">{t('auth.registerToStart')}</p>
          </div>

          <GoogleSignInButton />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground select-none">{t('common.or')}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              type="email"
              placeholder={t('auth.email')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.passwordMinPlaceholder')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <Button type="submit" className="w-full font-semibold" disabled={submitting}>
              {submitting ? t('auth.signingUp') : t('auth.register')}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">{t('auth.signIn')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
