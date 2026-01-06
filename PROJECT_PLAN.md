# Voyager HRIS - Project Launch Plan

**Target Launch:** Friday, January 9th, 2026  
**Platform:** Replit (Voyager Edition)

## 1. Executive Summary
The goal is to deploy **Voyager HRIS V1**, a comprehensive enterprise HR platform, for pilot usage by the HR Team. 

**Why Replit?**
We are choosing Replit over Cursor/Antigravity to leverage "Vibe Coding." This allows us to rapidly iterate on design and frontend logic using natural language without getting bogged down in complex local environment configurations, git operations, or backend infrastructure management. Replit handles the hosting, environment, and deployment instantly.

## 2. Environment Strategy

We will utilize a dual-environment setup native to Replit:

*   **🟢 Staging (Development):** 
    *   **URL:** Your internal Replit Workspace (`...replit.dev`)
    *   **Purpose:** Active "Vibe Coding", real-time changes, and testing new features.
    *   **Access:** Developers (You & Me).
*   **🔵 Production (Live):**
    *   **URL:** The Deployed App (`voyager-hris.replit.app`)
    *   **Purpose:** Stable, locked version for the HR Team to use.
    *   **Access:** End Users (HR Team).
    *   **Note:** We will use **LocalStorage Persistence** to simulate a database. This means data will be saved to the user's specific browser, allowing them to test workflows (add employee, move candidate) without losing data on refresh, even without a real backend.

---

## 3. Implementation Roadmap (2-Day Sprint)

### 📅 Wednesday, Jan 7th: "Simulation & Logic"
*Focus: Making the beautiful interface actually 'work' for the user.*

*   **Objective:** Implement Client-Side Persistence.
*   **Tasks:**
    1.  **LocalStorage Adapters:** Update `Employees`, `Recruitment`, and `Tasks` modules to save data to the browser.
    2.  **Form Wiring:** Ensure "Add Employee" and "Create Job" buttons actually update the lists and show success messages.
    3.  **Interactive States:** Add hover effects, active states, and loading spinners to all buttons.
    4.  **Search Functionality:** Make the Global Command Palette (Cmd+K) and Search bars functional.

### 📅 Thursday, Jan 8th: "Polish & Protection"
*Focus: Ensuring a professional, bug-free experience.*

*   **Objective:** Visual Polish & Mobile Readiness.
*   **Tasks:**
    1.  **Mobile Response:** Verify Sidebar collapse and Table scrolling on mobile devices.
    2.  **Empty States:** Design friendly "No Data" screens for empty tables (instead of blank space).
    3.  **Toast Notifications:** Add "Saved Successfully", "Deleted", and "Error" popup notifications for all actions.
    4.  **User Guide:** Create a simple "Getting Started" modal for new users.

### 📅 Friday, Jan 9th: "Launch Day"
*Focus: Deployment and Handover.*

*   **Objective:** Go Live.
*   **Tasks:**
    1.  **Final Code Freeze:** Stop all development at 12:00 PM.
    2.  **Production Deployment:** Trigger the final Replit Deployment.
    3.  **Sanity Check:** Click through the Live URL on Desktop and Mobile.
    4.  **Handover:** Distribute URL to HR Team.

---

## 4. Immediate Next Steps (Starting Now)
1.  **Refactor Data Layer:** Move static arrays to React Context + LocalStorage hooks.
2.  **Wire "Add Employee" Modal:** Make the main action button functional.
3.  **Mobile Sidebar Test:** Ensure the new navigation works on phones.
