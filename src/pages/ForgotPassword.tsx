import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import autoSorsaLogo from '@/assets/autsorsa-logo-hires.png';
import autoSorsaLogoDark from '@/assets/autsorsa-logo-dark.png';

export default function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      setSent(true);
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
            <h1 className="text-xl font-bold text-foreground">{t('auth.resetPassword')}</h1>
            <p className="text-sm text-muted-foreground">{t('auth.enterEmail')}</p>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('auth.resetSent', { email })}
              </p>
              <Link to="/login" className="text-primary hover:underline text-sm font-medium">
                {t('auth.backToSignIn')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder={t('auth.email')}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <Button type="submit" className="w-full font-semibold" disabled={submitting}>
                {submitting ? t('auth.sending') : t('auth.sendResetLink')}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline font-medium">{t('auth.backToSignIn')}</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
