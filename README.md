# bgl_ops

Frappe app for Betonsa Ghana Limited (BGL). Maintained by Powersoft.

Covers BGL's daily operations on ERPNext: trip and cubic pay tracking,
staff loans and advances, payroll preparation and review, leave management,
and an executive command centre.

## What's included

- DocTypes: Daily Trip Log, BGL Trip Rate, BGL Vehicle, Staff Loan Advance
  (with repayment child table), BGL Leave Encashment, BGL Payroll Signoff
- Desk pages: Trip Sheet, Payroll Prep Sheet, Review & Approve, Payroll Guide
- Web page: `/command-center` (role-gated, live data)
- Workspaces: BGL Operations (HR) and BGL Executive (management)
- Reports: Trip Costing, Trips - Yesterday, Leave Balance Board, payroll and
  SSNIT reports
- Server scripts for leave: anniversary policy assignment and employee
  leave-status sync. Encashment is an HR-entered record (BGL Leave
  Encashment) settled outside payroll
- Fixtures for all custom fields, property setters, client scripts, print
  formats, dashboards and number cards

## Requirements

- Frappe v16, ERPNext v16, Frappe HR v16 (`required_apps`)
- No additional Python packages

## Install

    bench get-app <repo-url>
    bench --site <site> install-app bgl_ops
    bench --site <site> migrate
    bench build && bench restart

Fixtures sync on every migrate and are idempotent. On a site that already
carries these customisations, fixture sync adopts them in place by name.
Back up first as standard practice.

## Site-resident data (not shipped)

Operational data stays in the site database and is expected to be maintained
there: trip rates, trip logs, vehicles, loans, leave records, and the
`betonsa_logo.jpeg` file used by the letter head (upload once on a fresh
site). The salary components `Loans`, `Salary Advance` and `Absent`
must exist on the site; the payroll prep sheet depends on them.

Trip rates are site-specific by design. Airport and Tema do not pay the same
rate for the same work, and Saturday differs again, so every rate row names a
pay group, a site and a day type. Do not widen a row back to site "All" - a
single row covering both sites is what mispriced Airport once already.

## Payroll month, in order

1. Trips and cubic entered daily, both sites, then Submit Month and Generate
   Trip Earnings.
2. Payroll Prep Sheet: Pro-Ration (joiners and existing part-month staff),
   Basic Salaries, Loans, Advances, Absences, Allowances and OT. Advance
   boxes start at 0 - an advance is a one-off, not a standing deduction.
3. Mark reviewed on Basic Salaries and on Allowances and OT. Payroll refuses
   to run while either is unsigned, and a sign-off reopens itself if the
   figures move afterwards.
4. Review and Approve: group by group, or Approve every draft in one pass.
   Either way nobody who has left may be approved onto payroll.
5. Create Payroll on the same page. It asks again before opening a new month
   and refuses while an earlier month is still unsubmitted.

## Access

- `/command-center`: HR User, HR Manager, System Manager, or Command Center
  Viewer
- BGL Executive workspace: Command Center Viewer
- Payroll prep and review actions: HR Manager

## Support

Built on Python by Michael | Support: michael@powersoftsystem.com | +233 54 726 0353
