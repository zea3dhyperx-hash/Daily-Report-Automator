
import { User, DailyReport } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const SESSION_KEY = 'daily_report_session';

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }
  return res.json() as Promise<T>;
};

export const dbService = {
  signup: async (userData: Omit<User, 'id'>): Promise<User> => {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const user = await handleResponse<User>(res);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
  },

  login: async (email: string): Promise<User | null> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (res.status === 404) return null;
    const user = await handleResponse<User>(res);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  getCurrentUser: (): User | null => {
    const user = localStorage.getItem(SESSION_KEY);
    return user ? JSON.parse(user) : null;
  },

  updateUser: async (user: User): Promise<User> => {
    const res = await fetch(`${API_BASE}/auth/user/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    const updated = await handleResponse<User>(res);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    return updated;
  },

  getReports: async (userId: string): Promise<DailyReport[]> => {
    const res = await fetch(`${API_BASE}/reports/${userId}`);
    return handleResponse<DailyReport[]>(res);
  },

  saveReport: async (report: DailyReport): Promise<DailyReport> => {
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    return handleResponse<DailyReport>(res);
  },

  deleteReport: async (reportId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/reports/${reportId}`, { method: 'DELETE' });
    await handleResponse(res);
  }
};
