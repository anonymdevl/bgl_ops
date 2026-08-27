import frappe


def set_default_workspace(login_manager=None):
    """On login: make the cockpit the landing page for BGL users.

    - Command Center Viewers land on BGL Executive.
    - HR users land on BGL Operations.
    - Users who explicitly chose a different workspace are left alone.
    """
    try:
        user = frappe.session.user
        if user in ("Guest", "Administrator") and user != "Administrator":
            return
        current = frappe.db.get_value("User", user, "default_workspace")
        roles = set(frappe.get_roles(user))
        target = None
        if "Command Center Viewer" in roles:
            target = "BGL Executive"
        elif roles & {"HR Manager", "HR User"}:
            target = "BGL Operations"
        if not target:
            return
        # only fill in when empty, or when still pointing at a stock page
        if not current or current in ("Home", "HR", "Payroll"):
            if frappe.db.exists("Workspace", target):
                frappe.db.set_value("User", user, "default_workspace",
                                    target, update_modified=False)
    except Exception:
        frappe.log_error(frappe.get_traceback(),
                         "bgl_ops set_default_workspace")
