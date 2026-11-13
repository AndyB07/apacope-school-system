import { useState, useEffect } from 'react'; import { api } from './api.js'; import Landing from './Landing.jsx'; import { Marks, Reports } from './Marks.jsx';
import Notices from './Notices.jsx';
import StudentIdentity from './StudentIdentity.jsx';
import { AssetsPage, FinancePage } from './Operations.jsx';
import AdminPage from './Admin.jsx';
import PersonalPortal from './Portal.jsx';
import AccountSettings from './Settings.jsx';
import TrainerAssignments from './TrainerAssignments.jsx';
const today = () => new Date().toISOString().slice(0, 10);
const Badge = ({ s }) => <span className={'badge ' + s.split(' ')[0]}>{s}</span>;

function Login({ onLogin }) {
  const [email, setEmail] = useState(''), [password, setPw] = useState(''), [showPassword, setShowPassword] = useState(false), [err, setErr] = useState(''), [loading, setLoading] = useState(false);
  const go = async event => { event.preventDefault(); if (loading) return; setErr(''); setLoading(true); try { const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem('token', d.token); onLogin(d.user); } catch (e) { setErr(e.message); setLoading(false); } };
  return <div className="authLayout">
    <aside className="authStory">
      <div className="authBrand"><img src="/logo.png" alt="GSA APACOPE" /><span><b>GSA APACOPE</b><small>SCHOOL MANAGEMENT</small></span></div>
      <div className="authStoryCopy"><span className="eyebrow"><i /> YOUR SCHOOL, IN SYNC</span><h1>Welcome back<br />to your <em>community.</em></h1><p>Your school workspace brings learning, progress and people together.</p></div>
      <span className="authFootnote">A place for every learner. A clearer day for everyone.</span>
    </aside>
    <section className="authPanel">
      <div className="authFormHead"><span className="sectionEyebrow">YOUR GSA APACOPE ACCOUNT</span><h2>Sign in</h2><p>Enter your account details to continue to your workspace.</p></div>
      <form className="loginForm" onSubmit={go} aria-busy={loading}>
        <label htmlFor="login-email">Email address</label>
        <input id="login-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.org" required />
        <label htmlFor="login-password">Password</label>
        <div className="passwordField"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPw(e.target.value)} placeholder="Enter your password" required />
          <button type="button" className="passwordToggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button></div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className={`pri loginSubmit${loading ? ' is-loading' : ''}`} type="submit" disabled={loading}>
          {loading ? <><span className="loginSpinner" aria-hidden="true" /><span className="loginSubmitLabel">Signing you in…</span></> : <>Continue to workspace <span aria-hidden="true">→</span></>}
        </button>
        {loading && <p className="loginProgress" role="status">Verifying your details and preparing your workspace.</p>}
      </form>
      <p className="authSecure"><span aria-hidden="true">✳</span> Your account and school information stay protected.</p>
    </section>
  </div>;
}

const ROLE_INFO = {
  ADMIN: { label: 'Administrator', title: 'School overview', intro: 'Your school operations, attendance and learner support in one clear view.', focus: 'School-wide learner attendance' },
  HEAD: { label: 'Head teacher', title: 'Leadership overview', intro: 'A school-wide view of attendance, learner support and the school community.', focus: 'School-wide learner attendance' },
  DOS_REB: { label: 'Director of Studies · REB', title: 'REB track overview', intro: 'Attendance and learner progress across Nursery, Primary and Secondary.', focus: 'REB learner attendance' },
  DOS_TVET: { label: 'Director of Studies · TVET', title: 'TVET track overview', intro: 'Attendance and learner progress across the TVET software development levels.', focus: 'TVET learner attendance' },
  TRAINER: { label: 'Trainer', title: 'Teaching overview', intro: 'Keep your learners, daily attendance and progress moving forward.', focus: 'Learner attendance' },
  PARENT: { label: 'Parent portal', title: 'Your child’s school day', intro: 'A simple view of your child’s attendance and learning progress.', focus: 'Your child’s term results' },
  STUDENT: { label: 'Student portal', title: 'Your learning journey', intro: 'Check your attendance, class and subject progress in one place.', focus: 'Your subject progress' },
  LIBRARIAN: { label: 'Librarian', title: 'Library & asset register', intro: 'Keep books, school equipment and supplies organized, accounted for and in good condition.', focus: 'Library and school assets' },
  LIBRARY_STAFF: { label: 'Librarian / Storekeeper', title: 'Library & inventory', intro: 'Manage the school library, equipment and supplies in one shared workspace.', focus: 'Library and school assets' },
  STOREKEEPER: { label: 'Storekeeper', title: 'Inventory & asset register', intro: 'Track school stock, issues, returns, reorder needs and equipment maintenance.', focus: 'School inventory and assets' },
  ACCOUNTANT: { label: 'Accountant', title: 'Fees & finance', intro: 'Manage learner fee accounts, payments, receipts, balances and school expenditure.', focus: 'School finance' },
};

