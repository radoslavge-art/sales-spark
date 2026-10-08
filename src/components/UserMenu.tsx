import { LogOut, Settings, Moon, Sun, Shield, ChevronDown, Globe } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useEffect, useState } from 'react';

interface UserMenuProps {
  isAdmin: boolean;
  onNavigate: (view: string) => void;
}

export function UserMenu({ isAdmin, onNavigate }: UserMenuProps) {
  const { profile, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const displayName = profile?.name || 'User';
  const [open, setOpen] = useState(false);

  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [dark]);

  const handleAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-sm font-medium h-10 px-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="max-w-[120px] truncate">{displayName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-52 p-1.5">
        <button
          onClick={() => handleAction(() => onNavigate('settings'))}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Settings className="h-4 w-4" /> {t('userMenu.settings')}
        </button>
        {isAdmin && (
          <button
            onClick={() => handleAction(() => onNavigate('admin'))}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Shield className="h-4 w-4" /> {t('userMenu.adminPanel')}
          </button>
        )}

        <Separator className="my-1.5" />

        {/* Dark mode toggle */}
        <div className="flex items-center justify-between rounded-md px-2.5 py-2">
          <div className="flex items-center gap-2.5 text-sm">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{dark ? t('userMenu.lightMode') : t('userMenu.darkMode')}</span>
          </div>
          <Switch checked={dark} onCheckedChange={setDark} className="scale-90" />
        </div>

        {/* Language toggle */}
        <div className="flex items-center justify-between rounded-md px-2.5 py-2">
          <div className="flex items-center gap-2.5 text-sm">
            <Globe className="h-4 w-4" />
            <span>{language === 'bg' ? 'EN' : 'BG'}</span>
          </div>
          <Switch checked={language === 'bg'} onCheckedChange={(checked) => setLanguage(checked ? 'bg' : 'en')} className="scale-90" />
        </div>

        <Separator className="my-1.5" />

        <button
          onClick={() => handleAction(signOut)}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-destructive"
        >
          <LogOut className="h-4 w-4" /> {t('userMenu.logOut')}
        </button>
      </PopoverContent>
    </Popover>
  );
}