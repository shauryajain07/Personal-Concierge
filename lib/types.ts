export type Course = {
  id: string;
  semesterId: string;
  code: string;
  name: string;
  color: string;
  credits: number;
  progress: number;
};

export type Assignment = {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueAt: string;
  status: "not_started" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  estimatedMinutes: number;
  actualMinutes: number;
  progress: number;
  createdAt: string;
  subtasks?: Subtask[];
};

export type Subtask = {
  id: string;
  assignmentId: string;
  title: string;
  estimatedMinutes: number;
  status: "pending" | "completed";
  position: number;
};

export type Note = {
  id: string;
  courseId: string | null;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Grade = {
  id: string;
  courseId: string;
  title: string;
  score: number;
  maxScore: number;
  weight: number;
};

export type CalendarEvent = {
  id: string;
  courseId: string | null;
  assignmentId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  type: "class" | "personal" | "deadline";
  locked: boolean;
};

export type StudySession = {
  id: string;
  assignmentId: string;
  subtaskId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  status: "planned" | "completed" | "missed";
  planId: string | null;
};

export type AcademicData = {
  semesters: Array<{ id: string; name: string; number: number; startDate: string; endDate: string }>;
  courses: Course[];
  assignments: Assignment[];
  notes: Note[];
  grades: Grade[];
  events: CalendarEvent[];
  studySessions: StudySession[];
  aiConfigured: boolean;
  aiAuthMessage?: string;
  aiModel?: string;
};

export type PlanChange = {
  id: string;
  assignmentId: string;
  title: string;
  startAt: string;
  endAt: string;
  reason: string;
};
