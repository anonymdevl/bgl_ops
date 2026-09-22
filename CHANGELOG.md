## v1.26.3 - 2026-09-22

- Salary Slip print: adopted the site's existing "Salary Slip - Betonsa v2"
  reconciliation handling in place of v1.26.1's relabelling. Reconciliation
  Adjustment rows are removed from the slip entirely: the earning-side amount
  is FOLDED into Extra Duty Allowance (or shown as "Other Allowance" when the
  slip has no EDA row), and the deduction-side total prints as "Other
  Deductions". Totals remain exact because amounts are folded, never dropped.

## v1.26.2 - 2026-09-22

- Bank Advice annex now uses the Employee-master check (same source as the
  Missing Bank Details button) for each excluded employee, so the printed
  "Missing" column states exactly which of Salary Mode = Bank / Bank Name /
  Bank A/C No. HR must complete - including Salary Mode, which slip data
  alone cannot reveal. Annex wording now points HR to the Employee master's
  Salary Information section. Falls back to slip-derived detail if the
  master lookup returns nothing for an employee.

## v1.26.1 - 2026-09-22

- Salary Slip print: internal reconciliation components are relabelled in
  plain language on the printed slip only - "Reconciliation Adjustment"
  prints as "Salary Adjustment", "Reconciliation Adjustment - Deduction" as
  "Salary Adjustment (Recovery)". The rows stay (so earnings still sum to
  GROSS PAY exactly) and the underlying records keep their real names for
  audit; only the employee-facing label changes.

## v1.26.0 - 2026-09-22

- Salary Slip: full redesign of the "Salary Slip - Betonsa" print format to
  match the Bank Advice aesthetics - real BetonSA logo + registered address
  header, brand-red rule, employee card (name, ID, designation, site,
  department, Days Paid as paid/working, bank + account from the Employee
  master), earnings and deductions side by side with dark headers and zebra
  rows, employer SSNIT contributions in a muted strip ABOVE the net band,
  charcoal NET PAY band with red edge, amount in words, Private &
  Confidential footer. Table-based layout - safe for wkhtmltopdf PDFs.
- Set as the DEFAULT print format for Salary Slip (Property Setter fixture).
- hooks.py: fixture export filters now include Salary Slip property setters
  and the v1.25 Payroll Entry accrual Client Script.

## v1.25.0 - 2026-09-22

- Take-Home Solver (allowance-split mode): part-month support. For new hires
  working fewer than 22 days, "That figure is what they actually receive for
  the N days" now works in the default allowance-split mode too - the solver
  finds the allowance pool whose PRORATED result (basic prorated, allowances
  not) lands on the agreed cash.
- Payroll Entry: new "Create Accrual Journal" button (Client Script - core
  doctype untouched). Appears on a submitted Payroll Entry whose slips were
  submitted individually (so the automatic journal never fired) and no journal
  exists yet. Uses ERPNext's own accrual routine; fails with a clear message
  if GL accounts are not configured.
- Bank Advice: modern redesign - real BetonSA logo (from /files on the site)
  with the registered address in the header, brand-red accents, clean tables,
  footer on every printed page. Dialog simplified for the accountant: type
  "Send to (bank & branch)" and "Company account the money leaves from" once,
  and the bank is remembered automatically (named after itself, up to 10);
  next month a single "Bank" pick refills both boxes.
- New "Missing Bank Details" button on Review & Approve: lists every Active
  employee whose Employee master is missing Salary Mode = Bank, Bank Name or
  Bank A/C No. - specifying exactly which field(s) HR must complete. The bank
  advice annex now also names what is missing per excluded employee.
- Probation End Date is now MANDATORY when creating a new Employee (existing
  records unaffected), so probation can no longer be forgotten at onboarding.

## 1.24.0 - bank advice

- New "Bank Advice (Print)" on Review & Approve: a formal, letterheaded
  payment instruction fit to hand to the bank. Reference number, date,
  bank address block, instruction paragraph with the total in figures
  AND words, the employee/bank/account/amount schedule, and three
  signature lines (two authorised signatories + MD).
- Optional inputs before printing: which site (All/Airport/Tema), the
  company account to debit, and the bank branch it is addressed to.
- It refuses to print while any slip is still a draft - an instruction
  to pay only ever comes from submitted payroll.
- Employees with no account number on file are moved to a separate
  annex page, clearly marked as excluded from the instruction, with
  their own total - so the letter total always equals what the bank
  should actually transfer.
- The plain Payment Sheet CSV stays as-is for internal use.

## 1.23.0 - solver everywhere defaults to allowance split, and applies everything

