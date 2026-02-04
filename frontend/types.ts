
export interface User {
  id: string;
  name: string;
  employeeId: string;
  teamName: string;
  email: string;
  defaultTo?: string;
  defaultCc?: string;
  savedColors?: string[];
  theme?: 'light' | 'dark';
}

export interface TaskRow {
  id: string;
  date: string;
  day: string;
  projectName: string;
  projectType: string;
  assignedBy: string;
  employeeName: string;
  employeeId: string;
  teamName: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  workingHours: string;
  remarks: string;
  isRunning: boolean;
}

export interface PlanningTask {
  id: string;
  label: string;
  description: string;
}

export interface DailyReport {
  id: string;
  userId: string;
  date: string;
  day: string;
  tasks: TaskRow[];
  planningTasks?: PlanningTask[];
  createdAt: number;
  preText?: string;
  postText?: string;
  themeColor?: string;
  isPlainTheme?: boolean;
}

export interface AIResponse {
  projectName: string;
  projectType: string;
  assignedBy: string;
  remarks: string;
}
