frappe.pages['payroll-guide'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper, title: 'BGL Payroll Guide', single_column: true
	});
	var G = [
	{ lane: 'How payroll works here', tag: 'read this once', items: [
		['Three lanes, three moves each',
		'Payroll is not one long list - it is <b>three lanes, one per role, and each lane is three moves</b>:<ol>' +
		'<li><b>People & Leave</b> (all month): keep employee records current, enter and approve leave, handle encashments.</li>' +
		'<li><b>Trips & Cubic</b> (daily): enter the day\'s quantities; at month end lock both sites and generate the earnings.</li>' +
		'<li><b>Payroll Numbers</b> (month end, in order): Prep Sheet, then Review & Approve, then Payroll Entry.</li></ol>' +
		'You only need to learn <b>your own lane</b>. The five stones on the BGL Operations cockpit are these moves laid end to end - green means done, the glowing one is next, and Payroll Entry stays blocked until everything before it is green. Management watches the Command Center and enters nothing.']
	]},
	{ lane: 'People & Leave', tag: 'all month, as things happen', items: [
		['Keep employee records current',
		'Every new hire gets an Employee record the day they start - the <b>joining date drives their prorated first salary</b>, so it must be right. Add their vehicle if they drive one. Departures: set the relieving date promptly so they drop off payroll checks.'],
		['Leave and encashment',
				'Every employee gets <b>18 working days</b> of Annual Leave a year - weekends never count, '+
		'so Thursday to Monday costs 3 days, not 5. Casual (3) and Sick (5) work the same way.<ol>'+
		'<li><b>Applying:</b> HR raises a Leave Application on the employee\'s behalf, sets the approver, '+
		'approves and submits. Attendance marks itself On Leave for the working days and the balance updates instantly.</li>'+
		'<li><b>Encashment (leave sold back for cash):</b> open a <b>Leave Encashment</b>. The amount computes '+
		'itself: monthly basic &divide; 22 &times; days. Two ways to pay:<br>'+
		'&bull; <b>With payroll</b> (normal): the Encashment Date decides WHICH month pays it - it must fall inside '+
		'a payroll period you have not run yet. Use the last day of the current month. The system blocks dates in '+
		'months already run.<br>'+
		'&bull; <b>Cash now</b>: tick <b>Pay Via Payment Entry</b> and settle it from the bank today - it never '+
		'touches a payslip.</li>'+
		'<li><b>Watching it:</b> the Command Center Leave tab shows Who\'s Out, every employee\'s balance, and the '+
		'encashment pipeline tagged PAYROLL or CASH so you always know how money is leaving.</li></ol>'+
		'Encashment entries also appear on the Review &amp; Approve board under <b>Leave Encashments</b> before payroll runs.'],
	]},
	{ lane: 'Trips & Cubic', tag: 'daily entry, locked at month end', items: [
		['Enter the day\'s trips and cubic',
				'<b>Trip Sheet</b> (BGL Operations > Trip Sheet (HR)): pick site and month, type each driver\'s quantity per day, Save Drafts. Rates apply automatically (site, group, weekday vs Saturday). Vehicle numbers typed here save to the employee and unknown ones are added to the Vehicle List. Green cells are locked (submitted). Print Sheet gives the signed A3 with totals.'],
		['Month end: lock, then generate',
		'When the month\'s entries are complete: <b>Submit Month</b> on each site (permanent - check totals first; only an HR Manager can Unlock Month). Then click <b>Generate Trip Earnings (Drafts)</b> once. That is the whole handover - the drafts land on the Review board for the Payroll Numbers lane.'],
	]},
	{ lane: 'Payroll Numbers', tag: 'last days of the month, strictly in order', items: [
		['Move 1 - Prep Sheet: loans and advances',
				'The <b>Payroll Prep Sheet</b> is the one page: loans pre-fill from the ledger with the agreed installment capped at the balance (0 skips a month; "clears loan" shows on final payment); new loans are recorded right there with + Add loan / advance; salary advances carry forward from last month - edit only the exceptions (advances are taken mid-month and deducted in full the same month). Repayments write themselves into each loan\'s ledger. Cash/bank repayments outside payroll go straight on the Staff Loan Advance record.'],
		['Move 1 - Prep Sheet: absences',
				'Prep Sheet section 3: type DAYS only. The sheet computes the full amount ((days / 22) x that employee\'s Basic from their salary assignment) and creates the Absent deduction draft - the exact way it was always uploaded, minus the calculator.'],
		['Move 1 - Prep Sheet: new hires',
				'Anyone whose joining date falls inside the month appears automatically on the Prep Sheet. Type ONE number - the agreed monthly basic. This month pays basic x days/22 (days pre-counted from the joining date, editable), and the full basic becomes their Salary Structure Assignment from the 1st of next month. SSNIT and PAYE prorate themselves. Joining date is mandatory on every new employee - the readiness checklist flags any that look wrong.'],
		['Move 1 - Prep Sheet: fixed allowances and overtime',
				'Prep Sheet section 4: Housing, Transport, Extra Duty and fixed Overtime Allowance carry forward from last month - edit only what changed. Employees who earn Trips or Cubic have the fixed OT cell LOCKED: one overtime type per person, always.'],
		['Move 2 - Review and approve',
				'<b>Review & Approve board</b> (BGL Operations > Review & Approve): each group shows its count, total, and whether it AGREES with its source (trip sheets, loan ledger, last month). Foreign/inactive employees and duplicates are flagged on top. Approve each group (HR Manager). When everything is green the "Proceed to Payroll Entry" button appears. Payroll Entry then pulls every submitted entry into the salary slips as usual.'],
		['Move 3 - Run Payroll Entry',
		'Only when the cockpit verdict reads <b>READY FOR PAYROLL ENTRY</b>. Run it for the full month (1st to last day) so every dated entry - including leave encashments - is picked up. Generate the slips, spot-check a few against the Review board totals, submit.'],
	]},
	{ lane: 'Management view', tag: 'watch, never enter', items: [
		['Command Center and Employee 360',
				'On the BGL Operations workspace, the <b>Employee Hub</b> search box answers "who is this person and what is their situation" in two keystrokes: type a name, click the match, and the card shows branch, designation, joining date, mobile, vehicle, basic, live loan balance, leave taken and this month\'s trips - with one-click buttons to open the record, start a leave application, jump to the Prep Sheet, or see their payroll entries, salary slips and trip logs. Management gets the deeper <b>Employee 360</b> inside the Command Center: pick a person and a period (this month, last month, 3 months, this year, all time) and see gross paid, deductions, net received, every earning and deduction by component, all salary slips, trips and leave for that window.'],
	]},
	{ lane: 'Reference', tag: 'when you need it', items: [
		['Rates',
				'<b>BGL Trip Rate</b> list: one row per pay group + site + day type, named like RATE-... Set a new row with a new effective date instead of editing an old one - history stays intact. "All" site applies everywhere unless a site-specific row exists.'],
		['Vehicles',
				'<b>Vehicle List (BGL Vehicle)</b>: only the number is required (e.g. GR-4052-17). Type, site and plate details are optional extras.'],
		['Fixing mistakes',
				'Before locking: just edit and Save Drafts again. After locking a trip sheet: HR Manager > Unlock Month (returns logs to drafts, deletes unsubmitted earning drafts; refuses if earnings were already submitted - cancel those first under Additional Salary). Prep Sheet: re-saving updates in place, never duplicates; 0 removes an entry, and the red <b>x</b> on any added row strikes that person out (Save then removes their draft; click x again to restore). Approved (submitted) entries: cancel the Additional Salary record itself, then regenerate.'],
		['Who can do what',
				'<b>HR User</b>: enter trips, view sheets and reports. <b>HR Manager</b>: everything + Submit Month, Unlock Month, Generate Trip Earnings, Save Deductions, Approve. <b>Command Center Viewer</b> (management): the Command Center and BGL Executive workspace.'],
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
