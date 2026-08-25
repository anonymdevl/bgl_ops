# BGL Ops (bgl_ops)

Installable Frappe/ERPNext app for Betonsa Ghana Limited, by Powersoft.

Bundles:
- DocTypes: Daily Trip Log, BGL Trip Rate, Staff Loan Advance (+ Staff Loan
  Repayment child), Leave Encashment Request
- Client Scripts: live trip costing, loan balance auto-compute
- Query Reports: BGL Trip Costing, BGL Trips - Yesterday, BGL Leave Balance Board
- Dashboard: 6 number cards + 3 charts on the "BGL Operations" workspace
- Executive page: /command-center (premium styled, live data, login required)

## Requirements (version 16)
- Frappe Framework v16 (tested against 16.21)
- ERPNext v16 (tested against 16.22)
- Frappe HR (hrms) v16 (tested against 16.8) - declared in required_apps
- Python >= 3.10 (bench standard for v16)
- No extra pip packages; the app uses only frappe APIs.

NOTES
- The Take Home client scripts call server methods (thp_calculate / thp_apply /
  thp_bulk_generate) provided by the separately installed "smarterp" app, and the
  Take Home DocTypes themselves live in the site database. Those scripts and the
  related custom fields are bundled here for completeness; they are simply inert
  if smarterp is absent.
- The "Betonsa" letter head and report logos reference /files/betonsa_logo.jpeg.
  On a fresh site, upload that file once (or the logo will not render).
- The "BGL Vehicle" master (fleet numbers incl. marketer cars/pickups) is
  site-resident by design and is intentionally NOT in the doctype fixtures:
  re-importing doctype fixtures drops and recreates their tables, which would
  erase vehicle records. For the same reason, NEVER edit fixtures/doctype.json
  on a live installation - add new fields via Custom Field fixtures instead.
- The BGL Trip Rate seed data (the confirmed rates) lives in the SITE, not in
  fixtures, by design: rates are operational data HR maintains.

## SITE-RESIDENT INVENTORY (deliberate, not in fixtures)
These live only in the site database. They are SAFE across migrate/update
(sync never deletes records it does not own), but a from-scratch rebuild
would need them recreated:
- BGL Vehicle doctype + vehicle records (kept out of fixtures so doctype
  re-import can never wipe the table)
- BGL Trip Rate naming rule (live site uses format:RATE-{group}-{site}-...;
  fixtures still say hash - do not "fix" this, see doctype.json warning)
- Workspace Sidebar icons and items for BGL Operations
- All operational data: trip rates, trip logs, loans, encash requests,
  vehicles - protected by database backups, as data should be.

## Install
    cd frappe-bench
    bench get-app /path/to/bgl_ops      # or a git URL
    bench --site bgl.powersoftsystem.com install-app bgl_ops
    bench --site bgl.powersoftsystem.com migrate
    bench build && bench restart

Fixtures sync on migrate. Safe to re-run; fixtures are idempotent.

NOTE: If the site already has these customizations created manually (as
bgl.powersoftsystem.com does today), installing the app adopts them: fixture
sync updates records in place by name. Take a backup first as standard practice:
    bench --site <site> backup

## Command Center
After install, visit https://<site>/command-center while logged in.
Access: any authenticated user with HR User / HR Manager / System Manager role.
