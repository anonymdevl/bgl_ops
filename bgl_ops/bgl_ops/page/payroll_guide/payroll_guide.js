frappe.pages['payroll-guide'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({ parent: wrapper,
		title: 'BGL Payroll Guide', single_column: true });
	var body = $('<div style="margin:10px 20px 60px;max-width:900px"></div>').appendTo(page.main);
	$('<style>\
		.pg h2{font-size:17px;margin:26px 0 8px;color:var(--heading-color)}\
		.pg .flow{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 4px}\
		.pg .flow span{background:var(--card-bg);border:1px solid var(--border-color);border-radius:8px;\
			padding:7px 11px;font-size:12.5px;flex:1 1 130px;text-align:center}\
		.pg .flow b{display:block;font-size:12px}\
		.pg details{background:var(--card-bg);border:1px solid var(--border-color);border-radius:10px;\
			margin-bottom:8px;padding:0 14px}\
		.pg summary{font-weight:700;font-size:14px;cursor:pointer;padding:11px 0;color:var(--heading-color)}\
		.pg details p,.pg details li{font-size:13.5px}\
		.pg .rule{display:flex;gap:10px;margin:0 0 10px;font-size:13.5px}\
		.pg .rule i{flex:none;width:22px;height:22px;border-radius:50%;background:#f0a04b;color:#191203;\
			font-style:normal;font-weight:800;font-size:12px;display:grid;place-items:center}\
	</style>').appendTo(body);
	body.append('\
	<div class="pg">\
	<p style="color:var(--text-muted);max-width:70ch">One month of pay, one order of work. Everything below matches the live screens (v1.21). Type every amount as a plain positive number - the screen you are on decides whether it adds to pay or comes off it.</p>\
	<h2>The month, in order</h2>\
	<div class="flow">\
		<span><b>Every day</b>Trip Log Sheet</span>\
		<span><b>All month</b>Prep Sheet: loans &amp; advances</span>\
		<span><b>Month end</b>Prep Sheet finished &amp; saved</span>\
		<span><b>Then</b>Every tab Marked Reviewed</span>\
		<span><b>Then</b>Review &amp; Approve &rarr; run payroll</span>\
		<span><b>Finally</b>Check drafts &rarr; Submit &rarr; Payment Sheet &rarr; payslips</span>\
	</div>\
	<h2>Screen by screen</h2>\
	<details open><summary>Trip Log Sheet - daily driver entries</summary>\
		<p>Pick site and date, type each driver\'s quantity, Enter moves down a row, Save. Enter exactly what was done - top-ups are management\'s decision on a different screen, never bigger numbers here.</p></details>\
	<details><summary>Monthly Payroll Prep Sheet - the working document</summary>\
		<p>Load the month. Tabs: <b>A</b> new hires &middot; <b>B</b> basics &middot; <b>1</b> loans &middot; <b>2</b> advances &middot; <b>3</b> absent days &middot; <b>4</b> allowances/OT. Orange boxes are unsaved - press <b>Save Prep Sheet</b> before leaving. Print or export any tab; <b>Import This Tab (CSV)</b> fills boxes from a file as unsaved edits (minus signs are ignored on purpose).</p>\
		<p>The <b>&fnof;x</b> button beside a basic solves it from an agreed take-home - for a mid-month joiner it asks whether the agreed figure is the monthly package or the part-month money. <b>Mark Reviewed</b> saves your edits first, then signs off what is stored; if figures change later the sign-off reopens itself.</p></details>\
	<details><summary>Review &amp; Approve - run, submit, pay</summary>\
		<p>Readiness must be all green (leavers marked, tabs reviewed, trips submitted). Approve the groups, run payroll - every slip is a <b>draft</b>. Spot-check drafts, submit, then <b>Payment Sheet (CSV)</b> downloads the bank list straight from the slips. That file - and nothing else - goes to the bank.</p></details>\
	<details><summary>Cubic Override - management top-ups, done clean</summary>\
		<p>Trip-sheet figure and payroll figure side by side per driver. Type the figure management wants paid, give the reason, Apply: one clean record, slip rebuilt, trip logs untouched.</p></details>\
	<details><summary>Take-Home Solver - the calculator</summary>\
		<p>Ask "what basic gives this take-home?" or "what does this package net?" without touching payroll. To actually apply a figure, use the &fnof;x button on the Prep Sheet so the save and sign-off flow cover it.</p></details>\
	<h2>The six rules</h2>\
	<div class="rule"><i>1</i><span><b>Positive numbers only.</b> The tab decides direction; a minus sign is never typed.</span></div>\
	<div class="rule"><i>2</i><span><b>Trip logs are sacred.</b> Goodwill goes through Cubic Override with a reason.</span></div>\
	<div class="rule"><i>3</i><span><b>Agreed take-homes go through &fnof;x.</b> Nobody works PAYE backwards on paper.</span></div>\
	<div class="rule"><i>4</i><span><b>Orange means unsaved.</b> Save before stepping away.</span></div>\
	<div class="rule"><i>5</i><span><b>The bank is paid from the Payment Sheet button.</b> Never from a hand-typed list.</span></div>\
	<div class="rule"><i>6</i><span><b>Leavers are marked before the run.</b> One minute on the employee record.</span></div>\
	</div>');
};
