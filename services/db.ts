
import { User, DailyReport } from '../types';

const STORAGE_KEYS = {
  USERS: 'daily_report_users',
  REPORTS: 'daily_report_reports',
  SESSION: 'daily_report_session'
};

const MAX_REPORTS = 30;

const getFromStorage = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const saveToStorage = <T>(key: string, data: T[]): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const dbService = {
  signup: async (userData: Omit<User, 'id'>): Promise<User> => {
    const users = getFromStorage<User>(STORAGE_KEYS.USERS);
    const newUser: User = { ...userData, id: crypto.randomUUID() };
    users.push(newUser);
    saveToStorage(STORAGE_KEYS.USERS, users);
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(newUser));
    return newUser;
  },

  login: async (email: string): Promise<User | null> => {
    const users = getFromStorage<User>(STORAGE_KEYS.USERS);
    const user = users.find(u => u.email === email);
    if (user) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
      return user;
    }
    return null;
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  },

  getCurrentUser: (): User | null => {
    const user = localStorage.getItem(STORAGE_KEYS.SESSION);
    return user ? JSON.parse(user) : null;
  },

  updateUser: async (user: User): Promise<User> => {
    const users = getFromStorage<User>(STORAGE_KEYS.USERS);
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      users[index] = user;
      saveToStorage(STORAGE_KEYS.USERS, users);
    }
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
    return user;
  },

  getReports: async (userId: string): Promise<DailyReport[]> => {
    const reports = getFromStorage<DailyReport>(STORAGE_KEYS.REPORTS);
    return reports
      .filter(r => r.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  saveReport: async (report: DailyReport): Promise<DailyReport> => {
    const reports = getFromStorage<DailyReport>(STORAGE_KEYS.REPORTS);
    const reportToSave = { ...report };
    
    if (!reportToSave.id) {
      // Limit check for new reports
      const userReports = reports.filter(r => r.userId === report.userId);
      if (userReports.length >= MAX_REPORTS) {
        throw new Error(`Storage Limit Reached. Max ${MAX_REPORTS} reports allowed.`);
      }
      reportToSave.id = crypto.randomUUID();
    }

    const index = reports.findIndex(r => r.id === reportToSave.id);
    if (index !== -1) {
      reports[index] = reportToSave;
    } else {
      reports.push(reportToSave);
    }
    
    saveToStorage(STORAGE_KEYS.REPORTS, reports);
    return reportToSave;
  },

  deleteReport: async (reportId: string): Promise<void> => {
    const reports = getFromStorage<DailyReport>(STORAGE_KEYS.REPORTS);
    const filtered = reports.filter(r => r.id !== reportId);
    saveToStorage(STORAGE_KEYS.REPORTS, filtered);
  }
};
