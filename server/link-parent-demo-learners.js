import 'dotenv/config';
import mongoose from 'mongoose';
import { LEVELS, Student, User } from './models.js';

if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured.');

try {
  await mongoose.connect(process.env.MONGO_URI);
  const parent = await User.findOne({ email: 'parent@gsa.rw', role: 'PARENT' }).select('_id');
  if (!parent) throw new Error('Parent demo account not found.');

  let linked = 0;
  let skipped = 0;
  for (const [track, levels] of Object.entries(LEVELS)) {
    for (const level of levels) {
      const learner = await Student.findOne({ track, level, rollNo: 1, admissionNo: /^GSA/ });
      if (!learner) {
        skipped++;
        continue;
      }
      if (learner.parent && learner.parent.toString() !== parent.id) {
        skipped++;
        continue;
      }
      learner.parent = parent._id;
      await learner.save();
      linked++;
    }
  }
  console.log(`Linked ${linked} demo learners across classes; skipped ${skipped} missing or already-linked learners.`);
} finally {
  await mongoose.disconnect();
}
