export interface CreateOnboardingDTO { employeeId: string; }
export interface UpdateOnboardingDTO { status?: string; completedAt?: string | null; }
export interface UpdateOnboardingTaskDTO { completed?: boolean; assignmentDetails?: string; }
export interface CreateOnboardingTaskDTO { taskName: string; }

export interface OnboardingTaskDTO {
  id: string; onboardingRecordId: string; taskName: string; category: string;
  completed: boolean; assignmentDetails: string | null; completedAt: string | null;
  sortOrder: number; createdAt: string; updatedAt: string;
}
export interface OnboardingResponseDTO {
  id: string; employeeId: string; ownerId: string; status: string;
  completedAt: string | null; createdAt: string; updatedAt: string;
  firstName: string; lastName: string; workEmail: string; jobTitle: string | null;
  department: string | null; joinDate: string | null;
  hireName: string; hireRole: string | null; hireDepartment: string | null;
  hireEmail: string; startDate: string | null;
  taskCount: number; completedCount: number; tasks?: OnboardingTaskDTO[];
}
