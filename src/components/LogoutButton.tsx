import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

export default function LogoutButton() {
  const { signOut } = useAuth();

  return (
    <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
      <LogOut className="h-4 w-4" />
      Logout
    </Button>
  );
}
