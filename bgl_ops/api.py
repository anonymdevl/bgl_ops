import json
import calendar

import frappe
from frappe.utils import add_days, flt, get_first_day, getdate, today

PAY_GROUPS = [
    "Mixer Driver", "Pump Driver", "Pump Operator",
    "Trailer Driver", "Plant Operator", "Chemical",
]
GROUP_UNIT = {
    "Mixer Driver": "Trip", "Pump Driver": "Trip", "Trailer Driver": "Trip",
    "Pump Operator": "Cubic", "Plant Operator": "Cubic", "Chemical": "Fixed",
}


def _require_access():
    if frappe.session.user in (None, "", "Guest"):
        frappe.throw("Login required", frappe.PermissionError)
    roles = set(frappe.get_roles())
    if not roles & {"System Manager", "HR Manager", "HR User"}:
        frappe.throw("Not permitted", frappe.PermissionError)


def _q(sql, values=None):
    return frappe.db.sql(sql, values or {}, as_dict=True)


def _active_rates():
    return _q(
        """select pay_group, site, day_type, rate, effective_from, salary_component
           from `tabBGL Trip Rate` where is_active=1
           order by effective_from desc""")


def _rate_for(rates, pay_group, site, day_type, on_date):
    """Site-specific rate wins over 'All'; latest effective_from <= date."""
    best = None
    for r in rates:
        if r.pay_group != pay_group or r.day_type != day_type:
            continue
        if str(r.effective_from) > str(on_date):
            continue
        if r.site == site:
            return r
        if r.site == "All" and best is None:
            best = r
    return best


@frappe.whitelist()
def dashboard_data():
    """All figures for the /command-center page in one call."""
    _require_access()
    month_start = get_first_day(today())
    yesterday = add_days(today(), -1)

    trips_month = _q(
        """select ifnull(sum(quantity),0) qty, ifnull(sum(amount),0) amt
           from `tabDaily Trip Log`
           where docstatus=1 and unit='Trip' and log_date >= %(ms)s""",
        {"ms": month_start})[0]
    cubic_month = _q(
        """select ifnull(sum(quantity),0) qty, ifnull(sum(amount),0) amt
           from `tabDaily Trip Log`
           where docstatus=1 and unit='Cubic' and log_date >= %(ms)s""",
        {"ms": month_start})[0]
    logs_today = _q(
        """select count(*) cnt, ifnull(sum(quantity),0) qty
           from `tabDaily Trip Log`
           where docstatus < 2 and log_date = %(d)s""",
        {"d": today()})[0]
    yday = _q(
        """select branch site, ifnull(sum(quantity),0) qty, ifnull(sum(amount),0) amt
           from `tabDaily Trip Log`
           where docstatus=1 and log_date = %(d)s group by branch""",
        {"d": yesterday})
    by_site = _q(
        """select branch site, pay_group, ifnull(sum(quantity),0) qty,
                  ifnull(sum(amount),0) amt
           from `tabDaily Trip Log`
           where docstatus=1 and log_date >= %(ms)s
           group by branch, pay_group order by amt desc""",
        {"ms": month_start})
    trend = _q(
        """select log_date d, ifnull(sum(amount),0) amt, ifnull(sum(quantity),0) qty
           from `tabDaily Trip Log`
           where docstatus=1 and log_date >= %(f)s
           group by log_date order by log_date""",
        {"f": add_days(today(), -14)})

    # Loans - the new ledger (source of truth once seeded)
    loans = _q(
        """select loan_type, count(*) cnt, ifnull(sum(principal),0) principal,
                  ifnull(sum(total_repaid),0) repaid, ifnull(sum(balance),0) balance
           from `tabStaff Loan Advance`
           where status='Active' group by loan_type""")
    loan_rows = _q(
        """select name, employee_name, loan_type, principal, total_repaid, balance, status
           from `tabStaff Loan Advance`
           where status in ('Active','Fully Paid')
           order by balance desc limit 25""")

    # Interim view until the ledger is seeded: live payroll deductions (last 40 days)
    payroll_recovery = _q(
        """select salary_component, ifnull(sum(amount),0) amt,
                  count(distinct employee) staff
           from `tabAdditional Salary`
           where disabled=0 and docstatus < 2
             and salary_component in ('Loans','Salary Advance')
             and payroll_date >= %(f)s
           group by salary_component""",
        {"f": add_days(today(), -40)})

    encash = _q(
        """select status, count(*) cnt, ifnull(sum(days),0) days
           from `tabLeave Encashment Request` group by status""")

    # Leave summary (company-wide, current allocations)
    leave = {
        "entitled": flt(_q(
            """select ifnull(sum(total_leaves_allocated),0) v from `tabLeave Allocation`
               where docstatus=1 and from_date<=%(d)s and to_date>=%(d)s""",
            {"d": today()})[0].v),
        "taken": flt(_q(
            """select ifnull(sum(la.total_leave_days),0) v from `tabLeave Application` la
               where la.docstatus=1 and la.status='Approved'
                 and la.from_date >= %(y)s""",
            {"y": str(getdate(today()).year) + "-01-01"})[0].v),
        "pending_apps": _q(
            """select count(*) v from `tabLeave Application`
               where docstatus=0 and status='Open'""")[0].v,
        "on_leave_today": _q(
            """select count(*) v from `tabLeave Application`
               where docstatus=1 and status='Approved'
                 and from_date<=%(d)s and to_date>=%(d)s""",
            {"d": today()})[0].v,
    }

    crew = _q(
        """select designation, branch, count(*) cnt from `tabEmployee`
           where status='Active' and designation in
             ('Mixer Driver','Pump Driver','Pump Operator','Trailer Driver',
              'Plant Operator','Chemical')
           group by designation, branch""")
    headcount = _q(
        "select count(*) v from `tabEmployee` where status='Active'")[0].v

    return {
        "as_of": today(),
        "yesterday": yesterday,
        "trips_month": trips_month,
        "cubic_month": cubic_month,
        "logs_today": logs_today,
        "yesterday_by_site": yday,
        "month_by_site_group": by_site,
        "trend_14d": trend,
        "active_loans": loans,
        "loan_rows": loan_rows,
        "payroll_recovery": payroll_recovery,
        "encash": encash,
        "leave": leave,
        "crew": crew,
        "headcount": headcount,
        "rates": _active_rates(),
    }


