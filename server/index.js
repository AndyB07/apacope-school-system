import 'dotenv/config';
import express from 'express'; import cors from 'cors'; import mongoose from 'mongoose';
import jwt from 'jsonwebtoken'; import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { User, Student, Attendance, FollowUp, Material, Notice, Mark, InventoryItem, AssetMovement, FinanceInvoice, FinancePayment, FinanceEntry, AuditLog, Notification, SUBJECTS, grade, LEVELS, CONFIG, ROLE_TRACKS } from './models.js';

const app = express(); app.use(cors()); app.use(express.json());
const wrap = f => (req, res) => f(req, res).catch(e => res.status(500).json({ error: e.message }));

// ---------- auth & RBAC ----------
const auth = async (req, res, next) => {
  let identity;
  try { identity = jwt.verify((req.headers.authorization || '').slice(7), process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Not logged in' }); }
  try {
    const account = await User.findById(identity.id).select('name role student isActive mustChangePassword assignedLevels teachingAssignments');
    if (!account || account.isActive === false) return res.status(401).json({ error: 'Account unavailable.' });
    if (account.mustChangePassword && req.originalUrl.split('?')[0] !== '/api/auth/change-password') {
      return res.status(403).json({ error: 'Change your temporary password before continuing.' });
    }
    req.user = {
      ...identity, name: account.name, role: account.role,
      studentId: account.student?.toString(), assignedLevels: account.assignedLevels || [],
      teachingAssignments: account.teachingAssignments || [],
    };
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
  next();
};
const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Forbidden' });
// Data isolation: parents -> own children only; DOS -> own tracks only
const studentFilter = u => u.role === 'PARENT' ? { parent: u.id }
  : u.role === 'STUDENT' ? { _id: u.studentId || null }
  : u.role === 'TRAINER' ? { level: { $in: u.assignedLevels || [] } }
  : ROLE_TRACKS[u.role] ? { track: { $in: ROLE_TRACKS[u.role] } }
    : ['ADMIN', 'HEAD', 'TRAINER'].includes(u.role) ? {} : { _id: null };

app.post('/api/auth/login', wrap(async (req, res) => {
  const email = cleanText(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });
  const u = await User.findOne({ email });
  if (!u || u.isActive === false || !(await bcrypt.compare(password, u.password))) return res.status(401).json({ error: 'Wrong email or password' });
  const user = { id: u.id, name: u.name, role: u.role, studentId: u.student?.toString(), mustChangePassword: u.mustChangePassword === true };
  res.json({ token: jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '8h' }), user });
}));
app.post('/api/auth/change-password', auth, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 128) {
    return res.status(400).json({ error: 'Enter your current password and a new password of 10–128 characters.' });
  }
  const account = await User.findById(req.user.id);
  if (!account || !(await bcrypt.compare(currentPassword, account.password))) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  account.password = await bcrypt.hash(newPassword, 10);
  account.mustChangePassword = false;
  await account.save();
  await audit(req.user, 'Changed password', 'User', account.id, 'Self-service password change');
  res.json({ changed: true });
}));

// ---------- helpers ----------
const iso = d => d.toISOString().slice(0, 10);
const trackForLevel = level => Object.entries(LEVELS).find(([, levels]) => levels.includes(level))?.[0];
const trainerCourses = (user, level) => user.teachingAssignments?.find(assignment => assignment.level === level)?.courses || [];
const monday = s => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; };
// Excused days are left out of the denominator; Late counts as attended.
const pct = (recs) => { const t = recs.filter(r => r.status !== 'Excused'); return t.length ? Math.round(100 * t.filter(r => r.status !== 'Absent').length / t.length) : null; };
export const absenceStage = n => n >= CONFIG.escalate ? ['Urgent review', 'Escalate to school management']
  : n >= CONFIG.parentContact ? ['High priority', 'Contact parent/guardian']
  : n >= CONFIG.followUp ? ['Follow-up', 'Teacher follow-up with student'] : ['Normal', 'No action'];

// ---------- attendance ----------
app.get('/api/classes', auth, allow('ADMIN', 'HEAD', 'TRAINER', 'DOS_REB', 'DOS_TVET'), (req, res) => {
  const tr = ROLE_TRACKS[req.user.role];
  const levels = req.user.role === 'TRAINER'
    ? new Set((req.user.teachingAssignments || []).map(assignment => assignment.level))
    : null;
  res.json(Object.entries(LEVELS).filter(([t]) => !tr || tr.includes(t))
    .flatMap(([t, list]) => list.filter(level => !levels || levels.has(level)).map(level => ({
      track: t, level, courses: req.user.role === 'TRAINER' ? trainerCourses(req.user, level) : SUBJECTS[t],
    }))));
});
const trackForDos = user => user.role === 'DOS_REB' ? ['NUR', 'PRI', 'SEC']
  : user.role === 'DOS_TVET' ? ['TVT'] : [];
