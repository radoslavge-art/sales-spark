import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import NamePrompt from '@/pages/NamePrompt';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, profile, profileLoading } = useAuth();

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!profile?.name) return <NamePrompt />;

  return <>{children}</>;
}
