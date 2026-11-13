import 'dotenv/config';
import mongoose from 'mongoose';
import { Student } from './models.js';
import { DEMO_STUDENTS, demoStudentName } from './demoStudents.js';

if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured.');

const legacyFirstNames = new Set(DEMO_STUDENTS.map(([firstName]) => firstName));
let updated = 0;

try {
  await mongoose.connect(process.env.MONGO_URI);
  const learners = await Student.find({ admissionNo: /^GSA\d{4}$/ });
  for (const learner of learners) {
    const legacySuffix = learner.level.replace(/\s+/g, '');
    const match = learner.name.match(/^(\S+)\s+(\S+)$/);
    if (!match || match[2] !== legacySuffix || !legacyFirstNames.has(match[1])) continue;
    learner.name = demoStudentName(learner.rollNo);
    await learner.save();
    updated++;
  }
  console.log(`Updated ${updated} demo learner names. Other learner names were not changed.`);
} finally {
  await mongoose.disconnect();
}
