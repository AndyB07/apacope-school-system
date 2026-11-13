import 'dotenv/config';
import mongoose from 'mongoose'; import bcrypt from 'bcryptjs';
import { User, Student, Attendance, Material, Mark, InventoryItem, AssetMovement, FinanceInvoice, FinancePayment, FinanceEntry, AuditLog, Notification, SUBJECTS, LEVELS } from './models.js';
import { DEMO_STUDENTS_PER_CLASS, demoStudentName } from './demoStudents.js';
await mongoose.connect(process.env.MONGO_URI);
await Promise.all([User, Student, Attendance, Material, Mark, InventoryItem, AssetMovement, FinanceInvoice, FinancePayment, FinanceEntry, AuditLog, Notification].map(m => m.deleteMany({})));
const password = await bcrypt.hash('Password123!', 10);
const mk = (name, email, role, student, assignedLevels) => User.create({ name, email, role, password, student, assignedLevels });
await mk('System Admin', 'admin@gsa.rw', 'ADMIN'); await mk('Head Teacher', 'head@gsa.rw', 'HEAD');
await mk('DOS REB', 'dosreb@gsa.rw', 'DOS_REB'); await mk('DOS TVET', 'dostvet@gsa.rw', 'DOS_TVET');
const trainer = await mk('Trainer Demo', 'trainer@gsa.rw', 'TRAINER', undefined, ['L3SWD']);
trainer.teachingAssignments = [{ level: 'L3SWD', courses: ['Web Design'] }];
await trainer.save();
const parent = await mk('Parent Demo', 'parent@gsa.rw', 'PARENT');
await mk('Library & Store Staff Demo', 'librarian.storekeeper@gsa.rw', 'LIBRARY_STAFF');
await mk('Accountant Demo', 'accountant@gsa.rw', 'ACCOUNTANT');
const days = []; for (let i = 0; i < 28; i++) { const d = new Date(Date.now() - i * 864e5); if (![0, 6].includes(d.getUTCDay())) days.push(d.toISOString().slice(0, 10)); }
let n = 1, l5swdStudent;
for (const [track, levels] of Object.entries(LEVELS)) for (const level of levels) for (let r = 1; r <= DEMO_STUDENTS_PER_CLASS; r++) {
  const studentNumber = n++;
  const s = await Student.create({ admissionNo: 'GSA' + String(studentNumber).padStart(4, '0'), name: demoStudentName(studentNumber),
    rollNo: r, track, level, parent: r === 1 ? parent._id : undefined });
  if (track === 'TVT' && level === 'L5SWD' && r === 1) l5swdStudent = s;
  const rate = r === 6 ? 0.55 : 0.9;
  await Mark.insertMany(SUBJECTS[track].map(subject => ({ student: s._id, term: 'Term 1', subject, ca: Math.round((r === 6 ? .45 : .7 + Math.random() * .25) * 40), exam: Math.round((r === 6 ? .4 : .55 + Math.random() * .35) * 60) }))); // last student of each class is a chronic absentee
  await Attendance.insertMany(days.map(date => ({ student: s._id, date, status: Math.random() < rate ? 'Present' : 'Absent' })));
}
await mk('Student Demo', 'student@gsa.rw', 'STUDENT', l5swdStudent._id);
await Material.create({ title: 'Intro to HTML (Level 3)', type: 'Video', url: 'https://www.youtube.com', level: 'L3SWD', module: 'Web Design', outcome: 'LO1', description: 'Hosted externally' });
console.log('Seeded. Demo account passwords: Password123!'); process.exit();
