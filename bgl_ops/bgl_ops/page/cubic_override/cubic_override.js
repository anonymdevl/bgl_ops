frappe.pages['cubic-override'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({ parent: wrapper,
		title: 'Cubic Override', single_column: true });
	var body = $('<div style="margin:10px 20px 40px"></div>').appendTo(page.main);
	$('<style>\
		table.cov{width:100%;border-collapse:collapse;font-size:13px;background:var(--fg-color)}\
		.cov th,.cov td{padding:6px 9px;border-bottom:1px solid var(--border-color);text-align:right}\
		.cov th.l,.cov td.l{text-align:left}\
		.cov input{width:110px;text-align:right}\
		.cov .d-up{color:var(--green-600);font-weight:600}.cov .d-dn{color:var(--red-500);font-weight:600}\
	</style>').appendTo(body);
	body.append('<p style="font-size:13px;color:var(--text-muted);max-width:820px">Each driver\'s <b>trip-sheet</b> figure is what the logs say they earned; <b>on payroll</b> is what the month currently pays. When management wants someone topped up, type the figure they should receive and press Apply: one clean record is written, the draft slip rebuilds, and the Daily Trip Logs stay exactly as the drivers logged them.</p>');
	var bar = $('<div style="display:flex;gap:10px;margin:8px 0 14px;align-items:end">\
		<div><label style="font-size:11px;color:var(--text-muted);display:block">Month</label><input type="month" id="cv-month"></div>\
		<div><label style="font-size:11px;color:var(--text-muted);display:block">Site</label>\
			<select id="cv-site"><option>All</option><option>Airport</option><option>Tema</option></select></div>\
	</div>').appendTo(body);
	var now = new Date();
	bar.find('#cv-month').val(now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'));
	var holder = $('<div></div>').appendTo(body);
	function fmt(v) { return format_number(v, null, 2); }
	function load() {
		frappe.call({ method: 'bgl_ops.api.override_sheet',
			args: { month: bar.find('#cv-month').val(), site: bar.find('#cv-site').val() },
			freeze: true, callback: function(r) {
				var rows = (r.message || {}).rows || [];
				if (!rows.length) {
					holder.html('<p class="text-muted">No trip or cubic pay found for this month/site yet.</p>');
					return;
				}
				var h = '<table class="cov"><thead><tr><th class="l">Driver</th><th class="l">Component</th>' +
					'<th>Trip-sheet</th><th>On payroll</th><th>Pay instead</th><th>Change</th><th></th></tr></thead><tbody>';
				rows.forEach(function(x, i) {
					h += '<tr data-i="' + i + '"><td class="l">' + frappe.utils.escape_html(x.employee_name) +
						'<br><span style="font-size:11px;color:var(--text-muted)">' +
						frappe.utils.escape_html((x.designation || '') + ' - ' + (x.branch || '')) + '</span></td>' +
						'<td class="l">' + frappe.utils.escape_html(x.component) + '</td>' +
						'<td>' + fmt(x.sheet_total) + '</td><td>' + fmt(x.payroll_amount) + '</td>' +
						'<td><input type="number" step="0.01" class="cv-new" value="' + x.payroll_amount + '"></td>' +
						'<td class="cv-delta">-</td>' +
						'<td><button class="btn btn-xs btn-default cv-go">Apply</button></td></tr>';
				});
				holder.html(h + '</tbody></table>');
				holder.find('.cv-new').on('input', function() {
					var tr = $(this).closest('tr'), x = rows[tr.data('i')];
					var d = flt($(this).val()) - x.payroll_amount;
					tr.find('.cv-delta').html(d ? '<span class="' + (d > 0 ? 'd-up' : 'd-dn') + '">' +
						(d > 0 ? '+' : '') + fmt(d) + '</span>' : '-');
				});
				holder.find('.cv-go').on('click', function() {
					var tr = $(this).closest('tr'), x = rows[tr.data('i')];
					var amount = flt(tr.find('.cv-new').val());
					frappe.prompt({ fieldname: 'reason', fieldtype: 'Data',
						label: 'Reason (goes in the record, never on the slip)' },
						function(v) {
							frappe.call({ method: 'bgl_ops.api.override_apply',
								args: { month: bar.find('#cv-month').val(), employee: x.employee,
									component: x.component, new_amount: amount, reason: v.reason },
								freeze: true, freeze_message: 'Writing the override...',
								callback: function(r) {
									var m = r.message || {};
									frappe.show_alert({ indicator: 'green',
										message: x.employee_name + ': ' + x.component + ' now ' + fmt(m.now) +
										(m.new_net != null ? ', slip net ' + fmt(m.new_net) : '') });
									load();
								} });
						}, x.employee_name + ' - ' + fmt(amount) + ' instead of ' + fmt(x.payroll_amount), 'Apply override');
				});
			} });
	}
	page.set_primary_action('Load', load);
};
