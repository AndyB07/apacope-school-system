import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const today = () => new Date().toISOString().slice(0, 10);
const money = value => `RWF ${Number(value || 0).toLocaleString()}`;
const dateLabel = value => value ? new Date(value).toLocaleDateString() : '—';

function Feedback({ error, status }) {
  return <>{error && <p className="operationFeedback operationError" role="alert">{error}</p>}
    {status && <p className="operationFeedback" role="status">{status}</p>}</>;
}

export function AssetsPage() {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [itemForm, setItemForm] = useState({ name: '', category: '', quantity: '0', unit: 'piece', reorderLevel: '0', location: '' });
  const [moveForm, setMoveForm] = useState({ itemId: '', action: 'Issued', quantity: '1', borrower: '', issueId: '', note: '' });

  const load = async () => {
    const [nextItems, nextMovements] = await Promise.all([
      api('/assets/items?q=' + encodeURIComponent(query)),
      api('/assets/movements'),
    ]);
    setItems(nextItems);
    setMovements(nextMovements);
    setMoveForm(current => ({
      ...current,
      itemId: nextItems.some(item => item._id === current.itemId) ? current.itemId : nextItems[0]?._id || '',
    }));
  };
  useEffect(() => { load().catch(e => setError(e.message)); }, [query]);

  const outstandingIssues = useMemo(() => movements.filter(movement =>
    movement.action === 'Issued' && movement.quantity > (movement.returnedQuantity || 0)), [movements]);
  const lowStock = items.filter(item => item.available <= item.reorderLevel).length;
  const activeLoans = outstandingIssues.reduce((sum, movement) => sum + movement.quantity - (movement.returnedQuantity || 0), 0);

  const addItem = async event => {
    event.preventDefault();
    setError(''); setStatus(''); setBusy(true);
    try {
      await api('/assets/items', { method: 'POST', body: itemForm });
      setItemForm({ name: '', category: '', quantity: '0', unit: 'piece', reorderLevel: '0', location: '' });
      setStatus('Item added to the register.');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const recordMovement = async event => {
    event.preventDefault();
    setError(''); setStatus(''); setBusy(true);
    try {
      await api('/assets/movements', { method: 'POST', body: moveForm });
      setMoveForm(current => ({ ...current, quantity: '1', borrower: '', issueId: '', note: '' }));
      setStatus('Asset activity recorded and stock updated.');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const setMove = (key, value) => setMoveForm(current => ({ ...current, [key]: value }));
  const patchMove = values => setMoveForm(current => ({ ...current, ...values }));
  const selectedItem = items.find(item => item._id === moveForm.itemId);
  const actionNeedsStock = ['Issued', 'Damaged', 'Sent for maintenance'].includes(moveForm.action);
  const itemIssues = outstandingIssues.filter(movement => movement.item?._id === moveForm.itemId);
  const selectedIssue = itemIssues.find(movement => movement._id === moveForm.issueId);
  const maxMovementQuantity = actionNeedsStock ? selectedItem?.available
    : moveForm.action === 'Returned' && selectedIssue
      ? selectedIssue.quantity - (selectedIssue.returnedQuantity || 0) : undefined;

  return <section className="operationsPage">
    <header className="operationsHeading"><div><span className="sectionEyebrow">LIBRARY & SCHOOL PROPERTY</span>
      <h1>Library &amp; inventory</h1>
      <p>Keep a reliable record of textbooks, equipment and supplies, including issue, return, damage and maintenance.</p></div>
      <span className="operationsMark">GSA <i>✳</i></span></header>
    <Feedback error={error} status={status} />
    <div className="operationsMetrics">
      <article><span>REGISTERED ITEMS</span><b>{items.length}</b><small>Books, equipment and supplies</small></article>
      <article><span>AVAILABLE STOCK</span><b>{items.reduce((sum, item) => sum + item.available, 0)}</b><small>Ready to be issued</small></article>
      <article><span>ON LOAN</span><b>{activeLoans}</b><small>Items not yet returned</small></article>
      <article><span>REORDER ALERTS</span><b>{lowStock}</b><small>At or below reorder level</small></article>
    </div>
    <div className="operationsGrid">
      <section className="operationCard"><div className="operationCardHeading"><span className="sectionEyebrow">ASSET REGISTER</span><h2>Register a new item</h2>
        <p>Add a textbook, computer, projector, lab tool or supply.</p></div>
        <form className="operationForm" onSubmit={addItem}>
          <label>Item name<input required maxLength="120" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Mathematics textbook" /></label>
          <label>Category<input required maxLength="80" value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })} placeholder="Books, IT equipment, lab tools…" /></label>
          <div className="operationFormPair">
            <label>Quantity<input type="number" min="0" step="1" required value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: e.target.value })} /></label>
            <label>Unit<input required maxLength="30" value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} placeholder="piece, box…" /></label>
          </div>
          <div className="operationFormPair">
            <label>Reorder alert at<input type="number" min="0" step="1" required value={itemForm.reorderLevel} onChange={e => setItemForm({ ...itemForm, reorderLevel: e.target.value })} /></label>
            <label>Storage location<input maxLength="80" value={itemForm.location} onChange={e => setItemForm({ ...itemForm, location: e.target.value })} placeholder="Library shelf A2" /></label>
          </div>
          <button className="pri" disabled={busy}>{busy ? 'Saving…' : 'Add to register'}</button>
        </form>
      </section>
      <section className="operationCard"><div className="operationCardHeading"><span className="sectionEyebrow">MOVEMENT & CONDITION</span><h2>Record an activity</h2>
        <p>Issue stock, log returns or record damage and repairs.</p></div>
        <form className="operationForm" onSubmit={recordMovement}>
          <label>Item<select required value={moveForm.itemId} onChange={e => patchMove({ itemId: e.target.value, issueId: '' })}>
            {items.map(item => <option key={item._id} value={item._id}>{item.name} · {item.available} available</option>)}</select></label>
          <label>Activity<select value={moveForm.action} onChange={e => patchMove({ action: e.target.value, issueId: '' })}>
            {['Issued', 'Returned', 'Stock in', 'Damaged', 'Sent for maintenance', 'Returned from maintenance', 'Repaired'].map(action => <option key={action}>{action}</option>)}</select></label>
          {moveForm.action === 'Returned' && <label>Issue record<select required value={moveForm.issueId} onChange={e => setMove('issueId', e.target.value)}>
            <option value="">Choose the borrower / issue</option>{itemIssues.map(issue => <option key={issue._id} value={issue._id}>{issue.borrower} · {issue.quantity - (issue.returnedQuantity || 0)} still out · {dateLabel(issue.date)}</option>)}</select></label>}
          <div className="operationFormPair">
            <label>Quantity<input type="number" min="1" step="1" required max={maxMovementQuantity}
              value={moveForm.quantity} onChange={e => setMove('quantity', e.target.value)} /></label>
            {moveForm.action === 'Issued' && <label>Issued to<input required maxLength="120" value={moveForm.borrower} onChange={e => setMove('borrower', e.target.value)} placeholder="Learner or staff name" /></label>}
          </div>
          <label>Note<input maxLength="240" value={moveForm.note} onChange={e => setMove('note', e.target.value)} placeholder="Condition, reason or reference" /></label>
          <button className="pri" disabled={busy || !items.length}>{busy ? 'Saving…' : 'Record activity'}</button>
        </form>
      </section>
    </div>
    <section className="operationCard">
      <div className="operationTableHeading"><div><span className="sectionEyebrow">CURRENT STOCK</span><h2>Items and condition</h2></div>
        <input aria-label="Search asset register" placeholder="Search items…" value={query} onChange={e => setQuery(e.target.value)} /></div>
      <div className="tw"><table><thead><tr><th>Item</th><th>Category</th><th>Location</th><th>Total</th><th>Available</th><th>On loan</th><th>Damaged</th><th>Maintenance</th><th>Stock status</th></tr></thead>
        <tbody>{items.map(item => {
          const onLoan = item.quantity - item.available - item.damaged - item.inMaintenance;
          const low = item.available <= item.reorderLevel;
          return <tr key={item._id}><td><b>{item.name}</b></td><td>{item.category}</td><td>{item.location || '—'}</td><td>{item.quantity} {item.unit}</td>
            <td>{item.available}</td><td>{Math.max(0, onLoan)}</td><td>{item.damaged}</td><td>{item.inMaintenance}</td>
            <td><span className={'operationStatus ' + (low ? 'low' : 'ready')}>{low ? 'Reorder needed' : 'In stock'}</span></td></tr>;
        })}</tbody></table>
        {!items.length && <p className="operationEmpty">No items registered yet. Add the school’s first item above.</p>}</div>
    </section>
    <section className="operationCard"><div className="operationCardHeading"><span className="sectionEyebrow">AUDIT TRAIL</span><h2>Recent asset activity</h2>
      <p>Every stock movement is recorded with its date and staff member.</p></div>
      <div className="tw"><table><thead><tr><th>Date</th><th>Item</th><th>Activity</th><th>Quantity</th><th>Borrower</th><th>Recorded by</th><th>Note</th></tr></thead>
        <tbody>{movements.map(movement => <tr key={movement._id}><td>{dateLabel(movement.date)}</td><td>{movement.item?.name || 'Item removed'}</td>
          <td>{movement.action}{movement.action === 'Issued' ? ` (${movement.returnedQuantity || 0} returned)` : ''}</td>
          <td>{movement.quantity} {movement.item?.unit || ''}</td><td>{movement.borrower || movement.issue?.borrower || '—'}</td>
          <td>{movement.recordedBy || '—'}</td><td>{movement.note || '—'}</td></tr>)}</tbody></table>
        {!movements.length && <p className="operationEmpty">Asset issues, returns and maintenance records will appear here.</p>}</div>
    </section>
  </section>;
}

