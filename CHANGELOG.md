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
