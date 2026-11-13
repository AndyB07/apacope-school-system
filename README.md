# GSA APACOPE School Management System
React (Vite) + Node/Express + MongoDB (local or free MongoDB Atlas).

## Run
1. `cd server && cp .env.example .env` (put your MongoDB URI in it) `&& npm install && npm run seed && npm start`  (API on :5000)
2. `cd client && npm install && npm run dev`  (open http://localhost:5173)

The Vite development server proxies `/api` to `http://localhost:5000`. When hosting the client and API on separate origins, configure `VITE_API_BASE_URL` at client build time to the API URL including `/api` (for example, `https://your-api-host.example/api`), and configure the API host's CORS policy for the client origin.

Demo logins (password `Password123!`): admin@gsa.rw, head@gsa.rw, dosreb@gsa.rw, dostvet@gsa.rw, trainer@gsa.rw, parent@gsa.rw, student@gsa.rw, librarian.storekeeper@gsa.rw, accountant@gsa.rw
DOS-REB sees only Nursery/Primary/Secondary; DOS-TVET only L3-L5SWD; parents and students see only their linked learner record. The student demo account is linked to the first seeded L5SWD learner. For an existing database, run `cd server; npm run link-student-demo-to-l5swd` to update only that demo account without reseeding or clearing school data.
The parent demo account is linked to one sample learner in each class and has a child selector on the overview. For an existing database, run `cd server; npm run link-parent-demo-learners` to link available seeded class examples to the parent demo without replacing another parent's existing link.
Student names are displayed as `First Last (Class)` and demo learners have distinct full names across classes. For an existing seeded database, run `cd server; npm run diversify-demo-student-names` to update only seeded demo learners; other learner names are left unchanged.
Thresholds (3/5/8 absences, 75%) are in server/models.js.
The Report Cards student selector opens with L5SWD learners first; other learners remain available to select.

## Finance, library, and school assets
The Librarian and Storekeeper share one workspace and one combined demo login: `librarian.storekeeper@gsa.rw`. Their shared register covers textbooks, equipment, and supplies; staff can record stock received, issues to borrowers, returns, damage, and maintenance, and see low-stock reminders and an activity history. The Accountant workspace manages learner fee invoices, partial or full payments, receipt numbers, outstanding balances, and school expenditure. Finance and asset APIs are restricted to their designated roles and administrators. The demo login for both library and store staff is `librarian.storekeeper@gsa.rw`; the accountant demo login is `accountant@gsa.rw`.
For an existing database, run `cd server; npm run provision-operations-demo-users` to create the shared library/store demo login and accountant account without clearing school data. If an earlier seeded librarian, storekeeper, or combined library demo account is present, the script consolidates it into `librarian.storekeeper@gsa.rw`. Newly created accounts use password `Password123!`; existing matching accounts are left unchanged.

## Notices and school events
The Notices & calendar workspace lets authorized school staff publish school-wide, track-specific, or class-specific announcements, assignments, events, and exams. Class-specific notices (for example, L5SWD or S3) are limited to that class; track-specific notices reach all classes in the selected track. Parents and students see notices for their linked learner's audience and whole-school notices, and can acknowledge notices as read. Event and due dates are shown in the notice list. External SMS/email delivery, file attachments, and assignment submissions are not configured.

## User workspaces and PDF requirements
The school platform proposal PDF was compared with the current application. These role-specific workflows are available:

| User | Available workflows |
|---|---|
| Administrator | Register and edit learner admissions, enrollment status, previous-school/academic notes, parent links, accounts and role assignments; enable/disable accounts, issue one-time temporary passwords, and review an activity log. Newly created or reset accounts must change their temporary password before continuing. |
| Head Teacher | School-wide overview, attendance follow-up, report cards, notices, and learning resources. |
| DOS REB / DOS TVET | Track-scoped classes, attendance, marks, reports, absence follow-up, notices, and learning resources. Each DOS can create trainer accounts and assign trainers to classes and courses within their own education track. |
| Trainer | Attendance, marks, absence follow-up, class-targeted learning resources, and notices, restricted to assigned classes and courses. DOS REB / DOS TVET manage teaching assignments from Trainer assignments. Administrators can also set class/course assignments when creating a trainer account. |
| Student | Own report card, attendance history, class materials, notices, and password settings. |
| Parent / Guardian | Records for linked children only: report cards, attendance history, absence notifications, notices, fee balances, and recorded payment receipts. |
| Accountant | Fee invoices, payments/receipts, balances, and expenditure. |
| Librarian / Storekeeper | Shared school asset and inventory register, issue/return records, maintenance, and low-stock alerts. |

Learner and parent data is scoped by the server to the linked account. Staff publishing a learning link can target a class/trade or the whole school. An absence recorded for a linked learner creates an in-app notification for that learner and active parent account. Password reset is administrator-issued; the temporary password is shown only once and must be changed at next sign-in.

The seeded `trainer@gsa.rw` demo account is assigned to Web Design in L3SWD. DOS REB can create trainers and assign Nursery, Primary, and Secondary classes/courses; DOS TVET can create trainers and assign L3SWD–L5SWD classes/courses. New DOS-created trainers receive a one-time temporary password and must change it after their first sign-in. These boundaries are enforced by the API, not only by the user interface.

The following proposal items still need additional development or external school services: timetable and room scheduling; trainer teaching-load/session/CPD and classroom-observation records; assignment submission and quizzes; direct file uploads, bookmarks, and resource view/download analytics; configurable school terms and advanced assessment types; Excel exports; automated database backups and recovery testing; and external SMS/email delivery. Learning materials currently use validated hosted links, which avoids storing large videos on the school server. Self-service password recovery by email also requires an email service and is not configured.