- "Allowance split (basic fixed)" is now the DEFAULT solve mode on the
  standalone Take-Home Solver page and in every fx dialog on the prep
  sheet (Basic Salaries tab and the pro-ration tab). Basic stays what
  it is; the solver finds the allowance pool and splits it by the
  percentages (40,30,30 unless changed).
- The fx dialogs now apply EVERYTHING on Use: the basic goes into its
  column and the solved Housing/Transport/Extra Duty land straight on
  the Allowances tab for that employee - no re-typing. One Save Prep
  Sheet keeps it all, covered by the normal sign-off.
- The standalone solver page grew an "Apply this to payroll..." button:
  after a solve, pick it, confirm, and the figures are written for the
  selected month (salary assignment + allowance records + the draft
  slip rebuilt). It refuses months that already have a SUBMITTED slip -
  the solver never edits paid history.

## 1.22.0 - probation watch

- New "Probation End Date" field on the Employee, set by HR at
  onboarding. There is no fixed probation length at BGL, so the date is
  free - one month or six, whatever was agreed for that person.
- The Monthly Payroll Prep Sheet opens with a Probation Watch banner for
  the month: everyone whose probation ends inside the payroll month, and
  anyone overdue (ended recently but still on the old salary - no new
  Salary Structure Assignment after the end date). The banner walks
  through what to do: new SSA from the confirmation date, new allowances
  on the sheet, fx for an agreed take-home.
- Once the confirmed rate is applied (a newer SSA exists), the overdue
  flag clears itself.

## 1.21.3 - solver mode clarity

- The Take-Home Solver now greys out the fields the chosen Solve-for
  mode ignores. Solving Basic disables the Basic box and the Split %;
  solving the allowance split disables the Housing/Transport/Extra Duty
  boxes; "just show the net" disables the target and split. No more
  typing figures the solver silently drops.

## 1.21.2 - the strike-through bug and slow saves

- Striking a row with x now counts as an edit. Before, the zeroed boxes
  never registered as unsaved, so Mark Reviewed skipped them, the sheet
  reloaded, and the "removed" row came straight back. Now Save and Mark
  Reviewed both carry removals, every time.
- Saves stop rewriting unchanged rows. Every save was writing all 140+
  draft records whether they moved or not; a row whose figures did not
  change is now left untouched, so saving takes seconds again.

## 1.21.1 - first-look fixes from the live install

- Cubic Override no longer crashes on load (Frappe 16 refuses aggregate
  strings in get_all; the query moved to plain SQL).
- Month fields on Cubic Override and the Take-Home Solver are dropdowns
  of real month names. input[type=month] is a picker on Chrome and a bare
  text box on Safari - BGL runs Safari, so no one types 2026-09 again.
- Sidebar reads in working order: Trip Log Sheet, Monthly Payroll Prep
  Sheet, Review & Approve, Cubic Override, Take-Home Solver, Guide.
- Workspace pages breathe on wide screens and the payroll-trail cards
  clamp their detail text to three lines instead of ballooning.
- The Payroll Guide page is rewritten clean for v1.21: the month in
  order, screen-by-screen reference, the six rules.

## 1.21.0 - the September lessons

Everything August taught us, turned into screens, so nothing about pay
lives in Excel any more.

- Take-Home Solver (new page). Management agrees "this person receives
  3,000"; the screen solves PAYE/SSNIT backwards for the basic or the
  allowance split, shows the full slip math, and Apply writes the salary
  assignment + allowance records and rebuilds the draft slip. Labels are
  explicit: what it shows is the BASE take-home - trips/cubic ride on top.
- Cubic Override (new page). The trip-sheet figure and the payroll figure
  side by side per driver; type what management wants paid, the change
  shows live, Apply writes one clean record so the slip carries a single
  normal cubic line. Daily Trip Logs are never modified.
- Payment Sheet (CSV) button on Review & Approve. The bank sheet is
  exported FROM the salary slips - the sheet you pay from IS the system,
  so there is no second version of the truth to reconcile. It warns
  loudly when slips are still drafts or an active employee has no slip.
- The solver lives INSIDE the prep sheet: an fx button beside every
  basic on Tab A (new hires) and Tab B opens it pre-filled, and for a
  mid-month joiner it asks the question August taught us to ask - is the
  agreed figure the monthly package, or what they receive for the part
  month? Use fills the sheet cell; save and sign-off cover it like any
  typing. The standalone page remains as a calculator only.
- Every export now has an import: Import This Tab (CSV) fills the open
  tab's boxes from a file, matching people by name or ID. Values arrive
  as unsaved orange edits for review - never straight into the database -
  and signs are ignored (the tab decides direction), so a stray minus in
  Excel cannot flip a deduction into pay.
