import { useState, useEffect } from 'react'; import { api } from './api.js'; import StudentIdentity from './StudentIdentity.jsx';
const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const grade = (t, tvt) => tvt ? (t >= 70 ? 'Competent' : 'Not Yet Competent') : t >= 80 ? 'A' : t >= 70 ? 'B' : t >= 60 ? 'C' : t >= 50 ? 'D' : t >= 40 ? 'E' : 'F';

export function Marks() {
  const [classes, setClasses] = useState([]), [cls, setCls] = useState(null), [subs, setSubs] = useState([]), [subject, setSubject] = useState('');
  const [term, setTerm] = useState('Term 1'), [rows, setRows] = useState([]), [msg, setMsg] = useState(''), [error, setError] = useState('');
  useEffect(() => { api('/classes').then(c => { setClasses(c); setCls(c[0] || null); }).catch(e => setError(e.message)); }, []);
  useEffect(() => {
    if (!cls) { setSubs([]); setSubject(''); setRows([]); return; }
    setError('');
    api(`/subjects?track=${encodeURIComponent(cls.track)}&level=${encodeURIComponent(cls.level)}`)
      .then(subjects => { setSubs(subjects); setSubject(current => subjects.includes(current) ? current : subjects[0] || ''); })
      .catch(e => { setSubs([]); setSubject(''); setError(e.message); });
  }, [cls]);
  useEffect(() => {
    if (!cls || !subject) { setRows([]); return; }
    setError('');
    api(`/marks?level=${encodeURIComponent(cls.level)}&term=${encodeURIComponent(term)}&subject=${encodeURIComponent(subject)}`)
      .then(setRows).catch(e => { setRows([]); setError(e.message); });
  }, [cls, subject, term]);
  const set = (i, k, v) => setRows(rows.map((r, j) => i === j ? { ...r, [k]: v } : r));
  const save = async () => {
    setError(''); setMsg('');
    try {
      const r = await api('/marks', { method: 'POST', body: {
        term, subject, level: cls.level, records: rows.map(row => ({ student: row._id, ca: row.ca, exam: row.exam })),
      } });
      setMsg(`Saved ${r.saved}` + (r.skipped ? `, ${r.skipped} skipped (empty or out of range)` : ''));
    } catch (e) { setError(e.message); }
  };
  return <><h2>Enter Marks</h2>{error && <p className="operationFeedback operationError" role="alert">{error}</p>}
    {!classes.length && <p className="operationFeedback" role="status">No classes are assigned to this trainer yet. Ask the DOS for your track to assign your classes and courses.</p>}
    {cls && !subs.length && <p className="operationFeedback" role="status">No courses are assigned to you for {cls.level}. Ask the DOS to update your teaching assignments.</p>}
    <div className="row">
    <select aria-label="Class or trade" value={cls?.level || ''} onChange={e => setCls(classes.find(c => c.level === e.target.value) || null)}>{classes.map(c => <option key={c.level} value={c.level}>{c.level}</option>)}</select>
    <select value={subject} onChange={e => setSubject(e.target.value)}>{subs.map(s => <option key={s}>{s}</option>)}</select>
    <select value={term} onChange={e => setTerm(e.target.value)}>{TERMS.map(t => <option key={t}>{t}</option>)}</select>
    <button className="pri" disabled={!rows.length || !subject} onClick={save}>Save marks</button><span>{msg}</span></div>
    <div className="card tw"><table><thead><tr><th>Roll</th><th>Student · class / trade</th><th>CA (/40)</th><th>Exam (/60)</th><th>Total</th><th>{cls?.track === 'TVT' ? 'Competency' : 'Grade'}</th></tr></thead>
      <tbody>{rows.map((r, i) => { const ok = r.ca !== '' && r.exam !== '', t = ok ? +r.ca + +r.exam : null;
        return <tr key={r._id}><td>{r.rollNo}</td><td><StudentIdentity name={r.name} level={r.level} track={r.track} /></td>
          <td><input className="num" type="number" min="0" max="40" value={r.ca} onChange={e => set(i, 'ca', e.target.value)} /></td>
          <td><input className="num" type="number" min="0" max="60" value={r.exam} onChange={e => set(i, 'exam', e.target.value)} /></td>
          <td><b>{t ?? '—'}</b></td><td>{ok && <span className={'badge ' + (t >= 50 ? 'Good' : 'Critical')}>{grade(t, cls.track === 'TVT')}</span>}</td></tr>; })}</tbody></table></div></>;
}

export function Reports() {
  const [list, setList] = useState([]), [lvl, setLvl] = useState('All'), [id, setId] = useState(''), [term, setTerm] = useState('Term 1'), [r, setR] = useState(null);
  useEffect(() => { api('/students').then(l => { setList(l); setId(l[0]?._id); }); }, []);
  useEffect(() => { if (id) api(`/report/${id}?term=${encodeURIComponent(term)}`).then(setR); }, [id, term]);
  const levels = ['All', ...new Set(list.map(s => s.level))], shown = list.filter(s => lvl === 'All' || s.level === lvl);
  return <><h2 className="noprint">Report Cards</h2><div className="row noprint">
    <select value={lvl} onChange={e => { setLvl(e.target.value); const f = list.filter(s => e.target.value === 'All' || s.level === e.target.value); setId(f[0]?._id); }}>{levels.map(l => <option key={l}>{l}</option>)}</select>
    <select value={id} onChange={e => setId(e.target.value)}>{shown.map(s => <option key={s._id} value={s._id}>{s.name} ({s.level})</option>)}</select>
    <select value={term} onChange={e => setTerm(e.target.value)}>{TERMS.map(t => <option key={t}>{t}</option>)}</select>
    <button className="pri" onClick={() => window.print()}>🖨 Print / Save PDF</button></div>
    {r && <div className="report"><div className="rhead"><img src="/logo.png" /><div><h1>Groupe Scolaire APACOPE</h1><p>STUDENT REPORT CARD · {r.term}</p></div></div>
      <div className="rinfo"><div><span>Name · class / trade</span><StudentIdentity name={r.student.name} level={r.student.level} track={r.student.track} /></div><div><span>Admission No</span><b>{r.student.admissionNo}</b></div>
        <div><span>Class</span><b>{r.student.level}</b></div><div><span>Attendance</span><b>{r.attendance ?? '—'}%</b></div></div>
      <table><thead><tr><th>Subject / Module</th><th>CA /40</th><th>Exam /60</th><th>Total /100</th><th>{r.student.track === 'TVT' ? 'Competency' : 'Grade'}</th></tr></thead>
        <tbody>{r.rows.map(m => <tr key={m.subject}><td>{m.subject}</td><td>{m.ca}</td><td>{m.exam}</td><td><b>{m.total}</b></td><td>{m.grade}</td></tr>)}</tbody></table>
      <div className="rsum"><div><span>Average</span><b>{r.average ?? '—'}%</b></div><div><span>Position</span><b>{r.rank} / {r.of}</b></div></div>
      <p className="remark"><b>Remark:</b> {r.remark}</p>
      <div className="sign"><div>Class Teacher / Trainer</div><div>Director of Studies</div><div>Head Teacher</div><div>Parent</div></div></div>}</>;
}
