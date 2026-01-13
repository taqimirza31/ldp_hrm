import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Employee {
  id: number;
  // Core Identifiers
  employeeId: string;
  name: string; // Display Name
  firstName: string;
  middleName?: string;
  lastName: string;
  avatar?: string;
  
  // Work Details
  role: string; // Designation or Title
  department: string;
  subDepartment?: string;
  businessUnit?: string;
  primaryTeam?: string;
  costCenter?: string;
  grade?: string;
  jobCategory?: string;
  location: string; // Office Location
  managerEmail?: string;
  hrEmail?: string;
  
  // Status & Type
  status: 'Active' | 'On Leave' | 'Terminated' | 'Resigned';
  employeeType: string; // Full time, Contractor, etc.
  shift?: string;
  
  // Contact Info
  email: string; // Official Email
  personalEmail?: string;
  workPhone?: string;
  
  // Personal Details
  dob?: string;
  gender?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  
  // Address (Permanent)
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  
  // Address (Communication)
  commStreet?: string;
  commCity?: string;
  commState?: string;
  commCountry?: string;
  commZipCode?: string;
  
  // Dates
  joinDate: string;
  probationStartDate?: string;
  probationEndDate?: string;
  confirmationDate?: string;
  noticePeriod?: string;
  
  // Exit Info
  resignationDate?: string;
  lastWorkingDate?: string;
  exitType?: string;
  resignationReason?: string;
  eligibleForRehire?: string;
  
  // Custom
  customField1?: string;
  customField2?: string;
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
  { 
    id: 1, 
    employeeId: "EMP001",
    name: "Sarah Connor", 
    firstName: "Sarah",
    lastName: "Connor",
    role: "Product Director", 
    department: "Product", 
    status: "Active", 
    email: "sarah@admani.com", 
    location: "San Francisco", 
    joinDate: "2020-10-12", 
    avatar: "https://github.com/shadcn.png",
    employeeType: "Full Time",
    grade: "L6",
    managerEmail: "kyle.reese@admani.com",
    city: "San Francisco",
    state: "CA",
    country: "USA"
  },
  { 
    id: 2, 
    employeeId: "EMP002",
    name: "Neo Anderson", 
    firstName: "Neo",
    lastName: "Anderson",
    role: "Lead Engineer", 
    department: "Engineering", 
    status: "Active", 
    email: "neo@admani.com", 
    location: "Remote", 
    joinDate: "2021-03-15", 
    avatar: "https://github.com/shadcn.png",
    employeeType: "Full Time",
    grade: "L5",
    managerEmail: "morpheus@admani.com",
    city: "Chicago",
    state: "IL",
    country: "USA"
  },
  { 
    id: 3, 
    employeeId: "EMP003",
    name: "Morpheus King", 
    firstName: "Morpheus",
    lastName: "King",
    role: "VP of Operations", 
    department: "Operations", 
    status: "On Leave", 
    email: "morpheus@admani.com", 
    location: "London", 
    joinDate: "2019-06-01", 
    avatar: "https://github.com/shadcn.png",
    employeeType: "Full Time",
    grade: "L8",
    city: "London",
    country: "UK"
  },
  { 
    id: 4, 
    employeeId: "EMP004",
    name: "Trinity Moss", 
    firstName: "Trinity",
    lastName: "Moss",
    role: "Senior Designer", 
    department: "Design", 
    status: "Active", 
    email: "trinity@admani.com", 
    location: "Berlin", 
    joinDate: "2022-01-10", 
    avatar: "https://github.com/shadcn.png",
    employeeType: "Full Time",
    grade: "L5",
    managerEmail: "neo@admani.com",
    city: "Berlin",
    country: "Germany"
  },
  { 
    id: 5, 
    employeeId: "EMP005",
    name: "John Wick", 
    firstName: "John",
    lastName: "Wick",
    role: "Security Analyst", 
    department: "Security", 
    status: "Terminated", 
    email: "john@admani.com", 
    location: "New York", 
    joinDate: "2023-05-20", 
    avatar: "https://github.com/shadcn.png",
    employeeType: "Full Time",
    grade: "L4",
    exitType: "Involuntary",
    resignationReason: "Violation of Policy",
    eligibleForRehire: "No",
    lastWorkingDate: "2024-01-15"
  },
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
