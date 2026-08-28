# bgl_ops Changelog

All releases in plain language. Version shows in the Payroll Cockpit footer.

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
