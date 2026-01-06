# Voyager HRIS - Master Execution Plan

**Project:** Voyager HRIS (Enterprise Prototype)  
**Goal:** Deploy fully functional V1 for HR Pilot  
**Platform:** Replit (Vibe Coding & Deployment)  
**Deadline:** Friday, January 9th, 2026 @ 5:00 PM  

---

## 📅 Phase 1: Interactive Logic (Wednesday, Jan 7)
**Goal:** Make the app "remember" data. When you add an employee, they stay added.

### Morning (09:00 - 13:00)
1.  **[Dev] State Management Setup:** 
    *   Install `zustand` for easy global state management.
    *   Create `client/src/store/useStore.ts` to handle Employees, Candidates, and Tasks.
    *   Configure `persist` middleware so data survives page reloads (simulating a database).
2.  **[Dev] Employee Module Wiring:**
    *   Connect the "Add Employee" form to the store.
    *   Make "Delete" and "Edit" buttons functional.
    *   **User Action:** *Test adding a fake employee and refreshing the page to see if they remain.*

### Afternoon (14:00 - 18:00)
3.  **[Dev] Recruitment Pipeline:**
    *   Make the Kanban board drag-and-drop persist changes.
    *   Allow adding new Candidates to specific stages.
4.  **[Dev] Task Management:**
    *   Wire up the "Tasks" page to allow creating and checking off to-dos.
5.  **[Dev] Search & Command Palette:**
    *   Index the new dynamic data so `Cmd+K` finds the new employees/candidates.
    *   **User Action:** *Try searching for a newly added candidate.*

---

## 📅 Phase 2: Polish & Protection (Thursday, Jan 8)
**Goal:** Make it feel professional and unbreakable.

### Morning (09:00 - 13:00)
1.  **[Dev] Feedback Systems:**
    *   Implement "Toast" notifications (e.g., "✅ Employee Saved Successfully").
    *   Add confirmation dialogs for destructive actions (e.g., "Are you sure you want to delete?").
2.  **[Dev] Empty States:**
    *   Design friendly placeholder screens for pages with no data (e.g., "No Candidates yet. Add one?").
    *   **User Action:** *Review the "Empty State" designs and approve the copy.*

### Afternoon (14:00 - 18:00)
3.  **[Dev] Mobile Responsiveness:**
    *   Fix sidebar behavior on mobile.
    *   Ensure complex tables scroll horizontally on small screens.
4.  **[Dev] Final Design Sweep:**
    *   Consistency check on fonts, colors, and spacing.
    *   Ensure the new "Voyager" logo is visible everywhere.
    *   **User Action:** *Click through every page on your phone and report any broken layouts.*

---

## 📅 Phase 3: Launch Day (Friday, Jan 9)
**Goal:** Deployment and Handover.

### Morning (09:00 - 12:00) - Code Freeze
1.  **[Dev] Code Cleanup:** Remove temporary console logs and unused components.
2.  **[Dev] Performance Tune:** Optimize image loading and bundle size.
3.  **[User & Dev] Final Walkthrough:** We do a live walkthrough of the staging environment together.

### Afternoon (13:00 - 17:00) - Deployment
4.  **[Dev] Production Build:** Trigger the Replit Deployment pipeline.
5.  **[Dev] DNS & Domain:** Verify `voyager-hris.replit.app` is live and secure (HTTPS).
6.  **[User] Distribution:** Send the link to the HR Team.

---

## 🛠️ Environment Strategy

We are using **Replit** for the entire lifecycle to ensure speed and simplicity.

1.  **Staging (Where we work):**
    *   The **Workspace** you are looking at right now.
    *   We use this for "Vibe Coding" (rapid iteration).
    *   Changes happen here instantly.

2.  **Production (Where HR works):**
    *   **URL:** `voyager-hris.replit.app`
    *   **Setup:** We will use the "Deploy" button in Replit to freeze the code and host it on a dedicated server.
    *   **Data:** Because we are using Client-Side Persistence (LocalStorage), every HR user will have their own private "instance" of data in their browser. This is perfect for a pilot/demo as it prevents users from messing up each other's data.

---

## ✅ Immediate Next Steps for You (The User)
1.  **Approve this Plan:** Give me the "Go Ahead" to start Phase 1.
2.  **Sit Back:** I will begin wiring up the Employee Module immediately.
