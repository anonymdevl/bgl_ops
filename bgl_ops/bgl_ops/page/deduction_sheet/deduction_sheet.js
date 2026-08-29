frappe.pages['deduction-sheet'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Monthly Payroll Prep Sheet',
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
	page.set_secondary_action('Save Prep Sheet', save_all);
	page.add_inner_button('Print Sheet', print_sheet);

	var body = $('<div class="dds-body" style="margin:10px 20px 40px"></div>').appendTo(page.main);
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
		.dds-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 14px;border-bottom:1px solid var(--border-color);padding-bottom:10px}\
		.dds-tab{border:1px solid var(--border-color);background:var(--fg-color);border-radius:100px;\
			padding:6px 16px;font-size:12.5px;font-weight:600;cursor:pointer;color:var(--text-muted)}\
		.dds-tab.active{background:var(--primary);color:#fff;border-color:var(--primary)}\
		.dds-tab .cnt{opacity:.75;font-weight:400;margin-left:4px}\
		.dds-pane{display:none}.dds-pane.active{display:block}\
		.dds-splitline{border-top:1px dashed var(--border-color);margin:26px 0 4px}\
		.dds-sign-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 12px;\
			padding:8px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--subtle-fg)}\
		.dds-sign-bar .btn{margin-left:auto}\
		.dds-ok{color:var(--green-600);font-weight:600;font-size:12.5px}\
		.dds-stale{color:var(--orange-500);font-weight:600;font-size:12.5px}\
		.dds-pending{color:var(--text-muted);font-size:12.5px}\
	</style>').appendTo(body);
	var holder = $('<div class="dds"></div>').appendTo(body);
	holder.html('<p class="text-muted" style="padding:14px">Choose a month, then Load Sheet.</p>');

	function fmt(v) { return format_number(flt(v), null, 2); }

	// how many data rows a table's markup holds, before it reaches the DOM
	function count_rows(html, table_id) {
		var m = html.split('id="' + table_id + '"')[1];
		if (!m) return 0;
		m = m.split('</table>')[0];
		return (m.match(/<tr data-emp=/g) || []).length;
	}

	// every tab gets the same filter box - one habit, not five
	function filter_box(pane) {
		return '<input type="text" class="dds-filter form-control input-sm" ' +
			'data-pane="' + pane + '" placeholder="Filter by name..." ' +
			'style="margin-bottom:8px;max-width:280px">';
	}

	// sign-off strip: says who checked this tab and when, or offers to
	function signoff_bar(section) {
		var s = ((state.data || {}).signoffs || {})[section] || null;
		var body;
		if (s && s.status === 'Reviewed' && !s.stale) {
			body = '<span class="dds-ok">Reviewed by ' + frappe.utils.escape_html(s.reviewed_by || '') +
				' on ' + String(s.reviewed_on || '').slice(0, 16) + '</span>' +
				'<button class="btn btn-xs btn-default dds-reopen" data-sec="' +
				frappe.utils.escape_html(section) + '">Reopen</button>';
		} else if (s && s.status === 'Reviewed' && s.stale) {
			body = '<span class="dds-stale">Reviewed by ' + frappe.utils.escape_html(s.reviewed_by || '') +
				', but the numbers changed since (was ' + s.entries_seen + ' entries / GHS ' +
				fmt(s.total_seen) + ', now ' + s.rows_now + ' / GHS ' + fmt(s.total_now) +
				') - check and mark it again</span>' +
				'<button class="btn btn-xs btn-primary dds-sign" data-sec="' +
				frappe.utils.escape_html(section) + '">Mark reviewed</button>';
		} else {
			body = '<span class="dds-pending">Not reviewed yet. Payroll stays blocked until someone checks this tab - even if nothing needed changing.</span>' +
				'<button class="btn btn-xs btn-primary dds-sign" data-sec="' +
				frappe.utils.escape_html(section) + '">Mark reviewed</button>';
		}
		return '<div class="dds-sign-bar">' + body + '</div>';
	}

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
		var h = '';
		h += '<div class="dds-pane" data-pane="hires">';
		h += signoff_bar('New Hire Pro-Ration') + filter_box('hires');
		if ((d.new_hires || []).length) {
			h += '<h4>A. New Hire Pro-Ration - ' + label + '</h4>' +
				'<p class="sect-note">Found automatically from each joining date. Type the agreed monthly basic; this month pays basic x days/22 (component stays Basic Salary - the remark carries the New Hire Proration name), and the full basic becomes the Salary Structure Assignment from the 1st of next month.</p>' +
				'<table class="dds-t" id="dds-hires"><thead><tr>' +
				'<th class="l">New hire</th><th class="l">Joined</th><th>Days worked</th>' +
				'<th>Actual monthly basic</th><th>This month pays</th></tr></thead><tbody>';
			(d.new_hires || []).forEach(function(nh) {
				var saved = (d.proration_drafts || []).filter(function(x) { return x.employee === nh.name; });
				var basic = nh.existing_base || '';
				h += '<tr data-emp="' + nh.name + '"><td class="l">' + nh.employee_name +
					' <span class="text-muted">' + (nh.designation || '') + '</span></td>' +
					'<td class="l">' + frappe.datetime.str_to_user(nh.date_of_joining) + '</td>' +
					'<td><input type="number" min="0" max="22" step="0.5" class="nh-days" value="' + nh.days_suggested + '"></td>' +
					'<td><input type="number" min="0" step="0.01" class="nh-basic" value="' + basic + '" placeholder="type basic"></td>' +
					'<td class="nh-pay">' + (saved.length ? fmt(saved[0].amount) + ' (saved)' : '-') + '</td></tr>';
			});
			h += '<tr class="total"><td class="l">TOTAL PRO-RATION</td><td></td>' +
				'<td id="tot-nh-days"></td><td id="tot-nh-basic"></td><td id="tot-nh"></td></tr>';
			h += '</tbody></table>';
		}
		if (!(d.new_hires || []).length) h += '<p class="sect-note">No joiners this month - nothing to prorate.</p>';

		// Same tab as the new hires, just set apart. One question - who needs
		// their month prorated - not two places to go looking.
		h += '<div class="dds-splitline"></div>';
		h += '<h4>Existing staff who worked part of the month <span class="text-muted" style="font-weight:400">- optional</span></h4>' +
			'<p class="sect-note">For someone <b>already on payroll</b> who worked part of the month - changed role mid-month, left, suspended, unpaid leave. Type the days worked and the agreed full monthly salary. Saving puts that salary on an assignment effective the 1st, then deducts the days not worked. Leave it empty if nobody applies. Do not also list the same person on the Absences tab.</p>' +
			'<table class="dds-t" id="dds-prorate"><thead><tr>' +
			'<th class="l">Employee</th><th>Days worked (of 22)</th>' +
			'<th>Full monthly salary</th><th>Deducted</th><th>This month pays</th><th></th></tr></thead><tbody>';
		(d.proration_rows || []).forEach(function(p) {
			h += prorate_row(p.employee, p.employee_name, p.days, p.full_salary);
		});
		h += '<tr class="total"><td class="l">TOTAL PART MONTH</td><td id="tot-pr-days"></td>' +
			'<td id="tot-pr-full"></td><td id="tot-pr-ded"></td><td id="tot-pr-pay"></td><td></td></tr>';
		h += '</tbody></table>' +
			'<button class="btn btn-xs btn-default dds-add" id="add-prorate">+ Add employee</button>';
		h += '</div>';   // closes the hires pane

		h += '<div class="dds-pane" data-pane="basics">' +
			'<h4>B. Basic Salaries - current assignments</h4>' +
			'<p class="sect-note">Every active employee\'s basic as payroll will use it. If one is wrong, type the corrected figure - saving creates a NEW assignment effective ' + state.month + '-01 (the old one stays as history; nothing submitted is edited). Leave blank to keep as is.</p>' +
			signoff_bar('Basic Salaries') + filter_box('basics') +
			'<div style="max-height:430px;overflow-y:auto">' +
			'<table class="dds-t" id="dds-basics"><thead><tr>' +
			'<th class="l">Employee</th><th class="l">Branch</th><th>Current basic</th><th class="l">Effective since</th><th>Corrected basic (only if wrong)</th></tr></thead><tbody>';
		(d.basics || []).forEach(function(b) {
			h += '<tr data-emp="' + b.employee + '"><td class="l">' + b.employee_name + '</td>' +
				'<td class="l">' + (b.branch || '') + '</td><td>' + fmt(b.base) + '</td>' +
				'<td class="l">' + frappe.datetime.str_to_user(b.from_date) + '</td>' +
				'<td><input type="number" min="0" step="0.01" class="bs-new" placeholder="keep"></td></tr>';
		});
		h += '<tr class="total"><td class="l">TOTAL BASIC SALARIES</td><td></td>' +
			'<td id="tot-bs-cur"></td><td></td><td id="tot-bs-new"></td></tr>';
		h += '</tbody></table></div></div>';

		h += '<div class="dds-pane" data-pane="loans">';
		h += signoff_bar('Loans') + filter_box('loans');
		h += '<h4>1. Loans - ' + label + '</h4>' +
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
		h += '<button class="btn btn-xs btn-default dds-add" id="add-loan">+ Add loan / advance</button>';
		h += '</div>';

		h += '<div class="dds-pane" data-pane="adv">';
		h += signoff_bar('Advances') + filter_box('adv');
		h += '<h4>2. Salary Advances - ' + label + '</h4>' +
			'<p class="sect-note">Everyone who took an advance last month is listed, but every box starts at <b>0</b> - an advance is a one-off, not a standing deduction. Type an amount only for people who took one this month. The Last month column is there to jog the memory, nothing more. Advances are deducted in full this same month.</p>' +
			'<table class="dds-t" id="dds-adv"><thead><tr>' +
			'<th class="l">Employee</th><th>Last month</th><th>Advance to deduct</th><th></th></tr></thead><tbody>';
		var seen = {};
		(d.prev_advances || []).forEach(function(a) {
			seen[a.employee] = 1;
			var saved = draft_amount('Salary Advance', a.employee);
			// Default 0, NOT last month's figure. An advance is a one-off, so
			// carrying the amount forward charges people who took nothing this
			// month unless somebody remembers to zero every row. Last month
			// stays on screen as a reference, which is all it should ever be.
			var val = saved !== null ? saved : 0;
			h += adv_row(a.employee, a.employee_name, fmt(a.amount), val);
		});
		// current drafts for people NOT in last month's list
		(d.drafts || []).forEach(function(x) {
			if (x.salary_component !== 'Salary Advance' || seen[x.employee]) return;
			seen[x.employee] = 1;
			var emp = (d.employees || []).filter(function(e) { return e.name === x.employee; });
			h += adv_row(x.employee, emp.length ? emp[0].employee_name : x.employee, '-', flt(x.amount));
		});
		h += '<tr class="total"><td class="l">TOTAL ADVANCES</td><td></td><td id="tot-adv"></td><td></td></tr>';
		h += '</tbody></table>' +
			'<button class="btn btn-xs btn-default dds-add" id="add-adv">+ Add employee</button>';
		h += '</div>';

		h += '<div class="dds-pane" data-pane="abs">';
		h += signoff_bar('Absences') + filter_box('abs');
		h += '<h4>3. Absent Days - ' + label + '</h4>' +
			'<p class="sect-note">Enter DAYS only. The sheet computes the full amount ((days / 22) x Basic) and creates the Absent deduction draft exactly as HR uploads it today - offsetting net pay.</p>' +
			'<table class="dds-t" id="dds-abs"><thead><tr>' +
			'<th class="l">Employee</th><th>Days absent</th><th>Deduction (auto)</th><th></th></tr></thead><tbody>';
		(d.drafts || []).forEach(function(x) {
			if (x.salary_component !== 'Absent') return;
			var emp = (d.employees || []).filter(function(e) { return e.name === x.employee; });
			var base = flt((d.bases || {})[x.employee]);
			var days = base > 0 ? Math.round((flt(x.amount) * 22 / base) * 2) / 2 : 0;
			h += abs_row(x.employee, emp.length ? emp[0].employee_name : x.employee, days);
		});
		h += '<tr class="total"><td class="l">TOTAL</td><td id="tot-abs-days"></td><td id="tot-abs"></td><td></td></tr>';
		h += '</tbody></table>' +
			'<button class="btn btn-xs btn-default dds-add" id="add-abs">+ Add employee</button>';
		h += '</div>';

		h += '<div class="dds-pane" data-pane="allow">';
		h += signoff_bar('Allowances and OT') + filter_box('allow');
		h += '<h4>4. Fixed Allowances and Overtime - ' + label + '</h4>' +
			'<p class="sect-note">Carried forward from last month - edit only what changed. Employees on Trips or Cubic have the fixed OT cell locked (one overtime type per person).</p>' +
			'<table class="dds-t" id="dds-allow"><thead><tr>' +
			'<th class="l">Employee</th><th>Housing</th><th>Transport</th><th>Extra Duty</th><th>Fixed OT</th><th>Total</th></tr></thead><tbody>';
		var amap = {};
		function arow(emp, nm) { return amap[emp] = amap[emp] || { name: nm, housing: 0, transport: 0, eda: 0, ota: 0 }; }
		function aset(r, comp, amt) {
			if (comp === 'Housing Allowance') r.housing = flt(amt);
			if (comp === 'Transport Allowance') r.transport = flt(amt);
			if (comp === 'Extra Duty Allowance') r.eda = flt(amt);
			if (comp === 'Overtime Allowance') r.ota = flt(amt);
		}
		(d.prev_allowances || []).forEach(function(a) { aset(arow(a.employee, a.employee_name), a.salary_component, a.amount); });
		(d.allowance_drafts || []).forEach(function(a) {
			var e2 = (d.employees || []).filter(function(e) { return e.name === a.employee; });
			aset(arow(a.employee, e2.length ? e2[0].employee_name : a.employee), a.salary_component, a.amount);
		});
		Object.keys(amap).forEach(function(emp) { h += allow_row(emp, amap[emp], (d.ot_locked || {})[emp]); });
		h += '<tr class="total"><td class="l">TOTAL ALLOWANCES</td><td id="tot-ah"></td><td id="tot-at"></td><td id="tot-ae"></td><td id="tot-ao"></td><td id="tot-aa"></td></tr>';
		h += '</tbody></table>' +
			'<button class="btn btn-xs btn-default dds-add" id="add-allow">+ Add employee</button>';
		h += '</div>';

		var tabs = [['hires', 'A \u00b7 Pro-Ration',
				(d.new_hires || []).length + count_rows(h, 'dds-prorate')],
			['basics', 'B \u00b7 Basic Salaries', (d.basics || []).length],
			['loans', '1 \u00b7 Loans', (d.loans || []).length],
			['adv', '2 \u00b7 Advances', count_rows(h, 'dds-adv')],
			['abs', '3 \u00b7 Absences', count_rows(h, 'dds-abs')],
			['allow', '4 \u00b7 Allowances & OT', count_rows(h, 'dds-allow')]];
		var tb = '<div class="dds-tabs">' + tabs.map(function(t) {
			return '<span class="dds-tab" data-tab="' + t[0] + '">' + t[1] +
				(t[2] !== null ? '<span class="cnt">(' + t[2] + ')</span>' : '') + '</span>';
		}).join('') + '</div>';
		h = tb + h;

		holder.html(h);
		var active = state.tab || 'hires';
		holder.find('.dds-tab[data-tab="' + active + '"]').addClass('active');
		holder.find('.dds-pane[data-pane="' + active + '"]').addClass('active');
		holder.find('.dds-tab').on('click', function() {
			state.tab = $(this).data('tab');
			holder.find('.dds-tab, .dds-pane').removeClass('active');
			$(this).addClass('active');
			holder.find('.dds-pane[data-pane="' + state.tab + '"]').addClass('active');
		});
		holder.find('.dds-filter').on('input', function() {
			var f = ($(this).val() || '').toLowerCase();
			var pane = holder.find('.dds-pane[data-pane="' + $(this).data('pane') + '"]');
			pane.find('table tbody tr').each(function() {
				if ($(this).hasClass('total')) return;   // totals always stay visible
				$(this).toggle(!f || $(this).text().toLowerCase().indexOf(f) > -1);
			});
		});
		holder.find('.dds-sign').on('click', function() {
			var sec = $(this).data('sec');
			frappe.confirm('Mark "' + sec + '" as reviewed for ' + state.month +
				'?<br><br>This is your name against these figures. The app records the totals as they stand now - if they change afterwards the sign-off reopens by itself.',
				function() {
					frappe.call({ method: 'bgl_ops.api.signoff_set',
						args: { month: state.month, section: sec }, freeze: true,
						callback: function() {
							frappe.show_alert({ message: sec + ' marked reviewed.', indicator: 'green' });
							load_sheet();
						} });
				});
		});
		holder.find('.dds-reopen').on('click', function() {
			var sec = $(this).data('sec');
			frappe.call({ method: 'bgl_ops.api.signoff_clear',
				args: { month: state.month, section: sec }, freeze: true,
				callback: function() {
					frappe.show_alert({ message: sec + ' reopened.', indicator: 'orange' });
					load_sheet();
				} });
		});
		holder.find('input').on('input', function() { $(this).addClass('dirty'); totals(); });
		holder.find('#add-loan').on('click', add_loan);
		holder.find('#add-adv').on('click', function() { add_person('adv'); });
		holder.find('#add-prorate').on('click', function() { add_person('prorate'); });
		holder.find('#add-abs').on('click', function() { add_person('abs'); });
		holder.find('#add-allow').on('click', function() { add_person('allow'); });
		holder.find('.dds-rm').on('click', function() {
			var tr = $(this).closest('tr');
			var removed = tr.toggleClass('dds-removed').hasClass('dds-removed');
			tr.find('input').prop('disabled', removed).css('opacity', removed ? .35 : 1);
			if (removed) { tr.find('input').each(function() { $(this).data('prev', $(this).val()).val(0); }); }
			else { tr.find('input').each(function() { $(this).val($(this).data('prev') || 0); }); }
			tr.css('text-decoration', removed ? 'line-through' : 'none');
			totals();
		});
		totals();
	}

	function allow_row(emp, r, locked) {
		function cell(cls, v) { return '<td><input type="number" min="0" step="0.01" class="' + cls + '" value="' + flt(v, 2) + '"></td>'; }
		return '<tr data-emp="' + emp + '"><td class="l">' + r.name + '</td>' +
			cell('al-h', r.housing) + cell('al-t', r.transport) + cell('al-e', r.eda) +
			(locked ? '<td class="text-muted" style="text-align:center">Trips/Cubic - locked</td>' : cell('al-o', r.ota)) +
			'<td class="al-tot">-</td></tr>';
	}

	function rm_cell() {
		return '<td class="dds-rm" title="Remove from this month (sets 0; saving removes any draft)" style="cursor:pointer;color:var(--red-500);font-weight:800;width:26px;text-align:center">&times;</td>';
	}

	function adv_row(emp, name, last, val) {
		return '<tr data-emp="' + emp + '"><td class="l">' + name + '</td><td>' + last + '</td>' +
			'<td><input type="number" min="0" step="0.01" class="da-amt" value="' + flt(val, 2) + '"></td>' + rm_cell() + '</tr>';
	}

	function prorate_row(emp, name, days, full) {
		return '<tr data-emp="' + emp + '"><td class="l">' + name + '</td>' +
			'<td><input type="number" min="0" max="22" step="0.5" class="pr-days" value="' + flt(days || 0) + '"></td>' +
			'<td><input type="number" min="0" step="0.01" class="pr-full" value="' + (full || '') + '" placeholder="full salary"></td>' +
			'<td class="pr-ded">-</td><td class="pr-pay">-</td>' + rm_cell() + '</tr>';
	}

	function abs_row(emp, name, days) {
		return '<tr data-emp="' + emp + '"><td class="l">' + name + '</td>' +
			'<td><input type="number" min="0" step="0.5" class="db-days" value="' + flt(days) + '"></td>' +
			'<td class="est"></td>' + rm_cell() + '</tr>';
	}

	function add_loan() {
		var d = state.data;
		var opts = (d.employees || []).map(function(e) { return e.name + ': ' + e.employee_name; });
		frappe.prompt([
			{ fieldname: 'emp', label: 'Employee', fieldtype: 'Select', options: opts.join('\n'), reqd: 1 },
			{ fieldname: 'loan_type', label: 'Type', fieldtype: 'Select', options: 'Loan\nOther', default: 'Loan' },
			{ fieldname: 'principal', label: 'Principal (GHS)', fieldtype: 'Currency', reqd: 1 },
			{ fieldname: 'expected_monthly', label: 'Agreed monthly installment (GHS)', fieldtype: 'Currency' },
			{ fieldname: 'date_taken', label: 'Date taken', fieldtype: 'Date', default: frappe.datetime.get_today() },
			{ fieldname: 'reason', label: 'Reason', fieldtype: 'Small Text' }
		], function(v) {
			frappe.call({
				method: 'bgl_ops.api.loan_create',
				args: { employee: v.emp.split(':')[0].trim(), principal: v.principal,
					expected_monthly: v.expected_monthly, loan_type: v.loan_type,
					date_taken: v.date_taken, reason: v.reason },
				freeze: true,
				callback: function(r) {
					frappe.show_alert({ message: 'Loan ' + r.message.name + ' recorded for ' + r.message.employee_name + '. Next: its installment now appears on this sheet - adjust if needed, then Save Prep Sheet.', indicator: 'green' });
					load_sheet();
				}
			});
		}, 'Record a new loan / advance', 'Create');
	}

	function add_person(kind) {
		var d = state.data;
		var opts = (d.employees || []).map(function(e) { return e.name + ': ' + e.employee_name; });
		frappe.prompt([{
			fieldname: 'emp', label: 'Employee', fieldtype: 'Select', options: opts.join('\n'), reqd: 1
		}], function(v) {
			var emp = v.emp.split(':')[0].trim();
			var name = v.emp.split(':').slice(1).join(':').trim();
			var tb = holder.find(kind === 'adv' ? '#dds-adv tbody' :
				(kind === 'allow' ? '#dds-allow tbody' :
				(kind === 'prorate' ? '#dds-prorate tbody' : '#dds-abs tbody')));
			var row = kind === 'adv' ? adv_row(emp, name, '-', 0) :
				(kind === 'allow' ? allow_row(emp, { name: name, housing: 0, transport: 0, eda: 0, ota: 0 }, (state.data.ot_locked || {})[emp]) :
				(kind === 'prorate' ? prorate_row(emp, name, 0, (state.data.bases || {})[emp] || '') : abs_row(emp, name, 0)));
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
		var tnhd = 0, tnhb = 0, tnhp = 0;
		holder.find('#dds-hires tbody tr[data-emp]').each(function() {
			var days = flt($(this).find('input.nh-days').val());
			var basic = flt($(this).find('input.nh-basic').val());
			var pay = basic > 0 ? basic * Math.min(days, 22) / 22 : 0;
			tnhd += days; tnhb += basic; tnhp += pay;
			$(this).find('td.nh-pay').text(basic > 0 ? fmt(pay) : '-');
		});
		holder.find('#tot-nh-days').text(tnhd ? tnhd + ' days' : '');
		holder.find('#tot-nh-basic').text(tnhb ? fmt(tnhb) : '');
		holder.find('#tot-nh').text(tnhp ? 'GHS ' + fmt(tnhp) : '');
		// basic salaries: what payroll will use now, and what a correction moves it to
		var tbc = 0, tbn = 0;
		holder.find('#dds-basics tbody tr[data-emp]').each(function() {
			var cur = flt(($(this).find('td').eq(2).text() || '').replace(/,/g, ''));
			var nw = flt($(this).find('input.bs-new').val());
			tbc += cur; tbn += (nw > 0 ? nw : cur);
		});
		holder.find('#tot-bs-cur').text(tbc ? fmt(tbc) : '');
		holder.find('#tot-bs-new').text(tbn ? fmt(tbn) : '');
		var pd = 0, pf = 0, pdd = 0, pp = 0;
		holder.find('#dds-prorate tbody tr[data-emp]').each(function() {
			var days = Math.min(flt($(this).find('input.pr-days').val()), 22);
			var full = flt($(this).find('input.pr-full').val());
			var ded = full > 0 && days > 0 ? full * (22 - days) / 22 : 0;
			var pay = full > 0 && days > 0 ? full - ded : 0;
			pd += days; pf += full; pdd += ded; pp += pay;
			$(this).find('td.pr-ded').text(ded ? fmt(ded) : '-');
			$(this).find('td.pr-pay').text(pay ? fmt(pay) : '-');
		});
		holder.find('#tot-pr-days').text(pd ? pd + ' days' : '');
		holder.find('#tot-pr-full').text(pf ? fmt(pf) : '');
		holder.find('#tot-pr-ded').text(pdd ? fmt(pdd) : '');
		holder.find('#tot-pr-pay').text(pp ? 'GHS ' + fmt(pp) : '');

		var th = 0, tt = 0, te = 0, to2 = 0, taa = 0;
		holder.find('#dds-allow tbody tr[data-emp]').each(function() {
			var vh = flt($(this).find('input.al-h').val()), vt = flt($(this).find('input.al-t').val());
			var ve = flt($(this).find('input.al-e').val()), vo = flt($(this).find('input.al-o').val());
			th += vh; tt += vt; te += ve; to2 += vo;
			var rt = vh + vt + ve + vo; taa += rt;
			$(this).find('td.al-tot').text(fmt(rt));
		});
		holder.find('#tot-ah').text(fmt(th)); holder.find('#tot-at').text(fmt(tt));
		holder.find('#tot-ae').text(fmt(te)); holder.find('#tot-ao').text(fmt(to2));
		holder.find('#tot-aa').text('GHS ' + fmt(taa));
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
		var new_hires = [], allowances = [];
		holder.find('#dds-hires tbody tr[data-emp]').each(function() {
			new_hires.push({ employee: $(this).data('emp'),
				actual_basic: flt($(this).find('input.nh-basic').val()),
				days: flt($(this).find('input.nh-days').val()) });
		});
		holder.find('#dds-allow tbody tr[data-emp]').each(function() {
			var r = { employee: $(this).data('emp'),
				housing: flt($(this).find('input.al-h').val()),
				transport: flt($(this).find('input.al-t').val()),
				eda: flt($(this).find('input.al-e').val()) };
			if ($(this).find('input.al-o').length) r.ota = flt($(this).find('input.al-o').val());
			allowances.push(r);
		});
		var prorations = [];
		holder.find('#dds-prorate tbody tr[data-emp]').each(function() {
			var days = flt($(this).find('input.pr-days').val());
			var full = flt($(this).find('input.pr-full').val());
			if (days > 0 && full > 0) {
				prorations.push({ employee: $(this).data('emp'), days: days, full_salary: full });
			}
		});
		var basics = [];
		holder.find('#dds-basics tbody tr[data-emp]').each(function() {
			var v = flt($(this).find('input.bs-new').val());
			if (v > 0) basics.push({ employee: $(this).data('emp'), new_base: v });
		});
		return { loans: loans, advances: advances, absences: absences, new_hires: new_hires,
			allowances: allowances, basics: basics, prorations: prorations };
	}

	function save_all() {
		if (!state.data) { frappe.msgprint('Load a sheet first.'); return; }
		var c = collect();
		frappe.confirm(
			'Save the ' + state.month + ' payroll prep sheet?<br><br>Loan rows write ledger repayments + draft "Loans" deductions; advances become draft "Salary Advance" deductions; absent days become draft "Absent" deductions with the amount computed for you ((days/22) x Basic). All drafts are dated to month-end for HR review - <b>Payroll Entry still runs afterwards</b>.',
			function() {
				frappe.call({
					method: 'bgl_ops.api.deduction_save',
					args: { month: state.month, loans: JSON.stringify(c.loans),
						advances: JSON.stringify(c.advances), absences: JSON.stringify(c.absences),
						new_hires: JSON.stringify(c.new_hires), allowances: JSON.stringify(c.allowances),
						basics: JSON.stringify(c.basics),
						prorations: JSON.stringify(c.prorations) },
					freeze: true, freeze_message: 'Saving deductions...',
					callback: function(r) {
						var m = r.message;
						var msg = 'Saved: ' + m.loans + ' loan(s), ' + m.advances + ' advance(s), ' + m.absences +
							' absence(s), ' + m.new_hires + ' new hire proration(s), ' +
							(m.prorations || 0) + ' part month proration(s), ' + m.allowances + ' allowance(s). Next: review + submit the drafts under Additional Salary, then run Payroll Entry.';
						if (m.ssa_created && m.ssa_created.length) msg += ' Salary assignments created: ' + m.ssa_created.join('; ') + '.';
						if (m.basics_changed && m.basics_changed.length) msg += ' Basic salary corrected: ' + m.basics_changed.join('; ') + '.';
						if (m.cleared.length) msg += ' Loans cleared: ' + m.cleared.join(', ') + '.';
						frappe.show_alert({ message: msg, indicator: m.errors.length ? 'orange' : 'green' });
						if ((m.skipped || []).length) frappe.msgprint({
							title: 'Left out on purpose',
							indicator: 'orange',
							message: 'These rows were not saved. Nothing is wrong - the sheet simply will not write pay for someone who has left, or overwrite something already submitted.<br><br>' +
								m.skipped.join('<br>') });
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
					var v = 0;
					if (sel === '#dds-loans') v = flt($(this).find('input.dl-amt').val());
					else if (sel === '#dds-allow' || sel === '#dds-hires') {
						$(this).find('input').each(function() { v += flt($(this).val()); });
					}
					else v = flt($(this).find('input').first().val());
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
		h += table_from('#dds-hires', 'A. New Hire Pro-Ration', ['New hire', 'Joined', 'Days', 'Actual basic', 'This month pays']);
		h += table_from('#dds-prorate', 'A. Existing Staff Pro-Ration', ['Employee', 'Days worked', 'Full salary', 'Deducted', 'This month pays']);
		h += table_from('#dds-loans', '1. Loans', ['Employee', 'Principal', 'Repaid', 'Balance', 'Installment', 'Deduct', 'After']);
		h += table_from('#dds-adv', '2. Salary Advances', ['Employee', 'Last month', 'Deduct']);
		h += table_from('#dds-abs', '3. Absent Days', ['Employee', 'Days', 'Est. deduction']);
		h += table_from('#dds-allow', '4. Fixed Allowances and Overtime', ['Employee', 'Housing', 'Transport', 'Extra Duty', 'Fixed OT', 'Total']);
		h += '<div class="sig">APPROVED BY MANAGING DIRECTOR .................................................................</div>';
		h += '</body></html>';
		var w = window.open('', '_blank');
		w.document.write(h); w.document.close();
		setTimeout(function() { w.print(); }, 400);
	}
};