- The full printout no longer drops rows that carry a decision: loans
  with a balance but no deduction typed, advances awaiting a figure, and
  new hires print in full, like Basic Salaries.
- Mark Reviewed on the prep sheet now saves your unsaved edits first
  (it asks). Before, it snapshotted the OLD stored figures and the very
  next save reopened your own sign-off.

## 1.20.0 - Phase 1: printing, exporting, quick entry

Display and data entry only. api.py is byte identical to 1.19.0; the only
files that changed are two page scripts, the guide and the version. No
figure anywhere can move as a result of this release.

- Prep sheet print now includes B - Basic Salaries. It was being dropped
  by the rule that skips rows with an empty input, which on that tab means
  "this basic is correct" - i.e. nearly every row.
- Print This Tab and Export This Tab (CSV) alongside the unchanged bulk
  Print Sheet. Both take only the active pane and honour the filter box.
  CSV is written with a UTF-8 BOM so Excel renders the names correctly.
- Enter moves down a column and selects the value, Shift+Enter moves up,
  on every prep sheet grid and on the trip sheet. Hidden rows, total rows
  and locked cells are skipped. Arrow keys deliberately untouched, since
  these are number inputs and up/down belong to the spinner.

## v1.19.0

The Command Center site selector now means something.

It only ever reached the four trip queries. Loans, advances, recovery,
encashment, leave and headcount ignored it, so choosing Airport still
listed Tema people and showed company-wide totals - the cards and the
tables under them disagreed, which is worse than having no filter.

- Ledger by type, Who owes what (loans and advances), Recovery by month,
  Encashment pipeline, and every leave figure now filter by branch through
  the employee record.
- Logs today and Yesterday by site filter too.
- The Field crew card and its breakdown follow the selector, so the number
  on the card agrees with the headcount printed beneath it.
- Crew data still returns both branches on purpose; the panel splits it
  client side for the All / Airport / Tema chips.
- Staff owing (payroll) counted loan staff PLUS advance staff, so the 13
  people holding both were counted twice - the card read 107 where 94 people
  actually owe something. It now counts each person once.

## v1.18.1

- Existing staff pro-ration moved back into the New Hire Pro-Ration tab,
  set apart by a divider rather than given a tab of its own. One question,
  who needs their month prorated, one place to answer it. Tab A2 is gone.
- Fixes "Unknown section: Existing Staff Pro-Ration" when marking it
  reviewed. It was asking to sign off a section the server did not
  recognise; the merged tab now signs off once, under New Hire Pro-Ration.
- That sign-off snapshot now watches both halves of the tab. It only
  tracked Basic Salary, so editing a part month figure after signing off
  would not have reopened it. The Absences snapshot excludes part month
  rows in turn, so the two sections cannot go stale on each other.

## v1.18.0

- Approve every draft in one pass, optional. Group by group is untouched
  for anyone who wants to read each line; this is for the manager who
  trusts whoever did the prep sheet. Same gate either way: nobody who has
  left may be sitting on payroll.
- Batched 75 at a time. A 600 draft month used to mean a long silent
  spinner; now the button counts up and a bar fills, and no single request
  runs long enough to time out. Run payroll appears as soon as it finishes.
- Employee status is cached per save. The leaver guard added in v1.16.0
  was costing one query per row, which is part of why saving felt slow.

## v1.17.0

New. Tab A2, Existing Staff Pro-Ration, optional.

- For someone already on payroll who worked part of the month - changed
  role mid-month, left, suspended, unpaid leave. Enter days worked and the
  agreed full monthly salary; saving puts that salary on an assignment
  effective the 1st and deducts the days not worked.
- Order of creation is deliberate: the Salary Structure Assignment is
  written FIRST, then the Absent line that depends on it. That is the same
  deadlock that made the new hire tab unusable before v1.13.1.
- A person on both A2 and the Absences tab is refused with a message
  rather than silently overwritten - both tabs write the same component.
- Part month rows no longer appear on the Absences tab, and reload
  rebuilds days worked and full salary from what was saved.

Fixed. Advances no longer carry last month's amount forward.

- Every advance box now starts at 0. An advance is a one-off, not a
  standing deduction, so pre-filling last month charged people who took
  nothing this month unless somebody zeroed every row by hand. Two August
  records were created this way. Last month stays on screen as a
  reference, which is all it was ever meant to be.

## v1.16.0

Saving the August prep sheet threw a wall of raw ERPNext errors and lost
GHS 2,000 of advances without saying so. Root cause: the carry-forward tabs
pre-filled from last month with no check that the person still works here,
so three leavers were offered, and ERPNext refused them one at a time in
language nobody can act on.