@frappe.whitelist()
def bulk_sheet(site, month):
    """Employees x days grid data for one site and month (YYYY-MM)."""
    _require_access()
    year, mon = int(month[:4]), int(month[5:7])
    days_in_month = calendar.monthrange(year, mon)[1]

    employees = _q(
        """select name, employee_name, designation,
                  ifnull(custom_truck_no,'') truck_no
           from `tabEmployee`
           where status='Active' and branch=%(site)s and designation in
             ('Mixer Driver','Pump Driver','Pump Operator','Trailer Driver',
              'Plant Operator','Chemical')
           order by field(designation,'Mixer Driver','Trailer Driver','Pump Driver',
                          'Pump Operator','Plant Operator','Chemical'), employee_name""",
        {"site": site})

    logs = _q(
        """select name, employee, day(log_date) d, quantity, amount, docstatus
           from `tabDaily Trip Log`
           where payroll_month=%(m)s and branch=%(site)s and docstatus < 2""",
        {"m": month, "site": site})
    grid = {}
    for l in logs:
        grid.setdefault(l.employee, {})[str(l.d)] = {
            "qty": l.quantity, "amt": l.amount,
            "name": l.name, "submitted": l.docstatus == 1,
        }

    saturdays = [d for d in range(1, days_in_month + 1)
                 if calendar.weekday(year, mon, d) == 5]
    sundays = [d for d in range(1, days_in_month + 1)
               if calendar.weekday(year, mon, d) == 6]

    return {
        "site": site, "month": month, "days": days_in_month,
        "saturdays": saturdays, "sundays": sundays,
        "employees": employees, "grid": grid,
        "rates": _active_rates(),
    }


