import { useEffect, useState } from 'react';
import { api } from './api.js';

const money = value => `RWF ${Number(value || 0).toLocaleString()}`;
const dateLabel = value => value ? new Date(value).toLocaleDateString() : '—';

export default function PersonalPortal({ user }) {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [attendance, setAttendance] = useState(null);
  const [finance, setFinance] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const parent = user.role === 'PARENT';

  useEffect(() => {
    let current = true;
    api('/students').then(list => {
      if (!current) return;
      setStudents(list);
      setStudentId(list[0]?._id || '');
    }).catch(e => { if (current) setError(e.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);
  useEffect(() => {
    if (!studentId) { setAttendance(null); setFinance(null); setNotifications([]); return; }
    let current = true;
    setError('');
    setAttendance(null);
    setFinance(null);
    const attendancePath = parent ? `/portal/attendance?studentId=${encodeURIComponent(studentId)}` : '/portal/attendance';
    const requests = [api(attendancePath), api('/portal/notifications')];
    if (parent) requests.push(api(`/portal/finance?studentId=${encodeURIComponent(studentId)}`));
    Promise.all(requests).then(([nextAttendance, nextNotifications, nextFinance]) => {
      if (current) {
        setAttendance(nextAttendance);
        setNotifications(nextNotifications.filter(notification => notification.student?._id === studentId));
        setFinance(nextFinance || null);
      }
    }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [studentId, parent]);
  const markRead = async notificationId => {
    setError('');
    try {
      await api(`/portal/notifications/${notificationId}/read`, { method: 'POST' });
      setNotifications(current => current.map(item => item._id === notificationId ? { ...item, readAt: new Date().toISOString() } : item));
    } catch (e) { setError(e.message); }
  };

  if (loading) return <section className="operationsPage"><div className="operationCard" role="status">Loading your learner records…</div></section>;
  return <section className="operationsPage">
    <header className="operationsHeading"><div><span className="sectionEyebrow">{parent ? 'PARENT & GUARDIAN PORTAL' : 'STUDENT PORTAL'}</span>
      <h1>{parent ? 'Your family’s school records' : 'Your school records'}</h1>
      <p>{parent ? 'Review each linked learner’s attendance, fee balance, and payment receipts.' : 'Review your attendance history and learning progress.'}</p></div>
      <span className="operationsMark">GSA <i>✳</i></span></header>
    {error && <p className="operationFeedback operationError" role="alert">{error}</p>}
    {!students.length ? <div className="operationCard"><b>Your learner profile is not linked yet.</b>
      <p>Please contact the school administrator to connect your account to a learner record.</p></div> : <>
      {parent && <div className="row"><label htmlFor="portal-learner">Learner</label>
        <select id="portal-learner" value={studentId} onChange={e => setStudentId(e.target.value)}>
          {students.map(student => <option key={student._id} value={student._id}>{student.name} · {student.level}</option>)}</select></div>}
      {attendance && <>
        <div className="operationsMetrics">
          <article><span>RECORDED DAYS</span><b>{attendance.records.length}</b><small>Most recent 180 school days</small></article>
          <article><span>PRESENT / LATE</span><b>{attendance.totals.present}</b><small>Days attending school</small></article>
          <article><span>ABSENCES</span><b>{attendance.totals.absent}</b><small>Recorded absent days</small></article>
          <article><span>EXCUSED</span><b>{attendance.totals.excused}</b><small>Excused from attendance calculation</small></article>
        </div>
        <section className="operationCard"><div className="operationTableHeading"><div><span className="sectionEyebrow">ATTENDANCE HISTORY</span><h2>{attendance.student.name} · {attendance.student.level}</h2></div></div>
          <div className="tw"><table><thead><tr><th>Date</th><th>Status</th></tr></thead>
            <tbody>{attendance.records.map(record => <tr key={record._id}><td>{record.date}</td><td>{record.status}</td></tr>)}</tbody></table>
            {!attendance.records.length && <p className="operationEmpty">No attendance has been recorded yet.</p>}</div></section>
      </>}
      {!!notifications.length && <section className="operationCard"><div className="operationTableHeading"><div><span className="sectionEyebrow">SCHOOL MESSAGES</span><h2>Attendance updates</h2></div></div>
        <div className="noticeList">{notifications.map(notification => <article className={'noticeCard' + (notification.readAt ? '' : ' unread')} key={notification._id}>
          <h3>{notification.title}</h3><p className="noticeMessage">{notification.message}</p>
          <div className="noticeMeta"><span>{dateLabel(notification.createdAt)}</span></div>
          {!notification.readAt && <button className="noticeReadButton" onClick={() => markRead(notification._id)}>Mark as read</button>}
        </article>)}</div>
      </section>}
      {parent && finance && <>
        <div className="operationsMetrics financeMetrics">
          <article><span>FEES INVOICED</span><b>{money(finance.summary.billed)}</b><small>Recorded learner charges</small></article>
          <article><span>PAID</span><b>{money(finance.summary.paid)}</b><small>Payments recorded by the school</small></article>
          <article><span>BALANCE DUE</span><b>{money(finance.summary.balance)}</b><small>Outstanding fees</small></article>
          <article><span>RECEIPTS</span><b>{finance.payments.length}</b><small>Recorded payments</small></article>
        </div>
        <section className="operationCard"><div className="operationTableHeading"><div><span className="sectionEyebrow">FEE ACCOUNT</span><h2>Invoices and balances</h2></div></div>
          <div className="tw"><table><thead><tr><th>Term</th><th>Description</th><th>Invoiced</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>{finance.invoices.map(invoice => {
              const balance = invoice.amount - invoice.paidAmount;
              return <tr key={invoice._id}><td>{invoice.term}</td><td>{invoice.description}</td><td>{money(invoice.amount)}</td>
                <td>{money(invoice.paidAmount)}</td><td><b>{money(balance)}</b></td><td>{balance ? invoice.paidAmount ? 'Part-paid' : 'Unpaid' : 'Paid'}</td></tr>;
            })}</tbody></table>{!finance.invoices.length && <p className="operationEmpty">No fee invoices are available for this learner.</p>}</div></section>
        <section className="operationCard"><div className="operationTableHeading"><div><span className="sectionEyebrow">PAYMENT RECEIPTS</span><h2>School payment history</h2></div></div>
          <div className="tw"><table><thead><tr><th>Receipt</th><th>Date</th><th>Fee</th><th>Amount</th><th>Method</th></tr></thead>
            <tbody>{finance.payments.map(payment => <tr key={payment._id}><td>{payment.receiptNo}</td><td>{dateLabel(payment.date)}</td>
              <td>{payment.invoice?.description || '—'} · {payment.invoice?.term || ''}</td><td>{money(payment.amount)}</td><td>{payment.method}</td></tr>)}</tbody></table>
            {!finance.payments.length && <p className="operationEmpty">No payment receipts have been recorded yet.</p>}</div></section>
      </>}
    </>}
  </section>;
}