- Leavers are filtered out of the advance and allowance carry-forward at
  source. They are never offered again.
- Anything still refused is reported by name in plain words under Left out
  on purpose, instead of being thrown. One bad row can no longer bury a
  whole save.
- A component already submitted for that date is left alone rather than
  inserted a second time, which is what produced the overwrite error.
- Who owes what now shows the loan ledger AND this month's salary
  advances, with All, Loans and Advances filter chips and a name search.
  The 25 row cap is gone.
- The Field crew card reads active staff, because that is what it counts.
  Total staff would have to change with history to be true.

## v1.15.0

Weekends are visible everywhere, because they are paid differently.

- Trip Log Sheet now carries Qty, Sat qty, Normal, Saturday and Total per
  person, matching the NORMAL / SAT / T.AMOUNT columns both sites already
  reconcile against. Saturday columns are tinted down the whole grid, Sundays
  faintly red, and the DAY TOTALS row keeps the same tint.
- The printed trip sheet uses their own column names - TIPS TO SITE, NORMAL,
  SAT, T.AMOUNT - with a grand total and an "of which Saturday" line, so a
  printout can be laid beside theirs and read straight across.
- Command Center trip grid: Saturdays now tinted like Sundays were, plus a
  Sat column beside the total.

Context: Saturday is a different rate from a weekday for most groups at both
sites, and the two sites do not agree with each other. Airport pays 1.00 a
cubic on Saturday against 0.70 on a weekday; Tema pays 0.70 flat. Showing one
Amount hid all of that.

Pre-deploy QA fixes folded into 1.15.0:
- Both workspace cockpits build their five stones from named readiness keys.
  The new "basics" line was not in their list, so overall readiness could sit
  red while every stone showed green, with nothing on screen explaining why.
  Added to the Payroll Prep Sheet stone in both.
- BGL Payroll Signoff had naming_rule "Expression" against autoname "hash".
  Corrected to "Random", matching BGL Trip Rate, so migrate cannot reject it.
- _signoffs returns empty if its table does not exist yet, so a part-finished
  migrate cannot take the cockpit down. Unsigned means blocked, never allowed.
- The Basic Salaries snapshot selected a bare column beside GROUP BY, which is
  rejected under ONLY_FULL_GROUP_BY. Now max(a.base).
- _section_snapshot is cached per request; readiness asked for the same
  sections several times on every workspace load.
- Printed trip sheet grew two money columns but its group band row still
  spanned the old width.

## v1.14.0

Prep Sheet sign-off, and the tab fixes.

- New DocType BGL Payroll Signoff. One record per payroll month per section,
  holding who reviewed it, when, and the entry count and money total at that
  moment. If those numbers move afterwards the sign-off goes stale by itself
  and the section turns red again.
- Readiness no longer guesses whether Allowances and Basic Salaries were done.
  Row counts cannot tell "reviewed and correctly unchanged" from "never
  touched" - fixed allowances and untouched basics look identical either way.
  Both are now explicit sign-off lines, and Basic Salaries has its own line
  for the first time.
- run_payroll refuses while either section is unsigned, naming them.
- Every tab pill now carries a count. Advances, Absences and Allowances had
  none.
- Every tab now has the same filter box, not just Basic Salaries. Total rows
  stay visible while filtering.
- Save Deductions renamed Save Prep Sheet. The sheet stopped being only about
  deductions several versions ago.

## v1.13.2

Totals on every number column that gets reconciled.

- Review and Approve: a month summary above the groups showing each group's
  entries, what adds to pay, what comes off pay, and the net effect. Earnings
  and deductions are kept in separate columns on purpose - a single grand
  total across groups of opposite sign would be meaningless. Each group table
  also now foots with its own TOTAL row.
- Payroll Prep Sheet: totals on the New Hire Pro-Ration tab (days, basics and
  what the month pays) and on the Basic Salaries tab (payroll total now, and
  what it becomes after corrections). The other four tabs already footed.
- Trip Log Sheet: a sticky DAY TOTALS row under the grid giving the column
  total for every day plus the grand quantity and amount. The printed sheet
  carries the same row. A day keyed twice now shows up immediately.
- Command Center: totals on Ledger by type, Who owes what, and the Encashment
  pipeline. The encashment total excludes Rejected, which never counts towards
  what the company owes.

## v1.13.1

Fixed while running August 2026 payroll.