app.get('/api/dos/trainers', auth, allow('DOS_REB', 'DOS_TVET'), wrap(async (req, res) => {
  const tracks = trackForDos(req.user), allowedLevels = new Set(tracks.flatMap(track => LEVELS[track]));
  const trainers = await User.find({ role: 'TRAINER', isActive: { $ne: false } })
    .select('name email assignedLevels teachingAssignments').sort('name').lean();
  res.json(trainers.map(trainer => ({
    _id: trainer._id, name: trainer.name, email: trainer.email,
    teachingAssignments: (trainer.teachingAssignments || []).filter(assignment => allowedLevels.has(assignment.level)),
  })));
}));
app.post('/api/dos/trainers', auth, allow('DOS_REB', 'DOS_TVET'), wrap(async (req, res) => {
  const allowedLevels = new Set(trackForDos(req.user).flatMap(track => LEVELS[track]));
  const cleanName = cleanText(req.body?.name), cleanEmail = cleanText(req.body?.email).toLowerCase();
  const assignments = normalizeTeachingAssignments(req.body?.teachingAssignments, allowedLevels);
  if (!cleanName || cleanName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    || !assignments?.length) {
    return res.status(400).json({ error: 'Enter a valid trainer name and email, and assign at least one class and course in your education track.' });
  }
  if (await User.exists({ email: cleanEmail })) return res.status(409).json({ error: 'An account with that email already exists.' });
  const temporaryPassword = randomBytes(18).toString('base64url');
  let trainer;
  try {
    trainer = await User.create({
      name: cleanName, email: cleanEmail, role: 'TRAINER', isActive: true, mustChangePassword: true,
      teachingAssignments: assignments, assignedLevels: assignments.map(assignment => assignment.level),
      password: await bcrypt.hash(temporaryPassword, 10),
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'An account with that email already exists.' });
    throw error;
  }
  await audit(req.user, 'Created trainer account', 'User', trainer.id,
    `${cleanEmail}: ${assignments.map(assignment => assignment.level).join(', ')}`);
  res.status(201).json({
    _id: trainer.id, name: trainer.name, email: trainer.email,
    teachingAssignments: trainer.teachingAssignments, temporaryPassword,
  });
}));
app.put('/api/dos/trainers/:id/assignments', auth, allow('DOS_REB', 'DOS_TVET'), wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Trainer not found.' });
  const tracks = trackForDos(req.user), allowedLevels = new Set(tracks.flatMap(track => LEVELS[track]));
  const { teachingAssignments } = req.body || {};
  if (!Array.isArray(teachingAssignments)) return res.status(400).json({ error: 'Provide the trainer class and course assignments.' });
  const validated = normalizeTeachingAssignments(teachingAssignments, allowedLevels);
  if (!validated) return res.status(400).json({ error: 'Each assigned class must include valid, non-duplicate courses within your education track.' });
  const trainer = await User.findOne({ _id: req.params.id, role: 'TRAINER' });
  if (!trainer) return res.status(404).json({ error: 'Trainer not found.' });
  const preserved = (trainer.teachingAssignments || []).filter(assignment => !allowedLevels.has(assignment.level));
  const assignments = [...preserved, ...validated];
  trainer.teachingAssignments = assignments;
  trainer.assignedLevels = [...new Set(assignments.map(assignment => assignment.level))];
  await trainer.save();
  await audit(req.user, 'Assigned trainer classes and courses', 'User', trainer.id,
    validated.map(assignment => `${assignment.level}: ${assignment.courses.join(', ')}`).join('; ') || `Removed assignments in ${tracks.join(', ')}`);
  res.json({ _id: trainer.id, name: trainer.name, teachingAssignments: assignments.filter(assignment => allowedLevels.has(assignment.level)) });
}));
app.get('/api/attendance/class', auth, allow('ADMIN', 'TRAINER', 'DOS_REB', 'DOS_TVET', 'HEAD'), wrap(async (req, res) => {
  const { level, date } = req.query;
  if (!trackForLevel(level) || (req.user.role === 'TRAINER' && !req.user.assignedLevels.includes(level))) {
    return res.status(403).json({ error: 'You are not assigned to that class.' });
  }
  const students = await Student.find({ ...studentFilter(req.user), level }).sort('rollNo');
  const recs = await Attendance.find({ date, student: { $in: students.map(s => s._id) } });
  res.json(students.map(s => ({ _id: s._id, rollNo: s.rollNo, name: s.name, level: s.level, track: s.track, status: recs.find(r => r.student.equals(s._id))?.status || 'Present' })));
}));
app.post('/api/attendance/bulk', auth, allow('ADMIN', 'TRAINER', 'DOS_REB', 'DOS_TVET'), wrap(async (req, res) => {
  const { date, records } = req.body || {};
  const parsedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date
    || !Array.isArray(records)) return res.status(400).json({ error: 'Enter a valid attendance date and record list.' });
  const statuses = ['Present', 'Absent', 'Late', 'Excused'];
  const validRecords = [...new Map(records.filter(record => record && mongoose.isValidObjectId(record.student) && statuses.includes(record.status))
    .map(record => [String(record.student), record])).values()];
  const ok = new Set((await Student.find({ ...studentFilter(req.user), _id: { $in: validRecords.map(r => r.student) } })).map(s => s.id));
  const ops = validRecords.filter(r => ok.has(r.student)).map(r => ({ updateOne: {
    filter: { student: r.student, date }, update: { $set: { status: r.status, markedBy: req.user.name } }, upsert: true } }));
  if (ops.length) await Attendance.bulkWrite(ops);
  if (ops.length) await audit(req.user, 'Marked attendance', 'Attendance batch', date, `${ops.length} records`);
  const absentRecords = validRecords.filter(record => record.status === 'Absent' && ok.has(record.student));
  if (absentRecords.length) {
    const learners = await Student.find({ _id: { $in: absentRecords.map(record => record.student) } }).select('_id name level parent').lean();
    const learnerIds = learners.map(learner => learner._id);
    const [parents, studentAccounts] = await Promise.all([
      User.find({ _id: { $in: learners.map(learner => learner.parent).filter(Boolean) }, role: 'PARENT', isActive: { $ne: false } }).select('_id'),
      User.find({ student: { $in: learnerIds }, role: 'STUDENT', isActive: { $ne: false } }).select('_id student'),
    ]);
    const parentIds = new Set(parents.map(parent => parent.id));
    const recipients = [];
    for (const learner of learners) {
      const recipientIds = [
        ...(learner.parent && parentIds.has(learner.parent.toString()) ? [learner.parent.toString()] : []),
        ...studentAccounts.filter(account => account.student.equals(learner._id)).map(account => account.id),
      ];
      for (const recipientId of recipientIds) recipients.push({ recipientId, learner });
    }
    if (recipients.length) await Notification.bulkWrite(recipients.map(({ recipientId, learner }) => ({
      updateOne: {
        filter: { recipientId, student: learner._id, date, category: 'Attendance' },
        update: { $setOnInsert: {
          recipientId, student: learner._id, date, category: 'Attendance',
          title: 'Attendance recorded as absent',
          message: `${learner.name} (${learner.level}) was marked absent on ${date}. Contact the school if this is unexpected.`,
        } },
        upsert: true,
      },
    })));
  }
  res.json({ saved: ops.length, skipped: records.length - ops.length });
}));

app.get('/api/dashboard', auth, wrap(async (req, res) => {
  const today = req.query.date || iso(new Date());
  const students = await Student.find(studentFilter(req.user)).sort('level rollNo');
  const ids = students.map(s => s._id);
  const month = await Attendance.find({ student: { $in: ids }, date: new RegExp('^' + today.slice(0, 7)) });
  const todayRecs = month.filter(r => r.date === today);
  const summary = students.map(s => {
    const r = month.filter(x => x.student.equals(s._id));
    const p = pct(r);
    return { _id: s._id, rollNo: s.rollNo, name: s.name, level: s.level, track: s.track,
      present: r.filter(x => x.status !== 'Absent' && x.status !== 'Excused').length,
      absent: r.filter(x => x.status === 'Absent').length, total: r.length, pct: p,
      status: p === null ? 'Good' : p >= 85 ? 'Good' : p >= CONFIG.minPct ? 'Warning' : 'Critical' };
  });
  // Heatmap: class x Mon-Fri for the chosen week
  const mon = monday(req.query.week || today);
  const days = [0, 1, 2, 3, 4].map(i => iso(new Date(mon.getTime() + i * 864e5)));
  const wk = await Attendance.find({ student: { $in: ids }, date: { $in: days } });
  const levels = [...new Set(students.map(s => s.level))];
  const heatmap = levels.map(level => {
    const sid = students.filter(s => s.level === level).map(s => s.id);
    return { level, cells: days.map(d => pct(wk.filter(r => r.date === d && sid.includes(r.student.toString())))) };
  });
  res.json({ today, days, heatmap, summary,
    kpi: { today: pct(todayRecs), month: pct(month), absentToday: todayRecs.filter(r => r.status === 'Absent').length,
      chronic: summary.filter(s => s.pct !== null && s.pct < CONFIG.minPct).length } });
}));

