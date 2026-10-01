import frappe


def get_context(context):
    if frappe.session.user in (None, "", "Guest"):
        frappe.local.flags.redirect_location = "/login?redirect-to=/command-center"
        raise frappe.Redirect
    roles = set(frappe.get_roles())
    if not roles & {"System Manager", "Command Center Viewer"}:
        context.no_cache = 1
        context.denied = 1
        context.full_name = frappe.utils.get_fullname(frappe.session.user)
        return context
    context.no_cache = 1
    context.full_name = frappe.utils.get_fullname(frappe.session.user)
    context.csrf_token = frappe.sessions.get_csrf_token()
    return context
