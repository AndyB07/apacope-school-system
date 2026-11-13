import mongoose from 'mongoose';
const { Schema, model } = mongoose;
// Four tracks and their levels (code: NUR / PRI / SEC / TVT)
export const LEVELS = {
  NUR: ['Nursery 1', 'Nursery 2', 'Nursery 3'],
  PRI: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
  SEC: ['S1', 'S2', 'S3'],
  TVT: ['L3SWD', 'L4SWD', 'L5SWD'],
};
// Configurable thresholds set by school management
export const CONFIG = { minPct: 75, followUp: 3, parentContact: 5, escalate: 8 };
// Which tracks each role may see (null = all)
export const ROLE_TRACKS = { ADMIN: null, HEAD: null, TRAINER: null,
  DOS_REB: ['NUR', 'PRI', 'SEC'], DOS_TVET: ['TVT'] };

export const User = model('User', new Schema({
  name: String, email: { type: String, unique: true }, password: String,
  isActive: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  assignedLevels: [String],
  teachingAssignments: [{
    level: { type: String, required: true },
    courses: { type: [String], default: [] },
  }],
  role: { type: String, enum: ['ADMIN', 'HEAD', 'DOS_REB', 'DOS_TVET', 'TRAINER', 'STUDENT', 'PARENT', 'LIBRARIAN', 'LIBRARY_STAFF', 'ACCOUNTANT', 'STOREKEEPER'] },
  student: { type: Schema.Types.ObjectId, ref: 'Student' },
}));
export const Student = model('Student', new Schema({
  admissionNo: { type: String, unique: true }, name: String, rollNo: Number,
  track: { type: String, enum: Object.keys(LEVELS) }, level: String,
  guardianPhone: String, parent: { type: Schema.Types.ObjectId, ref: 'User' },
  enrollmentStatus: { type: String, enum: ['Active', 'Graduated', 'Withdrawn', 'Suspended'], default: 'Active' },
  previousSchool: { type: String, trim: true, maxlength: 120 },
  previousAcademicSummary: { type: String, trim: true, maxlength: 1000 },
}));
const att = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'Student', index: true },
  date: String, // YYYY-MM-DD
  status: { type: String, enum: ['Present', 'Absent', 'Late', 'Excused'] },
  markedBy: String,
});
att.index({ student: 1, date: 1 }, { unique: true });
export const Attendance = model('Attendance', att);
export const FollowUp = model('FollowUp', new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'Student' }, contactedBy: String,
  channel: { type: String, enum: ['Phone', 'SMS', 'Email', 'In person'] },
  outcome: String, at: { type: Date, default: Date.now },
}));
export const Material = model('Material', new Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000 },
  type: { type: String, enum: ['Video', 'Handout', 'Media'], required: true },
  url: String, level: String, module: String, outcome: String, postedBy: String,
  audienceTrack: { type: String, enum: Object.keys(LEVELS) },
  audienceLevel: String,
  createdAt: { type: Date, default: Date.now },
}));
const notice = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 3000 },
  category: { type: String, enum: ['Announcement', 'Assignment', 'Event', 'Exam'], required: true },
  audienceTrack: { type: String, enum: Object.keys(LEVELS) },
  audienceLevel: String,
  dueAt: Date,
  postedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  acknowledgements: [{ userId: String, readAt: { type: Date, default: Date.now } }],
});
notice.index({ audienceTrack: 1, audienceLevel: 1, createdAt: -1 });
export const Notice = model('Notice', notice);

export const SUBJECTS = {
  NUR: ['Language', 'Numeracy', 'Environment', 'Creative Arts'],
  PRI: ['English', 'Kinyarwanda', 'Mathematics', 'Science', 'Social Studies', 'Religion'],
  SEC: ['English', 'Kinyarwanda', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography'],
  TVT: ['Web Design', 'Programming Fundamentals', 'Databases', 'Networking', 'Communication Skills'],
};
// CA is out of 40, exam out of 60. TVET also gets a competency result (>=70 = Competent).
export const grade = (t, track) => track === 'TVT' ? (t >= 70 ? 'Competent' : 'Not Yet Competent')
  : t >= 80 ? 'A' : t >= 70 ? 'B' : t >= 60 ? 'C' : t >= 50 ? 'D' : t >= 40 ? 'E' : 'F';
const mk = new Schema({ student: { type: Schema.Types.ObjectId, ref: 'Student' }, term: String, subject: String, ca: Number, exam: Number });
mk.index({ student: 1, term: 1, subject: 1 }, { unique: true });
export const Mark = model('Mark', mk);

export const InventoryItem = model('InventoryItem', new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  quantity: { type: Number, required: true, min: 0 },
  available: { type: Number, required: true, min: 0 },
  damaged: { type: Number, default: 0, min: 0 },
  inMaintenance: { type: Number, default: 0, min: 0 },
  unit: { type: String, required: true, trim: true, maxlength: 30 },
  reorderLevel: { type: Number, required: true, min: 0, default: 0 },
  location: { type: String, trim: true, maxlength: 80 },
  updatedBy: String,
}, { timestamps: true }));
export const AssetMovement = model('AssetMovement', new Schema({
  item: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
  action: { type: String, enum: ['Stock in', 'Issued', 'Returned', 'Damaged', 'Sent for maintenance', 'Returned from maintenance', 'Repaired'], required: true },
  quantity: { type: Number, required: true, min: 1 },
  returnedQuantity: { type: Number, default: 0, min: 0 },
  issue: { type: Schema.Types.ObjectId, ref: 'AssetMovement' },
  borrower: { type: String, trim: true, maxlength: 120 },
  note: { type: String, trim: true, maxlength: 240 },
  recordedBy: String,
  date: { type: Date, default: Date.now },
}));
export const FinanceInvoice = model('FinanceInvoice', new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  term: { type: String, required: true, trim: true, maxlength: 40 },
  description: { type: String, required: true, trim: true, maxlength: 120 },
  amount: { type: Number, required: true, min: 1 },
  paidAmount: { type: Number, required: true, min: 0, default: 0 },
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
}));
export const FinancePayment = model('FinancePayment', new Schema({
  invoice: { type: Schema.Types.ObjectId, ref: 'FinanceInvoice', required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  method: { type: String, enum: ['Cash', 'Bank transfer', 'Mobile money'], required: true },
  reference: { type: String, trim: true, maxlength: 80 },
  receiptNo: { type: String, unique: true, required: true },
  receivedBy: String,
  date: { type: Date, default: Date.now },
}));
export const FinanceEntry = model('FinanceEntry', new Schema({
  category: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 240 },
  amount: { type: Number, required: true, min: 1 },
  reference: { type: String, trim: true, maxlength: 80 },
  date: { type: Date, required: true, default: Date.now },
  recordedBy: String,
  createdAt: { type: Date, default: Date.now },
}));
export const AuditLog = model('AuditLog', new Schema({
  actorId: { type: String, required: true, index: true },
  actorName: { type: String, required: true },
  action: { type: String, required: true, maxlength: 80 },
  entity: { type: String, required: true, maxlength: 80 },
  entityId: { type: String, maxlength: 80 },
  details: { type: String, maxlength: 240 },
  at: { type: Date, default: Date.now, index: true },
}));
const notification = new Schema({
  recipientId: { type: String, required: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  category: { type: String, enum: ['Attendance', 'Academic', 'Message'], required: true },
  title: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 500 },
  date: { type: String, maxlength: 10 },
  createdAt: { type: Date, default: Date.now },
  readAt: Date,
});
notification.index({ recipientId: 1, student: 1, date: 1, category: 1 }, { unique: true });
export const Notification = model('Notification', notification);