// Absence monitoring (unexplained absences this month) + follow-up suppression
app.get('/api/monitoring', auth, allow('ADMIN', 'HEAD', 'DOS_REB', 'DOS_TVET', 'TRAINER'), wrap(async (req, res) => {
  const students = await Student.find(studentFilter(req.user));
  const start = iso(new Date()).slice(0, 7);
  const abs = await Attendance.find({ status: 'Absent', date: new RegExp('^' + start), student: { $in: students.map(s => s._id) } });
  const fus = await FollowUp.find({ at: { $gte: new Date(start + '-01') } });
  res.json(students.map(s => {
    const n = abs.filter(a => a.student.equals(s._id)).length, [status, action] = absenceStage(n);
    const done = fus.some(f => f.student.equals(s._id)); // already followed up -> don't re-alert
    return { _id: s._id, name: s.name, level: s.level, track: s.track, absences: n, status, action: done && n < CONFIG.escalate ? 'Followed up' : action };
  }).filter(r => r.absences >= 1).sort((a, b) => b.absences - a.absences));
}));
app.get('/api/followups', auth, allow('ADMIN', 'HEAD', 'DOS_REB', 'DOS_TVET', 'TRAINER'), wrap(async (req, res) => {
  const ids = (await Student.find(studentFilter(req.user))).map(s => s._id);
  res.json(await FollowUp.find({ student: { $in: ids } }).populate('student', 'name level track').sort('-at'));
}));
app.post('/api/followups', auth, allow('ADMIN', 'HEAD', 'DOS_REB', 'DOS_TVET', 'TRAINER'), wrap(async (req, res) => {
  if (!(await Student.exists({ ...studentFilter(req.user), _id: req.body.student }))) return res.status(403).json({ error: 'Forbidden' });
  const followup = await FollowUp.create({ ...req.body, contactedBy: req.user.name });
  await audit(req.user, 'Logged learner follow-up', 'FollowUp', followup.id, followup.channel);
  res.json(followup);
}));
app.get('/api/portal/notifications', auth, allow('PARENT', 'STUDENT'), wrap(async (req, res) => {
  res.json(await Notification.find({ recipientId: req.user.id }).populate('student', 'name level').sort('-createdAt').limit(100).lean());
}));
app.post('/api/portal/notifications/:id/read', auth, allow('PARENT', 'STUDENT'), wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Notification not found.' });
  const updated = await Notification.updateOne({ _id: req.params.id, recipientId: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
  if (!updated.matchedCount && !(await Notification.exists({ _id: req.params.id, recipientId: req.user.id }))) {
    return res.status(404).json({ error: 'Notification not found.' });
  }
  res.json({ read: true });
}));

// ---------- announcements, assignments, and school events ----------
const noticeAudience = async user => {
  const global = { audienceTrack: null, audienceLevel: null };
  if (user.role === 'TRAINER') {
    return { $or: [global, { audienceLevel: { $in: user.assignedLevels || [] } }] };
  }
  if (user.role === 'PARENT' || user.role === 'STUDENT') {
    const students = user.role === 'PARENT'
      ? await Student.find(studentFilter(user)).select('track level')
      : await Student.find(studentFilter(user)).limit(1).select('track level');
    const tracks = [...new Set(students.map(student => student.track))];
    const levels = [...new Set(students.map(student => student.level))];
    return { $or: [global, ...tracks.map(audienceTrack => ({ audienceTrack, audienceLevel: null })),
      ...levels.map(audienceLevel => ({ audienceLevel }))] };
  }
  const tracks = ROLE_TRACKS[user.role];
  if (!tracks) return {};
  return { $or: [global, { audienceTrack: { $in: tracks }, audienceLevel: null },
    { audienceLevel: { $in: tracks.flatMap(track => LEVELS[track]) } }] };
};
app.get('/api/notices', auth, wrap(async (req, res) => {
  const visible = await Notice.find(await noticeAudience(req.user)).sort('-createdAt').limit(100).lean();
  res.json(visible.map(({ acknowledgements = [], ...item }) => ({
    ...item, isRead: acknowledgements.some(a => a.userId === req.user.id),
  })));
}));
app.post('/api/notices', auth, allow('ADMIN', 'HEAD', 'DOS_REB', 'DOS_TVET', 'TRAINER'), wrap(async (req, res) => {
  const { title, message, category, scope, level, track, dueAt } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 120
    || typeof message !== 'string' || !message.trim() || message.trim().length > 3000
    || !['Announcement', 'Assignment', 'Event', 'Exam'].includes(category)) {
    return res.status(400).json({ error: 'Enter a title, message, and valid category.' });
  }
  let audienceTrack, audienceLevel;
  if (scope === 'track') {
    if (!Object.hasOwn(LEVELS, track)) return res.status(400).json({ error: 'Choose a valid education track.' });
    audienceTrack = track;
  } else if (scope === 'class') {
    const match = Object.entries(LEVELS).find(([, levels]) => levels.includes(level));
    if (!match) return res.status(400).json({ error: 'Choose a valid class.' });
    [audienceTrack] = match;
    audienceLevel = level;
  } else if (scope !== 'school') {
    return res.status(400).json({ error: 'Choose a valid audience.' });
  }
  const permittedTracks = ROLE_TRACKS[req.user.role];
  if (audienceTrack && permittedTracks && !permittedTracks.includes(audienceTrack)) {
    return res.status(403).json({ error: 'You cannot post to that education track.' });
  }
  if (req.user.role === 'TRAINER' && (scope !== 'class' || !req.user.assignedLevels.includes(audienceLevel))) {
    return res.status(403).json({ error: 'Trainers may publish notices only to their assigned classes.' });
  }
  if (dueAt && Number.isNaN(new Date(dueAt).getTime())) {
    return res.status(400).json({ error: 'Enter a valid event or due date.' });
  }
  const item = await Notice.create({
    title: title.trim(), message: message.trim(), category, postedBy: req.user.name,
    ...(audienceTrack ? { audienceTrack } : {}),
    ...(audienceLevel ? { audienceLevel } : {}),
    ...(dueAt ? { dueAt: new Date(dueAt) } : {}),
  });
  await audit(req.user, 'Published notice', 'Notice', item.id, item.title);
  res.status(201).json(item);
}));
app.post('/api/notices/:id/read', auth, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Notice not found.' });
  const visible = await noticeAudience(req.user);
  const updated = await Notice.updateOne(
    { _id: req.params.id, ...visible, 'acknowledgements.userId': { $ne: req.user.id } },
    { $push: { acknowledgements: { userId: req.user.id, readAt: new Date() } } },
  );
  if (updated.matchedCount) return res.json({ isRead: true });
  if (!(await Notice.exists({ _id: req.params.id, ...visible }))) return res.status(404).json({ error: 'Notice not found.' });
  res.json({ isRead: true });
}));

