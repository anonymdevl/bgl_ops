# bgl_ops Changelog

All releases in plain language. Version shows in the Payroll Cockpit footer.

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