- New hire pro-ration could never work. deduction_save created the Basic
  Salary proration override before the Salary Structure Assignment, so every
  genuine new hire failed with "There is no Salary Structure assigned" and the
  assignment was never reached. The SSA is now written first, then the
  override. Full basic from the joining date, prorated for month one, full
  from the next month, exactly as designed.
- Allowances readiness line was dishonest. It counted rows, so one unrelated
  allowance turned it green while the carry-forward had not been done. It now
  compares the number of people covered this month against last month and
  stays red until the real carry-forward is in.
- Payroll can no longer be opened for a new month while an earlier month still
  has an unsubmitted Payroll Entry. Running a new month on top of an unclosed
  one is how people get paid twice.
- Opening a brand new payroll month now always asks a second time, naming the
  month and the headcount it is about to draft slips for.

# bgl_ops Changelog

All releases in plain language. Version shows in the Payroll Cockpit footer.

## 1.13.0 - 2026-08-28
- Encashment redesigned per HR (Alexandra): OUT of payroll entirely.
  - New "BGL Leave Encashment" record: employee, date, encashed days,
    encashed amount (typed by HR - the system no longer computes or pays
    it), status Not Paid / Paid, remarks. Quick-entry, HR-owned.
  - Every surface repointed: Command Center pipeline (amber Not Paid /
    green Paid), all-staff leave roster, Employee 360 (new Encashed
    column; remaining = allocated - taken - encashed), number card,
    workspace links, Payroll Guide, and the printed Leave Application
    form's "days remaining" figure.
  - Review board's Leave Encashments group removed - encashment no longer
    reaches Additional Salary or salary slips.
  - Retired the stock-encashment automation (valuation script, date guard,
    form guidance) from fixtures.

- Status widened to five per HR: Requested / Approved / Paid / Unpaid /
  Rejected (colour-coded everywhere). Rejected never reduces the balance;
  every other status does. Pending money = Requested + Approved + Unpaid.
- Manager visibility completed: Employee Hub card now shows "Leave encashed"
  beside leave taken, so 18 = taken + encashed + remaining is visible from
  the hub, the roster, Employee 360, the Leave Balance Board and the printed
  form alike.

- Extra integration fields (approved): department (auto-fetched, for
  filtering and reports), payment date (required once Paid) and payment
  reference - so "what left the company and when" is answerable without
  leaving the record.
- Leave Balance Board report repointed: Encash Not Paid / Encash Paid
  columns from the new record; Remaining = entitled - taken - ALL encashed.

## 1.12.4 - 2026-08-28
- Guard: Create Payroll now also refuses while new hires remain unprorated.
  A green Review board was not enough - a joiner never entered on the
  Pro-Ration tab has no salary assignment and would silently drop off the
  payroll (142 instead of 149). The refusal names the pending joiners.

## 1.12.3 - 2026-08-28
- Fix (found in live E2E): run_payroll now inserts the Payroll Entry before
  filling employees - v16's employee query silently returns nobody on an
  unsaved document, which made click 1 fail with "No employees found".

## 1.12.2 - 2026-08-28
- Critical fix found in pre-run QA: trip earnings arrive under their real
  components (Mixer Driver Cubic - Tema/Airport, Pump Cubic Incentive,
  Cubic - Weekday/Weekend, Trips) but the Review board, Approve action,
  readiness stone and slip reconciliation only matched the literals
  'Trips'/'Cubic' - mixer and pump cubic money would have bypassed the
  entire gate. All four now resolve the component list live from the
  BGL Trip Rate table, so new components join the gate automatically.

## 1.12.1 - 2026-08-28
- Payroll creation is now watchable: a live progress rail (green-to-amber
  fill with a traveling light) counts slips as they are written - big X/143
  counter, rotating stage messages, and a "just written: <name>" ticker.
  Finishes with a completion pulse and a green toast; submission gets its
  own "N people are getting paid" moment.

## 1.12.0 - 2026-08-28
- Two green clicks: payroll runs itself from the Review board.
  - Click 1 "Create Payroll (draft slips)": appears only when every group is
    approved. Copies all settings from last month's Payroll Entry (accounts,
    cost centre, bank), dates itself to the month, includes every active
    employee, excludes non-active ones BY NAME (narrated, never silent),
    submits the entry and drafts all salary slips.
  - Machine check: slip component totals reconciled against the Review board
    per group; anomalies flagged (approved money with no slip, zero or
    negative net, >20% net swing vs last month).
  - Click 2 "Submit all salary slips": instant when clean; when notes exist
    it requires reading and an explicit confirm. Progress self-refreshes
    while background slip creation runs.
  - Duplicate-run guard: a month that already has a Payroll Entry can never
    get a second one from the button (June had four - never again).