// ---------- e-learning (links to externally hosted videos + handouts) ----------
const materialAudience = async user => {
  const wholeSchool = { audienceTrack: null, audienceLevel: null, level: { $in: ['', null] } };
  if (user.role === 'TRAINER') {
    return { $or: [wholeSchool, { audienceLevel: { $in: user.assignedLevels || [] } },
      { level: { $in: user.assignedLevels || [] } }] };
  }
  if (user.role === 'PARENT' || user.role === 'STUDENT') {
    const learners = await Student.find(studentFilter(user)).select('track level');
    const tracks = [...new Set(learners.map(learner => learner.track))];
    const levels = [...new Set(learners.map(learner => learner.level))];
    return { $or: [wholeSchool, { audienceTrack: { $in: tracks }, audienceLevel: null },
      { audienceLevel: { $in: levels } }, { level: { $in: levels } }] };
  }
  const tracks = ROLE_TRACKS[user.role];
  if (!tracks) return {};
  return { $or: [wholeSchool, { audienceTrack: { $in: tracks }, audienceLevel: null },
    { audienceLevel: { $in: tracks.flatMap(track => LEVELS[track]) } },
    { level: { $in: tracks.flatMap(track => LEVELS[track]) } }] };
};
app.get('/api/materials', auth, wrap(async (req, res) => {
  const search = cleanText(req.query.q);
  const q = search ? { $or: ['title', 'description', 'module', 'outcome'].map(field => ({
    [field]: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
  })) } : {};
  res.json(await Material.find({ $and: [await materialAudience(req.user), q] }).sort('-createdAt').limit(300));
}));
app.post('/api/materials', auth, allow('ADMIN', 'TRAINER', 'DOS_REB', 'DOS_TVET', 'HEAD'), wrap(async (req, res) => {
  const { title, description, type, url, level, module, outcome } = req.body || {};
  const cleanUrl = cleanText(url), cleanTitle = cleanText(title);
  const parsedUrl = URL.canParse(cleanUrl) ? new URL(cleanUrl) : null;
  if (!cleanTitle || cleanTitle.length > 120 || !['Video', 'Handout', 'Media'].includes(type)
    || !parsedUrl || !['http:', 'https:'].includes(parsedUrl.protocol)
    || (description && (typeof description !== 'string' || description.trim().length > 2000))
    || (module && (typeof module !== 'string' || module.trim().length > 120))
    || (outcome && (typeof outcome !== 'string' || outcome.trim().length > 120))) {
    return res.status(400).json({ error: 'Enter a title, material type, valid http(s) link, and optional details within the allowed lengths.' });
  }
  let audienceTrack, audienceLevel;
  if (level) {
    const match = Object.entries(LEVELS).find(([, levels]) => levels.includes(level));
    if (!match) return res.status(400).json({ error: 'Choose a valid class or trade.' });
    [audienceTrack] = match;
    audienceLevel = level;
  }
  const permittedTracks = ROLE_TRACKS[req.user.role];
  if (audienceTrack && permittedTracks && !permittedTracks.includes(audienceTrack)) {
    return res.status(403).json({ error: 'You cannot publish learning materials to that education track.' });
  }
  if (req.user.role === 'TRAINER' && (!audienceLevel || !req.user.assignedLevels.includes(audienceLevel))) {
    return res.status(403).json({ error: 'Trainers may publish learning resources only to their assigned classes.' });
  }
  if (req.user.role === 'TRAINER' && !trainerCourses(req.user, audienceLevel).includes(cleanText(module))) {
    return res.status(403).json({ error: 'Choose a course assigned to you for the selected class.' });
  }
  const material = await Material.create({
    title: cleanTitle, description: cleanText(description), type, url: cleanUrl,
    level: audienceLevel || '', module: cleanText(module), outcome: cleanText(outcome), postedBy: req.user.name,
    ...(audienceTrack ? { audienceTrack, audienceLevel } : {}),
  });
  await audit(req.user, 'Published learning material', 'Material', material.id, material.title);
  res.status(201).json(material);
}));

// ---------- marks & report cards ----------
const STAFF = ['ADMIN', 'TRAINER', 'DOS_REB', 'DOS_TVET'];
app.get('/api/students', auth, wrap(async (req, res) => {
  const students = await Student.find(studentFilter(req.user)).sort('level rollNo');
  students.sort((a, b) => Number(b.level === 'L5SWD') - Number(a.level === 'L5SWD'));
  res.json(students);
}));
app.get('/api/subjects', auth, wrap(async (req, res) => {
  const { track, level } = req.query;
  if (!Object.hasOwn(SUBJECTS, track)) return res.json([]);
  if (req.user.role === 'TRAINER' && !level) {
    return res.status(400).json({ error: 'Choose one of your assigned classes to view its courses.' });
  }
  if (level && (!LEVELS[track].includes(level)
    || (req.user.role === 'TRAINER' && !req.user.assignedLevels.includes(level)))) {
    return res.status(403).json({ error: 'You are not assigned to that class.' });
  }
  const subjects = SUBJECTS[track];
  res.json(req.user.role === 'TRAINER' && level
    ? subjects.filter(subject => trainerCourses(req.user, level).includes(subject))
    : subjects);
}));
app.get('/api/marks', auth, allow(...STAFF), wrap(async (req, res) => {
  const { level, term, subject } = req.query;
  const track = trackForLevel(level);
  if (!track || (req.user.role === 'TRAINER' && !req.user.assignedLevels.includes(level))) {
    return res.status(403).json({ error: 'You are not assigned to that class.' });
  }
  if (!SUBJECTS[track].includes(subject)) return res.status(400).json({ error: 'Choose a valid course for this class.' });
  if (req.user.role === 'TRAINER' && !trainerCourses(req.user, level).includes(subject)) {
    return res.status(403).json({ error: 'You are not assigned to teach this course in that class.' });
  }
  const st = await Student.find({ ...studentFilter(req.user), level }).sort('rollNo');
  const ms = await Mark.find({ term, subject, student: { $in: st.map(s => s._id) } });
  res.json(st.map(s => { const m = ms.find(x => x.student.equals(s._id)); return { _id: s._id, rollNo: s.rollNo, name: s.name, level: s.level, track: s.track, ca: m?.ca ?? '', exam: m?.exam ?? '' }; }));
}));
app.post('/api/marks', auth, allow(...STAFF), wrap(async (req, res) => {
  const { term, subject, level, records } = req.body || {};
  const track = trackForLevel(level);
  if (typeof term !== 'string' || !term.trim() || term.trim().length > 40 || !track
    || !SUBJECTS[track].includes(subject) || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Choose a valid class, course, term, and list of learner marks.' });
  }
  if (req.user.role === 'TRAINER' && (!req.user.assignedLevels.includes(level) || !trainerCourses(req.user, level).includes(subject))) {
    return res.status(403).json({ error: 'You are not assigned to teach this course in that class.' });
  }
  const recordIds = records.filter(record => record && mongoose.isValidObjectId(record.student));
  const learners = await Student.find({ ...studentFilter(req.user), level, _id: { $in: recordIds.map(record => record.student) } }).select('_id');
  const ok = new Set(learners.map(student => student.id));
  const clean = recordIds.filter(record => ok.has(record.student) && record.ca !== '' && record.exam !== ''
    && Number.isFinite(+record.ca) && +record.ca >= 0 && +record.ca <= 40
    && Number.isFinite(+record.exam) && +record.exam >= 0 && +record.exam <= 60);
  if (clean.length) await Mark.bulkWrite(clean.map(r => ({ updateOne: { filter: { student: r.student, term, subject },
    update: { $set: { ca: +r.ca, exam: +r.exam } }, upsert: true } })));
  if (clean.length) await audit(req.user, 'Saved marks', 'Mark batch', `${term} · ${subject}`, `${clean.length} learner records`);
  res.json({ saved: clean.length, skipped: records.length - clean.length });
}));
app.get('/api/report/:id', auth, wrap(async (req, res) => {
  const s = await Student.findOne({ ...studentFilter(req.user), _id: req.params.id });
  if (!s) return res.status(403).json({ error: 'Forbidden' }); // parents can only open their own child
  const term = req.query.term, mates = await Student.find({ level: s.level });
  const all = await Mark.find({ term, student: { $in: mates.map(m => m._id) } });
  const sum = id => all.filter(x => x.student.equals(id)).reduce((a, x) => a + x.ca + x.exam, 0);
  const rank = [...mates].sort((a, b) => sum(b._id) - sum(a._id)).findIndex(m => m.id === s.id) + 1;
  const rows = all.filter(x => x.student.equals(s._id)).map(m => ({ subject: m.subject, ca: m.ca, exam: m.exam, total: m.ca + m.exam, grade: grade(m.ca + m.exam, s.track) }));
  const average = rows.length ? Math.round(rows.reduce((a, r) => a + r.total, 0) / rows.length) : null;
  const remark = average === null ? 'No marks recorded yet.' : average >= 80 ? 'Excellent work. Keep it up!' : average >= 60 ? 'Good performance; keep improving.'
    : average >= 50 ? 'Fair. More effort is needed.' : 'Needs academic support. Please meet the Director of Studies.';
  res.json({ student: s, term, rows, average, rank, of: mates.length, remark, attendance: pct(await Attendance.find({ student: s._id })) });
}));

