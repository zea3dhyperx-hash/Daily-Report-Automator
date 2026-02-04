
import React, { useState } from 'react';
import { dbService } from '../services/db.ts';
import { User } from '../types.ts';

interface AuthProps {
  onAuthSuccess: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    employeeId: '',
    teamName: '',
    email: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    setTimeout(async () => {
      try {
        if (isLogin) {
          const user = await dbService.login(formData.email);
          if (user) {
            onAuthSuccess(user);
          } else {
            alert('User not found. Check email or sign up.');
          }
        } else {
          const user = await dbService.signup({
            name: formData.name,
            employeeId: formData.employeeId,
            teamName: formData.teamName,
            email: formData.email,
            theme: 'light' // Default theme
          });
          onAuthSuccess(user);
        }
      } catch (err: any) {
        console.error('Auth error', err);
        alert(err?.message || 'An error occurred during authentication.');
      } finally {
        setIsLoading(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 p-12 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-800">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-12">
            <span className="text-white font-black text-2xl">DR</span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tighter">Daily Report</h1>
          <p className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest">Local Automation Tool</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <>
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Full Name</label>
                <input
                  required
                  type="text"
                  placeholder="John Doe"
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700 dark:text-slate-100 transition-all"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Emp ID</label>
                  <input
                    required
                    type="text"
                    placeholder="E1234"
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700 dark:text-slate-100 transition-all"
                    value={formData.employeeId}
                    onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Team</label>
                  <input
                    required
                    type="text"
                    placeholder="QA Team"
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700 dark:text-slate-100 transition-all"
                    value={formData.teamName}
                    onChange={e => setFormData({ ...formData, teamName: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}
          <div>
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Email Address</label>
            <input
              required
              type="email"
              placeholder="name@company.com"
              className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700 dark:text-slate-100 transition-all"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none disabled:opacity-50 active:scale-95 uppercase tracking-wider text-sm"
          >
            {isLoading ? 'Processing...' : (isLogin ? 'Login to Local Store' : 'Initialize Account')}
          </button>
        </form>
        
        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition uppercase tracking-widest"
          >
            {isLogin ? "New user? Create account" : "Have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
