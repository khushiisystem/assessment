💡 Welcome to the ZEC Learn Flow Project
📘 Project Information

Repository: https://github.com/an-zd/zec-learn-flow.git

Lovable Project URL: https://lovable.dev/projects/4c3b138c-04e2-472d-9823-2a52a211dc87

🧰 Project Setup
🔹 Backend

Branch: back-end

Follow the setup instructions provided in the backend README.

🔹 Frontend

Branch: front-end

Follow the setup instructions provided in the frontend README.

⚠️ Note:
Do not push changes directly to the main branch.
Always create and work on your own branch from origin.

🧑‍💻 How to Edit the Code
Option 1 — Use Lovable

You can directly edit the project in Lovable.
Changes made there will automatically be committed to this repository.

👉 Open in Lovable

Option 2 — Work Locally (Recommended)

If you prefer using your local IDE:

# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Step 3: Install dependencies
npm install

# Step 4: Start the development server
npm run dev


✅ Prerequisite: Ensure Node.js and npm are installed.
(We recommend using nvm
)

Option 3 — Edit Directly on GitHub

Open the file you want to edit.

Click the pencil (✏️) icon.

Commit and push your changes.

Option 4 — Use GitHub Codespaces

Go to your repository → Click Code → Codespaces → New codespace

Edit files directly within the Codespace.

Commit and push when done.

🧩 Tech Stack

This project is built using modern, modular technologies:

⚡ Vite (Fast bundler)

⚛️ React + TypeScript

🎨 Tailwind CSS

🧱 shadcn/ui (component library)

🖼️ Lucide Icons

🌐 React Router DOM (client-side routing)

🔐 Axios for API communication (Auth, Login, Register)

🎯 Project Overview

ZEC Learn Flow is a role-based learning management platform designed for:

📘 Admins — to assign, manage, and monitor learning modules.

👩‍💻 Employees — to learn, track progress, and take notes.

👥 Roles and Flows
👨‍💼 Admin

Manage learners, technologies, and questions.

Assign learning modules or study materials to employees.

Track progress and completion statistics.

👩‍💻 Employee

Access assigned learning modules and materials.

View questions, submit answers, and track progress.

Save personal notes and external resource links (e.g., Google Docs).

📂 Key Pages and Features
🏠 Landing Page (src/pages/LandingPage.tsx)

Marketing-style intro with CTAs.

Quick links to Admin and Employee login.

🔐 Authentication (src/pages/Login.tsx)

Login → POST /api/auth/login

Signup → POST /api/auth/register

Role-based redirects:

Admin → /admin

Employee → /dashboard

Toast feedback for success or errors.

🧭 Employee Dashboard (src/pages/EmployeeDashboard.tsx)

Technology grid with progress bars and quick access.

Module view, recommendations, and achievements.

User data persisted in localStorage.

📚 Module View (src/components/ModuleView.tsx)

Sidebar navigation by module.

Accordion-style questions and answers.

Study materials and personal notes section.

Notes saved to localStorage.

📈 Employee Progress (src/pages/EmployeeProgress.tsx)

Overall and per-technology progress tracking.

Achievements, milestones, and recent activity.

🧑‍🏫 Admin Dashboard (src/pages/AdminDashboard.tsx)

KPIs: Learners, Technologies, Questions, Avg. Completion.

Searchable technology catalog (Java, React, Node.js, AWS, etc.).

Access question management and learner views.

🧩 Question Management (src/components/QuestionManagement.tsx)

Add, edit, and delete questions.

Tag difficulty, group by module.

Assign technology or modules to employees.

👥 Learner Management

UserListView.tsx: filter learners by name, profile, or technology.

UserDetailView.tsx: progress metrics and module details.


🧠 Data & Utilities

lib/users.ts — demo dataset and progress helpers

lib/learningContent.ts — technology → module → question mapping

lib/assignments.ts — in-memory assignment store

lib/notes.ts — localStorage CRUD for personal notes

lib/utils.ts — class name merging and helpers
