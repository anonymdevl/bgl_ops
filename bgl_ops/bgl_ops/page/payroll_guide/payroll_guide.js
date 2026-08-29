frappe.pages['payroll-guide'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper, title: 'BGL Payroll Guide', single_column: true
	});
	var G = [
	{ lane: 'What changed', tag: 'read this first if you used the old sheet', items: [
		['Five things now work differently',
		'<ol>' +
		'<li><b>Advances start at zero.</b> The tab still lists everyone who took one last month, but every box begins at <b>0</b>. An advance is a one-off, not a standing deduction. Type an amount only for people who took one THIS month. The Last month column is a memory jogger, nothing more.</li>' +
		'<li><b>Two tabs must be signed off</b> before payroll will run: Basic Salaries, and Allowances &amp; OT. Press <b>Mark reviewed</b> on each. If nothing needed changing that is a perfectly good answer, but somebody has to say so.</li>' +
		'<li><b>Pro-Ration covers everyone</b> - joiners at the top, existing staff who worked part of the month below the divider on the same tab.</li>' +
		'<li><b>People who have left are gone</b> from the carry-forward lists. Anything the sheet refuses to save is listed by name under "Left out on purpose".</li>' +
		'<li><b>Approve every draft in one press</b> if you want to, or keep going group by group. Both end in the same place.</li>' +
		'</ol>']
	]},
	{ lane: 'How payroll works here', tag: 'read this once', items: [
		['Three lanes, three moves each',
		'Payroll is not one long list - it is <b>three lanes, one per role, and each lane is three moves</b>:<ol>' +
		'<li><b>People &amp; Leave</b> (all month): keep employee records current, enter and approve leave, handle encashments.</li>' +
		'<li><b>Trips &amp; Cubic</b> (daily): enter the day\'s quantities; at month end lock both sites and generate the earnings.</li>' +
		'<li><b>Payroll Numbers</b> (month end, in order): Prep Sheet, then Review &amp; Approve, then Payroll Entry.</li></ol>' +
		'You only need to learn <b>your own lane</b>. The five stones on the BGL Operations cockpit are these moves laid end to end - green means done, the glowing one is next, and Payroll Entry stays blocked until everything before it is green. Management watches the Command Center and enters nothing.']
	]},
	{ lane: 'People & Leave', tag: 'all month, as things happen', items: [
		['Keep employee records current',
		'Every new hire gets an Employee record the day they start - the <b>joining date drives their prorated first salary</b>, so it must be right. Add their vehicle if they drive one. Departures: <b>set the relieving date and status the day they leave</b>. This matters more than it used to - the Prep Sheet now hides anyone inactive from the carry-forward lists, so a leaver marked promptly can never be paid by accident.'],
		['Leave and encashment',
		'Every employee gets <b>18 working days</b> of Annual Leave a year - weekends never count, ' +
		'so Thursday to Monday costs 3 days, not 5. Casual (3) and Sick (5) work the same way.<ol>' +
		'<li><b>Applying:</b> HR raises a Leave Application on the employee\'s behalf, sets the approver, ' +
		'approves and submits. Attendance marks itself On Leave for the working days and the balance updates instantly.</li>' +
		'<li><b>Encashment (leave exchanged for money):</b> HR records it on <b>BGL Leave Encashment</b> - ' +
		'employee, date, days, and the AMOUNT AS HR COMPUTES IT (the system does not calculate or pay it; ' +
		'payment happens outside payroll). Mark the record <b>Paid</b> once the money is given. ' +
		'Encashed days come off the leave balance immediately: remaining = entitled - taken - encashed.</li>' +
		'<li><b>Watching it:</b> the Command Center Leave tab shows Who\'s Out, every employee\'s balance, and the ' +
		'encashment pipeline. Its total excludes Rejected, which never counts towards what the company owes.</li></ol>']
	]},
	{ lane: 'Trips & Cubic', tag: 'daily entry, locked at month end', items: [
		['Enter the day\'s trips and cubic',
		'<b>Trip Sheet</b> (BGL Operations &gt; Trip Sheet (HR)): pick site and month, type each driver\'s quantity per day, Save Drafts. Rates apply automatically. Vehicle numbers typed here save to the employee and unknown ones are added to the Vehicle List. Green cells are locked (submitted).'],
		['Reading the sheet: weekends and totals',
		'Saturday columns are <b>tinted down the whole grid</b> and Sundays faintly red, because Saturday is paid at a different rate. Each person\'s row ends in five figures - <b>Qty, Sat qty, Normal, Saturday, Total</b> - the same columns the site sheets reconcile against, so ours can be read straight across against theirs.<br><br>' +
		'Under the grid a sticky <b>DAY TOTALS</b> row gives the column total for every day plus the grand quantity and amount. <b>Use it.</b> A day keyed twice, or a driver\'s figures landing in the wrong column, shows up there immediately and nowhere else. Print Sheet carries the same columns and an "of which Saturday" line.'],
		['Month end: lock, then generate',
		'When the month\'s entries are complete: <b>Submit Month</b> on each site (permanent - check the day totals first; only an HR Manager can Unlock Month). Then click <b>Generate Trip Earnings (Drafts)</b> once. That is the whole handover - the drafts land on the Review board.'],
	]},
	{ lane: 'Payroll Numbers', tag: 'last days of the month, strictly in order', items: [
		['Move 1 - Prep Sheet: what the tabs are',
		'One page, six tabs, each with a count on its pill and its own filter box. <b>Save Prep Sheet</b> writes them all at once.<ol>' +
		'<li><b>A - Pro-Ration</b>: joiners, and existing staff who worked part of the month.</li>' +
		'<li><b>B - Basic Salaries</b>: every active employee\'s basic as payroll will use it. <b>Needs sign-off.</b></li>' +
		'<li><b>1 - Loans</b>, <b>2 - Advances</b>, <b>3 - Absences</b>.</li>' +
		'<li><b>4 - Allowances &amp; OT</b>. <b>Needs sign-off.</b></li></ol>' +
		'Anything the save refuses is listed by name under <b>Left out on purpose</b> - normally a leaver, or something already submitted. That is the sheet protecting you, not an error.'],
		['Move 1 - Prep Sheet: advances (this changed)',
		'Everyone who took an advance last month is listed, <b>but every box starts at 0</b>. Type an amount only for people who took one this month; leave the rest at zero. The <b>Last month</b> column is there to jog the memory and nothing else.<br><br>' +
		'This is the single most important change on the sheet. Previously the box was pre-filled with last month\'s figure, so anyone who did not take an advance this month was charged again unless somebody remembered to zero their row by hand. Advances are taken mid-month and recovered in full the same month.'],
		['Move 1 - Prep Sheet: loans',
		'Loans pre-fill from the ledger with the agreed installment, capped at the balance. 0 skips a month; "clears loan" shows on the final payment. New loans are recorded right there with <b>+ Add loan / advance</b>. Repayments write themselves into each loan\'s ledger. Cash or bank repayments made outside payroll go straight on the Staff Loan Advance record.'],
		['Move 1 - Prep Sheet: absences',
		'Type <b>DAYS only</b>. The sheet computes (days / 22) x that employee\'s Basic and creates the Absent deduction. Do not use this tab for someone who is being prorated for a part month - that belongs on the Pro-Ration tab, and the sheet will refuse the duplicate rather than let the two overwrite each other.'],
		['Move 1 - Prep Sheet: pro-ration, both kinds',
		'<b>Joiners</b> appear automatically from their joining date. Type ONE number - the agreed monthly basic. This month pays basic x days/22 (days pre-counted, editable) and the full basic becomes their Salary Structure Assignment. SSNIT and PAYE prorate themselves.<br><br>' +
		'<b>Below the divider, existing staff</b> who worked part of the month - changed role mid-month, left, suspended, unpaid leave. Add them with <b>+ Add employee</b>, type days worked and the agreed full monthly salary. Saving puts that salary on an assignment effective the 1st, then deducts the days not worked. Usually empty; leave it so if nobody applies.<br><br>' +
		'One <b>Mark reviewed</b> covers the whole tab.'],
		['Move 1 - Prep Sheet: allowances and overtime',
		'Housing, Transport, Extra Duty and fixed Overtime Allowance carry forward from last month - edit only what changed. Employees who earn Trips or Cubic have the fixed OT cell LOCKED: one overtime type per person, always. <b>Needs sign-off.</b>'],
		['Move 1b - Sign off the two review tabs (new, and required)',
		'<b>Basic Salaries</b> and <b>Allowances &amp; OT</b> each carry a strip at the top of the tab. Read the figures, then press <b>Mark reviewed</b>. Payroll will not run until both are signed.<br><br>' +
		'Why these two and not the others: their correct state is very often "unchanged", so no count or total can tell reviewed-and-fine apart from never-opened. Only a person can. The app records <b>who signed, when, and the totals at that moment</b> - and if those totals move afterwards the sign-off goes stale on its own and the tab turns red again. Nobody has to remember to un-approve anything. <b>Reopen</b> undoes it deliberately.'],
		['Move 2 - Review and approve',
		'The <b>Review &amp; Approve board</b> opens with a <b>month summary</b>: every group, its entry count, what adds to pay, what comes off pay, and the <b>net effect on payroll</b>. Earnings and deductions stay in separate columns on purpose - one total across groups of opposite sign would mean nothing. Each group also foots with its own total, and agrees or disagrees with its source.<br><br>' +
		'Two ways to approve, same result:<ol>' +
		'<li><b>Group by group</b> - open each, read the lines, press Approve. For anyone who wants the detail.</li>' +
		'<li><b>Approve every draft</b> - one press at the top. For a manager who trusts whoever did the Prep Sheet. It works in batches, counting up as it goes, so a 600 draft month shows progress instead of a frozen spinner.</li></ol>' +
		'Either way the same gate applies: <b>anyone who is no longer active staff stops the approval</b> and is named. Duplicates are flagged at the top.'],
		['Move 3 - Run Payroll Entry',
		'Once everything is green, <b>Create Payroll</b> appears on the same page - two clicks, no retyping. Opening a brand new payroll month <b>asks a second time</b>, naming the month and the headcount it is about to draft slips for.<br><br>' +
		'Two things it will refuse outright: a month where <b>Basic Salaries or Allowances &amp; OT are unsigned</b>, and opening a new month while <b>an earlier month still has an unsubmitted Payroll Entry</b>. Running a new month on top of an unclosed one is how people get paid twice. Then spot-check a few slips against the Review board totals and submit.'],
	]},
	{ lane: 'Management view', tag: 'watch, never enter', items: [
		['Command Center and Employee 360',
		'The <b>Employee Hub</b> search box answers "who is this person and what is their situation" in two keystrokes: type a name, click the match, and the card shows branch, designation, joining date, mobile, vehicle, basic, live loan balance, leave taken and this month\'s trips - with one-click buttons through to the record, a leave application, the Prep Sheet, their payroll entries, slips and trip logs.<br><br>' +
		'<b>Who owes what</b> now carries the loan ledger <b>and</b> this month\'s salary advances in one table, with All / Loans / Advances chips and a name search. <b>Field crew</b> counts active staff. <b>Employee 360</b> gives gross, deductions, net and every component for any person over any period.'],
	]},
	{ lane: 'Reference', tag: 'when you need it', items: [
		['Rates - and why the two sites differ',
		'<b>BGL Trip Rate</b>: one row per pay group + site + day type. <b>Airport and Tema are not the same</b>, which is why every row is now site-specific rather than "All":<ul>' +
		'<li><b>Mixer</b>: Tema 25 flat. Airport 20 weekday, <b>25 Saturday</b>.</li>' +
		'<li><b>Trailer</b>: Tema 25. Airport 20.</li>' +
		'<li><b>Pump (driver and operator)</b>: Tema 0.70 flat. Airport 0.70 weekday, <b>1.00 Saturday</b>.</li>' +
		'<li><b>Plant</b>: Tema 0.25 / 0.37. Airport <b>0.16 / 0.25</b>.</li>' +
		'<li><b>Chemical</b>: Tema 15, Airport 7.</li></ul>' +
		'Set a NEW row with a new effective date rather than editing an old one - history stays intact. Never widen a row back to "All": a single rate covering both sites is what caused Airport to be mispriced once already.'],
		['Vehicles',
		'<b>Vehicle List (BGL Vehicle)</b>: only the number is required (e.g. GR-4052-17). Type, site and plate details are optional extras.'],
		['Fixing mistakes',
		'Before locking a trip sheet: edit and Save Drafts again. After locking: HR Manager &gt; <b>Unlock Month</b> (returns logs to drafts, deletes unsubmitted earning drafts; refuses if earnings were already submitted - cancel those first).<br><br>' +
		'Prep Sheet: re-saving updates in place, never duplicates; 0 removes an entry, and the red <b>x</b> on any added row strikes that person out. A tab you already signed off <b>reopens itself</b> if the numbers change. Approved (submitted) entries: cancel the Additional Salary record itself, then regenerate.'],
		['Who can do what',
		'<b>HR User</b>: enter trips, view sheets and reports. <b>HR Manager</b>: everything + Submit Month, Unlock Month, Generate Trip Earnings, Save Prep Sheet, Mark reviewed, Approve, Create Payroll. <b>Command Center Viewer</b> (management): the Command Center and BGL Executive workspace.'],
	]}
	];
	var body = $('<div style="max-width:840px;margin:8px 20px 40px"></div>').appendTo(page.main);
	$('<style>.pg-s{border:1px solid var(--border-color);border-radius:12px;margin-bottom:10px;background:var(--fg-color);overflow:hidden}\
.pg-h{padding:13px 17px;cursor:pointer;font-weight:700;font-size:14px;display:flex;gap:10px;align-items:center}\
.pg-h:hover{background:var(--subtle-fg)}\
.pg-h .tw{margin-left:auto;color:var(--text-muted);transition:transform .2s}\
.pg-s.open .tw{transform:rotate(90deg)}\
.pg-b{display:none;padding:2px 17px 15px;font-size:13.5px;color:var(--text-color);line-height:1.65;border-top:1px solid var(--border-color)}\
.pg-s.open .pg-b{display:block}\
.pg-b ol{padding-left:19px}.pg-b li{margin-bottom:6px}\
.pg-lane{margin:26px 0 10px;display:flex;gap:12px;align-items:baseline}\
.pg-lane b{font-size:15px;letter-spacing:.02em}\
.pg-lane span{font-size:12px;color:var(--text-muted)}\
.pg-n{width:24px;height:24px;border-radius:50%;background:rgba(240,160,75,.15);color:#d9822b;flex:none;\
display:grid;place-items:center;font-size:12px;font-weight:800}</style>').appendTo(body);
	body.append('<p class="text-muted" style="margin-bottom:4px">The complete BGL payroll handbook - grouped by lane. Learn your own lane; the rest is reference.</p>');
	G.forEach(function(g, gi) {
		body.append('<div class="pg-lane"><b>' + g.lane + '</b><span>' + g.tag + '</span></div>');
		g.items.forEach(function(x, i) {
			body.append('<div class="pg-s' + (gi === 0 ? ' open' : '') + '"><div class="pg-h"><span class="pg-n">' + (i + 1) + '</span>' + x[0] +
				'<span class="tw">&#9654;</span></div><div class="pg-b"><p>' + x[1] + '</p></div></div>');
		});
	});
	body.find('.pg-h').on('click', function() { $(this).parent().toggleClass('open'); });
};
