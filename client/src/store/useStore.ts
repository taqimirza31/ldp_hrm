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

  // Recruitment
  candidates: Candidate[];
  addCandidate: (candidate: Omit<Candidate, 'id'>) => void;
  moveCandidate: (id: number, newStage: string) => void;
  deleteCandidate: (id: number) => void;
}

export interface Candidate {
  id: number;
  name: string;
  role: string;
  stage: string;
  score: number;
  img: string;
}

const INITIAL_EMPLOYEES: Employee[] = [
  { id: 1, name: "Sarah Connor", role: "Product Director", department: "Product", status: "Active", email: "sarah@admani.com", location: "San Francisco", joinDate: "2020-10-12", avatar: "https://github.com/shadcn.png" },
  { id: 2, name: "Neo Anderson", role: "Lead Engineer", department: "Engineering", status: "Active", email: "neo@admani.com", location: "Remote", joinDate: "2021-03-15", avatar: "https://github.com/shadcn.png" },
  { id: 3, name: "Morpheus King", role: "VP of Operations", department: "Operations", status: "On Leave", email: "morpheus@admani.com", location: "London", joinDate: "2019-06-01", avatar: "https://github.com/shadcn.png" },
  { id: 4, name: "Trinity Moss", role: "Senior Designer", department: "Design", status: "Active", email: "trinity@admani.com", location: "Berlin", joinDate: "2022-01-10", avatar: "https://github.com/shadcn.png" },
  { id: 5, name: "John Wick", role: "Security Analyst", department: "Security", status: "Terminated", email: "john@admani.com", location: "New York", joinDate: "2023-05-20", avatar: "https://github.com/shadcn.png" },
];

const INITIAL_CANDIDATES: Candidate[] = [
  { id: 1, name: "John Wick", role: "Security Specialist", stage: "applied", score: 98, img: "https://github.com/shadcn.png" },
  { id: 2, name: "Ellen Ripley", role: "Operations Manager", stage: "interview", score: 95, img: "https://github.com/shadcn.png" },
  { id: 3, name: "Tony Stark", role: "Lead Engineer", stage: "offer", score: 99, img: "https://github.com/shadcn.png" },
  { id: 4, name: "Sarah Connor", role: "Product Owner", stage: "screening", score: 88, img: "https://github.com/shadcn.png" },
  { id: 5, name: "Bruce Wayne", role: "CEO", stage: "applied", score: 92, img: "https://github.com/shadcn.png" },
  { id: 6, name: "Natasha Romanoff", role: "HR BP", stage: "interview", score: 96, img: "https://github.com/shadcn.png" },
];

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      employees: INITIAL_EMPLOYEES,
      candidates: INITIAL_CANDIDATES,
      
      // Employee Actions
      addEmployee: (employee) => set((state) => ({
        employees: [...state.employees, { ...employee, id: Math.max(0, ...state.employees.map(e => e.id)) + 1 }]
      })),
      updateEmployee: (id, updatedEmployee) => set((state) => ({
        employees: state.employees.map((emp) => emp.id === id ? { ...emp, ...updatedEmployee } : emp)
      })),
      deleteEmployee: (id) => set((state) => ({
        employees: state.employees.filter((emp) => emp.id !== id)
      })),

      // Candidate Actions
      addCandidate: (candidate) => set((state) => ({
        candidates: [...state.candidates, { ...candidate, id: Math.max(0, ...state.candidates.map(c => c.id)) + 1 }]
      })),
      moveCandidate: (id, newStage) => set((state) => ({
        candidates: state.candidates.map((c) => c.id === id ? { ...c, stage: newStage } : c)
      })),
      deleteCandidate: (id) => set((state) => ({
        candidates: state.candidates.filter((c) => c.id !== id)
      })),
    }),
    {
      name: 'voyager-hris-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
