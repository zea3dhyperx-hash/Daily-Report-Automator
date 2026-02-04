
import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db.ts';
import { User, DailyReport } from '../types.ts';
import { format, isValid } from 'date-fns';
import { PlusCircle, LogOut, FileText, Trash2, Calendar, X, Database, Settings, Mail, Info, Sun, Moon } from 'lucide-react';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onOpenReport: (report: DailyReport) => void;
  onUpdateUser: (user: User) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onOpenReport, onUpdateUser }) => {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [recipientData, setRecipientData] = useState({
    defaultTo: user.defaultTo || '',
    defaultCc: user.defaultCc || ''
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const MAX_REPORTS = 30;

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const data = await dbService.getReports(user.id);
        setReports(data);
      } catch (err) {
        console.error('Fetch error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchReports();
  }, [user.id]);

  const handleToggleTheme = async () => {
    const newTheme = user.theme === 'dark' ? 'light' : 'dark';
    const updatedUser = { ...user, theme: newTheme };
    await dbService.updateUser(updatedUser);
    onUpdateUser(updatedUser);
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    const updatedUser = { ...user, ...recipientData };
    await dbService.updateUser(updatedUser);
    onUpdateUser(updatedUser);
    setIsSavingSettings(false);
    setIsEditingSettings(false);
  };

  const handleCreateNew = async () => {
    if (reports.length >= MAX_REPORTS) {
      alert(`Storage Limit Reached. Please delete older reports.`);
      return;
    }
    const dateObj = new Date(selectedDate);
    if (!isValid(dateObj)) return;
    const newReport: DailyReport = {
      id: '', 
      userId: user.id,
      date: selectedDate,
      day: format(dateObj, 'EEEE'),
      tasks: [],
      planningTasks: [],
      createdAt: Date.now()
    };
    try {
      const saved = await dbService.saveReport(newReport);
      onOpenReport(saved);
      setShowDateModal(false);
    } catch (err: any) {
      alert(err.message || 'Could not save report');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Permanently delete this report from your history?')) {
      try {
        await dbService.deleteReport(id);
        setReports(prev => prev.filter(r => r.id !== id));
      } catch (err) {
        console.error('Delete failed:', err);
        alert('Could not delete the report. Please try again.');
      }
    }
  };

  const storagePercentage = Math.min((reports.length / MAX_REPORTS) * 100, 100);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 min-h-screen">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2 tracking-tighter uppercase">Hi, {user.name}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-widest">{user.teamName} • ID: {user.employeeId}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleToggleTheme} 
            className="p-3 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
            title={`Switch to ${user.theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {user.theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
          </button>
          <button onClick={() => setIsEditingSettings(true)} className="p-3 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-2xl transition-all"><Settings size={22} /></button>
          <button onClick={onLogout} className="ml-2 flex items-center gap-2 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors font-bold uppercase text-[10px] tracking-widest"><LogOut size={18} /> Logout</button>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm transition-colors">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest"><Database size={14} className="text-indigo-600 dark:text-indigo-400" /> Report Cloud Storage</div>
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500">{reports.length} / {MAX_REPORTS} REPORTS</div>
        </div>
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-500 rounded-full ${storagePercentage > 90 ? 'bg-red-500' : 'bg-indigo-600'}`} style={{ width: `${storagePercentage}%` }} />
        </div>
        {reports.length >= MAX_REPORTS && <p className="mt-3 text-[10px] font-black text-red-500 uppercase flex items-center gap-1"><Info size={12} /> Limit reached. Delete old reports to create new ones.</p>}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-sm flex flex-col md:flex-row gap-8 items-center justify-between transition-colors">
        <div className="flex items-center gap-6"><div className="w-16 h-16 bg-indigo-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0"><Mail size={32} /></div><div><h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tighter text-xl">Outlook Recipients</h3><p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Auto-fill settings for your report emails.</p></div></div>
        <div className="flex items-center gap-3 w-full md:w-auto"><div className="flex-1 md:w-64"><label className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 ml-1">Default To:</label><div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{user.defaultTo || 'Not Configured'}</div></div><button onClick={() => setIsEditingSettings(true)} className="bg-indigo-600 text-white font-black uppercase text-[10px] tracking-widest px-6 py-4 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">Update recipients</button></div>
      </div>

      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden transition-all">
        <div className="relative z-10"><h2 className="text-3xl font-black mb-3 uppercase tracking-tighter">Workflow Hub</h2><p className="mb-8 text-indigo-100 max-w-sm font-medium opacity-90 leading-relaxed text-sm">Log tasks in real-time. Export with one click directly into Outlook with pre-filled recipients.</p><button onClick={() => setShowDateModal(true)} disabled={reports.length >= MAX_REPORTS} className={`flex items-center gap-3 bg-white px-10 py-5 rounded-2xl font-black transition-all shadow-xl active:scale-95 uppercase tracking-widest text-sm ${reports.length >= MAX_REPORTS ? 'opacity-50 cursor-not-allowed text-slate-400' : 'text-indigo-600 hover:bg-indigo-50'}`}><PlusCircle size={24} /> Create New Report</button></div>
      </div>

      <div>
        <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-slate-800 dark:text-white uppercase tracking-tighter"><Database size={22} className="text-indigo-600 dark:text-indigo-400" /> Report History</h3>
        {isLoading ? <div className="grid gap-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-[2rem]"></div>)}</div> : reports.length === 0 ? <div className="text-center p-20 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem] text-slate-400 transition-colors"><Calendar size={64} className="mx-auto mb-6 opacity-5" /><p className="text-xl font-black uppercase tracking-tighter text-slate-300 dark:text-slate-700">No Historical Data</p></div> : (
          <div className="grid gap-4">
            {reports.map(report => (
              <div key={report.id} onClick={() => onOpenReport(report)} className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-2xl transition-all duration-500 cursor-pointer flex justify-between items-center group relative overflow-hidden">
                <div className="flex items-center gap-6"><div className="w-14 h-14 bg-indigo-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 dark:group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500 shadow-sm"><FileText size={28} /></div><div><div className="font-black text-xl text-slate-800 dark:text-white tracking-tight uppercase">{format(new Date(report.date), 'MMMM do, yyyy')}</div><div className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] flex items-center gap-2">{report.day} • {report.tasks.length} LOG ENTRIES</div></div></div>
                <button onClick={(e) => handleDelete(e, report.id)} className="p-4 text-slate-300 dark:text-slate-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all relative z-10"><Trash2 size={22} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800"><div className="flex justify-between items-center mb-8"><h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Launch Report</h2><button onClick={() => setShowDateModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all text-slate-400"><X size={24} /></button></div><div className="space-y-8"><input type="date" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 dark:text-white transition-all" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /><button onClick={handleCreateNew} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl uppercase tracking-widest text-sm">Initialize Log</button></div></div>
        </div>
      )}

      {isEditingSettings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 border border-slate-200 dark:border-slate-800"><div className="flex justify-between items-center mb-8"><h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white flex items-center gap-2"><Settings className="text-indigo-600 dark:text-indigo-400" /> Reporting Setup</h2><button onClick={() => setIsEditingSettings(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all text-slate-400"><X size={24} /></button></div><div className="space-y-6"><div><label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Default To (Separated by ;)</label><input type="text" value={recipientData.defaultTo} onChange={(e) => setRecipientData({...recipientData, defaultTo: e.target.value})} placeholder="manager@company.com" className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium dark:text-white" /></div><div><label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Default CC (Separated by ;)</label><input type="text" value={recipientData.defaultCc} onChange={(e) => setRecipientData({...recipientData, defaultCc: e.target.value})} placeholder="leads@company.com" className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium dark:text-white" /></div><button onClick={handleSaveSettings} disabled={isSavingSettings} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl uppercase tracking-widest text-sm">{isSavingSettings ? 'Saving...' : 'Confirm Settings'}</button></div></div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