app.get('/api/portal/attendance', auth, allow('PARENT', 'STUDENT'), wrap(async (req, res) => {
  let student;
  if (req.user.role === 'STUDENT') {
    student = await Student.findOne(studentFilter(req.user));
  } else {
    if (!mongoose.isValidObjectId(req.query.studentId)) return res.status(400).json({ error: 'Choose one of your linked learners.' });
    student = await Student.findOne({ ...studentFilter(req.user), _id: req.query.studentId });
  }
  if (!student) return res.status(404).json({ error: 'Learner record not found.' });
  const records = await Attendance.find({ student: student._id }).sort('-date').limit(180).lean();
  res.json({
    student: { _id: student.id, name: student.name, level: student.level, admissionNo: student.admissionNo },
    records,
    totals: {
      present: records.filter(record => record.status === 'Present' || record.status === 'Late').length,
      absent: records.filter(record => record.status === 'Absent').length,
      excused: records.filter(record => record.status === 'Excused').length,
    },
  });
}));
app.get('/api/portal/finance', auth, allow('PARENT'), wrap(async (req, res) => {
  const linked = await Student.find(studentFilter(req.user)).select('_id name level admissionNo');
  const selected = req.query.studentId
    ? linked.filter(student => student.id === req.query.studentId)
    : linked;
  if (req.query.studentId && !selected.length) return res.status(404).json({ error: 'Learner record not found.' });
  const ids = selected.map(student => student._id);
  const [invoices, payments] = await Promise.all([
    FinanceInvoice.find({ student: { $in: ids } }).populate('student', 'name admissionNo level').sort('-createdAt').lean(),
    FinancePayment.find({ invoice: { $in: await FinanceInvoice.find({ student: { $in: ids } }).distinct('_id') } })
      .populate({ path: 'invoice', populate: { path: 'student', select: 'name admissionNo level' } }).sort('-date').lean(),
  ]);
  const billed = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paid = invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
  res.json({ invoices, payments, summary: { billed, paid, balance: billed - paid } });
}));

// ---------- library, school assets, and finance workspaces ----------
const ASSET_STAFF = ['ADMIN', 'LIBRARIAN', 'STOREKEEPER', 'LIBRARY_STAFF'];
const FINANCE_STAFF = ['ADMIN', 'ACCOUNTANT'];
const cleanText = value => typeof value === 'string' ? value.trim() : '';
const normalizeTeachingAssignments = (value, allowedLevels) => {
  if (!Array.isArray(value)) return null;
  const seenLevels = new Set();
  for (const assignment of value) {
    const track = trackForLevel(assignment?.level);
    if (!track || !allowedLevels.has(assignment.level) || seenLevels.has(assignment.level)
      || !Array.isArray(assignment.courses) || !assignment.courses.length
      || assignment.courses.some(course => !SUBJECTS[track].includes(course))
      || new Set(assignment.courses).size !== assignment.courses.length) return null;
    seenLevels.add(assignment.level);
  }
  return value.map(assignment => ({ level: assignment.level, courses: [...assignment.courses] }));
};
const audit = (user, action, entity, entityId, details) => AuditLog.create({
  actorId: user.id, actorName: user.name, action, entity, entityId: String(entityId || ''),
  details: cleanText(details).slice(0, 240),
});