function RoleDashboard({ user, onNavigate }) {
  const [data, setData] = useState(null), [students, setStudents] = useState([]), [selectedStudentId, setSelectedStudentId] = useState(''), [report, setReport] = useState(null), [error, setError] = useState('');
  const info = ROLE_INFO[user.role] || ROLE_INFO.STUDENT;
  const personal = ['PARENT', 'STUDENT'].includes(user.role);
  useEffect(() => {
    let current = true;
    Promise.all([api('/dashboard?week=' + today()), api('/students')])
      .then(([dashboard, list]) => {
        if (current) {
          setData(dashboard);
          setStudents(list);
          setSelectedStudentId(currentId => currentId || list[0]?._id || '');
        }
      })
      .catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [personal]);
  useEffect(() => {
    if (!personal || !selectedStudentId) { setReport(null); return; }
    let current = true;
    setReport(null);
    api(`/report/${selectedStudentId}?term=Term 1`)
      .then(result => { if (current) setReport(result); })
      .catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [personal, selectedStudentId]);

  if (error) return <section className="roleDashboard"><div className="dashboardError" role="alert"><b>We couldn’t load your school overview.</b><p>{error}</p><button className="pri" onClick={() => window.location.reload()}>Try again</button></div></section>;
  if (!data) return <section className="roleDashboard"><div className="dashboardLoading" role="status">Preparing your school overview…</div></section>;

  const { kpi, summary } = data;
  const count = students.length;
  const selectedStudent = students.find(student => student._id === selectedStudentId);
  const classes = new Set(students.map(s => s.level)).size;
  const atRisk = summary.filter(s => s.status === 'Warning' || s.status === 'Critical').length;
  const percent = value => value === null || value === undefined ? '—' : `${value}%`;
  const firstName = user.name?.split(' ')[0] || 'there';
  const canTeach = ['ADMIN', 'TRAINER', 'DOS_REB', 'DOS_TVET'].includes(user.role);
  const metrics = personal
    ? [['Attendance', percent(report?.attendance), 'Overall attendance'], ['Term average', percent(report?.average), report?.term || 'Term 1 results'], ['Subjects', report?.rows?.length ?? '—', 'Results recorded'], ['Class', selectedStudent?.level || 'Not assigned', 'Current learning group']]
    : [
      ['Learners in scope', count, 'Enrolled learners'],
      ['Attendance today', percent(kpi.today), 'Present, late or excused'],
      ['Class groups', classes, user.role === 'DOS_TVET' ? 'TVET levels' : 'Active levels'],
      [user.role === 'TRAINER' ? 'Absent today' : 'Needs attention', user.role === 'TRAINER' ? kpi.absentToday : atRisk, user.role === 'TRAINER' ? 'Learners absent today' : 'Attendance below target'],
    ];
  const priorities = [...summary].filter(s => s.pct !== null).sort((a, b) => a.pct - b.pct).slice(0, 6);

  return <section className="roleDashboard">
    <header className="dashboardWelcome">
      <div><span className="dashboardEyebrow">{info.label} <i /> {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <h1>{info.title}<span>, {firstName}</span></h1><p>{info.intro}</p></div>
      <span className="dashboardWelcomeMark">GSA <i>✳</i></span>
    </header>
    {personal && selectedStudent && <div className="personalStudentIdentity"><span>LEARNER</span><StudentIdentity name={selectedStudent.name} level={selectedStudent.level} track={selectedStudent.track} /></div>}
    <div className="dashboardMetrics">{metrics.map(([title, value, detail], index) =>
      <article className="dashboardMetric" key={title}><span className="metricIndex">0{index + 1}</span><span className="metricTitle">{title}</span><b>{value}</b><small>{detail}</small></article>
    )}</div>
    {personal && !students.length && <div className="dashboardNotice"><b>Your learner profile isn’t linked yet.</b><span>Please contact the school administrator to connect your account to a learner record.</span></div>}
    <div className="dashboardColumns">
      <article className="dashboardPanel">
        <div className="dashboardPanelHeading"><div><span className="sectionEyebrow">{personal ? 'LEARNING PROGRESS' : 'ATTENDANCE & FOLLOW-UP'}</span><h2>{info.focus}</h2></div>
          {!personal && <button className="dashboardTextButton" onClick={() => onNavigate('mon')}>Review follow-ups <span aria-hidden="true">→</span></button>}
        </div>
        {personal
          ? report?.rows?.length
            ? <div className="subjectProgress">{report.rows.map(row => <div className="subjectRow" key={row.subject}><span>{row.subject}</span><div className="subjectBar"><i style={{ width: `${Math.max(0, Math.min(100, row.total))}%` }} /></div><b>{row.total}%</b><small>{row.grade}</small></div>)}</div>
            : <p className="dashboardEmpty">No term results are available yet.</p>
          : priorities.length
            ? <div className="attendanceList">{priorities.map(s => <div className="attendanceRow" key={s._id}><div className="studentInitial">{s.name.slice(0, 1)}</div><div className="attendanceStudent"><StudentIdentity name={s.name} level={s.level} /><small>{s.present} days present · {s.absent} absent</small></div><div className="attendanceBar"><i style={{ width: `${s.pct}%` }} /></div><b className="attendancePercent">{s.pct}%</b><Badge s={s.status} /></div>)}</div>
            : <p className="dashboardEmpty">Attendance summaries will appear here as records are taken.</p>}
      </article>
      <aside className="dashboardPanel dashboardActions"><span className="sectionEyebrow">QUICK ACCESS</span><h2>{personal ? 'Your school tools' : 'Make today count'}</h2><p>{personal ? 'Pick up where you left off.' : 'Jump straight into your everyday work.'}</p>
        {personal
          ? <><button onClick={() => onNavigate('notices')}>School notices <span>→</span></button><button onClick={() => onNavigate('rep')}>View report card <span>→</span></button><button onClick={() => onNavigate('learn')}>Open learning resources <span>→</span></button></>
          : <>{canTeach && <><button onClick={() => onNavigate('mark')}>Take class attendance <span>→</span></button><button onClick={() => onNavigate('marks')}>Enter learner marks <span>→</span></button></>}
            <button onClick={() => onNavigate(user.role === 'HEAD' ? 'mon' : 'learn')}>{user.role === 'HEAD' ? 'Review absence follow-ups' : 'Open learning resources'} <span>→</span></button>
            <button onClick={() => onNavigate('notices')}>School notices <span>→</span></button>
            {user.role === 'HEAD' && <button onClick={() => onNavigate('rep')}>View report cards <span>→</span></button>}</>}
      </aside>
    </div>
    {!personal && <div className="dashboardFooterNote"><span>✳</span> This view includes only learners and education tracks available to your account.</div>}
  </section>;
}

function Mark() {
  const [classes, setClasses] = useState([]), [level, setLevel] = useState(''), [date, setDate] = useState(today()), [rows, setRows] = useState([]), [msg, setMsg] = useState('');
  useEffect(() => { api('/classes').then(c => { setClasses(c); setLevel(c[0]?.level || ''); }); }, []);
  useEffect(() => { if (level) api(`/attendance/class?level=${encodeURIComponent(level)}&date=${date}`).then(setRows); }, [level, date]);
  const set = (i, status) => setRows(rows.map((r, j) => i === j ? { ...r, status } : r));
  const save = async () => { const r = await api('/attendance/bulk', { method: 'POST', body: { date, records: rows.map(r => ({ student: r._id, status: r.status })) } }); setMsg(`Saved ${r.saved}`); };
  return <><h2>Take Attendance</h2>{!classes.length && <p className="operationFeedback" role="status">No classes are available for your account yet. Ask the DOS for your track to assign classes and courses.</p>}<div className="row">
    <select aria-label="Class or trade" value={level} disabled={!classes.length} onChange={e => setLevel(e.target.value)}>{classes.map(c => <option key={c.level}>{c.level}</option>)}</select>
    <input type="date" value={date} onChange={e => setDate(e.target.value)} />
    <button disabled={!rows.length} onClick={() => setRows(rows.map(r => ({ ...r, status: 'Present' })))}>Mark all present</button>
    <button className="pri" disabled={!rows.length} onClick={save}>Save</button><span>{msg}</span></div>
    <div className="card tw"><table><thead><tr><th>Roll</th><th>Student · class / trade</th><th>Attendance</th></tr></thead><tbody>{rows.map((r, i) => <tr key={r._id}><td>{r.rollNo}</td><td><StudentIdentity name={r.name} level={r.level} track={r.track} /></td>
      <td>{['Present', 'Absent', 'Late', 'Excused'].map(s => <button key={s} className={r.status === s ? 'badge ' + s : ''} style={{ margin: 2, border: '1px solid #ccc', borderRadius: 99, padding: '3px 10px', cursor: 'pointer' }} onClick={() => set(i, s)}>{s}</button>)}</td></tr>)}</tbody></table></div></>;
}

function Monitoring() {
  const [rows, setRows] = useState([]), [log, setLog] = useState([]), [f, setF] = useState({ channel: 'Phone', outcome: '' });
  const load = () => { api('/monitoring').then(setRows); api('/followups').then(setLog); }; useEffect(load, []);
  const add = async id => { const outcome = prompt('Outcome / action agreed?'); if (!outcome) return;
    await api('/followups', { method: 'POST', body: { student: id, channel: f.channel, outcome } }); load(); };
  return <><h2>Absence Monitoring</h2>
    <div className="row">Contact channel: <select value={f.channel} onChange={e => setF({ ...f, channel: e.target.value })}>{['Phone', 'SMS', 'Email', 'In person'].map(c => <option key={c}>{c}</option>)}</select></div>
    <div className="card tw"><table><thead><tr><th>Student · class / trade</th><th>Absences this month</th><th>Status</th><th>Recommended action</th><th></th></tr></thead>
      <tbody>{rows.map(r => <tr key={r._id}><td><StudentIdentity name={r.name} level={r.level} track={r.track} /></td><td>{r.absences}</td><td><Badge s={r.status} /></td><td>{r.action}</td>
        <td>{r.status !== 'Normal' && <button onClick={() => add(r._id)}>Log follow-up</button>}</td></tr>)}</tbody></table></div>
    <div className="card tw"><b>Follow-up register</b><table><thead><tr><th>When</th><th>Student</th><th>By</th><th>Channel</th><th>Outcome</th></tr></thead>
      <tbody>{log.map(l => <tr key={l._id}><td>{new Date(l.at).toLocaleDateString()}</td><td><StudentIdentity name={l.student?.name} level={l.student?.level} track={l.student?.track} /></td><td>{l.contactedBy}</td><td>{l.channel}</td><td>{l.outcome}</td></tr>)}</tbody></table></div></>;
}

function Learn({ user }) {
  const [items, setItems] = useState([]), [classes, setClasses] = useState([]), [q, setQ] = useState('');
  const [n, setN] = useState({ type: 'Video', title: '', url: '', level: '', module: '', description: '', outcome: '' });
  const [error, setError] = useState(''), [status, setStatus] = useState('');
  const canPost = ['ADMIN', 'HEAD', 'DOS_REB', 'DOS_TVET', 'TRAINER'].includes(user.role);
  useEffect(() => {
    let current = true;
    api('/materials?q=' + encodeURIComponent(q)).then(result => { if (current) setItems(result); })
      .catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [q]);
  useEffect(() => {
    if (canPost) api('/classes').then(result => {
      setClasses(result);
      if (user.role === 'TRAINER') setN(current => ({ ...current, level: result[0]?.level || '' }));
    }).catch(e => setError(e.message));
  }, [canPost, user.role]);
  const post = async event => {
    event.preventDefault(); setError(''); setStatus('');
    try {
      await api('/materials', { method: 'POST', body: n });
      setN(current => ({ ...current, title: '', url: '', description: '', outcome: '' }));
      setStatus('Learning resource published to the selected audience.');
      setItems(await api('/materials?q=' + encodeURIComponent(q)));
    } catch (e) { setError(e.message); }
  };
  return <section className="operationsPage">
    <header className="operationsHeading"><div><span className="sectionEyebrow">LEARNING &amp; ENGAGEMENT</span>
      <h1>E-learning resources</h1><p>Find class resources by title, module, outcome, or description.</p></div>
      <span className="operationsMark">GSA <i>✳</i></span></header>
    {error && <p className="operationFeedback operationError" role="alert">{error}</p>}
    {status && <p className="operationFeedback" role="status">{status}</p>}
    <div className="row"><input aria-label="Search learning resources" placeholder="Search resources…" value={q} onChange={e => setQ(e.target.value)} /></div>
    {canPost && <section className="operationCard"><div className="operationCardHeading"><span className="sectionEyebrow">TRAINER TOOLS</span>
      <h2>Publish a learning resource</h2><p>Share a hosted video or downloadable document link with the whole school or one class.</p></div>
      <form className="operationForm" onSubmit={post}>
        <div className="operationFormPair"><label>Resource type<select value={n.type} onChange={e => setN({ ...n, type: e.target.value })}>
          {['Video', 'Handout', 'Media'].map(type => <option key={type}>{type}</option>)}</select></label>
          <label>Class / trade<select required={user.role === 'TRAINER'} value={n.level} onChange={e => setN({ ...n, level: e.target.value, module: '' })}>
            {user.role !== 'TRAINER' && <option value="">Whole school</option>}{classes.map(item => <option key={item.level} value={item.level}>{item.level} · {item.track}</option>)}</select></label></div>
        <div className="operationFormPair"><label>Title<input required maxLength="120" value={n.title} onChange={e => setN({ ...n, title: e.target.value })} /></label>
          <label>Hosted resource URL<input required type="url" maxLength="2048" placeholder="https://…" value={n.url} onChange={e => setN({ ...n, url: e.target.value })} /></label></div>
        <div className="operationFormPair"><label>{user.role === 'TRAINER' ? 'Assigned course' : 'Module / topic'}
          {user.role === 'TRAINER'
            ? <select required value={n.module} onChange={e => setN({ ...n, module: e.target.value })}>
              <option value="">Choose a course</option>{(classes.find(item => item.level === n.level)?.courses || []).map(course =>
                <option key={course}>{course}</option>)}</select>
            : <input maxLength="120" value={n.module} onChange={e => setN({ ...n, module: e.target.value })} />}</label>
          <label>Learning outcome<input maxLength="120" value={n.outcome} onChange={e => setN({ ...n, outcome: e.target.value })} /></label></div>
        <label>Description / instructions<textarea maxLength="2000" rows="3" value={n.description} onChange={e => setN({ ...n, description: e.target.value })} /></label>
        {user.role === 'TRAINER' && !classes.length && <p className="operationFeedback operationError">Ask the administrator to assign your teaching classes before publishing resources.</p>}
        <button className="pri" type="submit" disabled={user.role === 'TRAINER' && !classes.length}>Publish resource</button>
      </form>
    </section>}
    <div className="cards">{items.map(material => <article className="card" key={material._id}>
      <span className="sectionEyebrow">{material.type}{material.level ? ` · ${material.level}` : ' · Whole school'}</span>
      <h2>{material.title}</h2>{material.module && <b>{material.module}</b>}
      {material.outcome && <p>Learning outcome: {material.outcome}</p>}
      {material.description && <p>{material.description}</p>}
      <small>Shared by {material.postedBy || 'School staff'}</small><p><a href={material.url} target="_blank" rel="noreferrer">Open resource ↗</a></p>
    </article>)}</div>
    {!items.length && <div className="operationCard operationEmpty">No learning resources match your search.</div>}
  </section>;
}

const roleHome = role => role === 'ACCOUNTANT' ? 'finance'
  : ['LIBRARIAN', 'STOREKEEPER', 'LIBRARY_STAFF'].includes(role) ? 'assets' : 'dash';

export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } });
  const [tab, setTab] = useState(() => { try { return roleHome(JSON.parse(localStorage.getItem('user'))?.role); } catch { return 'dash'; } });
  const [view, setView] = useState('landing');
  useEffect(() => {
    const requirePasswordChange = () => setUser(current => {
      if (!current) return current;
      const updated = { ...current, mustChangePassword: true };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
    window.addEventListener('auth:password-change-required', requirePasswordChange);
    return () => window.removeEventListener('auth:password-change-required', requirePasswordChange);
  }, []);
  const login = u => { localStorage.setItem('user', JSON.stringify(u)); setUser(u); setTab(roleHome(u.role)); };
  if (!user) return view === 'login' ? <div className="authbg"><button className="backlink" onClick={() => setView('landing')}><span aria-hidden="true">←</span> Back to home</button><Login onLogin={login} /></div> : <Landing onLogin={() => setView('login')} />;
  if (user.mustChangePassword) return <div className="authbg"><AccountSettings onPasswordChanged={() => {
    const updatedUser = { ...user, mustChangePassword: false };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }} /></div>;
  const canTeach = ['ADMIN', 'TRAINER', 'DOS_REB', 'DOS_TVET'].includes(user.role);
  const canViewReports = ['ADMIN', 'HEAD', 'DOS_REB', 'DOS_TVET', 'TRAINER', 'PARENT', 'STUDENT'].includes(user.role);
  const canMonitor = ['ADMIN', 'HEAD', 'DOS_REB', 'DOS_TVET', 'TRAINER'].includes(user.role);
  const canManageAssets = ['ADMIN', 'LIBRARIAN', 'STOREKEEPER', 'LIBRARY_STAFF'].includes(user.role);
  const canManageFinance = ['ADMIN', 'ACCOUNTANT'].includes(user.role);
  const tabs = [
    ...(user.role === 'ADMIN' ? [['admin', 'Accounts & learners']] : []),
    ...(['DOS_REB', 'DOS_TVET'].includes(user.role) ? [['assignments', 'Trainer assignments']] : []),
    ...(!canManageAssets && !canManageFinance ? [['dash', 'Overview']] : []),
    ...(['PARENT', 'STUDENT'].includes(user.role) ? [['portal', user.role === 'PARENT' ? 'Family portal' : 'My attendance']] : []),
    ...(canTeach ? [['mark', 'Take attendance'], ['marks', 'Enter marks']] : []),
    ...(canViewReports ? [['rep', 'Report cards']] : []),
    ...(canMonitor ? [['mon', 'Absence follow-up']] : []),
    ...(canManageAssets ? [['assets', 'Library & inventory']] : []),
    ...(canManageFinance ? [['finance', 'Fees & finance']] : []),
    ['notices', 'Notices & calendar'],
    ['learn', 'E-learning'],
    ['settings', 'Account settings'],
  ];
  return <div className="app"><aside className="side">
    <div className="sideIdentity"><img src="/logo.png" alt="GSA APACOPE" /><div><b>{user.name}</b><small>{ROLE_INFO[user.role]?.label || user.role}</small></div></div><hr />
    <span className="sideSectionLabel">YOUR WORKSPACE</span>
    {tabs.map(([key, label]) => <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}><span className="sideNavMark">{key === tab ? '●' : '○'}</span>{label}</button>)}
    <button className="sideLogout" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); setView('landing'); setTab('dash'); }}><span className="sideNavMark">↗</span>Sign out</button>
    <div className="sideFooter"><span>GSA APACOPE</span><small>Learning together, moving forward.</small></div>
  </aside>
    <main className="main">{tab === 'dash' && <RoleDashboard user={user} onNavigate={setTab} />}{tab === 'admin' && user.role === 'ADMIN' && <AdminPage />}{tab === 'assignments' && ['DOS_REB', 'DOS_TVET'].includes(user.role) && <TrainerAssignments user={user} />}{tab === 'portal' && ['PARENT', 'STUDENT'].includes(user.role) && <PersonalPortal user={user} />}{tab === 'settings' && <AccountSettings />}{tab === 'mark' && <Mark />}{tab === 'mon' && <Monitoring />}{tab === 'notices' && <Notices user={user} />}{tab === 'learn' && <Learn user={user} />}{tab === 'marks' && <Marks />}{tab === 'rep' && <Reports />}{tab === 'assets' && canManageAssets && <AssetsPage />}{tab === 'finance' && canManageFinance && <FinancePage />}</main></div>;
}
