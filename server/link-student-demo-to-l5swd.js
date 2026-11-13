import 'dotenv/config';
import mongoose from 'mongoose';
import { Student, User } from './models.js';

if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured.');

try {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: 'student@gsa.rw', role: 'STUDENT' });
  if (!user) throw new Error('Student demo account not found.');

  const learner = await Student.findOne({ track: 'TVT', level: 'L5SWD' }).sort('rollNo');
  if (!learner) throw new Error('No L5SWD learner exists. Add an L5SWD learner first.');

  user.student = learner._id;
  await user.save();
  console.log('Student demo account is now linked to the first L5SWD learner.');
} finally {
  await mongoose.disconnect();
}
