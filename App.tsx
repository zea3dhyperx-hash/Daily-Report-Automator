
import React, { useState, useEffect } from 'react';
import Auth from './components/Auth.tsx';
import Dashboard from './components/Dashboard.tsx';
import ReportEditor from './components/ReportEditor.tsx';
import { dbService } from './services/db.ts';
import { User, DailyReport } from './types.ts';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeReport, setActiveReport] = useState<DailyReport | null>(null);

  useEffect(() => {
    const session = dbService.getCurrentUser();
    if (session) setUser(session);
  }, []);

  // Sync dark mode class with user preference
  useEffect(() => {
    if (user?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user?.theme]);

  const handleLogout = () => {
    dbService.logout();
    setUser(null);
    setActiveReport(null);
  };

  if (!user) {
    return <Auth onAuthSuccess={setUser} />;
  }

  if (activeReport) {
    return (
      <ReportEditor 
        user={user} 
        report={activeReport} 
        onClose={() => setActiveReport(null)} 
        onUpdateUser={setUser}
      />
    );
  }

  return (
    <Dashboard 
      user={user} 
      onLogout={handleLogout} 
      onOpenReport={setActiveReport}
      onUpdateUser={setUser}
    />
  );
};

export default App;
