import frappe
from frappe.utils import today, add_days, get_first_day


def _require_access():
    if frappe.session.user in (None, "", "Guest"):
        frappe.throw("Login required", frappe.PermissionError)
    roles = set(frappe.get_roles())
    if not roles & {"System Manager", "HR Manager", "HR User"}:
        frappe.throw("Not permitted", frappe.PermissionError)


@frappe.whitelist()
def dashboard_data():
    """All figures for the /command-center page in one call."""
    _require_access()
    month_start = get_first_day(today())
    yesterday = add_days(today(), -1)

    def q(sql, values=None):
        return frappe.db.sql(sql, values or {}, as_dict=True)

    trips_month = q(
        """select ifnull(sum(quantity),0) qty, ifnull(sum(amount),0) amt
           from `tabDaily Trip Log`
           where docstatus=1 and unit='Trip' and log_date >= %(ms)s""",
        {"ms": month_start})[0]
    cubic_month = q(
        """select ifnull(sum(quantity),0) qty, ifnull(sum(amount),0) amt
           from `tabDaily Trip Log`
           where docstatus=1 and unit='Cubic' and log_date >= %(ms)s""",
        {"ms": month_start})[0]
    yday = q(
        """select branch site, ifnull(sum(quantity),0) qty, ifnull(sum(amount),0) amt
           from `tabDaily Trip Log`
           where docstatus=1 and log_date = %(d)s group by branch""",
        {"d": yesterday})
    by_site = q(
        """select branch site, pay_group, ifnull(sum(quantity),0) qty,
                  ifnull(sum(amount),0) amt
           from `tabDaily Trip Log`
           where docstatus=1 and log_date >= %(ms)s
           group by branch, pay_group order by amt desc""",
        {"ms": month_start})
    loans = q(
        """select loan_type, count(*) cnt, ifnull(sum(principal),0) principal,
                  ifnull(sum(total_repaid),0) repaid, ifnull(sum(balance),0) balance
           from `tabStaff Loan Advance`
           where status='Active' group by loan_type""")
    encash = q(
        """select status, count(*) cnt, ifnull(sum(days),0) days
           from `tabLeave Encashment Request` group by status""")
    trend = q(
        """select log_date d, ifnull(sum(amount),0) amt, ifnull(sum(quantity),0) qty
           from `tabDaily Trip Log`
           where docstatus=1 and log_date >= %(f)s
           group by log_date order by log_date""",
        {"f": add_days(today(), -14)})
    crew = q(
        """select designation, branch, count(*) cnt from `tabEmployee`
           where status='Active' and designation in
             ('Mixer Driver','Pump Driver','Pump Operator','Trailer Driver',
              'Plant Operator','Chemical')
           group by designation, branch""")

    return {
        "as_of": today(),
        "yesterday": yesterday,
        "trips_month": trips_month,
        "cubic_month": cubic_month,
        "yesterday_by_site": yday,
        "month_by_site_group": by_site,
        "active_loans": loans,
        "encash": encash,
        "crew": crew,
        "trend_14d": trend,
    }
