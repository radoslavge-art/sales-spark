import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import autoSorsaLogo from '@/assets/autsorsa-logo-hires.png';
import autoSorsaLogoDark from '@/assets/autsorsa-logo-dark.png';

export default function ResetPassword() {
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
      if (event === 'SIGNED_IN' && session) setReady(true);
    });

    const hash = window.location.hash;
    const search = window.location.search;
    if (hash.includes('type=recovery') || search.includes('type=recovery')) setReady(true);
    if (hash.includes('error=') || search.includes('error=')) setExpired(true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    const timeout = setTimeout(() => { if (!ready) setExpired(true); }, 8000);

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) { setError(t('auth.passwordMinLength')); return; }
    if (password !== confirmPassword) { setError(t('auth.passwordsMismatch')); return; }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      if (updateError.message.toLowerCase().includes('expired') || updateError.message.toLowerCase().includes('invalid')) {
        setError(t('auth.resetLinkExpired'));
      } else {
        setError(updateError.message);
      }
      toast({ title: t('common.error'), description: updateError.message, variant: 'destructive' });
    } else {
      toast({ title: t('auth.passwordUpdated'), description: t('auth.passwordUpdatedDesc') });
      await supabase.auth.signOut();
      navigate('/login');
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
          {expired && !ready ? (
            <div className="text-center space-y-4">
              <h1 className="text-xl font-bold text-foreground">{t('auth.linkExpired')}</h1>
              <p className="text-sm text-muted-foreground">{t('auth.linkExpiredDesc')}</p>
              <Link to="/forgot-password">
                <Button className="w-full font-semibold">{t('auth.requestNewLink')}</Button>
              </Link>
              <p className="text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline font-medium">{t('auth.backToSignIn')}</Link>
              </p>
            </div>
          ) : !ready ? (
            <div className="text-center space-y-3 py-4">
              <p className="text-sm text-muted-foreground">{t('auth.verifyingLink')}</p>
              <p className="text-xs text-muted-foreground/60">{t('auth.verifyingLinkSlow')}</p>
            </div>
          ) : (
            <>
              <div className="text-center space-y-1">
                <h1 className="text-xl font-bold text-foreground">{t('auth.setNewPassword')}</h1>
                <p className="text-sm text-muted-foreground">{t('auth.enterNewPassword')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input type="password" placeholder={t('auth.newPasswordPlaceholder')} value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
                <Input type="password" placeholder={t('auth.confirmPassword')} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={6} required />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full font-semibold" disabled={submitting}>
                  {submitting ? t('auth.updating') : t('auth.updatePassword')}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline font-medium">{t('auth.backToSignIn')}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
