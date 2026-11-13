import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './models.js';

if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured.');

await mongoose.connect(process.env.MONGO_URI);
try {
  const password = await bcrypt.hash('Password123!', 10);
  const accounts = [
    { name: 'Library & Store Staff Demo', email: 'librarian.storekeeper@gsa.rw', role: 'LIBRARY_STAFF' },
    { name: 'Accountant Demo', email: 'accountant@gsa.rw', role: 'ACCOUNTANT' },
  ];
  let created = 0, migrated = 0;
  const shared = await User.findOne({ email: 'librarian.storekeeper@gsa.rw' }).select('role');
  if (shared && shared.role !== 'LIBRARY_STAFF') throw new Error('librarian.storekeeper@gsa.rw already exists with a different role.');

  const legacyLibrarian = await User.findOne({ email: 'librarian@gsa.rw' });
  const storekeeper = await User.findOne({ email: 'storekeeper@gsa.rw', role: 'STOREKEEPER' });
  if (legacyLibrarian) {
    if (legacyLibrarian.role !== 'LIBRARIAN' || legacyLibrarian.name !== 'Librarian Demo') {
      throw new Error('A non-demo account is using librarian@gsa.rw. Consolidate that account manually before using the shared login.');
    }
    if (!shared) {
      legacyLibrarian.name = 'Library & Store Staff Demo';
      legacyLibrarian.email = 'librarian.storekeeper@gsa.rw';
      legacyLibrarian.role = 'LIBRARY_STAFF';
      await legacyLibrarian.save();
    } else {
      await legacyLibrarian.deleteOne();
    }
    migrated++;
  }
  if (storekeeper?.name === 'Storekeeper Demo') {
    await storekeeper.deleteOne();
    migrated++;
  } else if (storekeeper) {
    throw new Error('A non-demo storekeeper account still uses storekeeper@gsa.rw. Consolidate that account manually before using the shared login.');
  }
  const previousShared = await User.findOne({ email: 'library@gsa.rw' });
  if (previousShared) {
    if (previousShared.role !== 'LIBRARY_STAFF') throw new Error('library@gsa.rw already exists with a different role.');
    const currentShared = await User.findOne({ email: 'librarian.storekeeper@gsa.rw' });
    if (currentShared) await previousShared.deleteOne();
    else {
      previousShared.email = 'librarian.storekeeper@gsa.rw';
      await previousShared.save();
    }
    migrated++;
  }

  for (const account of accounts.filter(account => account.role === 'ACCOUNTANT')) {
    const existing = await User.findOne({ email: account.email }).select('role');
    if (existing) {
      if (existing.role !== account.role) throw new Error(`The account ${account.email} already exists with a different role.`);
      continue;
    }
    await User.create({ ...account, password });
    created++;
  }
  if (!shared && !legacyLibrarian && !previousShared) {
    await User.create({ ...accounts[0], password });
    created++;
  }
  console.log(`Created ${created} demo account(s) and migrated ${migrated} library demo account(s); existing matching accounts were left unchanged.`);
} finally {
  await mongoose.disconnect();
}