@frappe.whitelist()
def bulk_save(site, month, entries, trucks=None):
    """Save a batch of day-quantities as draft Daily Trip Logs.

    entries: json list of {employee, day, qty}
    trucks:  json dict  {employee: truck_no} - updates Employee master
    Existing submitted logs are never touched. qty 0/blank deletes a draft.
    """
    _require_access()
    entries = json.loads(entries) if isinstance(entries, str) else (entries or [])
    trucks = json.loads(trucks) if isinstance(trucks, str) else (trucks or {})
    rates = _active_rates()

    emp_cache = {}

    def emp(name):
        if name not in emp_cache:
            emp_cache[name] = frappe.db.get_value(
                "Employee", name,
                ["employee_name", "designation", "branch"], as_dict=True)
        return emp_cache[name]

    created = updated = deleted = skipped = 0
    errors = []

    VEHICLE_TYPE = {"Mixer Driver": "Mixer Truck", "Trailer Driver": "Trailer",
                    "Pump Driver": "Pump Truck", "Pump Operator": "Pump Truck"}

    def ensure_vehicle(v_no, designation):
        v_no = (v_no or "").strip()
        if not v_no:
            return ""
        if not frappe.db.exists("BGL Vehicle", v_no):
            frappe.get_doc({
                "doctype": "BGL Vehicle", "vehicle_no": v_no,
                "vehicle_type": VEHICLE_TYPE.get(designation, "Other"),
                "site": site, "is_active": 1,
            }).insert(ignore_permissions=False)
        return v_no

    for t_emp, t_no in (trucks or {}).items():
        info = emp(t_emp)
        frappe.db.set_value("Employee", t_emp, "custom_truck_no",
                            ensure_vehicle(t_no, info.designation if info else None),
                            update_modified=False)

    for e in entries:
        try:
            employee = e.get("employee")
            day = int(e.get("day"))
            qty = flt(e.get("qty") or 0)
            log_date = getdate(f"{month}-{day:02d}")
            info = emp(employee)
            if not info:
                skipped += 1
                continue

            existing = frappe.db.get_value(
                "Daily Trip Log",
                {"employee": employee, "log_date": log_date, "docstatus": ("<", 2)},
                ["name", "docstatus"], as_dict=True)

            if existing and existing.docstatus == 1:
                skipped += 1  # submitted days are locked
                continue

            if qty <= 0:
                if existing:
                    frappe.delete_doc("Daily Trip Log", existing.name,
                                      ignore_permissions=False)
                    deleted += 1
                continue

            pay_group = info.designation if info.designation in PAY_GROUPS else None
            if not pay_group:
                skipped += 1
                continue
            day_type = "Saturday" if log_date.weekday() == 5 else "Weekday"
            rate = _rate_for(rates, pay_group, site, day_type, log_date)
            rate_val = flt(rate.rate) if rate else 0
            component = rate.salary_component if rate else None

            values = {
                "log_date": log_date, "employee": employee,
                "employee_name": info.employee_name,
                "designation": info.designation, "branch": info.branch,
                "pay_group": pay_group, "unit": GROUP_UNIT[pay_group],
                "day_type": day_type, "quantity": qty,
                "rate_applied": rate_val, "amount": qty * rate_val,
                "salary_component": component, "payroll_month": month,
                "truck_no": (trucks or {}).get(employee)
                    or frappe.db.get_value("Employee", employee, "custom_truck_no"),
            }
            if existing:
                doc = frappe.get_doc("Daily Trip Log", existing.name)
                doc.update(values)
                doc.save()
                updated += 1
            else:
                doc = frappe.get_doc({"doctype": "Daily Trip Log", **values})
                doc.insert()
                created += 1
        except Exception as ex:
            errors.append(f"{e.get('employee')} day {e.get('day')}: {ex}")

    frappe.db.commit()
    return {"created": created, "updated": updated, "deleted": deleted,
            "skipped_submitted": skipped, "errors": errors[:10]}


@frappe.whitelist()
def submit_month(site, month):
    """Submit all draft logs for a site+month (locks them for payroll)."""
    _require_access()
    if "HR Manager" not in frappe.get_roles() and \
            "System Manager" not in frappe.get_roles():
        frappe.throw("Only HR Manager can submit the sheet", frappe.PermissionError)
    names = frappe.get_all(
        "Daily Trip Log",
        filters={"payroll_month": month, "branch": site, "docstatus": 0},
        pluck="name")
    done = 0
    for n in names:
        frappe.get_doc("Daily Trip Log", n).submit()
        done += 1
    frappe.db.commit()
    return {"submitted": done}
