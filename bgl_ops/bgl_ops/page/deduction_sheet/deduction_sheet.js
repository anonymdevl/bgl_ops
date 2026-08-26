frappe.pages['deduction-sheet'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Monthly Deduction Sheet',
		single_column: true
	});

	var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'];
	var state = { data: null, month: null };

	var month_field = page.add_field({
		fieldname: 'month', label: 'Month', fieldtype: 'Select',
		options: MONTHS.join('\n'),
		default: MONTHS[new Date().getMonth()]
	});

	function ym() {
		var mi = MONTHS.indexOf(month_field.get_value());
		var now = new Date(), y = now.getFullYear();
		if (mi > now.getMonth() + 1) y -= 1;
		return y + '-' + String(mi + 1).padStart(2, '0');
	}

	page.set_primary_action('Load Sheet', load_sheet);
	page.set_secondary_action('Save Deductions', save_all);
	page.add_inner_button('Print Sheet', print_sheet);

	var body = $('<div class="dds-body" style="margin-top:10px"></div>').appendTo(page.main);
	$('<style>\
		.dds h4{margin:18px 0 6px;font-size:14px}\
		.dds .sect-note{color:var(--text-muted);font-size:12px;margin:0 0 8px}\
		table.dds-t{border-collapse:collapse;width:100%;font-size:12.5px;background:var(--fg-color);\
			border:1px solid var(--border-color);border-radius:8px;overflow:hidden;margin-bottom:6px}\
		.dds-t th,.dds-t td{border-bottom:1px solid var(--border-color);padding:6px 10px;text-align:right;white-space:nowrap}\
		.dds-t th{background:var(--subtle-fg);font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted)}\
		.dds-t th.l,.dds-t td.l{text-align:left}\
		.dds-t td input{width:100px;text-align:right;border:1px solid var(--border-color);border-radius:6px;\
			padding:4px 7px;background:var(--control-bg);color:var(--text-color);font-weight:600}\
		.dds-t td input:focus{outline:none;border-color:var(--primary)}\
		.dds-t td input.dirty{border-color:var(--orange-500)}\
		.dds-t tr.total td{font-weight:700;background:var(--subtle-fg)}\
		.dds-t td.clears{color:var(--green-600);font-weight:700}\
		.dds-add{margin:2px 0 10px}\
	</style>').appendTo(body);
	var holder = $('<div class="dds"></div>').appendTo(body);
	holder.html('<p class="text-muted" style="padding:14px">Choose a month, then Load Sheet.</p>');

	function fmt(v) { return format_number(flt(v), null, 2); }

	function load_sheet() {
		state.month = ym();
		frappe.call({
			method: 'bgl_ops.api.deduction_sheet',
			args: { month: state.month },
			freeze: true,
			callback: function(r) { state.data = r.message; render(); }
		});
	}

	function draft_amount(component, employee) {
		var d = (state.data.drafts || []).filter(function(x) {
			return x.salary_component === component && x.employee === employee;
		});
		return d.length ? flt(d[0].amount) : null;
	}

	function render() {
		var d = state.data;
		var mi = parseInt(state.month.slice(5, 7), 10) - 1;
		var label = MONTHS[mi] + ' ' + state.month.slice(0, 4);
		var h = '<h4>1. Loans - ' + label + '</h4>' +
			'<p class="sect-note">Pre-filled with each loan\'s agreed installment, capped at the balance. Set 0 to skip this month.</p>' +
			'<table class="dds-t" id="dds-loans"><thead><tr>' +
			'<th class="l">Employee</th><th>Principal</th><th>Repaid</th><th>Balance</th>' +
			'<th>Installment</th><th>Deduct this month</th><th class="l">After</th></tr></thead><tbody>';
		(d.loans || []).forEach(function(l) {
			var saved = draft_amount('Loans', l.employee);
			var val = saved !== null ? saved : Math.min(flt(l.expected_monthly) || flt(l.balance), flt(l.balance));
			h += '<tr data-loan="' + l.name + '"><td class="l">' + l.employee_name + '</td>' +
				'<td>' + fmt(l.principal) + '</td><td>' + fmt(l.total_repaid) + '</td>' +
				'<td>' + fmt(l.balance) + '</td><td>' + fmt(l.expected_monthly) + '</td>' +
				'<td><input type="number" min="0" step="0.01" class="dl-amt" value="' + flt(val, 2) + '" data-bal="' + flt(l.balance) + '"></td>' +
				'<td class="l after"></td></tr>';
		});
		if (!(d.loans || []).length) h += '<tr><td class="l" colspan="7">No active loans in the ledger.</td></tr>';
		h += '<tr class="total"><td class="l">TOTAL LOANS</td><td></td><td></td><td></td><td></td><td id="tot-loans"></td><td></td></tr>';
		h += '</tbody></table>';

		h += '<h4>2. Salary Advances - ' + label + '</h4>' +
			'<p class="sect-note">Pre-filled from last month\'s submitted advances. Edit the exceptions, set 0 for no advance, add new people below. Advances are deducted in full this same month.</p>' +
			'<table class="dds-t" id="dds-adv"><thead><tr>' +
			'<th class="l">Employee</th><th>Last month</th><th>Advance to deduct</th></tr></thead><tbody>';
		var seen = {};
		(d.prev_advances || []).forEach(function(a) {
			seen[a.employee] = 1;
			var saved = draft_amount('Salary Advance', a.employee);
			var val = saved !== null ? saved : flt(a.amount);
			h += adv_row(a.employee, a.employee_name, fmt(a.amount), val);
		});
		// current drafts for people NOT in last month's list
		(d.drafts || []).forEach(function(x) {
			if (x.salary_component !== 'Salary Advance' || seen[x.employee]) return;
			seen[x.employee] = 1;
			var emp = (d.employees || []).filter(function(e) { return e.name === x.employee; });
			h += adv_row(x.employee, emp.length ? emp[0].employee_name : x.employee, '-', flt(x.amount));
		});
		h += '<tr class="total"><td class="l">TOTAL ADVANCES</td><td></td><td id="tot-adv"></td></tr>';
		h += '</tbody></table>' +
			'<button class="btn btn-xs btn-default dds-add" id="add-adv">+ Add employee</button>';

		h += '<h4>3. Absent Days - ' + label + '</h4>' +
			'<p class="sect-note">Enter DAYS only. The sheet computes the full amount ((days / 22) x Basic) and creates the Absent deduction draft exactly as HR uploads it today - offsetting net pay.</p>' +
			'<table class="dds-t" id="dds-abs"><thead><tr>' +
			'<th class="l">Employee</th><th>Days absent</th><th>Deduction (auto)</th></tr></thead><tbody>';
		(d.drafts || []).forEach(function(x) {
			if (x.salary_component !== 'Absent') return;
			var emp = (d.employees || []).filter(function(e) { return e.name === x.employee; });
			var base = flt((d.bases || {})[x.employee]);
			var days = base > 0 ? Math.round((flt(x.amount) * 22 / base) * 2) / 2 : 0;
			h += abs_row(x.employee, emp.length ? emp[0].employee_name : x.employee, days);
		});
		h += '<tr class="total"><td class="l">TOTAL</td><td id="tot-abs-days"></td><td id="tot-abs"></td></tr>';
		h += '</tbody></table>' +
			'<button class="btn btn-xs btn-default dds-add" id="add-abs">+ Add employee</button>';

		holder.html(h);
		holder.find('input').on('input', function() { $(this).addClass('dirty'); totals(); });
		holder.find('#add-adv').on('click', function() { add_person('adv'); });
		holder.find('#add-abs').on('click', function() { add_person('abs'); });
		totals();
	}

	function adv_row(emp, name, last, val) {
		return '<tr data-emp="' + emp + '"><td class="l">' + name + '</td><td>' + last + '</td>' +
			'<td><input type="number" min="0" step="0.01" class="da-amt" value="' + flt(val, 2) + '"></td></tr>';
	}

	function abs_row(emp, name, days) {
		return '<tr data-emp="' + emp + '"><td class="l">' + name + '</td>' +
			'<td><input type="number" min="0" step="0.5" class="db-days" value="' + flt(days) + '"></td>' +
			'<td class="est"></td></tr>';
	}

	function add_person(kind) {
		var d = state.data;
		var opts = (d.employees || []).map(function(e) { return e.name + ': ' + e.employee_name; });
		frappe.prompt([{
			fieldname: 'emp', label: 'Employee', fieldtype: 'Select', options: opts.join('\n'), reqd: 1
		}], function(v) {
			var emp = v.emp.split(':')[0].trim();
			var name = v.emp.split(':').slice(1).join(':').trim();
			var tb = holder.find(kind === 'adv' ? '#dds-adv tbody' : '#dds-abs tbody');
			var row = kind === 'adv' ? adv_row(emp, name, '-', 0) : abs_row(emp, name, 0);
			tb.find('tr.total').before(row);
			tb.find('tr[data-emp="' + emp + '"] input').addClass('dirty').on('input', function() {
				$(this).addClass('dirty'); totals();
			});
			totals();
		}, 'Add employee', 'Add');
	}

	function totals() {
		var tl = 0;
		holder.find('#dds-loans tbody tr[data-loan]').each(function() {
			var inp = $(this).find('input.dl-amt');
			var v = flt(inp.val()), bal = flt(inp.data('bal'));
			if (v > bal) { v = bal; inp.val(v); }
			tl += v;
			var after = bal - v;
			$(this).find('td.after').text(after <= 0 && v > 0 ? fmt(0) + ' - clears loan' : fmt(after))
				.toggleClass('clears', after <= 0 && v > 0);
		});
		holder.find('#tot-loans').text('GHS ' + fmt(tl));
		var ta = 0;
		holder.find('#dds-adv tbody tr[data-emp] input.da-amt').each(function() { ta += flt($(this).val()); });
		holder.find('#tot-adv').text('GHS ' + fmt(ta));
		var td = 0, tabs = 0, bases = (state.data && state.data.bases) || {};
		holder.find('#dds-abs tbody tr[data-emp]').each(function() {
			var emp = $(this).data('emp');
			var days = flt($(this).find('input.db-days').val());
			var est = (days / 22) * flt(bases[emp] || 0);
			td += days; tabs += est;
			$(this).find('td.est').text(days ? fmt(est) : '-');
		});
		holder.find('#tot-abs-days').text(td + ' days');
		holder.find('#tot-abs').text('GHS ' + fmt(tabs));
	}

	function collect() {
		var loans = [], advances = [], absences = [];
		holder.find('#dds-loans tbody tr[data-loan]').each(function() {
			loans.push({ loan: $(this).data('loan'), amount: flt($(this).find('input.dl-amt').val()) });
		});
		holder.find('#dds-adv tbody tr[data-emp]').each(function() {
			advances.push({ employee: $(this).data('emp'), amount: flt($(this).find('input.da-amt').val()) });
		});
		holder.find('#dds-abs tbody tr[data-emp]').each(function() {
			absences.push({ employee: $(this).data('emp'), days: flt($(this).find('input.db-days').val()) });
		});
		return { loans: loans, advances: advances, absences: absences };
	}

	function save_all() {
		if (!state.data) { frappe.msgprint('Load a sheet first.'); return; }
		var c = collect();
		frappe.confirm(
			'Save the ' + state.month + ' deduction sheet?<br><br>Loan rows write ledger repayments + draft "Loans" deductions; advances become draft "Salary Advance" deductions; absent days become draft "Absent" deductions with the amount computed for you ((days/22) x Basic). All drafts are dated to month-end for HR review - <b>Payroll Entry still runs afterwards</b>.',
			function() {
				frappe.call({
					method: 'bgl_ops.api.deduction_save',
					args: { month: state.month, loans: JSON.stringify(c.loans),
						advances: JSON.stringify(c.advances), absences: JSON.stringify(c.absences) },
					freeze: true, freeze_message: 'Saving deductions...',
					callback: function(r) {
						var m = r.message;
						var msg = 'Saved: ' + m.loans + ' loan deduction(s), ' + m.advances +
							' advance(s), ' + m.absences + ' absence entr(ies). Next: review + submit the drafts under Additional Salary, then run Payroll Entry.';
						if (m.cleared.length) msg += ' Loans cleared: ' + m.cleared.join(', ') + '.';
						frappe.show_alert({ message: msg, indicator: m.errors.length ? 'orange' : 'green' });
						if (m.errors.length) frappe.msgprint({ title: 'Some rows failed', message: m.errors.join('<br>') });
						load_sheet();
					}
				});
			}
		);
	}

	function print_sheet() {
		if (!state.data) { frappe.msgprint('Load a sheet first.'); return; }
		var mi = parseInt(state.month.slice(5, 7), 10) - 1;
		var label = MONTHS[mi] + ' ' + state.month.slice(0, 4);
		var h = '<html><head><meta charset="utf-8"><title>Deduction Sheet ' + label + '</title><style>' +
			'body{font-family:Arial;font-size:9pt;color:#000;margin:24px}' +
			'h2{margin:0}h3{margin:14px 0 4px;font-size:10pt}' +
			'img{height:44px}.hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}' +
			'table{border-collapse:collapse;width:100%;margin-bottom:8px}' +
			'th,td{border:0.5pt solid #000;padding:3pt 6pt;text-align:right}' +
			'th{background:#eee}th.l,td.l{text-align:left}tr.total td{font-weight:bold;background:#f4f4f4}' +
			'.sig{margin-top:26pt;font-size:8pt;font-weight:bold}' +
			'</style></head><body>' +
			'<div class="hd"><img src="/files/betonsa_logo.jpeg"><div style="text-align:right">' +
			'<h2>MONTHLY DEDUCTION SHEET</h2><div>' + label + '</div></div></div>';
		function table_from(sel, title, cols) {
			var t = '<h3>' + title + '</h3><table><tr>';
			cols.forEach(function(c, i) { t += '<th class="' + (i === 0 ? 'l' : '') + '">' + c + '</th>'; });
			t += '</tr>';
			holder.find(sel + ' tbody tr').each(function() {
				var cells = [];
				$(this).find('td').each(function() {
					var inp = $(this).find('input');
					cells.push(inp.length ? inp.val() : $(this).text());
				});
				if (!cells.length) return;
				var isTotal = $(this).hasClass('total');
				// skip zero-value data rows on print
				if (!isTotal && $(this).find('input').length) {
					var v = flt($(this).find('input').first().val());
					if (sel === '#dds-loans') v = flt($(this).find('input.dl-amt').val());
					if (v <= 0) return;
				}
				t += '<tr class="' + (isTotal ? 'total' : '') + '">';
				cells.slice(0, cols.length).forEach(function(c, i) {
					t += '<td class="' + (i === 0 ? 'l' : '') + '">' + (c || '-') + '</td>';
				});
				t += '</tr>';
			});
			return t + '</table>';
		}
		h += table_from('#dds-loans', '1. Loans', ['Employee', 'Principal', 'Repaid', 'Balance', 'Installment', 'Deduct', 'After']);
		h += table_from('#dds-adv', '2. Salary Advances', ['Employee', 'Last month', 'Deduct']);
		h += table_from('#dds-abs', '3. Absent Days', ['Employee', 'Days', 'Est. deduction']);
		h += '<div class="sig">APPROVED BY MANAGING DIRECTOR .................................................................</div>';
		h += '</body></html>';
		var w = window.open('', '_blank');
		w.document.write(h); w.document.close();
		setTimeout(function() { w.print(); }, 400);
	}
};
