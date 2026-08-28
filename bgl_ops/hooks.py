app_name = "bgl_ops"
app_title = "BGL Ops"
app_publisher = "Powersoft"
app_description = "Trips & cubic tracking, staff loans, leave visibility and an executive command center for Betonsa Ghana Limited."
app_email = "ai4powersoft@gmail.com"
app_license = "Proprietary"

# Target stack: Frappe v16 / ERPNext v16 / Frappe HR v16 (as on bgl.powersoftsystem.com)
required_apps = ["erpnext", "hrms"]

on_session_creation = "bgl_ops.boot.set_default_workspace"

# website (login) + desk (splash) assets - plain files, no node build needed
web_include_css = ["/assets/bgl_ops/css/bgl_login.css"]
web_include_js = ["/assets/bgl_ops/js/bgl_login.js"]
app_include_css = ["/assets/bgl_ops/css/bgl_desk.css"]


# Everything this app owns is synced from ./fixtures on `bench migrate`.
fixtures = [
    {"dt": "Custom HTML Block", "filters": [["name", "in", ["BGL Payroll Cockpit", "BGL Executive Deck"]]]},
    {"dt": "Role", "filters": [["name", "in", ["Command Center Viewer"]]]},
    {"dt": "DocType", "filters": [["name", "in", [
        "Daily Trip Log", "BGL Trip Rate", "BGL Vehicle",
        "Staff Loan Advance", "Staff Loan Repayment",
    ]]]},
    {"dt": "Server Script", "filters": [["name", "in", [
        "bgl_auto_leave_anniversary", "bgl_leave_encashment_amount",
        "bgl_leave_status_after_submit", "bgl_leave_status_after_cancel",
        "bgl_leave_status_sync", "bgl_encashment_date_guard",
    ]]]},
    # All site-specific custom fields (app-generated hrms/erpnext fields excluded)
    {"dt": "Custom Field", "filters": [["name", "in", [
        "Daily Trip Log-salary_component",
        "Additional Salary-custom_bgl_note",
        "Employee-custom_no_of_days_suspended", "Employee-ssnit_number",
        "Employee-custom_truck_no",
        "Employee-custom_leave_status_sb", "Employee-custom_leave_status",
        "Employee-custom_current_leave_type", "Employee-custom_leave_status_cb",
        "Employee-custom_current_leave_from", "Employee-custom_return_to_work_date",
        "Leave Application-custom_designation", "Leave Application-custom_resume_date",
        "Leave Application-custom_receiving_section", "Leave Application-custom_form_serial_no",
        "Leave Application-custom_security_received_date", "Leave Application-custom_receiving_col",
        "Leave Application-custom_secretary_received_date", "Leave Application-custom_approval_section",
        "Leave Application-custom_approver_comment", "Leave Application-custom_approval_date",
        "Leave Application-custom_hr_section", "Leave Application-custom_leave_days_bf",
        "Leave Application-custom_leave_days_entitled", "Leave Application-custom_leave_days_taken",
        "Leave Application-custom_leave_days_remaining", "Leave Application-custom_hr_col",
        "Leave Application-custom_proceed_on", "Leave Application-custom_contact_of_applicant",
        "Leave Application-custom_substituted_by", "Leave Application-custom_actual_start_date",
        "Leave Application-custom_actual_resume_date", "Leave Application-custom_hr_remarks",
    ]]]},
    {"dt": "Property Setter", "filters": [["doc_type", "in", [
        "Payroll Entry", "Salary Structure Assignment", "Employee",
        "Leave Application", "Leave Allocation", "Purchase Receipt",
        "Daily Trip Log",
    ]]]},
    {"dt": "Client Script", "filters": [["name", "in", [
        "Daily Trip Log - Auto Cost",
        "Staff Loan Advance - Balance",
        "Leave Encashment - Date Guidance",
    ]]]},
    {"dt": "Report", "filters": [["name", "in", [
        "BGL Trip Costing", "BGL Trips - Yesterday", "BGL Leave Balance Board",
        "Additional Salary Report", "Additional Salary Summary by Branch",
        "Payroll Summary Report - Adenta", "Payroll Summary Report - Tema",
        "SSNIT 5.5% & 13% Report", "SSNIT 5% & 13.5% Report",
    ]]]},
    {"dt": "Print Format", "filters": [["name", "in", [
        "Salary Slip - Betonsa", "Betonsa Leave Application Form",
        "Payroll Management Report - Adenta", "Payroll Management Report - Tema",
        "SSNIT 5.5% & 13% Report", "SSNIT 5% & 13.5% Report",
        "BGL Trip Costing", "BGL Trips - Yesterday",
    ]]]},
    {"dt": "Letter Head", "filters": [["name", "in", ["Betonsa"]]]},
    {"dt": "Auto Email Report", "filters": [["name", "in", ["BGL Trips - Yesterday"]]]},
    {"dt": "Number Card", "filters": [["name", "in", [
        "Trips This Month", "Cubic This Month (m3)", "Trip Pay This Month (GHS)",
        "Active Loans & Advances", "Money Owed to Company (GHS)",
        "Encash Requests Pending",
    ]]]},
    {"dt": "Dashboard Chart", "filters": [["name", "in", [
        "Daily Trip Pay Trend", "Trip Pay by Site", "Loan Balance by Type",
    ]]]},
]

website_route_rules = [
    {"from_route": "/command-center", "to_route": "command_center"},
]
