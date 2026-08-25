frappe.pages['trip-log-sheet'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Trip Log Sheet',
		single_column: true
	});

	var state = { sheet: null, dirty: {}, trucks: {} };

	var site_field = page.add_field({
		fieldname: 'site', label: 'Site', fieldtype: 'Select',
		options: 'Airport\nTema', default: 'Airport'
	});
	var month_field = page.add_field({
		fieldname: 'month', label: 'Month', fieldtype: 'Data',
		default: frappe.datetime.now_date().substring(0, 7)
	});

	page.set_primary_action('Load Sheet', load_sheet);
	var save_btn = page.set_secondary_action('Save Drafts', save_drafts);
	page.add_inner_button('Submit Month (lock)', submit_month);
	page.add_inner_button('Print Sheet', print_sheet);

	var body = $('<div class="tls-body"></div>').appendTo(page.main);
	$('<style>\
		.tls-body{margin-top:10px}\
		.tls-scroll{overflow:auto;max-height:70vh;border:1px solid var(--border-color);border-radius:8px}\
		table.tls{border-collapse:separate;border-spacing:0;font-size:12px;width:max-content;min-width:100%}\
		.tls th,.tls td{border-bottom:1px solid var(--border-color);border-right:1px solid var(--border-color);padding:0;background:var(--fg-color)}\
		.tls thead th{position:sticky;top:0;z-index:3;background:var(--subtle-fg);padding:6px;text-align:center;font-size:11px}\
		.tls thead th.sat{color:var(--orange-500)} .tls thead th.sun{color:var(--red-500)}\
		.tls td.emp,.tls th.emp{position:sticky;left:0;z-index:2;min-width:200px;padding:5px 10px;font-weight:600}\
		.tls thead th.emp{z-index:4;text-align:left}\
		.tls td.trk,.tls th.trk{position:sticky;left:200px;z-index:2;min-width:86px}\
		.tls thead th.trk{z-index:4}\
		.tls .grp{color:var(--text-muted);font-size:10.5px;font-weight:400}\
		.tls input.q{width:46px;border:none;background:transparent;text-align:center;padding:6px 2px;outline:none;color:var(--text-color)}\
		.tls input.q:focus{background:var(--yellow-100)}\
		.tls input.q.dirty{background:var(--yellow-200)}\
		.tls input.q:disabled{color:var(--green-600);font-weight:700}\
		.tls input.trkin{width:78px;border:none;background:transparent;padding:6px;outline:none;color:var(--blue-500)}\
		.tls td.tot{font-weight:700;text-align:center;padding:5px 8px;color:var(--orange-500)}\
	</style>').appendTo(body);
	var msg = $('<div class="text-muted" style="margin:8px 0">Pick a site and month, then Load Sheet. Saturdays are amber, Sundays red. Green cells are submitted and locked.</div>').appendTo(body);
	var holder = $('<div class="tls-scroll"></div>').appendTo(body);

	function load_sheet() {
		state.dirty = {}; state.trucks = {};
		frappe.call({
			method: 'bgl_ops.api.bulk_sheet',
			args: { site: site_field.get_value(), month: month_field.get_value() },
			freeze: true,
			callback: function(r) {
				state.sheet = r.message;
				render(r.message);
				msg.text(r.message.employees.length + ' employees | ' + r.message.site + ' ' + r.message.month);
			}
		});
	}

	function render(d) {
		var sat = {}, sun = {};
		(d.saturdays || []).forEach(function(x) { sat[x] = 1; });
		(d.sundays || []).forEach(function(x) { sun[x] = 1; });
		var h = '<table class="tls"><thead><tr><th class="emp">Driver / Operator</th><th class="trk">Vehicle</th>';
		for (var i = 1; i <= d.days; i++) {
			h += '<th class="' + (sat[i] ? 'sat' : (sun[i] ? 'sun' : '')) + '">' + i + '</th>';
		}
		h += '<th>Total</th></tr></thead><tbody>';
		d.employees.forEach(function(e) {
			var row = (d.grid || {})[e.name] || {}, tot = 0;
			h += '<tr><td class="emp">' + frappe.utils.escape_html(e.employee_name) +
				'<div class="grp">' + frappe.utils.escape_html(e.designation) + '</div></td>';
			h += '<td class="trk"><input class="trkin" data-emp="' + e.name + '" value="' +
				frappe.utils.escape_html(e.truck_no || '') + '" placeholder="-"></td>';
			for (var day = 1; day <= d.days; day++) {
				var cell = row[String(day)];
				if (cell) tot += cell.qty;
				h += '<td><input class="q" data-emp="' + e.name + '" data-day="' + day +
					'" value="' + (cell ? cell.qty : '') + '"' +
					(cell && cell.submitted ? ' disabled title="Submitted - locked"' : '') + '></td>';
			}
			h += '<td class="tot" data-totfor="' + e.name + '">' + (tot || '') + '</td></tr>';
		});
		h += '</tbody></table>';
		holder.html(h);

		holder.off('input').on('input', 'input.q', function() {
			var t = $(this);
			t.addClass('dirty');
			state.dirty[t.data('emp') + '|' + t.data('day')] =
				{ employee: t.data('emp'), day: t.data('day'), qty: t.val() };
			var tot = 0;
			holder.find('input.q[data-emp="' + t.data('emp') + '"]').each(function() {
				tot += parseFloat($(this).val()) || 0;
			});
			holder.find('[data-totfor="' + t.data('emp') + '"]').text(tot || '');
		}).on('input', 'input.trkin', function() {
			state.trucks[$(this).data('emp')] = $(this).val();
		});
	}

	function save_drafts() {
		if (!state.sheet) { frappe.msgprint('Load a sheet first.'); return; }
		var entries = Object.keys(state.dirty).map(function(k) { return state.dirty[k]; });
		if (!entries.length && !Object.keys(state.trucks).length) {
			frappe.show_alert({ message: 'Nothing to save', indicator: 'orange' }); return;
		}
		frappe.call({
			method: 'bgl_ops.api.bulk_save',
			args: {
				site: state.sheet.site, month: state.sheet.month,
				entries: JSON.stringify(entries), trucks: JSON.stringify(state.trucks)
			},
			freeze: true, freeze_message: 'Saving and pricing each day...',
			callback: function(r) {
				var m = r.message;
				frappe.show_alert({
					message: 'Saved: ' + m.created + ' created, ' + m.updated + ' updated, ' + m.deleted + ' cleared',
					indicator: m.errors.length ? 'orange' : 'green'
				});
				if (m.errors.length) frappe.msgprint({ title: 'Some rows failed', message: m.errors.join('<br>') });
				state.dirty = {}; state.trucks = {};
				holder.find('input.q.dirty').removeClass('dirty');
			}
		});
	}

	function print_sheet() {
		if (!state.sheet) { frappe.msgprint('Load a sheet first.'); return; }
		var d = state.sheet, sat = {}, sun = {};
		(d.saturdays || []).forEach(function(x) { sat[x] = 1; });
		(d.sundays || []).forEach(function(x) { sun[x] = 1; });
		var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Trip Sheet ' + d.site + ' ' + d.month + '</title><style>' +
			'@page{size:A3 landscape;margin:8mm}' +
			'body{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:9px;margin:0}' +
			'.hd{text-align:center;font-weight:bold;font-size:15px;border:1px solid #000;background:#eee;padding:4px;margin-bottom:2px}' +
			'.sub{text-align:center;font-size:10px;margin-bottom:6px}' +
			'table{border-collapse:collapse;width:100%}' +
			'th,td{border:0.5pt solid #000;padding:2px 3px;text-align:center}' +
			'th{background:#eee;font-size:8px}' +
			'td.nm{text-align:left;white-space:nowrap;font-weight:bold}' +
			'td.gp{text-align:left;font-size:7.5px;color:#444}' +
			'td.tot{font-weight:bold;background:#f4f4f4}' +
			'.sig{margin-top:16px;font-size:10px;display:flex;justify-content:space-between}' +
			'.sig span{border-top:1px solid #000;padding-top:3px;width:30%;text-align:center}' +
			'</style></head><body>' +
			'<div class="hd">BETONSA GHANA LIMITED - DAILY TRIP / CUBIC SHEET</div>' +
			'<div class="sub">Branch: <b>' + d.site + '</b> | Month: <b>' + d.month + '</b> | Printed: ' + new Date().toLocaleString() + '</div>' +
			'<table><thead><tr><th style="text-align:left">NAME</th><th>VEHICLE</th>';
		for (var i = 1; i <= d.days; i++) { h += '<th>' + i + (sat[i] ? '<br>S' : (sun[i] ? '<br>Su' : '')) + '</th>'; }
		h += '<th>TOTAL</th></tr></thead><tbody>';
		var grand = 0;
		d.employees.forEach(function(e) {
			var tot = 0;
			h += '<tr><td class="nm">' + e.employee_name + '<div class="gp">' + e.designation + '</div></td>';
			var trk = holder.find('input.trkin[data-emp="' + e.name + '"]').val();
			h += '<td>' + (trk || e.truck_no || '') + '</td>';
			for (var day = 1; day <= d.days; day++) {
				var v = parseFloat(holder.find('input.q[data-emp="' + e.name + '"][data-day="' + day + '"]').val()) || 0;
				tot += v;
				h += '<td>' + (v || '') + '</td>';
			}
			grand += tot;
			h += '<td class="tot">' + (tot || '') + '</td></tr>';
		});
		h += '<tr><td class="tot" style="text-align:right" colspan="' + (d.days + 2) + '">GRAND TOTAL</td><td class="tot">' + grand + '</td></tr>';
		h += '</tbody></table>' +
			'<div class="sig"><span>PREPARED BY</span><span>CHECKED BY (HR)</span><span>APPROVED BY MANAGING DIRECTOR</span></div>' +
			'</body></html>';
		var w = window.open('', '_blank');
		w.document.write(h); w.document.close();
		setTimeout(function() { w.print(); }, 400);
	}

	function submit_month() {
		if (!state.sheet) { frappe.msgprint('Load a sheet first.'); return; }
		frappe.confirm(
			'Submit ALL draft logs for ' + state.sheet.site + ' ' + state.sheet.month + '? This locks them for payroll.',
			function() {
				frappe.call({
					method: 'bgl_ops.api.submit_month',
					args: { site: state.sheet.site, month: state.sheet.month },
					freeze: true,
					callback: function(r) {
						frappe.show_alert({ message: r.message.submitted + ' logs submitted and locked', indicator: 'green' });
						load_sheet();
					}
				});
			}
		);
	}
};
