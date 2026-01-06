import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Employee {
  id: number;
  name: string;
  role: string;
  department: string;
  status: 'Active' | 'On Leave' | 'Terminated';
  email: string;
  location: string;
  joinDate: string;
  avatar?: string;
}

interface AppState {
  employees: Employee[];
  addEmployee: (employee: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: number, employee: Partial<Employee>) => void;
  deleteEmployee: (id: number) => void;
}

const INITIAL_EMPLOYEES: Employee[] = [
  { id: 1, name: "Sarah Connor", role: "Product Director", department: "Product", status: "Active", email: "sarah@admani.com", location: "San Francisco", joinDate: "2020-10-12", avatar: "https://github.com/shadcn.png" },
  { id: 2, name: "Neo Anderson", role: "Lead Engineer", department: "Engineering", status: "Active", email: "neo@admani.com", location: "Remote", joinDate: "2021-03-15", avatar: "https://github.com/shadcn.png" },
  { id: 3, name: "Morpheus King", role: "VP of Operations", department: "Operations", status: "On Leave", email: "morpheus@admani.com", location: "London", joinDate: "2019-06-01", avatar: "https://github.com/shadcn.png" },
  { id: 4, name: "Trinity Moss", role: "Senior Designer", department: "Design", status: "Active", email: "trinity@admani.com", location: "Berlin", joinDate: "2022-01-10", avatar: "https://github.com/shadcn.png" },
  { id: 5, name: "John Wick", role: "Security Analyst", department: "Security", status: "Terminated", email: "john@admani.com", location: "New York", joinDate: "2023-05-20", avatar: "https://github.com/shadcn.png" },
];

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      employees: INITIAL_EMPLOYEES,
      addEmployee: (employee) => set((state) => ({
        employees: [...state.employees, { ...employee, id: Math.max(0, ...state.employees.map(e => e.id)) + 1 }]
      })),
      updateEmployee: (id, updatedEmployee) => set((state) => ({
        employees: state.employees.map((emp) => emp.id === id ? { ...emp, ...updatedEmployee } : emp)
      })),
      deleteEmployee: (id) => set((state) => ({
        employees: state.employees.filter((emp) => emp.id !== id)
      })),
    }),
    {
      name: 'voyager-hris-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
