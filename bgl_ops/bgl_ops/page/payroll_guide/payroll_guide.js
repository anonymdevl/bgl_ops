frappe.pages['payroll-guide'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper, title: 'BGL Payroll Guide', single_column: true
	});
	var L = [
		['The monthly rhythm (read this first)',
		'Payroll is 3 steps, in order, every month:<ol>' +
		'<li><b>Trip sheets</b>: enter daily trips/cubic per site, Save Drafts as you go. When the month is complete, Submit Month (permanent - check totals first; only an HR Manager can Unlock Month to correct). Then click <b>Generate Trip Earnings (Drafts)</b>.</li>' +
		'<li><b>Payroll Prep Sheet</b>: one page for new-hire proration, loans, advances, absences and fixed allowances. One Save creates all the draft entries.</li>' +
		'<li><b>Review & Approve board</b>: drafts grouped by source, totals reconciled. Approve each group, then Proceed to Payroll Entry.</li></ol>' +
		'The cockpit trail on BGL Operations always shows which step is next.'],
		['Entering trips and cubic',
		'<b>Trip Sheet</b> (BGL Operations > Trip Sheet (HR)): pick site and month, type each driver\'s quantity per day, Save Drafts. Rates apply automatically (site, group, weekday vs Saturday). Vehicle numbers typed here save to the employee and unknown ones are added to the Vehicle List. Green cells are locked (submitted). Print Sheet gives the signed A3 with totals.'],
		['Rates',
		'<b>BGL Trip Rate</b> list: one row per pay group + site + day type, named like RATE-... Set a new row with a new effective date instead of editing an old one - history stays intact. "All" site applies everywhere unless a site-specific row exists.'],
		['Vehicles',
		'<b>Vehicle List (BGL Vehicle)</b>: only the number is required (e.g. GR-4052-17). Type, site and plate details are optional extras.'],
		['Loans and advances',
		'The <b>Payroll Prep Sheet</b> is the one page: loans pre-fill from the ledger with the agreed installment capped at the balance (0 skips a month; "clears loan" shows on final payment); new loans are recorded right there with + Add loan / advance; salary advances carry forward from last month - edit only the exceptions (advances are taken mid-month and deducted in full the same month). Repayments write themselves into each loan\'s ledger. Cash/bank repayments outside payroll go straight on the Staff Loan Advance record.'],
		['Absences',
		'Prep Sheet section 3: type DAYS only. The sheet computes the full amount ((days / 22) x that employee\'s Basic from their salary assignment) and creates the Absent deduction draft - the exact way it was always uploaded, minus the calculator.'],
		['New hires and proration',
		'Anyone whose joining date falls inside the month appears automatically on the Prep Sheet. Type ONE number - the agreed monthly basic. This month pays basic x days/22 (days pre-counted from the joining date, editable), and the full basic becomes their Salary Structure Assignment from the 1st of next month. SSNIT and PAYE prorate themselves. Joining date is mandatory on every new employee - the readiness checklist flags any that look wrong.'],
		['Fixed allowances and overtime',
		'Prep Sheet section 4: Housing, Transport, Extra Duty and fixed Overtime Allowance carry forward from last month - edit only what changed. Employees who earn Trips or Cubic have the fixed OT cell LOCKED: one overtime type per person, always.'],
		['Review, approve, run payroll',
		'<b>Review & Approve board</b> (BGL Operations > Review & Approve): each group shows its count, total, and whether it AGREES with its source (trip sheets, loan ledger, last month). Foreign/inactive employees and duplicates are flagged on top. Approve each group (HR Manager). When everything is green the "Proceed to Payroll Entry" button appears. Payroll Entry then pulls every submitted entry into the salary slips as usual.'],
		['Fixing mistakes',
		'Before locking: just edit and Save Drafts again. After locking a trip sheet: HR Manager > Unlock Month (returns logs to drafts, deletes unsubmitted earning drafts; refuses if earnings were already submitted - cancel those first under Additional Salary). Prep Sheet: re-saving updates in place, never duplicates; 0 removes an entry. Approved (submitted) entries: cancel the Additional Salary record itself, then regenerate.'],
		['Who can do what',
		'<b>HR User</b>: enter trips, view sheets and reports. <b>HR Manager</b>: everything + Submit Month, Unlock Month, Generate Trip Earnings, Save Deductions, Approve. <b>Command Center Viewer</b> (management): the Command Center and BGL Executive workspace.']
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
.pg-n{width:24px;height:24px;border-radius:50%;background:rgba(240,160,75,.15);color:#d9822b;flex:none;\
display:grid;place-items:center;font-size:12px;font-weight:800}</style>').appendTo(body);
	body.append('<p class="text-muted" style="margin-bottom:14px">The complete BGL payroll handbook - lives inside the system, always current with the app version.</p>');
	L.forEach(function(x, i) {
		body.append('<div class="pg-s' + (i === 0 ? ' open' : '') + '"><div class="pg-h"><span class="pg-n">' + (i + 1) + '</span>' + x[0] +
			'<span class="tw">&#9654;</span></div><div class="pg-b"><p>' + x[1] + '</p></div></div>');
	});
	body.find('.pg-h').on('click', function() { $(this).parent().toggleClass('open'); });
};
