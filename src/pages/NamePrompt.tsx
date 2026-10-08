import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function NamePrompt() {
  const { updateProfileName } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await updateProfileName(name.trim());
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('namePrompt.welcome')}</CardTitle>
          <CardDescription>{t('namePrompt.enterName')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder={t('namePrompt.yourName')}
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={saving || !name.trim()}>
              {saving ? t('common.saving') : t('namePrompt.continue')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