// ---------- administrator: accounts and learner records ----------
const USER_ROLES = ['ADMIN', 'HEAD', 'DOS_REB', 'DOS_TVET', 'TRAINER', 'STUDENT', 'PARENT', 'LIBRARIAN', 'LIBRARY_STAFF', 'ACCOUNTANT', 'STOREKEEPER'];
app.get('/api/admin/users', auth, allow('ADMIN'), wrap(async (req, res) => {
  const users = await User.find().select('name email role isActive mustChangePassword assignedLevels teachingAssignments student').populate('student', 'name admissionNo level');
  const parents = users.filter(user => user.role === 'PARENT').map(user => user._id);
  const children = await Student.find({ parent: { $in: parents } }).select('name admissionNo level parent').lean();
  const childrenByParent = new Map();
  for (const student of children) {
    const key = student.parent.toString();
    childrenByParent.set(key, [...(childrenByParent.get(key) || []), {
      _id: student._id, name: student.name, admissionNo: student.admissionNo, level: student.level,
    }]);
  }
  res.json(users.map(user => ({
    _id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive !== false,
    mustChangePassword: user.mustChangePassword === true, assignedLevels: user.assignedLevels || [],
    teachingAssignments: user.teachingAssignments || [],
    student: user.student, children: childrenByParent.get(user.id) || [],
  })));
}));
app.post('/api/admin/users', auth, allow('ADMIN'), wrap(async (req, res) => {
  const { name, email, role, password, studentId, studentIds = [], teachingAssignments = [] } = req.body || {};
  const cleanName = cleanText(name), cleanEmail = cleanText(email).toLowerCase();
  const allLevels = new Set(Object.values(LEVELS).flat());
  const assignments = normalizeTeachingAssignments(teachingAssignments, allLevels);
  if (!cleanName || cleanName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    || !USER_ROLES.includes(role) || typeof password !== 'string' || password.length < 10
    || (role === 'STUDENT' && !mongoose.isValidObjectId(studentId))
    || !assignments || (role === 'TRAINER' && !assignments.length)
    || (role !== 'TRAINER' && assignments.length)
    || (role === 'PARENT' && (!Array.isArray(studentIds) || !studentIds.length || studentIds.some(id => !mongoose.isValidObjectId(id))))) {
    return res.status(400).json({ error: 'Enter a valid name, email, role, password (at least 10 characters), valid class/course assignments for trainers, and required learner links.' });
  }
  let student, linkedStudents = [];
  if (role === 'STUDENT') {
    student = await Student.findById(studentId);
    if (!student) return res.status(400).json({ error: 'Choose an existing learner for the student account.' });
    if (await User.exists({ student: student._id })) return res.status(409).json({ error: 'That learner already has a student login.' });
  }
  if (role === 'PARENT') {
    const ids = [...new Set(studentIds.map(String))];
    linkedStudents = await Student.find({ _id: { $in: ids } }).select('_id parent');
    if (linkedStudents.length !== ids.length) return res.status(400).json({ error: 'One or more selected learners could not be found.' });
    if (linkedStudents.some(learner => learner.parent)) return res.status(409).json({ error: 'A selected learner is already linked to a parent account.' });
  }
  const duplicate = await User.exists({ email: cleanEmail });
  if (duplicate) return res.status(409).json({ error: 'An account with that email already exists.' });
  const user = await User.create({
    name: cleanName, email: cleanEmail, role,
    teachingAssignments: assignments,
    assignedLevels: assignments.map(assignment => assignment.level),
    password: await bcrypt.hash(password, 10), mustChangePassword: true,
    ...(student ? { student: student._id } : {}),
  });
  if (linkedStudents.length) {
    const result = await Student.updateMany(
      { _id: { $in: linkedStudents.map(learner => learner._id) }, parent: null },
      { $set: { parent: user._id } },
    );
    if (result.modifiedCount !== linkedStudents.length) {
      await Student.updateMany({ parent: user._id }, { $unset: { parent: 1 } });
      await User.deleteOne({ _id: user._id });
      return res.status(409).json({ error: 'A selected learner was linked to another parent at the same time. Refresh and try again.' });
    }
  }
  await audit(req.user, 'Created account', 'User', user.id, `${role}: ${cleanEmail}`);
  res.status(201).json({ _id: user.id, name: user.name, email: user.email, role: user.role, isActive: true });
}));
app.patch('/api/admin/users/:id', auth, allow('ADMIN'), wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Account not found.' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Use another administrator to change your own role or access.' });
  const account = await User.findById(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found.' });
  const { role, isActive, studentId, teachingAssignments } = req.body || {};
  const allLevels = new Set(Object.values(LEVELS).flat());
  if ((role !== undefined && !USER_ROLES.includes(role)) || (isActive !== undefined && typeof isActive !== 'boolean')
    || (studentId !== undefined && studentId !== null && !mongoose.isValidObjectId(studentId))
    || (teachingAssignments !== undefined && !normalizeTeachingAssignments(teachingAssignments, allLevels))) {
    return res.status(400).json({ error: 'Choose a valid role and account status.' });
  }
  const nextRole = role ?? account.role, nextActive = isActive ?? account.isActive !== false;
  const submittedAssignments = teachingAssignments === undefined
    ? account.teachingAssignments || []
    : normalizeTeachingAssignments(teachingAssignments, allLevels);
  if (nextRole === 'TRAINER' && !submittedAssignments.length && (role === 'TRAINER' || teachingAssignments !== undefined)) {
    return res.status(400).json({ error: 'A trainer account must be assigned at least one class and course.' });
  }
  if (nextRole !== 'TRAINER' && teachingAssignments !== undefined && submittedAssignments.length) {
    return res.status(400).json({ error: 'Only trainer accounts can have teaching assignments.' });
  }
  const nextAssignments = nextRole === 'TRAINER' ? submittedAssignments : [];
  const nextStudentId = studentId === null ? null : studentId ?? account.student?.toString();
  if (nextRole === 'STUDENT') {
    if (!mongoose.isValidObjectId(nextStudentId)) return res.status(400).json({ error: 'A student account must be linked to a learner.' });
    if (!(await Student.exists({ _id: nextStudentId }))) return res.status(400).json({ error: 'Choose an existing learner.' });
    if (await User.exists({ _id: { $ne: account._id }, student: nextStudentId })) {
      return res.status(409).json({ error: 'That learner already has a student login.' });
    }
  }
  if (account.role === 'ADMIN' && account.isActive !== false && (nextRole !== 'ADMIN' || !nextActive)
    && await User.countDocuments({ role: 'ADMIN', isActive: { $ne: false } }) <= 1) {
    return res.status(409).json({ error: 'The school must keep at least one active administrator.' });
  }
  account.role = nextRole;
  account.isActive = nextActive;
  if (teachingAssignments !== undefined || role !== undefined) {
    account.teachingAssignments = nextAssignments;
    account.assignedLevels = nextAssignments.map(assignment => assignment.level);
  }
  if (studentId !== undefined) account.student = nextStudentId || undefined;
  await account.save();
  await audit(req.user, 'Updated account access', 'User', account.id, `${nextRole}, ${nextActive ? 'active' : 'disabled'}`);
  res.json({ _id: account.id, name: account.name, email: account.email, role: account.role, isActive: account.isActive,
    assignedLevels: account.assignedLevels, teachingAssignments: account.teachingAssignments });
}));
app.post('/api/admin/users/:id/reset-password', auth, allow('ADMIN'), wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Account not found.' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Use account settings to change your own password.' });
  const account = await User.findById(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found.' });
  const temporaryPassword = randomBytes(18).toString('base64url');
  account.password = await bcrypt.hash(temporaryPassword, 10);
  account.mustChangePassword = true;
  await account.save();
  await audit(req.user, 'Reset account password', 'User', account.id, 'Temporary password issued');
  res.json({ temporaryPassword });
}));
app.get('/api/admin/students', auth, allow('ADMIN'), wrap(async (req, res) => {
  res.json(await Student.find().populate('parent', 'name email').sort('level rollNo'));
}));
app.post('/api/admin/students', auth, allow('ADMIN'), wrap(async (req, res) => {
  const { admissionNo, name, rollNo, track, level, guardianPhone, parentId,
    enrollmentStatus = 'Active', previousSchool, previousAcademicSummary } = req.body || {};
  const cleanAdmission = cleanText(admissionNo), cleanName = cleanText(name), roll = Number(rollNo);
  if (!cleanAdmission || cleanAdmission.length > 40 || !cleanName || cleanName.length > 120
    || !Number.isSafeInteger(roll) || roll < 1 || !Object.hasOwn(LEVELS, track) || !LEVELS[track].includes(level)
    || !['Active', 'Graduated', 'Withdrawn', 'Suspended'].includes(enrollmentStatus)
    || (guardianPhone && (typeof guardianPhone !== 'string' || guardianPhone.trim().length > 40))
    || (previousSchool && (typeof previousSchool !== 'string' || previousSchool.trim().length > 120))
    || (previousAcademicSummary && (typeof previousAcademicSummary !== 'string' || previousAcademicSummary.trim().length > 1000))) {
    return res.status(400).json({ error: 'Enter a valid admission number, learner name, roll number, track, class, and guardian phone.' });
  }
  let parent;
  if (parentId) {
    if (!mongoose.isValidObjectId(parentId)) return res.status(400).json({ error: 'Choose a valid parent account.' });
    parent = await User.findOne({ _id: parentId, role: 'PARENT', isActive: { $ne: false } });
    if (!parent) return res.status(400).json({ error: 'Choose an active parent account.' });
  }
  if (await Student.exists({ admissionNo: cleanAdmission })) return res.status(409).json({ error: 'That admission number is already in use.' });
  const student = await Student.create({
    admissionNo: cleanAdmission, name: cleanName, rollNo: roll, track, level,
    guardianPhone: cleanText(guardianPhone), ...(parent ? { parent: parent._id } : {}),
    enrollmentStatus, previousSchool: cleanText(previousSchool), previousAcademicSummary: cleanText(previousAcademicSummary),
  });
  await audit(req.user, 'Registered learner', 'Student', student.id, `${student.name} (${student.admissionNo})`);
  res.status(201).json(student);
}));
app.patch('/api/admin/students/:id', auth, allow('ADMIN'), wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Learner not found.' });
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ error: 'Learner not found.' });
  const { admissionNo, name, rollNo, track, level, guardianPhone, parentId,
    enrollmentStatus, previousSchool, previousAcademicSummary } = req.body || {};
  const nextTrack = track ?? student.track, nextLevel = level ?? student.level;
  const nextRoll = rollNo === undefined ? student.rollNo : Number(rollNo);
  const nextName = name === undefined ? student.name : cleanText(name);
  const nextAdmission = admissionNo === undefined ? student.admissionNo : cleanText(admissionNo);
  if (!Object.hasOwn(LEVELS, nextTrack) || !LEVELS[nextTrack].includes(nextLevel)
    || !nextName || nextName.length > 120 || !nextAdmission || nextAdmission.length > 40
    || !Number.isSafeInteger(nextRoll) || nextRoll < 1
    || (enrollmentStatus !== undefined && !['Active', 'Graduated', 'Withdrawn', 'Suspended'].includes(enrollmentStatus))
    || (guardianPhone !== undefined && (typeof guardianPhone !== 'string' || guardianPhone.trim().length > 40))
    || (previousSchool !== undefined && (typeof previousSchool !== 'string' || previousSchool.trim().length > 120))
    || (previousAcademicSummary !== undefined && (typeof previousAcademicSummary !== 'string' || previousAcademicSummary.trim().length > 1000))) {
    return res.status(400).json({ error: 'Enter valid learner details and a class matching the education track.' });
  }
  if (nextAdmission !== student.admissionNo && await Student.exists({ _id: { $ne: student._id }, admissionNo: nextAdmission })) {
    return res.status(409).json({ error: 'That admission number is already in use.' });
  }
  let parent;
  if (parentId) {
    if (!mongoose.isValidObjectId(parentId)) return res.status(400).json({ error: 'Choose a valid parent account.' });
    parent = await User.findOne({ _id: parentId, role: 'PARENT', isActive: { $ne: false } });
    if (!parent) return res.status(400).json({ error: 'Choose an active parent account.' });
    if (student.parent && !student.parent.equals(parent._id)) return res.status(409).json({ error: 'This learner is already linked to another parent. Unlink the current parent before transferring the record.' });
  }
  Object.assign(student, {
    admissionNo: nextAdmission, name: nextName, rollNo: nextRoll, track: nextTrack, level: nextLevel,
    ...(guardianPhone !== undefined ? { guardianPhone: cleanText(guardianPhone) } : {}),
    ...(enrollmentStatus !== undefined ? { enrollmentStatus } : {}),
    ...(previousSchool !== undefined ? { previousSchool: cleanText(previousSchool) } : {}),
    ...(previousAcademicSummary !== undefined ? { previousAcademicSummary: cleanText(previousAcademicSummary) } : {}),
    ...(parentId !== undefined ? { parent: parent?._id || undefined } : {}),
  });
  await student.save();
  await audit(req.user, 'Updated learner record', 'Student', student.id, `${student.name} (${student.admissionNo})`);
  res.json(student);
}));
app.get('/api/admin/audit', auth, allow('ADMIN'), wrap(async (req, res) => {
  res.json(await AuditLog.find().sort('-at').limit(200).lean());
}));