## 1.11.0 - 2026-08-28
- Payroll Prep Sheet reorganised into tabs, in payroll order: A New Hire
  Pro-Ration, B Basic Salaries, 1 Loans, 2 Advances, 3 Absences,
  4 Allowances & OT. One Save still writes every tab; Print Sheet still
  prints all sections regardless of the open tab.
- New "Basic Salaries" tab: every active employee's current basic (latest
  salary assignment) with its effective date, filterable. Typing a corrected
  figure creates a NEW submitted assignment effective the 1st of the active
  payroll month - submitted history is never edited, the same supersede
  pattern used for new-hire proration.
- Print Sheet now also includes New Hire Pro-Ration and Allowances & OT
  sections (previously only loans, advances, absences printed).

## 1.10.2 - 2026-08-28
- Fix (new-hire automation hole): the auto-created Salary Structure
  Assignment now starts from the employee's JOINING DATE at the full agreed
  basic, not the 1st of next month. Previously a hire with no manually
  created SSA had no assignment covering their first month - Payroll Entry
  would silently skip them. The proration override still trims month one to
  days/22; later months pay full automatically.

## 1.10.1 - 2026-08-28
- Fix: the Review board's Approve button now submits drafts dated anywhere in
  the payroll month, matching what the board displays (1.9.6 widened the
  display but not the approve action - a mid-month-dated draft could show on
  the board yet silently stay draft).

## 1.10.0 - 2026-08-28
- One story everywhere: "three lanes, one per role, three moves each".
  - Payroll Guide rebuilt around the lanes: People & Leave, Trips & Cubic,
    Payroll Numbers, Management view, plus a Reference group - same content,
    finally grouped. Numbering restarts per lane.
  - Cockpit and Executive stones carry a small lane label, so the trail
    itself teaches whose move is next (no personal names anywhere).
- Betonsa Leave Application Form: screen-only CSS so the desk print preview
  matches the (already correct) PDF - sheet-width container, restored table
  paddings and font sizes. PDF output untouched. Applied live and in fixture.

## 1.9.10 - 2026-08-28
- Fix: encashment pipeline and payroll recovery align the global filter to
  whole months. A month-to-date view (1st to today) was excluding entries
  dated at month-end - which is where payroll-dated documents naturally sit -
  so a draft encashment dated the 31st vanished from the pipeline.
- Payroll Guide: new "Leave and encashment" section - 18 working days,
  weekend exclusion, both encashment payment routes and the date rule.

## 1.9.9 - 2026-08-28
- Encashment pipeline now distinguishes the two payment routes. Each row is
  tagged PAYROLL or CASH and reads correctly for both: "Approved - pays with
  next payroll" vs "Approved - awaiting cash payment (Payment Entry)", and
  "Paid with payroll" vs "Paid in cash (Payment Entry)". Previously both
  routes shared the Unpaid label and cash payouts looked like payroll ones.

## 1.9.8 - 2026-08-28
- Fix: Employee Hub collapse now actually works. The toggle had been appended
  outside the block's own function scope, so it never bound to the title -
  clicking the chevron did nothing. Moved inside and hardened against the
  workspace stealing the click.
- BGL Operations workspace is now the single place HR works from:
  - New shortcuts: Employees, Leave Applications (joining Leave Encashments),
    plus Payroll Prep, Review & Approve and Payroll Guide which existed but
    were missing from the layout.
  - Leave card extended with Leave Allocation, Leave Policy, Leave Policy
    Assignment, Leave Type and Holiday List.
  - New "People & Payroll" card: Employee, Attendance, Additional Salary,
    Salary Slip, Payroll Entry, Salary Structure Assignment, Employee Grade,
    Department.

## 1.9.7 - 2026-08-28
- Leave Encashment date guard (server script + form guidance):
  - Blocks submission when the Encashment Date sits in a month whose payroll
    has already been run, or in a closed past month - with a plain-English
    explanation of why the money would never reach a payslip.
  - On successful submit, states which payroll run will pay it and how much.
  - Skipped entirely when "Pay Via Payment Entry" is ticked (cash now).
  - Form intro explains the rule while HR is still filling it in.

## 1.9.6 - 2026-08-28
- Payroll gate hardened against encashments and mid-month entries:
  - Review & Approve board gains a "Leave Encashments" group, reconciled
    against submitted Leave Encashment documents for the month.
  - Review board and readiness stones now match Additional Salary by the
    FULL payroll month (1st to month-end) instead of exactly month-end -
    an encashment dated mid-month can no longer pay while invisible to
    the gate.

