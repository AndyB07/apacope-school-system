import { useEffect, useState } from 'react';
import { api } from './api.js';

const ROLES = [
  'ADMIN', 'HEAD', 'DOS_REB', 'DOS_TVET', 'TRAINER', 'STUDENT', 'PARENT',
  'LIBRARIAN', 'LIBRARY_STAFF', 'STOREKEEPER', 'ACCOUNTANT',
];
const TRACKS = {
  NUR: ['Nursery 1', 'Nursery 2', 'Nursery 3'],
  PRI: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
  SEC: ['S1', 'S2', 'S3'],
  TVT: ['L3SWD', 'L4SWD', 'L5SWD'],
};
const COURSES = {
  NUR: ['Language', 'Numeracy', 'Environment', 'Creative Arts'],
  PRI: ['English', 'Kinyarwanda', 'Mathematics', 'Science', 'Social Studies', 'Religion'],
  SEC: ['English', 'Kinyarwanda', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography'],
  TVT: ['Web Design', 'Programming Fundamentals', 'Databases', 'Networking', 'Communication Skills'],
};
const dateLabel = value => value ? new Date(value).toLocaleString() : '—';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [audit, setAudit] = useState([]);
  const [role, setRole] = useState('TRAINER');
  const [account, setAccount] = useState({ name: '', email: '', password: '', studentId: '', studentIds: [], teachingAssignments: [] });
  const [learner, setLearner] = useState({
    admissionNo: '', name: '', rollNo: '1', track: 'TVT', level: 'L3SWD', guardianPhone: '',
    parentId: '', enrollmentStatus: 'Active', previousSchool: '', previousAcademicSummary: '',
  });
  const [editingLearnerId, setEditingLearnerId] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;

  const load = async () => {
    const [nextUsers, nextStudents, nextAudit] = await Promise.all([
      api('/admin/users'), api('/admin/students'), api('/admin/audit'),
    ]);
    setUsers(nextUsers);
    setStudents(nextStudents);
    setAudit(nextAudit);
  };
  useEffect(() => { load().catch(e => setError(e.message)); }, []);

  const createAccount = async event => {
    event.preventDefault();
    setError(''); setStatus(''); setBusy(true);
    try {
      await api('/admin/users', { method: 'POST', body: {
        ...account, role,
        teachingAssignments: role === 'TRAINER'
          ? account.teachingAssignments.filter(assignment => assignment.courses.length) : [],
        ...(role !== 'STUDENT' ? { studentId: undefined } : {}),
        ...(role !== 'PARENT' ? { studentIds: undefined } : {}),
      } });
      setAccount({ name: '', email: '', password: '', studentId: '', studentIds: [], teachingAssignments: [] });
      setStatus('Account created. Share the initial password with the user using a private channel.');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const registerLearner = async event => {
    event.preventDefault();
    setError(''); setStatus(''); setBusy(true);
    try {
      if (editingLearnerId) await api(`/admin/students/${editingLearnerId}`, { method: 'PATCH', body: learner });
      else await api('/admin/students', { method: 'POST', body: learner });
      setLearner({ admissionNo: '', name: '', rollNo: '1', track: 'TVT', level: 'L3SWD', guardianPhone: '',
        parentId: '', enrollmentStatus: 'Active', previousSchool: '', previousAcademicSummary: '' });
      setEditingLearnerId('');
      setStatus(editingLearnerId ? 'Learner record updated.' : 'Learner registered.');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const editLearner = student => {
    setEditingLearnerId(student._id);
    setLearner({
      admissionNo: student.admissionNo || '', name: student.name || '', rollNo: String(student.rollNo || 1),
      track: student.track, level: student.level, guardianPhone: student.guardianPhone || '',
      parentId: student.parent?._id || '', enrollmentStatus: student.enrollmentStatus || 'Active',
      previousSchool: student.previousSchool || '', previousAcademicSummary: student.previousAcademicSummary || '',
    });
    setError(''); setStatus('');
  };
  const updateAccount = async (user, values) => {
    setError(''); setStatus('');
    try {
      await api(`/admin/users/${user._id}`, { method: 'PATCH', body: values });
      setStatus(`Access updated for ${user.email}.`);
      await load();
    } catch (e) { setError(e.message); }
  };
  const resetPassword = async user => {
    if (!window.confirm(`Issue a temporary password for ${user.name}? They will need to set a new password before using the system.`)) return;
    setError(''); setStatus('');
    try {
      const result = await api(`/admin/users/${user._id}/reset-password`, { method: 'POST', body: {} });
      setStatus(`Temporary password for ${user.email}: ${result.temporaryPassword} — copy and share it privately. It will not be shown again.`);
      await load();
    } catch (e) { setError(e.message); }
  };
  const toggleStudentLink = id => setAccount(current => ({
    ...current,
    studentIds: current.studentIds.includes(id)
      ? current.studentIds.filter(studentId => studentId !== id) : [...current.studentIds, id],
  }));
  const toggleTeachingClass = (level, checked) => setAccount(current => {
    const teachingAssignments = current.teachingAssignments.filter(assignment => assignment.level !== level);
    if (checked) teachingAssignments.push({ level, courses: [] });
    return { ...current, teachingAssignments };
  });
  const toggleTeachingCourse = (level, course, checked) => setAccount(current => ({
    ...current,
    teachingAssignments: current.teachingAssignments.map(assignment => {
      if (assignment.level !== level) return assignment;
      const courses = new Set(assignment.courses);
      if (checked) courses.add(course);
      else courses.delete(course);
      return { ...assignment, courses: [...courses] };
    }),
  }));

  return <section className="operationsPage">
    <header className="operationsHeading"><div><span className="sectionEyebrow">SCHOOL ADMINISTRATION</span>
      <h1>Accounts &amp; learner records</h1><p>Create role-based accounts, register learners, and review important system changes.</p></div>
      <span className="operationsMark">GSA <i>✳</i></span></header>
    {error && <p className="operationFeedback operationError" role="alert">{error}</p>}
    {status && <p className="operationFeedback" role="status">{status}</p>}
    <div className="operationsGrid">
      <section className="operationCard"><div className="operationCardHeading"><span className="sectionEyebrow">ACCOUNT ACCESS</span><h2>Create an account</h2>
        <p>Passwords must contain at least 10 characters. Student and parent accounts are linked to learner records.</p></div>
        <form className="operationForm" onSubmit={createAccount}>
          <label>Full name<input required maxLength="120" value={account.name} onChange={e => setAccount({ ...account, name: e.target.value })} /></label>
          <label>Email address<input required type="email" maxLength="254" value={account.email} onChange={e => setAccount({ ...account, email: e.target.value })} /></label>
          <label>Role<select value={role} onChange={e => setRole(e.target.value)}>{ROLES.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
          {role === 'STUDENT' && <label>Linked learner<select required value={account.studentId} onChange={e => setAccount({ ...account, studentId: e.target.value })}>
            <option value="">Select learner</option>{students.filter(student => !users.some(user => user.role === 'STUDENT' && user.student?._id === student._id)).map(student =>
              <option key={student._id} value={student._id}>{student.name} · {student.level} · {student.admissionNo}</option>)}</select></label>}
          {role === 'PARENT' && <fieldset className="adminStudentLinks"><legend>Link learner(s)</legend>
            {students.map(student => <label key={student._id}><input type="checkbox" checked={account.studentIds.includes(student._id)}
              disabled={Boolean(student.parent)} onChange={() => toggleStudentLink(student._id)} />
              {student.name} · {student.level}{student.parent ? ` · linked to ${student.parent.name}` : ''}</label>)}
          </fieldset>}
          {role === 'TRAINER' && <div className="trainerAssignmentGrid">{Object.entries(TRACKS).flatMap(([track, levels]) =>
            levels.map(level => {
              const assignment = account.teachingAssignments.find(item => item.level === level);
              return <fieldset className="trainerClassAssignment" key={level}>
                <legend><label><input type="checkbox" checked={Boolean(assignment)}
                  onChange={event => toggleTeachingClass(level, event.target.checked)} />{level} · {track === 'TVT' ? 'TVET' : track}</label></legend>
                {assignment && <div className="trainerCourseList">{COURSES[track].map(course => <label key={course}><input type="checkbox"
                  checked={assignment.courses.includes(course)} onChange={event => toggleTeachingCourse(level, course, event.target.checked)} />{course}</label>)}</div>}
              </fieldset>;
            }))}</div>}
          <label>Initial password<input required type="password" minLength="10" maxLength="128" autoComplete="new-password"
            value={account.password} onChange={e => setAccount({ ...account, password: e.target.value })} /></label>
          <button className="pri" disabled={busy || (role === 'STUDENT' && !account.studentId)
            || (role === 'PARENT' && !account.studentIds.length)
            || (role === 'TRAINER' && !account.teachingAssignments.some(assignment => assignment.courses.length))}>
            {busy ? 'Creating…' : 'Create account'}</button>
        </form>
      </section>
      <section className="operationCard"><div className="operationCardHeading"><span className="sectionEyebrow">ADMISSIONS</span><h2>{editingLearnerId ? 'Edit learner record' : 'Register a learner'}</h2>
        <p>Maintain learner admission details, enrollment status, previous academic information, and parent link.</p></div>
        <form className="operationForm" onSubmit={registerLearner}>
          <label>Admission number<input required maxLength="40" value={learner.admissionNo} onChange={e => setLearner({ ...learner, admissionNo: e.target.value })} /></label>
          <label>Learner name<input required maxLength="120" value={learner.name} onChange={e => setLearner({ ...learner, name: e.target.value })} /></label>
          <div className="operationFormPair">
            <label>Education track<select value={learner.track} onChange={e => {
              const nextTrack = e.target.value;
              setLearner({ ...learner, track: nextTrack, level: TRACKS[nextTrack][0] });
            }}>{Object.keys(TRACKS).map(track => <option key={track} value={track}>{track === 'TVT' ? 'TVET' : track}</option>)}</select></label>
            <label>Class / trade<select value={learner.level} onChange={e => setLearner({ ...learner, level: e.target.value })}>
              {TRACKS[learner.track].map(level => <option key={level}>{level}</option>)}</select></label>
          </div>
          <div className="operationFormPair">
            <label>Roll number<input required type="number" min="1" step="1" value={learner.rollNo} onChange={e => setLearner({ ...learner, rollNo: e.target.value })} /></label>
            <label>Guardian phone<input maxLength="40" value={learner.guardianPhone} onChange={e => setLearner({ ...learner, guardianPhone: e.target.value })} /></label>
          </div>
          <label>Enrollment status<select value={learner.enrollmentStatus} onChange={e => setLearner({ ...learner, enrollmentStatus: e.target.value })}>
            {['Active', 'Graduated', 'Withdrawn', 'Suspended'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Previous school (optional)<input maxLength="120" value={learner.previousSchool} onChange={e => setLearner({ ...learner, previousSchool: e.target.value })} /></label>
          <label>Previous academic records / notes<textarea maxLength="1000" rows="3" value={learner.previousAcademicSummary}
            onChange={e => setLearner({ ...learner, previousAcademicSummary: e.target.value })} /></label>
          <label>Parent account (optional)<select value={learner.parentId} onChange={e => setLearner({ ...learner, parentId: e.target.value })}>
            <option value="">Not linked</option>{users.filter(user => user.role === 'PARENT' && user.isActive).map(user =>
              <option key={user._id} value={user._id}>{user.name} · {user.email}</option>)}</select></label>
          <div className="row"><button className="pri" disabled={busy}>{busy ? 'Saving…' : editingLearnerId ? 'Save learner record' : 'Register learner'}</button>
            {editingLearnerId && <button type="button" onClick={() => {
              setEditingLearnerId('');
              setLearner({ admissionNo: '', name: '', rollNo: '1', track: 'TVT', level: 'L3SWD', guardianPhone: '',
                parentId: '', enrollmentStatus: 'Active', previousSchool: '', previousAcademicSummary: '' });
            }}>Cancel</button>}</div>
        </form>
      </section>
    </div>

    <section className="operationCard"><div className="operationTableHeading"><div><span className="sectionEyebrow">ACCOUNT REGISTER</span><h2>Users and permissions</h2></div></div>
      <div className="tw"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Learner link</th><th>Teaching assignments</th><th>Access</th><th>Password</th></tr></thead>
        <tbody>{users.map(user => <tr key={user._id}><td>{user.name}</td><td>{user.email}</td><td><select aria-label={`Role for ${user.email}`} value={user.role}
          disabled={user._id === currentUserId}
          onChange={e => updateAccount(user, { role: e.target.value, isActive: user.isActive })}>
          {ROLES.map(value => <option key={value} value={value} disabled={value === 'STUDENT' && !user.student}>{value.replaceAll('_', ' ')}</option>)}</select></td>
          <td>{user.student ? `${user.student.name} · ${user.student.level}` : user.children.length ? user.children.map(child => `${child.name} · ${child.level}`).join(', ') : '—'}</td>
          <td>{(user.teachingAssignments || []).map(assignment => `${assignment.level}: ${assignment.courses.join(', ')}`).join(' · ') || '—'}</td>
          <td><button type="button" className={user.isActive ? '' : 'pri'} disabled={user._id === currentUserId}
            onClick={() => updateAccount(user, { role: user.role, isActive: !user.isActive })}>{user.isActive ? 'Disable' : 'Enable'}</button></td>
          <td><button type="button" disabled={user._id === currentUserId}
            onClick={() => resetPassword(user)}>{user.mustChangePassword ? 'Reissue temporary password' : 'Reset password'}</button></td>
        </tr>)}</tbody></table></div>
    </section>
    <section className="operationCard"><div className="operationTableHeading"><div><span className="sectionEyebrow">LEARNER REGISTER</span><h2>Admissions</h2></div></div>
      <div className="tw"><table><thead><tr><th>Admission no.</th><th>Name</th><th>Track</th><th>Class / trade</th><th>Status</th><th>Previous school</th><th>Parent</th><th>Guardian phone</th><th>Previous academic notes</th><th></th></tr></thead>
        <tbody>{students.map(student => <tr key={student._id}><td>{student.admissionNo}</td><td>{student.name}</td><td>{student.track}</td>
          <td>{student.level}</td><td>{student.enrollmentStatus || 'Active'}</td><td>{student.previousSchool || '—'}</td>
          <td>{student.parent?.name || '—'}</td><td>{student.guardianPhone || '—'}</td><td>{student.previousAcademicSummary || '—'}</td>
          <td><button type="button" onClick={() => editLearner(student)}>Edit</button></td></tr>)}</tbody></table></div>
    </section>
    <section className="operationCard"><div className="operationTableHeading"><div><span className="sectionEyebrow">ACCOUNTABILITY</span><h2>Recent system activity</h2></div></div>
      <div className="tw"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
        <tbody>{audit.map(entry => <tr key={entry._id}><td>{dateLabel(entry.at)}</td><td>{entry.actorName}</td><td>{entry.action}</td>
          <td>{entry.entity}</td><td>{entry.details || '—'}</td></tr>)}</tbody></table>{!audit.length && <p className="operationEmpty">Administrative actions will appear here.</p>}</div>
    </section>
  </section>;
}
