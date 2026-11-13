import { useEffect, useState } from 'react';
import { api } from './api.js';

const SUBJECTS = {
  NUR: ['Language', 'Numeracy', 'Environment', 'Creative Arts'],
  PRI: ['English', 'Kinyarwanda', 'Mathematics', 'Science', 'Social Studies', 'Religion'],
  SEC: ['English', 'Kinyarwanda', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography'],
  TVT: ['Web Design', 'Programming Fundamentals', 'Databases', 'Networking', 'Communication Skills'],
};

const assignmentMap = assignments => Object.fromEntries(
  assignments.map(assignment => [assignment.level, assignment.courses]),
);

export default function TrainerAssignments({ user }) {
  const [classes, setClasses] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [newTrainer, setNewTrainer] = useState({ name: '', email: '', teachingAssignments: {} });
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [busyTrainerId, setBusyTrainerId] = useState('');
  const [creatingTrainer, setCreatingTrainer] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const trackLabel = user.role === 'DOS_TVET' ? 'TVET' : 'REB';

  const load = async () => {
    const [nextClasses, nextTrainers] = await Promise.all([api('/classes'), api('/dos/trainers')]);
    setClasses(nextClasses);
    setTrainers(nextTrainers);
    setDrafts(Object.fromEntries(nextTrainers.map(trainer => [
      trainer._id, assignmentMap(trainer.teachingAssignments || []),
    ])));
  };
  useEffect(() => {
    load().catch(e => setError(e.message)).finally(() => setLoaded(true));
  }, []);

  const toggleClass = (trainerId, level, checked) => setDrafts(current => {
    const assignments = { ...current[trainerId] };
    if (checked) assignments[level] = assignments[level] || [];
    else delete assignments[level];
    return { ...current, [trainerId]: assignments };
  });
  const toggleCourse = (trainerId, level, course, checked) => setDrafts(current => {
    const assignments = { ...current[trainerId] };
    const courses = new Set(assignments[level] || []);
    if (checked) courses.add(course);
    else courses.delete(course);
    assignments[level] = [...courses];
    return { ...current, [trainerId]: assignments };
  });
  const toggleNewClass = (level, checked) => setNewTrainer(current => {
    const assignments = { ...current.teachingAssignments };
    if (checked) assignments[level] = assignments[level] || [];
    else delete assignments[level];
    return { ...current, teachingAssignments: assignments };
  });
  const toggleNewCourse = (level, course, checked) => setNewTrainer(current => {
    const courses = new Set(current.teachingAssignments[level] || []);
    if (checked) courses.add(course);
    else courses.delete(course);
    return { ...current, teachingAssignments: { ...current.teachingAssignments, [level]: [...courses] } };
  });
  const createTrainer = async event => {
    event.preventDefault();
    setError(''); setStatus(''); setTemporaryPassword(''); setCreatingTrainer(true);
    const teachingAssignments = Object.entries(newTrainer.teachingAssignments)
      .filter(([, courses]) => courses.length)
      .map(([level, courses]) => ({ level, courses }));
    try {
      const created = await api('/dos/trainers', {
        method: 'POST',
        body: { name: newTrainer.name, email: newTrainer.email, teachingAssignments },
      });
      setNewTrainer({ name: '', email: '', teachingAssignments: {} });
      setTemporaryPassword(created.temporaryPassword);
      setStatus(`Trainer account created for ${created.name}. Copy the temporary password below and share it privately; the trainer must change it after signing in.`);
      await load();
    } catch (e) { setError(e.message); }
    finally { setCreatingTrainer(false); }
  };
  const save = async trainer => {
    setError(''); setStatus(''); setTemporaryPassword(''); setBusyTrainerId(trainer._id);
    const teachingAssignments = Object.entries(drafts[trainer._id] || {})
      .filter(([, courses]) => courses.length)
      .map(([level, courses]) => ({ level, courses }));
    try {
      await api(`/dos/trainers/${trainer._id}/assignments`, {
        method: 'PUT', body: { teachingAssignments },
      });
      setStatus(`Class and course assignments saved for ${trainer.name}.`);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyTrainerId(''); }
  };
  const assignmentSummary = trainer => (trainer.teachingAssignments || []).length
    ? trainer.teachingAssignments.map(assignment => `${assignment.level}: ${assignment.courses.join(', ')}`).join(' · ')
    : 'No classes or courses assigned yet.';

  return <section className="operationsPage">
    <header className="operationsHeading"><div><span className="sectionEyebrow">{trackLabel} ACADEMIC MANAGEMENT</span>
      <h1>Trainer class &amp; course assignments</h1>
      <p>Assign trainers to the classes and courses they teach. Assignments control which attendance and marks they can access.</p></div>
      <span className="operationsMark">GSA <i>✳</i></span></header>
    {error && <p className="operationFeedback operationError" role="alert">{error}</p>}
    {status && <p className="operationFeedback" role="status">{status}</p>}
    {temporaryPassword && <p className="operationFeedback" role="status"><b>Temporary password:</b> <code>{temporaryPassword}</code></p>}
    {!loaded && !error && <section className="operationCard"><p>Loading trainer assignments…</p></section>}
    {loaded && !error && <section className="operationCard">
      <div className="operationCardHeading"><span className="sectionEyebrow">NEW TRAINER</span><h2>Add a trainer or teacher</h2>
        <p>Create an active trainer account and assign their classes and courses. A temporary password will be generated and shown once.</p></div>
      <form className="operationForm" onSubmit={createTrainer}>
        <label>Full name<input required maxLength="120" autoComplete="name" value={newTrainer.name}
          onChange={event => setNewTrainer(current => ({ ...current, name: event.target.value }))} /></label>
        <label>Email address<input required type="email" maxLength="254" autoComplete="email" value={newTrainer.email}
          onChange={event => setNewTrainer(current => ({ ...current, email: event.target.value }))} /></label>
        <div className="trainerAssignmentGrid">{classes.map(({ track, level }) => {
          const selected = Object.hasOwn(newTrainer.teachingAssignments, level);
          return <fieldset className="trainerClassAssignment" key={level}>
            <legend><label><input type="checkbox" checked={selected}
              onChange={event => toggleNewClass(level, event.target.checked)} />
              {level} · {track === 'TVT' ? 'TVET' : track}</label></legend>
            {selected ? <div className="trainerCourseList">
              {SUBJECTS[track].map(course => <label key={course}><input type="checkbox"
                checked={(newTrainer.teachingAssignments[level] || []).includes(course)}
                onChange={event => toggleNewCourse(level, course, event.target.checked)} />{course}</label>)}
              {!newTrainer.teachingAssignments[level]?.length && <small>Select at least one course.</small>}
            </div> : <p>Select the class to choose its courses.</p>}
          </fieldset>;
        })}</div>
        <button className="pri" type="submit" disabled={creatingTrainer
          || !Object.values(newTrainer.teachingAssignments).some(courses => courses.length)}>
          {creatingTrainer ? 'Creating…' : 'Create trainer account'}
        </button>
      </form>
    </section>}
    {loaded && !error && !trainers.length ? <section className="operationCard"><h2>No active trainer accounts</h2>
      <p>Create or enable a trainer account first, then return here to assign classes and courses.</p></section>
      : loaded && !error && trainers.map(trainer => {
        const assignments = drafts[trainer._id] || {};
        return <section className="operationCard trainerAssignmentCard" key={trainer._id}>
          <div className="operationCardHeading"><span className="sectionEyebrow">TRAINER</span>
            <h2>{trainer.name}</h2><p>{trainer.email}</p>
            <p><b>Current assignments:</b> {assignmentSummary(trainer)}</p></div>
          <div className="trainerAssignmentGrid">{classes.map(({ track, level }) => {
            const selected = Object.hasOwn(assignments, level);
            return <fieldset className="trainerClassAssignment" key={level}>
              <legend><label><input type="checkbox" checked={selected}
                onChange={event => toggleClass(trainer._id, level, event.target.checked)} />
                {level} · {track === 'TVT' ? 'TVET' : track}</label></legend>
              {selected ? <div className="trainerCourseList">
                {SUBJECTS[track].map(course => <label key={course}><input type="checkbox"
                  checked={(assignments[level] || []).includes(course)}
                  onChange={event => toggleCourse(trainer._id, level, course, event.target.checked)} />{course}</label>)}
                {!assignments[level]?.length && <small>Select at least one course to assign this class.</small>}
              </div> : <p>Select the class to choose its courses.</p>}
            </fieldset>;
          })}</div>
          <button className="pri" type="button" disabled={busyTrainerId === trainer._id}
            onClick={() => save(trainer)}>{busyTrainerId === trainer._id ? 'Saving…' : 'Save assignments'}</button>
        </section>;
      })}
  </section>;
}
