frappe.pages['review-board'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper, title: 'Review & Approve', single_column: true
	});
	var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'];
	var state = { data: null, month: null };
	var month_field = page.add_field({
		fieldname: 'month', label: 'Month', fieldtype: 'Select',
		options: MONTHS.join('\n'), default: MONTHS[new Date().getMonth()]
	});
	function ym() {
		var mi = MONTHS.indexOf(month_field.get_value());
		var now = new Date(), y = now.getFullYear();
		if (mi > now.getMonth() + 1) y -= 1;
		return y + '-' + String(mi + 1).padStart(2, '0');
	}
	page.set_primary_action('Load', load);

	var body = $('<div style="margin:10px 20px 40px"></div>').appendTo(page.main);
	$('<style>\
		.rvb-g{border:1px solid var(--border-color);border-radius:12px;margin-bottom:12px;background:var(--fg-color);overflow:hidden}\
		.rvb-h{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer}\
		.rvb-h:hover{background:var(--subtle-fg)}\
		.rvb-h b{font-size:14px}\
		.rvb-st{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:800;flex:none}\
		.rvb-st.ok{background:rgba(47,181,111,.15);color:var(--green-600);border:1.5px solid var(--green-500)}\
		.rvb-st.no{background:rgba(232,119,107,.12);color:var(--red-500);border:1.5px solid var(--red-400)}\
		.rvb-recon{font-size:12px;margin-left:auto;text-align:right}\
		.rvb-recon.ok{color:var(--green-600)} .rvb-recon.bad{color:var(--red-500);font-weight:700}\
		.rvb-recon.info{color:var(--text-muted)}\
		.rvb-b{display:none;border-top:1px solid var(--border-color);padding:8px 16px 12px}\
		.rvb-g.open .rvb-b{display:block}\
		table.rvb-t{width:100%;border-collapse:collapse;font-size:12.5px}\
		.rvb-t td,.rvb-t th{padding:5px 8px;border-bottom:1px solid var(--border-color);text-align:right}\
		.rvb-t td.l,.rvb-t th.l{text-align:left}\
		.rvb-warn{border:1px solid var(--red-400);background:rgba(232,119,107,.06);border-radius:12px;\
			padding:12px 16px;margin-bottom:12px;font-size:13px;color:var(--red-600)}\
		.rvb-go{display:none;margin:16px 0;text-align:center}\
		.rvb-go a{display:inline-block;background:var(--green-600);color:#fff;font-weight:800;\
			padding:12px 30px;border-radius:12px;text-decoration:none;font-size:14.5px}\
	</style>').appendTo(body);
	var holder = $('<div></div>').appendTo(body);
	holder.html('<p class="text-muted" style="padding:14px">Pick a month and Load.</p>');

	function fmt(v) { return format_number(flt(v), null, 2); }

	function load() {
		state.month = ym();
		frappe.call({
			method: 'bgl_ops.api.review_board', args: { month: state.month },
			freeze: true,
			callback: function(r) { state.data = r.message; render(); }
		});
	}

	function render() {
		var d = state.data, h = '';
		if ((d.foreign || []).length)
			h += '<div class="rvb-warn"><b>Not on active staff, but have entries:</b> ' +
				d.foreign.map(function(f) { return f.employee_name || f.employee; }).join(', ') +
				'. Open <a href="/app/additional-salary">Additional Salary</a> and remove them before approving.</div>';
		if ((d.duplicates || []).length)
			h += '<div class="rvb-warn"><b>Duplicates found:</b> ' +
				d.duplicates.map(function(x) { return x.employee_name + ' / ' + x.salary_component + ' (x' + x.c + ')'; }).join(', ') + '</div>';

		Object.keys(d.groups).forEach(function(key) {
			var g = d.groups[key];
			if (!g.rows.length && !g.source) return;
			var ok = g.drafts === 0 && g.rows.length > 0;
			var recon = '';
			if (g.source !== undefined) {
				if (g.informational) {
					recon = '<span class="rvb-recon info">' + g.source_label + ': GHS ' + fmt(g.source) + '</span>';
				} else {
					var agree = Math.abs(flt(g.total) - flt(g.source)) < 0.05;
					recon = '<span class="rvb-recon ' + (agree ? 'ok' : 'bad') + '">' +
						(agree ? 'agrees with ' + g.source_label + ' &#10003;'
							: 'DIFFERS from ' + g.source_label + ': GHS ' + fmt(g.source)) + '</span>';
				}
			}
			h += '<div class="rvb-g" data-g="' + key + '"><div class="rvb-h">' +
				'<span class="rvb-st ' + (ok ? 'ok' : 'no') + '">' + (ok ? '&#10003;' : g.drafts) + '</span>' +
				'<b>' + g.label + '</b>' +
				'<span class="text-muted" style="font-size:12px">' + g.rows.length + ' entr(ies) - GHS ' + fmt(g.total) +
				(g.drafts ? ' - ' + g.drafts + ' draft(s)' : ' - all submitted') + '</span>' + recon + '</div>' +
				'<div class="rvb-b"><table class="rvb-t"><tr><th class="l">Employee</th><th class="l">Component</th><th>Amount</th><th class="l">Status</th></tr>' +
				g.rows.map(function(r) {
					return '<tr><td class="l"><a href="/app/additional-salary/' + r.name + '">' + r.employee_name + '</a></td>' +
						'<td class="l">' + r.salary_component + '</td><td>' + fmt(r.amount) + '</td>' +
						'<td class="l">' + (r.docstatus ? '<span style="color:var(--green-600)">Submitted</span>' : 'Draft') + '</td></tr>';
				}).join('') + '</table>' +
				(g.drafts ? '<button class="btn btn-sm btn-primary rvb-approve" data-g="' + key + '" style="margin-top:10px">Approve ' + g.drafts + ' draft(s)</button>' : '') +
				'</div></div>';
		});
		h += '<div class="rvb-go" ' + (d.ready ? 'style="display:block"' : '') + '>' +
			'<a href="/app/payroll-entry/new">All green - Proceed to Payroll Entry &rarr;</a></div>';
		holder.html(h);
		holder.find('.rvb-h').on('click', function() { $(this).parent().toggleClass('open'); });
		holder.find('.rvb-approve').on('click', function(e) {
			e.stopPropagation();
			var key = $(this).data('g');
			frappe.confirm('Approve and SUBMIT all drafts in "' + state.data.groups[key].label + '"? They become live payroll entries.',
				function() {
					frappe.call({
						method: 'bgl_ops.api.approve_group',
						args: { month: state.month, group: key }, freeze: true,
						callback: function(r) {
							frappe.show_alert({ message: r.message.approved + ' entr(ies) approved. Next: approve the remaining groups, then Payroll Entry.', indicator: 'green' });
							if (r.message.errors.length) frappe.msgprint(r.message.errors.join('<br>'));
							load();
						}
					});
				});
		});
	}
};
