# bgl_ops

Frappe app for Betonsa Ghana Limited (BGL). Maintained by Powersoft.

Covers BGL's daily operations on ERPNext: trip and cubic pay tracking,
staff loans and advances, payroll preparation and review, leave management,
and an executive command centre.

## What's included

- DocTypes: Daily Trip Log, BGL Trip Rate, BGL Vehicle, Staff Loan Advance
  (with repayment child table)
- Desk pages: Trip Sheet, Payroll Prep Sheet, Review & Approve, Payroll Guide
- Web page: `/command-center` (role-gated, live data)
- Workspaces: BGL Operations (HR) and BGL Executive (management)
- Reports: Trip Costing, Trips - Yesterday, Leave Balance Board, payroll and
  SSNIT reports
- Server scripts for leave: anniversary policy assignment, encashment
  valuation (base / 22 x days), encashment date guard, employee leave-status
  sync
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
site). The salary components `Loans`, `Salary Advance`, `Absent` and
`Leave Encashment` must exist on the site; the payroll prep sheet and
encashment flow depend on them.

## Access

- `/command-center`: HR User, HR Manager, System Manager, or Command Center
  Viewer
- BGL Executive workspace: Command Center Viewer
- Payroll prep and review actions: HR Manager

## Support

Built on Python by Michael | Support: michael@powersoftsystem.com | +233 54 726 0353
