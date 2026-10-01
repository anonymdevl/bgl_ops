frappe.pages['takehome-solver'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({ parent: wrapper,
		title: 'Take-Home Solver', single_column: true });
	var body = $('<div style="margin:10px 20px 40px;max-width:860px"></div>').appendTo(page.main);
	page.add_inner_button('Set / Correct Salary', function() { salary_wizard(); });
	page.add_inner_button('Employee Leaving', function() { leaving_wizard(); });
	page.add_inner_button('PAYE Correction Sweep', function() { paye_sweep(); });

	function paye_sweep() {
		var month = g.find('#th-month').val();
		var label = g.find('#th-month option:selected').text();
		var d = new frappe.ui.Dialog({
			title: 'PAYE Correction Sweep - ' + label,
			size: 'extra-large',
			fields: [{ fieldname: 'body', fieldtype: 'HTML' }],
			primary_action_label: 'Apply to selected',
			primary_action: function() {
				var picked = [];
				d.$wrapper.find('.pcs-pick:checked').each(function() {
					picked.push($(this).data('emp'));
				});
				if (!picked.length) { frappe.msgprint('Nothing ticked.'); return; }
				var n_basic = d.$wrapper.find('.pcs-pick:checked').filter(function() {
					return $(this).data('plan') === 'basic'; }).length;
				frappe.confirm(
					'Hold the OLD base take-home for <b>' + picked.length +
					'</b> employee(s)? Each package is re-solved under the live ' +
					'tax slab exactly as the Suggested fix column shows, and each ' +
					'draft slip is rebuilt. The company absorbs the PAYE difference ' +
					'from now on.' +
					(n_basic ? '<br><br><b>' + n_basic + '</b> of them change BASIC ' +
						'salary (they have no allowances to carry the correction), ' +
						'which also moves SSNIT - theirs and the employer 13% share.' : ''),
					function() {
						frappe.call({ method: 'bgl_ops.api.paye_sweep_apply_all',
							args: { month: month, employees: picked },
							freeze: true, freeze_message: 'Re-solving ' + picked.length + ' package(s)...',
							callback: function(r) {
								var m = r.message || {};
								var h = (m.done || []).length + ' adjusted.';
								if ((m.failed || []).length)
									h += '<br><br><b>Could not adjust:</b><br>' + m.failed.map(function(f) {
										return f.employee + ': ' + frappe.utils.escape_html(String(f.error).slice(0, 160));
									}).join('<br>');
								frappe.msgprint({ title: 'Sweep finished', indicator: (m.failed || []).length ? 'orange' : 'green', message: h });
								load_rows();
							} });
					});
			}
		});
		function fmtn(v) { return format_number(v, null, 2); }
		function load_rows() {
			d.fields_dict.body.$wrapper.html('<div style="padding:30px;text-align:center;color:var(--text-muted)">Comparing every draft slip against the old tax bands...</div>');
			frappe.call({ method: 'bgl_ops.api.paye_sweep', args: { month: month },
				callback: function(r) {
					var m = r.message || {};
					if (m.same_slab) {
						d.fields_dict.body.$wrapper.html('<div style="padding:24px">The live tax slab matches the old bands - there is nothing to correct.</div>');
						return;
					}
					if (!(m.rows || []).length) {
						d.fields_dict.body.$wrapper.html('<div style="padding:24px">No draft slip moved. Either payroll has not been drafted for ' + label + ' yet (run it from Review &amp; Approve first), or every package already nets the same.</div>');
						return;
					}
					var fixable = m.rows.filter(function(x) { return !x.skip; });
					var h = '<div style="font-size:12.5px;margin-bottom:8px;color:var(--text-muted)">' +
						'<b>Agreed figure</b> is what this package paid under the old PAYE bands - the number management promised. ' +
						'<b>Draft slip now</b> is what the new bands pay. <b>Suggested fix</b> is the exact change that restores the agreed figure: ' +
						'usually the allowance pool, or a corrected BASIC when there are no allowances to carry it. ' +
						'Ticked rows are applied as suggested; the company absorbs the difference. ' +
						'Rows in grey cannot be auto-adjusted - the note says which tool to use.</div>' +
						'<table class="table table-sm" style="font-size:12.5px"><thead><tr>' +
						'<th><input type="checkbox" id="pcs-all" checked></th><th>Employee</th>' +
						'<th style="text-align:right">Basic</th><th style="text-align:right">Allowances</th>' +
						'<th style="text-align:right">Agreed figure</th><th style="text-align:right">Draft slip now</th>' +
						'<th style="text-align:right">Difference</th><th>Suggested fix</th><th>Note</th></tr></thead><tbody>';
					m.rows.forEach(function(x) {
						var col = x.delta > 0 ? 'var(--red-500)' : 'var(--green-600)';
						var fix = '';
						if (!x.skip && x.plan === 'allowances')
							fix = 'allowances ' + fmtn(x.allowances) + ' &rarr; <b>' + fmtn(x.suggested_allowances) + '</b>';
						else if (!x.skip && x.plan === 'basic')
							fix = '<span style="color:var(--orange-500)">basic ' + fmtn(x.basic) + ' &rarr; <b>' + fmtn(x.suggested_basic) + '</b></span>';
						h += '<tr' + (x.skip ? ' style="opacity:.5"' : '') + '>' +
							'<td>' + (x.skip ? '' : '<input type="checkbox" class="pcs-pick" data-emp="' + x.employee + '" data-plan="' + (x.plan || '') + '" checked>') + '</td>' +
							'<td>' + frappe.utils.escape_html(x.employee_name) + '</td>' +
							'<td style="text-align:right">' + fmtn(x.basic) + '</td>' +
							'<td style="text-align:right">' + fmtn(x.allowances) + '</td>' +
							'<td style="text-align:right;font-weight:700">' + fmtn(x.old_net) + '</td>' +
							'<td style="text-align:right">' + fmtn(x.new_net) + '</td>' +
							'<td style="text-align:right;color:' + col + ';font-weight:700">' +
								(x.delta > 0 ? 'short ' : 'over ') + fmtn(Math.abs(x.delta)) + '</td>' +
							'<td style="font-size:11.5px">' + fix + '</td>' +
							'<td style="font-size:11.5px;color:var(--text-muted)">' + frappe.utils.escape_html(x.skip || '') + '</td></tr>';
					});
					h += '</tbody></table>' +
						'<div style="font-size:12px;color:var(--text-muted)">' + fixable.length + ' of ' + m.rows.length + ' can be adjusted here. Untick anyone management wants left on the new-band figure (e.g. people whose tax went DOWN).</div>';
					d.fields_dict.body.$wrapper.html(h);
					d.$wrapper.find('#pcs-all').on('change', function() {
						d.$wrapper.find('.pcs-pick').prop('checked', this.checked);
					});
				} });
		}
		d.show();
		load_rows();
	}

	function salary_wizard() {
		var month = g.find('#th-month').val();
		var label = g.find('#th-month option:selected').text();
		var d = new frappe.ui.Dialog({
			title: 'Set / Correct Salary - ' + label,
			fields: [
				{ fieldname: 'employee', label: 'Employee', fieldtype: 'Link',
					options: 'Employee', reqd: 1, default: emp.get_value() || undefined,
					get_query: function() { return { filters: { status: 'Active' } }; } },
				{ fieldname: 'basic', label: 'Agreed BASIC salary (GHS)',
					fieldtype: 'Float', reqd: 1 },
				{ fieldname: 'take_home', label: 'Agreed TAKE-HOME (GHS)',
					fieldtype: 'Float', reqd: 1,
					description: 'The full monthly package: basic + allowances after taxes, BEFORE trips/cubic and before advances, loans or absences.' },
				{ fieldname: 'note', fieldtype: 'HTML',
					options: '<div style="font-size:12px;color:var(--text-muted)">Type the two numbers management agreed. The wizard works out the allowance split, replaces any wrong salary assignment, and fixes the part-month pro-ration for new joiners - nothing else to fill.</div>' }
			],
			primary_action_label: 'Preview',
			primary_action: function(v) {
				frappe.call({ method: 'bgl_ops.api.set_salary',
					args: { employee: v.employee, month: month, basic: v.basic,
						take_home: v.take_home, dry_run: 1 },
					freeze: true,
					callback: function(r) {
						var m = r.message;
						var fmt = function(x) { return format_number(x, null, 2); };
						var msg = '<b>' + m.employee_name + '</b> - ' + label +
							'<table class="table table-sm" style="font-size:12.5px;margin-top:8px">' +
							'<tr><td>Basic salary</td><td style="text-align:right">' + fmt(m.basic) + '</td></tr>' +
							'<tr><td>Housing / Transport / Extra Duty</td><td style="text-align:right">' +
								fmt(m.housing) + ' / ' + fmt(m.transport) + ' / ' + fmt(m.eda) + '</td></tr>' +
							'<tr><td><b>Full monthly take-home</b></td><td style="text-align:right"><b>' + fmt(m.full_net) + '</b></td></tr>' +
							(m.proration_amount != null
								? '<tr><td>New joiner: paid ' + m.days + ' of 22 days, basic prorated to</td>' +
									'<td style="text-align:right">' + fmt(m.proration_amount) + '</td></tr>' +
									'<tr><td><b>This month\u2019s base pay (before trips/deductions)</b></td>' +
									'<td style="text-align:right"><b>' + fmt(m.month_cash) + '</b></td></tr>'
								: '') +
							'</table>' +
							((m.will_replace_ssa || []).length
								? '<div style="font-size:12px;color:#b7791f">Replaces existing salary assignment: ' +
									m.will_replace_ssa.map(function(x) { return 'base ' + fmt(x.base) + ' from ' + x.from_date; }).join(', ') + '</div>'
								: '');
						frappe.confirm(msg, function() {
							frappe.call({ method: 'bgl_ops.api.set_salary',
								args: { employee: v.employee, month: month, basic: v.basic,
									take_home: v.take_home, dry_run: 0 },
								freeze: true, freeze_message: 'Applying...',
								callback: function(r2) {
									d.hide();
									frappe.msgprint({ title: 'Salary set', indicator: 'green',
										message: r2.message.employee_name + ' is set: basic ' +
											fmt(r2.message.basic) + ', take-home ' + fmt(r2.message.full_net) +
											'. The prep sheet and payroll will pick it up automatically.' });
								} });
						});
					} });
			}
		});
		d.show();
	}

	function leaving_wizard() {
		var d = new frappe.ui.Dialog({
			title: 'Employee Leaving',
			size: 'large',
			fields: [
				{ fieldname: 'employee', label: 'Employee', fieldtype: 'Link',
					options: 'Employee', reqd: 1, default: emp.get_value() || undefined,
					get_query: function() { return { filters: { status: ['in', ['Active', 'Inactive']] } }; },
					description: 'Inactive people are listed too, so a leaver deactivated by hand can still be cleaned up here.' },
				{ fieldname: 'relieving_date', label: 'Last working day',
					fieldtype: 'Date', reqd: 1, default: frappe.datetime.get_today() },
				{ fieldname: 'loan_action', label: 'Outstanding loan becomes',
					fieldtype: 'Select', options: 'Written Off\nFully Paid',
					default: 'Written Off', depends_on: 'eval:doc.__has_loans' },
				{ fieldname: 'body', fieldtype: 'HTML' }
			],
			primary_action_label: 'Deactivate Employee',
			primary_action: function(v) {
				frappe.confirm(
					'Deactivate <b>' + (d.__preview ? d.__preview.employee_name : v.employee) +
					'</b>? Their unpaid pay items will be removed, any active loan marked <b>' +
					(v.loan_action || 'Written Off') + '</b>, and payroll will exclude them from now on.',
					function() {
						frappe.call({ method: 'bgl_ops.api.offboard_apply',
							args: { employee: v.employee, relieving_date: v.relieving_date,
								loan_action: v.loan_action || 'Written Off' },
							freeze: true, freeze_message: 'Offboarding...',
							callback: function(r) {
								d.hide();
								frappe.msgprint({ title: 'Done', indicator: 'green',
									message: r.message.employee_name + ' is now Inactive.<br><br>' +
										r.message.made.map(function(x) { return '&bull; ' + frappe.utils.escape_html(x); }).join('<br>') });
							} });
					});
			}
		});
		function load_preview() {
			var empv = d.get_value('employee');
			if (!empv) return;
			frappe.call({ method: 'bgl_ops.api.offboard_preview',
				args: { employee: empv },
				callback: function(r) {
					var m = r.message; d.__preview = m;
					d.doc.__has_loans = (m.loans || []).length ? 1 : 0;
					d.refresh();
					var fmt = function(x) { return format_number(x, null, 2); };
					var h = '<div style="font-size:12.5px">';
					h += m.last_slip
						? '<div>&#x2705; Last submitted slip: <b>' + m.last_slip.name + '</b> (net ' + fmt(m.last_slip.net_pay) + ')</div>'
						: '<div>&#x26A0;&#xFE0F; No submitted salary slip on record.</div>';
					if ((m.draft_slips || []).length)
						h += '<div style="color:#c0392b">&#x274C; DRAFT slip exists (' +
							m.draft_slips.map(function(x) { return x.name; }).join(', ') +
							') - settle their final pay first. The wizard will refuse until then.</div>';
					if ((m.pending_ads || []).length) {
						h += '<div style="margin-top:6px"><b>Unpaid pay items that will be removed:</b></div>';
						m.pending_ads.forEach(function(a) {
							h += '<div>&bull; ' + a.salary_component + ' ' + fmt(a.amount) + ' (' + a.payroll_date + ')</div>';
						});
					}
					if ((m.loans || []).length) {
						h += '<div style="margin-top:6px"><b>Active loans:</b></div>';
						m.loans.forEach(function(l) {
							h += '<div>&bull; ' + l.name + ': taken ' + fmt(l.principal) +
								', repaid ' + fmt(l.repaid) + ', <b>balance ' + fmt(l.balance) + '</b></div>';
						});
					} else {
						h += '<div style="margin-top:6px">No active loans.</div>';
					}
					h += '</div>';
					d.fields_dict.body.$wrapper.html(h);
				} });
		}
		d.fields_dict.employee.$input.on('change', function() { setTimeout(load_preview, 400); });
		d.show();
		if (emp.get_value()) setTimeout(load_preview, 400);
	}
	$('<style>\
		.ths-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}\
		.ths-grid label{font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px}\
		.ths-grid input,.ths-grid select{width:100%}\
		.ths-out{border:1px solid var(--border-color);border-radius:12px;padding:14px 18px;margin-top:14px;background:var(--fg-color)}\
		.ths-out table{width:100%;border-collapse:collapse;font-size:13px}\
		.ths-out td{padding:5px 8px;border-bottom:1px solid var(--border-color)}\
		.ths-out td:last-child{text-align:right;font-weight:600}\
		.ths-hit{color:var(--green-600);font-weight:700}.ths-miss{color:var(--orange-500);font-weight:700}\
		.ths-note{font-size:12px;color:var(--text-muted);margin-top:8px}\
	</style>').appendTo(body);
	body.append('<p style="font-size:13px;color:var(--text-muted)">Management agrees a take-home; this screen works the payroll backwards. Pick what the system should solve <b>for</b>, press Solve, check the slip math, To make it real, use the buttons above: <b>Set / Correct Salary</b> applies a package (fixing wrong assignments and new-joiner pro-ration automatically), and <b>Employee Leaving</b> retires someone safely - final-pay check, unpaid items, loan settlement, deactivation. The &#402;x button on the Payroll Prep sheet does the same salary apply from inside the sheet. Trips and cubic always ride on top, so the final slip net still varies with the month.</p>');
	var emp_wrap = $('<div style="max-width:340px"></div>').appendTo(body);
	var emp = frappe.ui.form.make_control({
		parent: emp_wrap, render_input: true,
		df: { fieldtype: 'Link', options: 'Employee', label: 'Employee',
			fieldname: 'employee', reqd: 1 } });
	function fill_months($sel) {
		var M = ['January', 'February', 'March', 'April', 'May', 'June',
			'July', 'August', 'September', 'October', 'November', 'December'];
		var n = new Date();
		for (var i = 0; i < 12; i++) {
			var d = new Date(n.getFullYear(), n.getMonth() - i, 1);
			var v = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
			$sel.append($('<option>').val(v).text(M[d.getMonth()] + ' ' + d.getFullYear()));
		}
	}
	var g = $('<div class="ths-grid">\
		<div><label>Month</label><select id="th-month"></select></div>\
		<div><label>Solve for</label><select id="th-for">\
			<option value="allowances">Allowance split (basic fixed)</option>\
			<option value="basic">Basic (allowances fixed)</option>\
			<option value="net">Nothing - just show the net</option></select></div>\
		<div><label>Agreed take-home (GHS)</label><input type="number" step="0.01" id="th-target"></div>\
		<div><label>Basic</label><input type="number" step="0.01" id="th-basic"></div>\
		<div><label>Housing</label><input type="number" step="0.01" id="th-h"></div>\
		<div><label>Transport</label><input type="number" step="0.01" id="th-t"></div>\
		<div><label>Extra Duty</label><input type="number" step="0.01" id="th-e"></div>\
		<div><label>Split % (H,T,E)</label><input id="th-split" value="40,30,30"></div>\
	</div>').appendTo(body);
	fill_months(g.find('#th-month'));
	// open on the month actually in play (same rule as the other pages):
	// the previous month for as long as its payroll is unsubmitted
	frappe.call({ method: 'bgl_ops.api.suggest_month' }).then(function(r) {
		var m = (r.message || {}).month;
		if (m && g.find('#th-month option[value="' + m + '"]').length)
			g.find('#th-month').val(m);
	});
	function set_off($cell, off) {
		var $inp = $cell.find('input,select');
		$inp.prop('disabled', off);
		$cell.css('opacity', off ? 0.45 : 1);
		$cell.attr('title', off ? 'Not used in this Solve-for mode' : '');
	}
	function update_mode() {
		var mode = g.find('#th-for').val();
		var cell = function(sel){ return g.find(sel).closest('div'); };
		// everything on by default
		['#th-target','#th-basic','#th-h','#th-t','#th-e','#th-split'].forEach(function(s){ set_off(cell(s), false); });
		if (mode === 'basic') {
			// solving Basic: allowances are the fixed inputs; Basic and Split are ignored
			set_off(cell('#th-basic'), true);
			set_off(cell('#th-split'), true);
		} else if (mode === 'allowances') {
			// solving the allowance pool: Basic + Split are the inputs; H/T/E boxes are ignored
			set_off(cell('#th-h'), true);
			set_off(cell('#th-t'), true);
			set_off(cell('#th-e'), true);
		} else {
			// just show the net: all components are inputs; target and split play no part
			set_off(cell('#th-target'), true);
			set_off(cell('#th-split'), true);
		}
	}
	g.find('#th-for').on('change', update_mode);
	update_mode();
	var out = $('<div class="ths-out" style="display:none"></div>').appendTo(body);
	var last = null;
	function args() {
		return { employee: emp.get_value(), target: g.find('#th-target').val(),
			solve_for: g.find('#th-for').val(), basic: g.find('#th-basic').val(),
			housing: g.find('#th-h').val(), transport: g.find('#th-t').val(),
			eda: g.find('#th-e').val(), split: g.find('#th-split').val() };
	}
	function fmt(v) { return format_number(v, null, 2); }
	page.set_primary_action('Solve', function() {
		frappe.call({ method: 'bgl_ops.api.solver_preview', args: args(),
			freeze: true, callback: function(r) {
				var m = last = r.message;
				var rows = '<tr><td>Basic salary</td><td>' + fmt(m.basic) + '</td></tr>' +
					'<tr><td>Housing / Transport / Extra Duty</td><td>' + fmt(m.housing) + ' / ' + fmt(m.transport) + ' / ' + fmt(m.eda) + '</td></tr>' +
					'<tr><td>Gross</td><td>' + fmt(m.gross) + '</td></tr>' +
					'<tr><td>SSNIT 5.5%</td><td>-' + fmt(m.ssnit) + '</td></tr>' +
					'<tr><td>PAYE</td><td>-' + fmt(m.paye) + '</td></tr>' +
					'<tr><td><b>Base take-home (before trips/cubic, advances, loans)</b></td><td class="' +
						(Math.abs(m.off_by || 0) <= 0.15 ? 'ths-hit' : 'ths-miss') + '">' + fmt(m.net) + '</td></tr>';
				if (m.target) rows += '<tr><td>Agreed figure / off by</td><td>' + fmt(m.target) +
					' / ' + fmt(m.off_by) + '</td></tr>';
				out.html('<table>' + rows + '</table>' +
					'<div class="ths-note">Base take-home only: variable trips/cubic add on top with their overtime tax, and advances, loans or absences come off. That is why the slip net will differ from this figure - correctly.</div>' +
					(g.find('#th-for').val() !== 'net'
						? '<button class="btn btn-sm btn-primary" style="margin-top:10px" id="th-apply">Apply this to payroll...</button>'
						: '')).show();
				out.find('#th-apply').on('click', apply_to_payroll);
			} });
	});
	function apply_to_payroll() {
		if (!last || !emp.get_value()) return;
		var m = last, month = g.find('#th-month').val();
		var mi = parseInt(month.slice(5, 7), 10) - 1;
		var M = ['January','February','March','April','May','June','July','August','September','October','November','December'];
		var label = M[mi] + ' ' + month.slice(0, 4);
		frappe.confirm(
			'Apply to <b>' + label + '</b> payroll for this employee?<br><br>' +
			'Basic <b>' + fmt(m.basic) + '</b>, Housing <b>' + fmt(m.housing) + '</b>, ' +
			'Transport <b>' + fmt(m.transport) + '</b>, Extra Duty <b>' + fmt(m.eda) + '</b>.<br><br>' +
			'This writes the salary assignment and allowance records directly and rebuilds the draft slip. ' +
			'It refuses if a SUBMITTED slip already exists for that month - the solver never edits paid history.',
			function() {
				frappe.call({ method: 'bgl_ops.api.solver_apply',
					args: { employee: emp.get_value(), month: month, basic: m.basic,
						housing: m.housing, transport: m.transport, eda: m.eda,
						note: 'Applied from Take-Home Solver (' + label + ')' },
					freeze: true, freeze_message: 'Applying to ' + label + '...',
					callback: function(r) {
						var msg = 'Applied. ';
						if (r.message && r.message.new_net != null)
							msg += 'Draft slip net for ' + label + ' is now ' + fmt(r.message.new_net) + '.';
						frappe.msgprint({ title: 'Payroll updated', indicator: 'green', message: msg });
					} });
			});
	}

};
