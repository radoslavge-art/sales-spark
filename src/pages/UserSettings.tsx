import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

export default function UserSettings() {
  const { user, profile, updateProfileName } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState(profile?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    try {
      await updateProfileName(name.trim());
      toast({ title: t('settings.profileUpdated') });
    } catch {
      toast({ title: t('common.error'), description: t('settings.profileUpdateFailed'), variant: 'destructive' });
    }
    setSavingName(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: t('auth.passwordTooShort'), description: t('auth.passwordTooShortDesc'), variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('settings.passwordUpdated') });
      setNewPassword('');
    }
    setSavingPassword(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-foreground">{t('settings.title')}</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.profile')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveName} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('settings.profileName')}</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('namePrompt.yourName')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('settings.profileEmail')}</label>
              <Input value={user?.email ?? ''} disabled className="bg-muted" />
            </div>
            <Button type="submit" size="sm" disabled={savingName}>
              {savingName ? t('common.saving') : t('common.save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.security')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('settings.newPasswordLabel')}</label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={t('settings.newPasswordPlaceholder')}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={savingPassword}>
              {savingPassword ? t('auth.updating') : t('settings.changePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
