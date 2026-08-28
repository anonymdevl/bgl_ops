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
		.rvb-prog{margin:14px auto;max-width:560px;text-align:center}\
		.rvb-prog .num{font-size:34px;font-weight:800;letter-spacing:-.01em}\
		.rvb-prog .num small{font-size:15px;color:var(--text-muted);font-weight:600}\
		.rvb-rail{position:relative;height:10px;border-radius:100px;background:var(--border-color);\
			overflow:hidden;margin:10px 0 8px}\
		.rvb-fill{position:absolute;left:0;top:0;bottom:0;border-radius:100px;\
			background:linear-gradient(90deg,#2fb56f,#f0a04b);transition:width .8s cubic-bezier(.4,0,.2,1)}\
		.rvb-fill:after{content:"";position:absolute;top:0;bottom:0;right:0;width:46px;\
			background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);\
			animation:rvbspark 1.4s linear infinite}\
		@keyframes rvbspark{0%{transform:translateX(-46px)}100%{transform:translateX(46px)}}\
		.rvb-stage{font-size:12.5px;color:var(--text-muted);animation:rvbbreath 2.4s ease-in-out infinite}\
		@keyframes rvbbreath{0%,100%{opacity:.55}50%{opacity:1}}\
		.rvb-donepulse{animation:rvbpop .5s ease}\
		@keyframes rvbpop{0%{transform:scale(.96);opacity:.4}100%{transform:scale(1);opacity:1}}\
		.rvb-names{font-size:11.5px;color:var(--text-muted);min-height:16px;margin-top:2px}\
		.rvb-t tr.rvb-tot td{font-weight:700;background:var(--subtle-fg);border-top:2px solid var(--border-color)}\
		.rvb-sum{margin:0 0 16px;width:100%}\
		.rvb-sum th{background:var(--subtle-fg);font-size:11px;text-transform:uppercase;letter-spacing:.04em}\
		.rvb-sum td,.rvb-sum th{border-bottom:1px solid var(--border-color);padding:6px 10px;text-align:right}\
		.rvb-sum td.l,.rvb-sum th.l{text-align:left}\
		.rvb-sum tr.grand td{font-weight:700;background:var(--subtle-fg);border-top:2px solid var(--border-color)}\
		.rvb-sum tr.net td{font-weight:700;color:var(--blue-500)}\
		.rvb-bulk{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 16px;\
			padding:12px 16px;border:1px solid var(--border-color);border-radius:10px;background:var(--subtle-fg)}\
		.rvb-bulk b{font-size:13px}\
		.rvb-bulk .sub{font-size:12px;color:var(--text-muted)}\
		.rvb-bulk .btn{margin-left:auto}\
		.rvb-prog{height:6px;border-radius:99px;background:var(--border-color);overflow:hidden;\
			flex:0 0 100%;margin-top:4px;display:none}\
		.rvb-prog span{display:block;height:100%;width:0;background:var(--orange-500);transition:width .25s}\
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

		// ---- month summary: what adds to pay, what comes off, and the net.
		// Groups are not all the same sign, so a single grand total would be
		// meaningless - earnings and deductions are kept apart deliberately.
		var DEDUCT = { loans: 1, advances: 1, absences: 1 };
		var sum_earn = 0, sum_ded = 0, sum_rows = 0, srows = '';
		Object.keys(d.groups).forEach(function(key) {
			var g = d.groups[key];
			if (!g.rows.length && !g.source) return;
			var isd = DEDUCT[key];
			if (isd) sum_ded += flt(g.total); else sum_earn += flt(g.total);
			sum_rows += g.rows.length;
			srows += '<tr><td class="l">' + g.label + '</td><td>' + g.rows.length + '</td>' +
				'<td>' + (isd ? '-' : fmt(g.total)) + '</td>' +
				'<td>' + (isd ? fmt(g.total) : '-') + '</td>' +
				'<td class="l">' + (g.drafts ? g.drafts + ' draft(s)' : 'all submitted') + '</td></tr>';
		});
		if (srows) {
			h += '<table class="rvb-sum"><tr><th class="l">Group</th><th>Entries</th>' +
				'<th>Adds to pay</th><th>Comes off pay</th><th class="l">Status</th></tr>' +
				srows +
				'<tr class="grand"><td class="l">TOTAL</td><td>' + sum_rows + '</td>' +
				'<td>' + fmt(sum_earn) + '</td><td>' + fmt(sum_ded) + '</td><td></td></tr>' +
				'<tr class="net"><td class="l" colspan="2">NET EFFECT ON PAYROLL</td>' +
				'<td colspan="2">GHS ' + fmt(sum_earn - sum_ded) + '</td><td></td></tr>' +
				'</table>';
		}

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
				}).join('') +
				'<tr class="rvb-tot"><td class="l">TOTAL - ' + g.label + '</td>' +
				'<td class="l">' + g.rows.length + ' entr(ies)</td>' +
				'<td>' + fmt(g.total) + '</td>' +
				'<td class="l">' + (g.drafts ? g.drafts + ' draft(s)' : 'all submitted') + '</td></tr>' +
				'</table>' +
				(g.drafts ? '<button class="btn btn-sm btn-primary rvb-approve" data-g="' + key + '" style="margin-top:10px">Approve ' + g.drafts + ' draft(s)</button>' : '') +
				'</div></div>';
		});
		// optional shortcut for whoever trusts the prep sheet. Group by group
		// is untouched below for anyone who wants to read every line.
		var pending = 0, pendamt = 0;
		Object.keys(d.groups).forEach(function(key) {
			var g = d.groups[key];
			pending += g.drafts || 0;
			(g.rows || []).forEach(function(r) { if (!r.docstatus) pendamt += flt(r.amount); });
		});
		if (pending) {
			h = '<div class="rvb-bulk"><div><b>' + pending + ' draft(s) still to approve</b>' +
				'<div class="sub">GHS ' + fmt(pendamt) + ' across every group. Approving here is identical to pressing Approve on each group in turn.</div></div>' +
				'<button class="btn btn-sm btn-primary" id="rvb-all">Approve every draft</button>' +
				'<div class="rvb-prog"><span></span></div></div>' + h;
		}
		h += '<div id="rvb-pay"></div>';
		holder.html(h);
		render_payzone();
		holder.find('#rvb-all').on('click', function() {
			var btn = $(this), bar = holder.find('.rvb-prog'), fill = bar.find('span');
			var total = parseInt(btn.closest('.rvb-bulk').find('b').text(), 10) || 0, done = 0;
			frappe.confirm(
				'Approve and SUBMIT all ' + total + ' remaining draft(s)?<br><br>' +
				'They become live payroll entries in one pass. Anyone who is no longer active staff will stop this, by design.',
				function() {
					btn.prop('disabled', true); bar.show();
					// batched: keeps each request short and shows the count climbing
					(function next() {
						frappe.call({
							method: 'bgl_ops.api.approve_all',
							args: { month: state.month, limit: 75 },
							callback: function(r) {
								var m = r.message || {};
								done += (m.approved || 0);
								btn.text('Approving... ' + done + ' of ' + total);
								fill.css('width', Math.round(done / Math.max(total, 1) * 100) + '%');
								if ((m.errors || []).length) {
									frappe.msgprint({ title: 'Some drafts could not be approved', message: m.errors.join('<br>') });
									load(); return;
								}
								if (m.remaining > 0 && m.approved > 0) { next(); return; }
								frappe.show_alert({ message: done + ' draft(s) approved. Run payroll below.', indicator: 'green' }, 7);
								load();
							}
						});
					})();
				});
		});
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

	var payTimer = null;
	function render_payzone() {
		if (payTimer) { clearTimeout(payTimer); payTimer = null; }
		var d = state.data;
		var box = holder.find('#rvb-pay');
		frappe.call({ method: 'bgl_ops.api.payroll_status', args: { month: state.month } }).then(function(r) {
			var st = r.message || {};
			var h = '';
			function btn(id, label, green) {
				return '<div style="text-align:center;margin:16px 0"><button id="' + id + '" class="btn ' +
					(green ? 'btn-success' : 'btn-default') + '" style="font-weight:800;padding:10px 30px">' + label + '</button></div>';
			}
			if (st.phase === 'none') {
				if (d.ready) {
					h += '<div class="rvb-warn" style="border-color:var(--green-600);background:rgba(47,181,111,.07);color:var(--text-color)">' +
						'<b>All green.</b> One click creates the Payroll Entry exactly like last month (same accounts, cost centre, bank), ' +
						'dated ' + d.month_end + ', every active employee included and any leaver excluded by name - then drafts every salary slip for checking.</div>' +
						btn('rvb-run', 'Create Payroll (draft slips)', true);
				}
			} else {
				h += '<div class="rvb-warn" style="border-color:var(--border-color);background:var(--fg-color);color:var(--text-color)">' +
					'<b>Payroll ' + (st.entries || []).map(function(e) { return e.name; }).join(', ') + '</b> - slips: ' +
					st.created + ' of ' + st.expected + ' created' +
					(st.submitted ? ', ' + st.submitted + ' submitted' : '') + '.';
				if ((st.recon || []).length) {
					h += '<table class="rvb-t" style="margin-top:8px"><tr><th class="l">Group</th><th>Board</th><th>Slips</th><th class="l">Match</th></tr>';
					st.recon.forEach(function(x) {
						h += '<tr><td class="l">' + x.group + '</td><td>' + format_number(x.board, null, 2) + '</td><td>' +
							format_number(x.slips, null, 2) + '</td><td class="l">' +
							(x.ok ? '<span style="color:var(--green-600);font-weight:700">&#10003;</span>'
								: '<span style="color:var(--red-500);font-weight:700">DIFFERS</span>') + '</td></tr>';
					});
					h += '</table>';
				}
				if ((st.anomalies || []).length) {
					h += '<div style="margin-top:8px;color:var(--red-500)"><b>Read before submitting:</b><br>' +
						st.anomalies.slice(0, 15).join('<br>') + '</div>';
				}
				h += '</div>';
				if (st.phase === 'creating') {
					var pct = st.expected ? Math.min(100, Math.round(st.created * 100 / st.expected)) : 0;
					var stages = ['Reading salary structures...', 'Applying trips and cubic...',
						'Applying loans, advances and absences...', 'Working out SSNIT and PAYE...',
						'Writing salary slips...'];
					h += '<div class="rvb-prog">' +
						'<div class="num" id="rvb-count">' + st.created + '<small> / ' + st.expected + ' slips</small></div>' +
						'<div class="rvb-rail"><div class="rvb-fill" style="width:' + pct + '%"></div></div>' +
						'<div class="rvb-stage">' + stages[Math.floor(Date.now() / 3000) % stages.length] + '</div>' +
						'<div class="rvb-names" id="rvb-lastname"></div></div>';
					payTimer = setTimeout(render_payzone, 2500);
				}
				if (st.phase === 'drafts_ready') {
					var clean = !(st.anomalies || []).length && st.recon_ok;
					h += btn('rvb-submit', clean ? 'Submit all salary slips' : 'Submit anyway (I have read the notes above)', clean);
				}
				if (st.phase === 'submitted') {
					h += '<div class="rvb-warn" style="border-color:var(--green-600);background:rgba(47,181,111,.07);color:var(--text-color)">' +
						'<b>Payroll submitted.</b> ' + st.submitted + ' slips are live. Bank entry is made from the Payroll Entry as usual.</div>';
				}
				if (st.submitted && st.submitted < st.expected && st.phase !== 'drafts_ready') {
					payTimer = setTimeout(render_payzone, 5000);
				}
			}
			box.html(h);
			if (st.phase === 'creating' && st.created > 0) {
				frappe.call({ method: 'frappe.client.get_list', args: {
					doctype: 'Salary Slip', filters: { payroll_entry: ['in', (st.entries || []).map(function(e) { return e.name; })] },
					fields: ['employee_name'], order_by: 'creation desc', limit_page_length: 1 } }).then(function(q) {
					var rows = (q.message || []);
					if (rows.length) box.find('#rvb-lastname').text('just written: ' + rows[0].employee_name);
				});
			}
			if (st.phase === 'drafts_ready' && !box.data('celebrated')) {
				box.data('celebrated', 1);
				box.children().first().addClass('rvb-donepulse');
				frappe.show_alert({ message: 'All ' + st.created + ' slips drafted - run the final check below.', indicator: 'green' }, 6);
			}
			if (st.phase === 'submitted' && !box.data('cheered')) {
				box.data('cheered', 1);
				frappe.show_alert({ message: 'Payroll submitted. ' + st.submitted + ' people are getting paid.', indicator: 'green' }, 8);
			}
			box.find('#rvb-run').on('click', function() {
				function go(confirmed) {
					frappe.call({ method: 'bgl_ops.api.run_payroll',
						args: { month: state.month, confirm: confirmed ? 1 : 0 }, freeze: true,
						freeze_message: 'Creating payroll...',
						callback: function(rr) {
							var m = rr.message || {};
							// opening a NEW payroll month asks a second time, by itself
							if (m.needs_confirmation) {
								frappe.confirm(m.message, function() { go(1); });
								return;
							}
							if ((m.excluded || []).length) frappe.msgprint({ title: 'Excluded from payroll', message: m.excluded.join('<br>') });
							render_payzone();
						} });
				}
				frappe.confirm('Create the ' + state.month + ' Payroll Entry now? Settings copy from last month; every salary slip is created as a DRAFT for the final check.', function() { go(0); });
			});
			box.find('#rvb-submit').on('click', function() {
				var clean = !(st.anomalies || []).length && st.recon_ok;
				frappe.confirm(clean ?
					'Submit ALL ' + st.created + ' salary slips? This is the final commit - money becomes payable.' :
					'There are unresolved notes above. Submit ALL slips anyway?', function() {
					frappe.call({ method: 'bgl_ops.api.submit_payroll',
						args: { month: state.month, confirm: clean ? 0 : 1 }, freeze: true,
						freeze_message: 'Submitting slips...',
						callback: function() { render_payzone(); } });
				});
			});
		});
	}
};