app.get('/api/assets/items', auth, allow(...ASSET_STAFF), wrap(async (req, res) => {
  const search = cleanText(req.query.q);
  const filter = search ? { $or: ['name', 'category', 'location'].map(field => ({ [field]: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })) } : {};
  res.json(await InventoryItem.find(filter).sort('category name'));
}));
app.post('/api/assets/items', auth, allow(...ASSET_STAFF), wrap(async (req, res) => {
  const { name, category, quantity, unit, reorderLevel, location } = req.body || {};
  const count = Number(quantity), threshold = Number(reorderLevel);
  if (!cleanText(name) || !cleanText(category) || !cleanText(unit) || !Number.isSafeInteger(count) || count < 0
    || !Number.isSafeInteger(threshold) || threshold < 0) {
    return res.status(400).json({ error: 'Enter an item, category, unit, and valid non-negative stock levels.' });
  }
  res.status(201).json(await InventoryItem.create({ name, category, quantity: count, available: count, unit, reorderLevel: threshold, location, updatedBy: req.user.name }));
}));
app.get('/api/assets/movements', auth, allow(...ASSET_STAFF), wrap(async (req, res) => {
  const [recent, outstanding] = await Promise.all([
    AssetMovement.find().sort('-date').limit(300),
    AssetMovement.find({ action: 'Issued', $expr: { $gt: ['$quantity', '$returnedQuantity'] } }).sort('-date'),
  ]);
  const movements = [...new Map([...recent, ...outstanding].map(movement => [movement.id, movement])).values()];
  await AssetMovement.populate(movements, [
    { path: 'item', select: 'name category unit' },
    { path: 'issue', select: 'borrower quantity returnedQuantity' },
  ]);
  res.json(movements);
}));
app.post('/api/assets/movements', auth, allow(...ASSET_STAFF), wrap(async (req, res) => {
  const { itemId, action, quantity, borrower, note, issueId } = req.body || {};
  const count = Number(quantity);
  const actions = ['Stock in', 'Issued', 'Returned', 'Damaged', 'Sent for maintenance', 'Returned from maintenance', 'Repaired'];
  if (!mongoose.isValidObjectId(itemId) || !actions.includes(action) || !Number.isSafeInteger(count) || count < 1
    || (action === 'Issued' && !cleanText(borrower)) || (note && (typeof note !== 'string' || note.trim().length > 240))) {
    return res.status(400).json({ error: 'Choose an item and action, enter a whole-number quantity, and add the required details.' });
  }
  const increments = {
    'Stock in': { quantity: count, available: count },
    Issued: { available: -count },
    Damaged: { available: -count, damaged: count },
    'Sent for maintenance': { available: -count, inMaintenance: count },
    'Returned from maintenance': { available: count, inMaintenance: -count },
    Repaired: { available: count, damaged: -count },
  };
  let issue;
  if (action === 'Returned') {
    if (!mongoose.isValidObjectId(issueId)) return res.status(400).json({ error: 'Choose the issue record for the returned item.' });
    issue = await AssetMovement.findOneAndUpdate({
      _id: issueId, item: itemId, action: 'Issued',
      $expr: { $lte: [{ $add: ['$returnedQuantity', count] }, '$quantity'] },
    }, { $inc: { returnedQuantity: count } }, { new: true });
    if (!issue) return res.status(409).json({ error: 'Return quantity exceeds the outstanding quantity on that issue.' });
  }
  const inc = action === 'Returned' ? { available: count } : increments[action];
  const bounds = {
    Issued: { available: { $gte: count } },
    Damaged: { available: { $gte: count } },
    'Sent for maintenance': { available: { $gte: count } },
    'Returned from maintenance': { inMaintenance: { $gte: count } },
    Repaired: { damaged: { $gte: count } },
  }[action] || {};
  let item;
  try {
    item = await InventoryItem.findOneAndUpdate({ _id: itemId, ...bounds }, { $inc: inc }, { new: true });
  } catch (error) {
    if (issue) await AssetMovement.updateOne({ _id: issue._id }, { $inc: { returnedQuantity: -count } });
    throw error;
  }
  if (!item) {
    if (issue) await AssetMovement.updateOne({ _id: issue._id }, { $inc: { returnedQuantity: -count } });
    return res.status(409).json({ error: 'There is not enough available stock in the selected state for this action.' });
  }
  let movement;
  try {
    movement = await AssetMovement.create({
      item: itemId, action, quantity: count, borrower: cleanText(borrower) || issue?.borrower,
      note: cleanText(note), issue: issue?._id, recordedBy: req.user.name,
    });
  } catch (error) {
    await InventoryItem.updateOne({ _id: itemId }, { $inc: Object.fromEntries(Object.entries(inc).map(([key, value]) => [key, -value])) });
    if (issue) await AssetMovement.updateOne({ _id: issue._id }, { $inc: { returnedQuantity: -count } });
    throw error;
  }
  await audit(req.user, 'Recorded asset activity', 'AssetMovement', movement.id, `${action}: ${count}`);
  res.status(201).json(movement);
}));

