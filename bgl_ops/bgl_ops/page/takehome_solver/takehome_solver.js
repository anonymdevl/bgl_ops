frappe.pages['takehome-solver'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({ parent: wrapper,
		title: 'Take-Home Solver', single_column: true });
	var body = $('<div style="margin:10px 20px 40px;max-width:860px"></div>').appendTo(page.main);
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
	body.append('<p style="font-size:13px;color:var(--text-muted)">Management agrees a take-home; this screen works the payroll backwards. Pick what the system should solve <b>for</b>, press Solve, check the slip math, This page is a CALCULATOR only - to put a solved figure into payroll, use the &#402;x button beside the basic on the Payroll Prep sheet, so the save and sign-off flow cover it. Trips and cubic always ride on top, so the final slip net still varies with the month.</p>');
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
			<option value="basic">Basic (allowances fixed)</option>\
			<option value="allowances">Allowance split (basic fixed)</option>\
			<option value="net">Nothing - just show the net</option></select></div>\
		<div><label>Agreed take-home (GHS)</label><input type="number" step="0.01" id="th-target"></div>\
		<div><label>Basic</label><input type="number" step="0.01" id="th-basic"></div>\
		<div><label>Housing</label><input type="number" step="0.01" id="th-h"></div>\
		<div><label>Transport</label><input type="number" step="0.01" id="th-t"></div>\
		<div><label>Extra Duty</label><input type="number" step="0.01" id="th-e"></div>\
		<div><label>Split % (H,T,E)</label><input id="th-split" value="40,30,30"></div>\
	</div>').appendTo(body);
	fill_months(g.find('#th-month'));
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
					'<div class="ths-note">Base take-home only: variable trips/cubic add on top with their overtime tax, and advances, loans or absences come off. That is why the slip net will differ from this figure - correctly.</div>').show();
			} });
	});
};
