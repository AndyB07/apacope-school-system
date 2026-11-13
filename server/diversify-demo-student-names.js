import 'dotenv/config';
import mongoose from 'mongoose';
import { Student } from './models.js';
import { DEMO_STUDENT_COUNT, demoStudentName, legacyDemoStudentName } from './demoStudents.js';

if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured.');

let updated = 0;

try {
  await mongoose.connect(process.env.MONGO_URI);
  const learners = await Student.find({ admissionNo: /^GSA\d{4}$/ });
  for (const learner of learners) {
    const studentNumber = Number(learner.admissionNo.slice(3));
    if (studentNumber < 1 || studentNumber > DEMO_STUDENT_COUNT) continue;
    if (!legacyDemoStudentName(learner.rollNo, learner.level).includes(learner.name)) continue;
    learner.name = demoStudentName(studentNumber);
    await learner.save();
    updated++;
  }
  console.log(`Updated ${updated} seeded demo learner names. Other names were not changed.`);
} finally {
  await mongoose.disconnect();
}
