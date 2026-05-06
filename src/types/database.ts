// Supabase DB 타입 정의
// 스키마 변경 시 이 파일도 함께 업데이트

export type TaskStatus   = "backlog" | "todo" | "doing" | "blocked" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskType     = "planning" | "design" | "development" | "qa" | "operation" | "documentation" | "meeting" | "research" | "customer" | "management" | "other";
export type TaskDifficulty = "low" | "medium" | "high" | "very_high";
export type ProjectStatus  = "active" | "on_hold" | "completed" | "cancelled";
export type ProjectHealth  = "good" | "at_risk" | "critical";
export type UserRole       = "admin" | "leader" | "member";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  team: string | null;
  role: UserRole;
  level: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  priority: TaskPriority;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  task_type: TaskType;
  priority: TaskPriority;
  difficulty: TaskDifficulty | null;
  assignee_id: string | null;
  created_by: string | null;
  reviewer_id: string | null;
  status: TaskStatus;
  blocked_reason: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  started_at: string | null;
  completed_at: string | null;
  has_external_dependency: boolean;
  external_dependency_note: string | null;
  result_url: string | null;
  due_date_changed_count: number;
  scope_changed_count: number;
  created_at: string;
  updated_at: string;
}

export interface TaskEvent {
  id: string;
  task_id: string;
  event_type: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus | null;
  changed_by: string | null;
  changed_at: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
}

// 화면용 조인 타입
export interface TaskWithRelations extends Task {
  assignee?: User | null;
  project?: Project | null;
  reviewer?: User | null;
}

export interface Database {
  public: {
    Tables: {
      users:       { Row: User;       Insert: Partial<User>;       Update: Partial<User>; };
      projects:    { Row: Project;    Insert: Partial<Project>;    Update: Partial<Project>; };
      tasks:       { Row: Task;       Insert: Partial<Task>;       Update: Partial<Task>; };
      task_events: { Row: TaskEvent;  Insert: Partial<TaskEvent>;  Update: Partial<TaskEvent>; };
    };
  };
}