## 1.9.5 - 2026-08-28
- Global filter now governs every FLOW figure on the Command Center:
  payroll recovery (loans + advances), the encashment pipeline and
  company-wide leave taken all respect the selected period; Who's Out and
  the all-staff leave roster respect the site filter. Balances (entitled
  days, ledger balance) stay as-of-today - a balance has no past-period
  form without ledger reconstruction.
- Leave balances - all staff replicated on the Overview tab with its own
  filter box.

## 1.9.4 - 2026-08-28
- Loans & Advances tab: "Recovery by month" panel with a month picker -
  any payroll month from the last 13 shows loans and advances recovered
  (staff, entries, drafts flagged amber, GHS total). One fetch, instant
  switching.

## 1.9.3 - 2026-08-28
- Command Center Leave tab: "Leave balances - all staff" table - every active
  employee with days left per leave type (remaining / allocated, red when
  exhausted), filterable by name, branch or department.
- Encashment pipeline made plain-language: stages read "Requested - awaiting
  HR approval", "Approved - pays with next payroll", "Paid", with a GHS
  column so the cash leaving with the next payroll is visible upfront.
- Fix: "Recovered via payroll" figure now reads only the LATEST payroll
  month - previously the 40-day window could double-count two months at
  month-end.

## 1.9.2 - 2026-08-28
- Employee 360: two new tables under the component breakdowns - "Extra pay
  (Additional Salary)" and "Recoveries & other deductions (Additional
  Salary)" - every one-off payroll entry in the period (trips, loans,
  advances, absences, allowances, encashments) with month, amount and
  draft/submitted status. Split by the salary component's Earning/Deduction
  type, so nothing that touched payroll is invisible any more.

## 1.9.1 - 2026-08-27
- Who's Out polish: counts moved into two quiet pills on the right of the
  panel title; the tables now flow directly underneath with their own
  "Away now" / "Starting soon" header columns - less clutter, cleaner scan.

## 1.9.0 - 2026-08-27
- Leave module consolidated into the app (single source of truth):
  - Adopted the five live leave server scripts as fixtures
    (anniversary policy assignment, encashment valuation base/22 x days,
    leave-status banner sync on submit/cancel + daily).
  - Adopted the six Employee leave-status banner custom fields as fixtures.
- ONE encashment path: retired the custom Leave Encashment Request intake
  doctype. Every surface (Command Center Leave tab, Leave Balance Board,
  Employee 360, number card, workspace links) now reads stock Leave
  Encashment, which actually values and pays via Additional Salary.
- New: Who's Out on the Command Center Leave tab - who is away right now and
  who starts leave within 14 days, computed live from approved Leave
  Applications ("back in N days" is calculated at render, never stored).
- Take Home Planner remnants fully removed from the app: 8 custom fields,
  14 property setters, 2 client scripts, all fixture references.

## 1.8.5 - 2026-08-27
- Employee Hub on BGL Operations and BGL Executive can now be hidden:
  click the "Employee Hub" title to collapse or expand it (the choice is
  remembered per browser).
- Employee 360 now shows the full leave picture: leave balance as of today
  (allocated / taken / days left per type), pending leave requests, and
  leave encashment requests with their status (Requested / Approved /
  Paid / Rejected, colour-coded), alongside leave taken in the period.

## 1.8.4 - 2026-08-27
- Fix: readiness stones no longer show DONE for steps that simply have no data
  yet (post-purge "no logs yet" now shows as OPEN, not complete).
- Fix: "Review drafts" stone requires at least one payroll entry for the month
  before it can turn green.
- Fix: default landing after login - set System Settings default_app so the
  /apps selector no longer overrides the cockpit workspaces (data fix applied
  live; documented here).

## 1.8.3 - 2026-08-27
- Fix: HR could not pick a Leave Type when applying on behalf of employees.
  A leftover training-time link filter on leave_type excluded Annual Leave
  (the main allocated type). Filter removed entirely - the field is back to
  stock ERPNext behavior (allocation-based), live and in fixtures.

## 1.8.2 - 2026-08-27
- Payroll Guide updated for launch: new section on the Employee Hub and
  Employee 360, and the fixing-mistakes section now covers removing an
  added person with the red x. Guide verified against every shipped feature.
- Dummy data purged from the live site (33 test trip logs + 6 demo loans);
  the 13 real vehicles kept. August starts clean.

## 1.8.1 - 2026-08-27
- Fix: typing in the Employee Hub no longer triggers the desk's global
  search (workspace pages treat any keystroke as search - ours now stay
  inside the hub).
- Command Center gains the Employee 360 tab: search a person, pick a period
  (this month / last month / 3 months / this year / all time) and see their
  complete picture - biodata, gross/deductions/net actually paid, earnings
  and deductions broken down by component, every salary slip, trips and
  leave. Built for executive oversight.