export function FinancePage() {
  const [data, setData] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ studentId: '', term: 'Term 1', description: 'School fees', amount: '' });
  const [paymentForm, setPaymentForm] = useState({ invoiceId: '', amount: '', method: 'Cash', reference: '' });
  const [expenseForm, setExpenseForm] = useState({ category: '', description: '', amount: '', reference: '', date: today() });

  const load = async () => {
    const [finance, learnerList] = await Promise.all([api('/finance'), api('/finance/students')]);
    setData(finance);
    setStudents(learnerList);
    setInvoiceForm(current => ({ ...current, studentId: current.studentId || learnerList[0]?._id || '' }));
    const outstanding = finance.invoices.find(invoice => invoice.amount > invoice.paidAmount);
    setPaymentForm(current => ({
      ...current,
      invoiceId: finance.invoices.some(invoice => invoice._id === current.invoiceId && invoice.amount > invoice.paidAmount)
        ? current.invoiceId : outstanding?._id || '',
    }));
  };
  useEffect(() => { load().catch(e => setError(e.message)); }, []);

  const outstandingInvoices = data?.invoices.filter(invoice => invoice.amount > invoice.paidAmount) || [];
  const selectedInvoice = outstandingInvoices.find(invoice => invoice._id === paymentForm.invoiceId);
  const submit = async (event, path, body, success, clear) => {
    event.preventDefault(); setError(''); setStatus(''); setBusy(true);
    try {
      const result = await api(path, { method: 'POST', body });
      if (path === '/finance/payments') setStatus(`Payment recorded. Receipt ${result.receiptNo}.`);
      else setStatus(success);
      clear?.();
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return <section className="operationsPage">
    <header className="operationsHeading"><div><span className="sectionEyebrow">AUTHORIZED FINANCE WORKSPACE</span>
      <h1>Fees &amp; finance</h1><p>Manage learner fee accounts, invoices, payments, receipts, balances and school expenditure.</p></div>
      <span className="operationsMark">GSA <i>✳</i></span></header>
    <Feedback error={error} status={status} />
    {!data ? <div className="operationCard" role="status">Loading finance records…</div> : <>
      <div className="operationsMetrics financeMetrics">
        <article><span>FEES INVOICED</span><b>{money(data.summary.billed)}</b><small>Across recorded fee accounts</small></article>
        <article><span>PAYMENTS RECEIVED</span><b>{money(data.summary.collected)}</b><small>Receipts issued</small></article>
        <article><span>OUTSTANDING BALANCE</span><b>{money(data.summary.balance)}</b><small>Unpaid learner fees</small></article>
        <article><span>RECORDED EXPENDITURE</span><b>{money(data.summary.expenses)}</b><small>Expenses entered</small></article>
      </div>
      <div className="operationsGrid financeForms">
        <section className="operationCard"><div className="operationCardHeading"><span className="sectionEyebrow">FEE ACCOUNTS</span><h2>Create an invoice</h2>
          <p>Assign a fee or charge to a learner. Payments reduce the invoice balance.</p></div>
          <form className="operationForm" onSubmit={event => submit(event, '/finance/invoices', invoiceForm, 'Invoice created.', () => setInvoiceForm(current => ({ ...current, description: '', amount: '' })))}>
            <label>Learner<select required value={invoiceForm.studentId} onChange={e => setInvoiceForm({ ...invoiceForm, studentId: e.target.value })}>
              <option value="">Select a learner</option>{students.map(student => <option key={student._id} value={student._id}>{student.name} · {student.level} · {student.admissionNo}</option>)}</select></label>
            <label>Term or period<input required maxLength="40" value={invoiceForm.term} onChange={e => setInvoiceForm({ ...invoiceForm, term: e.target.value })} placeholder="Term 1 / 2026" /></label>
            <label>Fee description<input required maxLength="120" value={invoiceForm.description} onChange={e => setInvoiceForm({ ...invoiceForm, description: e.target.value })} placeholder="School fees, transport…" /></label>
            <label>Amount (RWF)<input type="number" min="1" step="1" required value={invoiceForm.amount} onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} /></label>
            <button className="pri" disabled={busy || !students.length}>{busy ? 'Saving…' : 'Create invoice'}</button>
          </form>
        </section>
        <section className="operationCard"><div className="operationCardHeading"><span className="sectionEyebrow">PAYMENT &amp; RECEIPT</span><h2>Record a payment</h2>
          <p>Record full or partial payment; the system creates a receipt number.</p></div>
          <form className="operationForm" onSubmit={event => submit(event, '/finance/payments', paymentForm, '', () => setPaymentForm(current => ({ ...current, amount: '', reference: '' })))}>
            <label>Outstanding invoice<select required value={paymentForm.invoiceId} onChange={e => setPaymentForm({ ...paymentForm, invoiceId: e.target.value, amount: '' })}>
              <option value="">Select an invoice</option>{outstandingInvoices.map(invoice => <option key={invoice._id} value={invoice._id}>
                {invoice.student?.name || 'Learner'} · {invoice.description} · balance {money(invoice.amount - invoice.paidAmount)}</option>)}</select></label>
            {selectedInvoice && <p className="financeBalanceHint">Balance due: <b>{money(selectedInvoice.amount - selectedInvoice.paidAmount)}</b></p>}
            <label>Payment amount (RWF)<input type="number" min="1" step="1" max={selectedInvoice ? selectedInvoice.amount - selectedInvoice.paidAmount : undefined}
              required value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></label>
            <label>Payment method<select value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}>
              {['Cash', 'Bank transfer', 'Mobile money'].map(method => <option key={method}>{method}</option>)}</select></label>
            <label>Payment reference<input maxLength="80" value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} placeholder="Optional transaction reference" /></label>
            <button className="pri" disabled={busy || !outstandingInvoices.length}>{busy ? 'Saving…' : 'Record payment & issue receipt'}</button>
          </form>
        </section>
        <section className="operationCard"><div className="operationCardHeading"><span className="sectionEyebrow">SCHOOL SPENDING</span><h2>Record expenditure</h2>
          <p>Keep school purchases and other expenses in the financial register.</p></div>
          <form className="operationForm" onSubmit={event => submit(event, '/finance/expenses', expenseForm, 'Expense added to the register.', () => setExpenseForm({ category: '', description: '', amount: '', reference: '', date: today() }))}>
            <label>Expense category<input required maxLength="80" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} placeholder="Learning materials, utilities…" /></label>
            <label>Description<input required maxLength="240" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="What was purchased or paid?" /></label>
            <div className="operationFormPair"><label>Amount (RWF)<input type="number" min="1" step="1" required value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></label>
              <label>Date<input type="date" required value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} /></label></div>
            <label>Reference<input maxLength="80" value={expenseForm.reference} onChange={e => setExpenseForm({ ...expenseForm, reference: e.target.value })} placeholder="Receipt or supplier reference" /></label>
            <button className="pri" disabled={busy}>{busy ? 'Saving…' : 'Record expenditure'}</button>
          </form>
        </section>
      </div>
      <section className="operationCard"><div className="operationTableHeading"><div><span className="sectionEyebrow">LEARNER ACCOUNTS</span><h2>Invoices and balances</h2></div>
        <button className="operationPrint noprint" onClick={() => window.print()}>Print / Save report</button></div>
        <div className="tw"><table><thead><tr><th>Learner</th><th>Admission no.</th><th>Term</th><th>Fee</th><th>Invoiced</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
          <tbody>{data.invoices.map(invoice => { const balance = invoice.amount - invoice.paidAmount; const label = balance === 0 ? 'Paid' : invoice.paidAmount ? 'Part-paid' : 'Unpaid';
            return <tr key={invoice._id}><td><b>{invoice.student?.name || 'Learner unavailable'}</b><small className="tableSubline">{invoice.student?.level}</small></td>
              <td>{invoice.student?.admissionNo || '—'}</td><td>{invoice.term}</td><td>{invoice.description}</td><td>{money(invoice.amount)}</td><td>{money(invoice.paidAmount)}</td><td><b>{money(balance)}</b></td>
              <td><span className={'operationStatus ' + (balance ? 'low' : 'ready')}>{label}</span></td></tr>;
          })}</tbody></table>{!data.invoices.length && <p className="operationEmpty">No fee invoices have been created yet.</p>}</div>
      </section>
      <section className="operationCard"><div className="operationCardHeading"><span className="sectionEyebrow">PAYMENT REGISTER</span><h2>Receipts issued</h2>
        <p>Each recorded payment is retained with its receipt number and payment method.</p></div>
        <div className="tw"><table><thead><tr><th>Receipt no.</th><th>Date</th><th>Learner</th><th>Fee / term</th><th>Amount</th><th>Method</th><th>Reference</th><th>Received by</th></tr></thead>
          <tbody>{data.payments.map(payment => <tr key={payment._id}><td><b>{payment.receiptNo}</b></td><td>{dateLabel(payment.date)}</td>
            <td>{payment.invoice?.student?.name || 'Learner unavailable'}</td><td>{payment.invoice?.description || '—'} · {payment.invoice?.term || ''}</td>
            <td>{money(payment.amount)}</td><td>{payment.method}</td><td>{payment.reference || '—'}</td><td>{payment.receivedBy || '—'}</td></tr>)}</tbody></table>
          {!data.payments.length && <p className="operationEmpty">Payments and receipts will appear here as they are recorded.</p>}</div>
      </section>
      <section className="operationCard"><div className="operationCardHeading"><span className="sectionEyebrow">FINANCIAL REPORT</span><h2>Expenditure register</h2></div>
        <div className="tw"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Reference</th><th>Recorded by</th></tr></thead>
          <tbody>{data.expenses.map(expense => <tr key={expense._id}><td>{dateLabel(expense.date)}</td><td>{expense.category}</td><td>{expense.description}</td>
            <td>{money(expense.amount)}</td><td>{expense.reference || '—'}</td><td>{expense.recordedBy || '—'}</td></tr>)}</tbody></table>
          {!data.expenses.length && <p className="operationEmpty">School expenditure will appear here as it is recorded.</p>}</div>
      </section>
    </>}
  </section>;
}