app.get('/api/finance/students', auth, allow(...FINANCE_STAFF), wrap(async (req, res) => {
  res.json(await Student.find().select('name admissionNo level').sort('level rollNo'));
}));
app.get('/api/finance', auth, allow(...FINANCE_STAFF), wrap(async (req, res) => {
  const [invoices, payments, expenses, [invoiceTotals], [expenseTotals]] = await Promise.all([
    FinanceInvoice.find().populate('student', 'name admissionNo level').sort('-createdAt'),
    FinancePayment.find().populate({ path: 'invoice', populate: { path: 'student', select: 'name admissionNo level' } }).sort('-date').limit(500),
    FinanceEntry.find().sort({ date: -1, createdAt: -1 }).limit(500),
    FinanceInvoice.aggregate([{ $group: { _id: null, billed: { $sum: '$amount' }, collected: { $sum: '$paidAmount' } } }]),
    FinanceEntry.aggregate([{ $group: { _id: null, expenses: { $sum: '$amount' } } }]),
  ]);
  const billed = invoiceTotals?.billed || 0, collected = invoiceTotals?.collected || 0;
  res.json({ invoices, payments, expenses, summary: { billed, collected, balance: billed - collected, expenses: expenseTotals?.expenses || 0 } });
}));
app.post('/api/finance/invoices', auth, allow(...FINANCE_STAFF), wrap(async (req, res) => {
  const { studentId, term, description, amount } = req.body || {};
  const value = Number(amount);
  if (!mongoose.isValidObjectId(studentId) || !cleanText(term) || !cleanText(description)
    || !Number.isSafeInteger(value) || value < 1 || !(await Student.exists({ _id: studentId }))) {
    return res.status(400).json({ error: 'Select a valid learner and enter a term, fee description, and positive whole-number amount.' });
  }
  const invoice = await FinanceInvoice.create({ student: studentId, term, description, amount: value, createdBy: req.user.name });
  await audit(req.user, 'Created fee invoice', 'FinanceInvoice', invoice.id, `${term}: ${description}`);
  res.status(201).json(invoice);
}));
app.post('/api/finance/payments', auth, allow(...FINANCE_STAFF), wrap(async (req, res) => {
  const { invoiceId, amount, method, reference } = req.body || {};
  const value = Number(amount);
  if (!mongoose.isValidObjectId(invoiceId) || !Number.isSafeInteger(value) || value < 1
    || !['Cash', 'Bank transfer', 'Mobile money'].includes(method)) {
    return res.status(400).json({ error: 'Choose an invoice, payment method, and positive whole-number amount.' });
  }
  const invoice = await FinanceInvoice.findOneAndUpdate({
    _id: invoiceId,
    $expr: { $lte: [{ $add: ['$paidAmount', value] }, '$amount'] },
  }, { $inc: { paidAmount: value } }, { new: true });
  if (!invoice) return res.status(409).json({ error: 'Payment exceeds the outstanding invoice balance, or the invoice was not found.' });
  const receiptNo = `GSA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
  let payment;
  try {
    payment = await FinancePayment.create({ invoice: invoice._id, amount: value, method, reference, receiptNo, receivedBy: req.user.name });
  } catch (error) {
    await FinanceInvoice.updateOne({ _id: invoice._id }, { $inc: { paidAmount: -value } });
    throw error;
  }
  await audit(req.user, 'Recorded fee payment', 'FinancePayment', payment.id, receiptNo);
  res.status(201).json(payment);
}));
app.post('/api/finance/expenses', auth, allow(...FINANCE_STAFF), wrap(async (req, res) => {
  const { category, description, amount, reference, date } = req.body || {};
  const value = Number(amount), entryDate = new Date(date);
  if (!cleanText(category) || !cleanText(description) || !Number.isSafeInteger(value) || value < 1
    || Number.isNaN(entryDate.getTime())) {
    return res.status(400).json({ error: 'Enter an expense category, description, positive whole-number amount, and date.' });
  }
  const expense = await FinanceEntry.create({ category, description, amount: value, reference, date: entryDate, recordedBy: req.user.name });
  await audit(req.user, 'Recorded school expense', 'FinanceEntry', expense.id, `${category}: ${description}`);
  res.status(201).json(expense);
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

await mongoose.connect(process.env.MONGO_URI);
app.listen(process.env.PORT || 5000, () => console.log('API running'));