## 1.8.0 - 2026-08-27
- Employee Hub on both workspaces: type a name, get the person's card
  (photo/initials, branch, designation, joined, mobile, vehicle, basic,
  loan balance, leave taken, this month's trips) with one-click actions -
  open record, new leave, loans/advances/absence, payroll entries, salary
  slips, trip logs. Executive gets the read-only version. HR never has to
  leave the cockpit.

## 1.7.6 - 2026-08-27
- Login now lands BGL users directly in their cockpit (BGL Operations, or
  BGL Executive for viewers), skipping the v16 multi-app selector screen.

## 1.7.5 - 2026-08-27
- BGL Executive brought to full parity with the Operations cockpit: same
  five-stone trail (read-only, badge says HAPPENING NOW), numbered/check
  badges, DONE/OPEN/WAITING labels, breathing active stone, progress line
  with traveling spark, month chip, machined cards, version footer.
- Glowing time-of-day icon (sun / dusk / moon) restored on the greeting in
  all four views, with a gentle pulse.

## 1.7.4 - 2026-08-27
- Spacing tune: constellation and date line sit tight together; the breathing
  room starts from the greeting downward.

## 1.7.3 - 2026-08-27
- Uniformity: all four cockpit views (Operations + Executive, dark + light)
  now use the proven corner constellation block - fixed size, always renders,
  star colors follow the theme. No layout-dependent sky anywhere.
- Breathing room between the date line, greeting, subtitle, verdict, cards
  and trail on both workspaces.

## 1.7.2 - 2026-08-27
- Fix: cockpit and executive constellations were invisible when the block
  rendered before layout settled (canvas measured zero width) - both now
  re-measure themselves and follow the desk theme reliably in dark and light.
- Workspace blocks freed from the narrow editor column - the cockpit and
  executive deck now use the full page width.
- The progress line is real now: green through done stones, amber through the
  active one, with a traveling amber spark so the flow is visibly alive.
- Dark-mode headline no longer runs under the AUGUST month chip.

## 1.7.1 - 2026-08-27
- Fix: Review & Approve crashed on v16 (Additional Salary lost its remark
  field upstream). Audit notes now live in our own "BGL Note" field on
  Additional Salary - visible on every generated entry.
- Prep sheet: added employees can now be removed (x on each row - strikes
  the row, zeroes it; Save then removes any draft; click again to restore).
- All BGL desk pages (Trip Sheet, Payroll Prep, Review & Approve, Guide)
  gained proper left/right spacing from the desk sidebar.

## 1.7.0 - 2026-08-26
- Payroll Cockpit on the BGL Operations workspace: greeting, five-stone monthly
  trail (do-this-next guidance), launchpad tiles, self-help cards, twinkling
  constellation in both desk themes.
- BGL Executive workspace for management: read-only trail, yesterday's trips,
  month cost, door to the Command Center.
- Command Center now requires the "Command Center Viewer" role
  (Ismail, Zafer, Administrator, Powersoft Helpdesk by default) and gains the
  twinkling star field + refreshed typography.
- Review & Approve board: month drafts grouped by source with reconciliation
  against trip sheets, ledger and last month; group approve; proceed to
  Payroll Entry only when all green.
- Cockpit becomes every BGL user's landing page automatically at login.
- Login page gains a twinkling constellation (toned Betonsa red + silver);
  the splash logo breathes with a soft red glow while the desk loads.

## 1.6.0 - 2026-08-26
- Monthly Payroll Prep Sheet (renamed from Deduction Sheet): New Hire
  Pro-Ration (auto-detected joiners, basic x days/22 override + next-month
  salary assignment), fixed allowances & overtime carried forward with the
  OT cell locked for Trips/Cubic earners.
- Trip sheet: permanent-lock warning + Unlock Month (HR Manager).
- Payroll Readiness checklist on the Command Center Overview.
- Inline loan creation on the prep sheet; absent days auto-amounted to match
  HR upload practice; teaching next-step messages across all saves.

## 1.5.0 - 2026-08
- Generate Trip Earnings (Drafts) from locked sheets, dated to month-end,
  double-pay guarded via pulled_to_payroll.
- Monthly Deduction Sheet (loans, advances, absences), desk + command center.

## 1.0.0 - 2026-08
- Initial app: Daily Trip Log, BGL Trip Rate, Staff Loan Advance ledger,
  Leave Encashment Request, bulk Trip Log Sheet (desk + command center),
  Command Center web page, reports, print formats, daily CEO email.
