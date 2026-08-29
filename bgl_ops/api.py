import json
import calendar

import frappe
from frappe.utils import add_days, cint, flt, get_first_day, getdate, today

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
def dashboard_data(from_date=None, to_date=None, site=None):
    """All figures for the /command-center page in one call.

    from_date/to_date scope the trip metrics (default: month to date).
    site filters trips to one branch ('All' or empty = both).
    Recovery, encashment and leave-taken respect the period; balances\n    (entitled days, ledger) are as-of-today snapshots by nature.
    """
    _require_access()
    period_start = str(getdate(from_date)) if from_date else str(get_first_day(today()))
    period_end = str(getdate(to_date)) if to_date else today()
    if period_start > period_end:
        period_start, period_end = period_end, period_start
    site = site if site in ("Airport", "Tema") else "All"
    yesterday = add_days(today(), -1)
    # payroll-dated flows (recovery, encashment) are monthly by nature:
    # align to whole months so a 31st-dated entry shows in a month-to-date view
    from frappe.utils import get_last_day
    pm_start = str(get_first_day(getdate(period_start)))
    pm_end = str(get_last_day(getdate(period_end)))

    p = {"f": period_start, "t": period_end, "site": site}
    site_cond = " and (%(site)s = 'All' or branch = %(site)s)"
    # Everything below hangs off an employee rather than carrying its own
    # branch column, so it filters through the Employee record instead.
    emp_cond = " and (%(site)s = 'All' or e.branch = %(site)s)"
    trips_month = _q(
        """select ifnull(sum(quantity),0) qty, ifnull(sum(amount),0) amt
           from `tabDaily Trip Log`
           where docstatus=1 and unit='Trip'
             and log_date between %(f)s and %(t)s""" + site_cond, p)[0]
    cubic_month = _q(
        """select ifnull(sum(quantity),0) qty, ifnull(sum(amount),0) amt
           from `tabDaily Trip Log`
           where docstatus=1 and unit='Cubic'
             and log_date between %(f)s and %(t)s""" + site_cond, p)[0]
    logs_today = _q(
        """select count(*) cnt, ifnull(sum(quantity),0) qty
           from `tabDaily Trip Log`
           where docstatus < 2 and log_date = %(d)s""" + site_cond,
        {"d": today(), "site": site})[0]
    yday = _q(
        """select branch site, ifnull(sum(quantity),0) qty, ifnull(sum(amount),0) amt
           from `tabDaily Trip Log`
           where docstatus=1 and log_date = %(d)s""" + site_cond + """
           group by branch""",
        {"d": yesterday, "site": site})
    by_site = _q(
        """select branch site, pay_group, ifnull(sum(quantity),0) qty,
                  ifnull(sum(amount),0) amt
           from `tabDaily Trip Log`
           where docstatus=1 and log_date between %(f)s and %(t)s""" + site_cond + """
           group by branch, pay_group order by amt desc""", p)
    trend = _q(
        """select log_date d, ifnull(sum(amount),0) amt, ifnull(sum(quantity),0) qty
           from `tabDaily Trip Log`
           where docstatus=1 and log_date between %(f)s and %(t)s""" + site_cond + """
           group by log_date order by log_date limit 92""", p)

    # Loans - the new ledger (source of truth once seeded)
    loans = _q(
        """select l.loan_type, count(*) cnt, ifnull(sum(l.principal),0) principal,
                  ifnull(sum(l.total_repaid),0) repaid, ifnull(sum(l.balance),0) balance
           from `tabStaff Loan Advance` l
           join `tabEmployee` e on e.name = l.employee
           where l.status='Active'""" + emp_cond + """
           group by l.loan_type""", p)
    loan_rows = _q(
        """select l.name, l.employee_name, l.loan_type, l.principal,
                  l.total_repaid, l.balance, l.status
           from `tabStaff Loan Advance` l
           join `tabEmployee` e on e.name = l.employee
           where l.status in ('Active','Fully Paid')""" + emp_cond + """
           order by l.balance desc limit 500""", p)

    # Salary advances are not ledger records - they are recovered in full the
    # same month - but "who owes what" is the question people actually ask,
    # so this month's advances belong in the same table.
    advance_rows = _q(
        """select a.employee, a.employee_name, a.amount
           from `tabAdditional Salary` a
           join `tabEmployee` e on e.name = a.employee
           where a.docstatus < 2 and a.salary_component = 'Salary Advance'
             and a.payroll_date between %(ms)s and %(me)s""" + emp_cond + """
           order by a.amount desc""",
        {"ms": get_first_day(getdate(today())).strftime("%Y-%m-%d"),
         "me": _month_end(today()[:7]), "site": site})

    # Interim view until the ledger is seeded: live payroll deductions (last 40 days)
    payroll_recovery = _q(
        """select a.salary_component, ifnull(sum(a.amount),0) amt,
                  count(distinct a.employee) staff
           from `tabAdditional Salary` a
           join `tabEmployee` e on e.name = a.employee
           where a.disabled=0 and a.docstatus < 2
             and a.salary_component in ('Loans','Salary Advance')
             and a.payroll_date between %(f)s and %(t)s""" + emp_cond + """
           group by a.salary_component""",
        {"f": pm_start, "t": pm_end, "site": site})

    # How many PEOPLE owe anything, counted once each. Adding the loan count
    # to the advance count double counts everyone who has both, and plenty do.
    owing_staff = _q(
        """select count(distinct a.employee) v
           from `tabAdditional Salary` a
           join `tabEmployee` e on e.name = a.employee
           where a.disabled=0 and a.docstatus < 2
             and a.salary_component in ('Loans','Salary Advance')
             and a.payroll_date between %(f)s and %(t)s""" + emp_cond,
        {"f": pm_start, "t": pm_end, "site": site})[0].v

    encash = _q(
        """select c.status, count(*) cnt, ifnull(sum(c.encashed_days),0) days,
                  ifnull(sum(c.encashed_amount),0) amt
           from `tabBGL Leave Encashment` c
           join `tabEmployee` e on e.name = c.employee
           where c.encashment_date between %(f)s and %(t)s""" + emp_cond + """
           group by c.status
           order by field(c.status,'Requested','Approved','Unpaid','Paid','Rejected')""",
        {"f": pm_start, "t": pm_end, "site": site})

    # Leave summary - follows the site selector like everything else
    leave = {
        "entitled": flt(_q(
            """select ifnull(sum(a.total_leaves_allocated),0) v
               from `tabLeave Allocation` a
               join `tabEmployee` e on e.name = a.employee
               where a.docstatus=1 and a.from_date<=%(d)s
                 and a.to_date>=%(d)s""" + emp_cond,
            {"d": today(), "site": site})[0].v),
        "taken": flt(_q(
            """select ifnull(sum(la.total_leave_days),0) v
               from `tabLeave Application` la
               join `tabEmployee` e on e.name = la.employee
               where la.docstatus=1 and la.status='Approved'
                 and la.from_date <= %(t)s and la.to_date >= %(f)s""" + emp_cond,
            {"f": period_start, "t": period_end, "site": site})[0].v),
        "pending_apps": _q(
            """select count(*) v from `tabLeave Application` la
               join `tabEmployee` e on e.name = la.employee
               where la.docstatus=0 and la.status='Open'""" + emp_cond,
            {"site": site})[0].v,
        "on_leave_today": _q(
            """select count(*) v from `tabLeave Application` la
               join `tabEmployee` e on e.name = la.employee
               where la.docstatus=1 and la.status='Approved'
                 and la.from_date<=%(d)s and la.to_date>=%(d)s""" + emp_cond,
            {"d": today(), "site": site})[0].v,
    }

    crew = _q(
        """select designation, branch, count(*) cnt from `tabEmployee`
           where status='Active' and designation in
             ('Mixer Driver','Pump Driver','Pump Operator','Trailer Driver',
              'Plant Operator','Chemical')
           group by designation, branch""")
    headcount = _q(
        """select count(*) v from `tabEmployee` e
           where e.status='Active'""" + emp_cond, {"site": site})[0].v

    return {
        "as_of": today(),
        "period": {"from_date": period_start, "to_date": period_end, "site": site},
        "yesterday": yesterday,
        "trips_month": trips_month,
        "cubic_month": cubic_month,
        "logs_today": logs_today,
        "yesterday_by_site": yday,
        "month_by_site_group": by_site,
        "trend_14d": trend,
        "active_loans": loans,
        "owing_staff": owing_staff,
        "loan_rows": loan_rows,
        "advance_rows": advance_rows,
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


@frappe.whitelist()
def generate_payroll_drafts(site, month):
    """One click: turn the locked (submitted) trip sheet for site+month into
    DRAFT Additional Salary earning entries - one per employee per component.

    - Only submitted logs (docstatus=1) not yet pulled_to_payroll are used.
    - payroll_date is set to the LAST DAY of the sheet's month, so ERPNext
      places each amount in that month's payroll run automatically.
    - Entries are created as DRAFTS for HR to review and submit.
    - Every source log is stamped pulled_to_payroll=1, so re-clicking can
      never create a duplicate payment.
    """
    _require_access()
    if "HR Manager" not in frappe.get_roles() and \
            "System Manager" not in frappe.get_roles():
        frappe.throw("Only HR Manager can generate payroll drafts",
                     frappe.PermissionError)

    year, mon = int(month[:4]), int(month[5:7])
    payroll_date = f"{year:04d}-{mon:02d}-{calendar.monthrange(year, mon)[1]:02d}"

    pending_drafts = frappe.db.count(
        "Daily Trip Log",
        {"payroll_month": month, "branch": site, "docstatus": 0})
    if pending_drafts:
        frappe.throw(
            f"{pending_drafts} log(s) for {site} {month} are still in Draft. "
            "Use 'Submit Month (lock)' first, then generate payroll drafts.")

    logs = _q(
        """select name, employee, employee_name, salary_component,
                  ifnull(quantity,0) qty, ifnull(amount,0) amt
           from `tabDaily Trip Log`
           where docstatus=1 and payroll_month=%(m)s and branch=%(s)s
             and ifnull(pulled_to_payroll,0)=0 and ifnull(amount,0) > 0
             and ifnull(salary_component,'') != ''""",
        {"m": month, "s": site})
    if not logs:
        return {"created": 0, "message":
                "Nothing to pull - every submitted log for this sheet has "
                "already been sent to payroll (or has no amount)."}

    groups = {}
    for l in logs:
        g = groups.setdefault((l.employee, l.salary_component), {
            "employee": l.employee, "employee_name": l.employee_name,
            "component": l.salary_component,
            "amount": 0.0, "qty": 0.0, "log_names": []})
        g["amount"] += flt(l.amt)
        g["qty"] += flt(l.qty)
        g["log_names"].append(l.name)

    month_label = f"{calendar.month_name[mon]} {year}"
    created, errors = [], []
    for g in groups.values():
        try:
            company = frappe.db.get_value("Employee", g["employee"], "company")
            doc = frappe.get_doc({
                "doctype": "Additional Salary",
                "employee": g["employee"],
                "company": company,
                "salary_component": g["component"],
                "amount": flt(g["amount"], 2),
                "payroll_date": payroll_date,
                "overwrite_salary_structure_amount": 0,
                "custom_bgl_note": (f"Auto-generated from {site} trip sheet "
                           f"{month_label}: {len(g['log_names'])} day(s), "
                           f"total qty {flt(g['qty'], 2)}."),
            })
            doc.insert()  # stays DRAFT (docstatus 0) for HR review
            for n in g["log_names"]:
                frappe.db.set_value("Daily Trip Log", n,
                                    "pulled_to_payroll", 1,
                                    update_modified=False)
            created.append({
                "name": doc.name, "employee": g["employee_name"],
                "component": g["component"], "amount": flt(g["amount"], 2)})
        except Exception as ex:
            errors.append(f"{g['employee_name']} / {g['component']}: {ex}")

    frappe.db.commit()
    return {"created": len(created), "payroll_date": payroll_date,
            "entries": created, "errors": errors[:10]}


# ---------------------------------------------------------------------------
# Monthly Deduction Sheet (loans, salary advances, absent days)
# ---------------------------------------------------------------------------

DEDUCT_COMPONENTS = ("Loans", "Salary Advance", "Absent")


def _month_end(month):
    year, mon = int(month[:4]), int(month[5:7])
    return f"{year:04d}-{mon:02d}-{calendar.monthrange(year, mon)[1]:02d}"


def _prev_month_end(month):
    year, mon = int(month[:4]), int(month[5:7])
    if mon == 1:
        year, mon = year - 1, 12
    else:
        mon -= 1
    return f"{year:04d}-{mon:02d}-{calendar.monthrange(year, mon)[1]:02d}"


@frappe.whitelist()
def deduction_sheet(month):
    """Everything the Monthly Deduction Sheet needs for one month (YYYY-MM)."""
    _require_access()
    m_end = _month_end(month)
    prev_end = _prev_month_end(month)

    loans = _q(
        """select name, employee, employee_name, loan_type, principal,
                  ifnull(total_repaid,0) total_repaid, ifnull(balance,0) balance,
                  ifnull(expected_monthly,0) expected_monthly
           from `tabStaff Loan Advance`
           where status='Active' and loan_type != 'Salary Advance'
           order by employee_name""")

    # Current month's saved drafts (so reloading shows what was entered).
    # Part-month pro-rations also live in the Absent component, but they
    # belong to tab A2 and must not surface on the Absences tab as well -
    # both tabs write the same component and the second save would silently
    # overwrite the first.
    drafts = _q(
        """select name, employee, salary_component, amount
           from `tabAdditional Salary`
           where docstatus=0 and payroll_date=%(d)s
             and salary_component in %(comps)s
             and ifnull(custom_bgl_note,'') not like 'Part month%%'""",
        {"d": m_end, "comps": DEDUCT_COMPONENTS})

    # tab A2: rebuild days worked and full salary from what was saved
    proration_rows = []
    for r in _q(
            """select a.employee, e.employee_name, a.amount
               from `tabAdditional Salary` a
               join `tabEmployee` e on e.name = a.employee
               where a.docstatus=0 and a.payroll_date=%(d)s
                 and a.salary_component='Absent'
                 and a.custom_bgl_note like 'Part month%%'""",
            {"d": m_end}):
        hit = _q(
            """select base from `tabSalary Structure Assignment`
               where employee=%(e)s and docstatus=1 and from_date <= %(d)s
               order by from_date desc limit 1""",
            {"e": r.employee, "d": m_end})
        base = flt(hit[0].base) if hit else 0
        days = round(22.0 - (flt(r.amount) * 22.0 / base), 1) if base else 0
        proration_rows.append({
            "employee": r.employee, "employee_name": r.employee_name,
            "days": days, "full_salary": base})

    # Current basic (latest submitted SSA) per active employee - the
    # "Basic Salaries" review tab. Sarah's team corrects wrong ones here.
    basics = _q(
        """select ssa.name ssa_name, ssa.employee, e.employee_name, e.branch,
                  ssa.base, ssa.from_date, ssa.salary_structure
           from `tabSalary Structure Assignment` ssa
           inner join `tabEmployee` e on e.name = ssa.employee
           inner join (select employee, max(from_date) mx
                       from `tabSalary Structure Assignment`
                       where docstatus=1 group by employee) t
             on t.employee = ssa.employee and t.mx = ssa.from_date
           where ssa.docstatus=1 and e.status='Active'
           order by e.employee_name, ssa.creation desc""")
    seen_emp = set()
    basics = [b for b in basics
              if not (b.employee in seen_emp or seen_emp.add(b.employee))]

    # Last month's submitted advances = this month's pre-fill
    # Only people who still work here. Carrying a leaver forward is how
    # Sarah ended up facing raw "Transactions cannot be created for an
    # Inactive Employee" errors with GHS 2,000 quietly missing.
    prev_adv = _q(
        """select a.employee, a.employee_name, a.amount
           from `tabAdditional Salary` a
           join `tabEmployee` e on e.name = a.employee
           where a.docstatus=1 and a.payroll_date=%(d)s
             and a.salary_component='Salary Advance'
             and e.status='Active'
           order by a.employee_name""",
        {"d": prev_end})

    employees = _q(
        """select name, employee_name, branch from `tabEmployee`
           where status='Active' order by employee_name""")

    # base pay for absent-day estimates (latest salary structure assignment)
    bases = _q(
        """select ssa.employee, ssa.base
           from `tabSalary Structure Assignment` ssa
           inner join (
               select employee, max(from_date) mx
               from `tabSalary Structure Assignment`
               where docstatus=1 group by employee) t
             on t.employee = ssa.employee and t.mx = ssa.from_date
           where ssa.docstatus=1""")

    # New hires: joining date inside this month
    new_hires = _q(
        """select name, employee_name, designation, branch, date_of_joining
           from `tabEmployee`
           where status='Active'
             and date_of_joining between %(f)s and %(t)s
           order by date_of_joining""",
        {"f": f"{month}-01", "t": m_end})
    base_map = {b.employee: flt(b.base) for b in bases}
    year, mon = int(month[:4]), int(month[5:7])
    for h in new_hires:
        doj = getdate(h.date_of_joining)
        # suggested worked days: weekdays from joining to month end, cap 22
        wd = 0
        d = doj
        last = getdate(m_end)
        while d <= last:
            if d.weekday() < 5:
                wd += 1
            d = add_days(d, 1)
        h["days_suggested"] = min(wd, 22)
        h["existing_base"] = base_map.get(h.name, 0)

    # Allowances prefill: last month's submitted uploads per component
    ALLOWANCE_COMPONENTS = ("Housing Allowance", "Transport Allowance",
                            "Extra Duty Allowance", "Overtime Allowance")
    prev_allow = _q(
        """select a.employee, a.employee_name, a.salary_component, a.amount
           from `tabAdditional Salary` a
           join `tabEmployee` e on e.name = a.employee
           where a.docstatus=1 and a.payroll_date=%(d)s
             and a.salary_component in %(comps)s
             and e.status='Active'
           order by a.employee_name""",
        {"d": prev_end, "comps": ALLOWANCE_COMPONENTS})
    allow_drafts = _q(
        """select employee, salary_component, amount
           from `tabAdditional Salary`
           where docstatus=0 and payroll_date=%(d)s
             and salary_component in %(comps)s""",
        {"d": m_end, "comps": ALLOWANCE_COMPONENTS})
    # proration drafts already saved (Basic Salary overwrite)
    proration_drafts = _q(
        """select employee, amount from `tabAdditional Salary`
           where docstatus=0 and payroll_date=%(d)s
             and salary_component='Basic Salary'""",
        {"d": m_end})
    # earner type per employee: Trip/Cubic designations get NO fixed OT
    ot_locked = {e.name: (e.designation in PAY_GROUPS and
                          GROUP_UNIT.get(e.designation) in ("Trip", "Cubic"))
                 for e in _q("select name, designation from `tabEmployee` where status='Active'")}

    return {"month": month, "month_end": m_end, "prev_month_end": prev_end,
            "basics": basics,
            "loans": loans, "drafts": drafts, "prev_advances": prev_adv,
            "employees": employees,
            "bases": base_map,
            "new_hires": new_hires,
            "signoffs": _signoffs(month),
            "proration_drafts": proration_drafts,
            "proration_rows": proration_rows,
            "prev_allowances": prev_allow,
            "allowance_drafts": allow_drafts,
            "ot_locked": ot_locked}


def _upsert_deduction_draft(employee, component, amount, m_end, remark,
                            overwrite=0):
    """Create/update/delete ONE draft Additional Salary. Returns action.

    Two refusals are RETURNED rather than raised, so one bad row cannot
    bury a whole save under ERPNext stack messages:
      inactive  - the employee has left
      submitted - already submitted for this date, so inserting again
                  trips the overwrite guard"""
    cache = getattr(frappe.local, "_bgl_empstat", None)
    if cache is None:
        cache = frappe.local._bgl_empstat = {}
    if employee not in cache:
        cache[employee] = frappe.db.get_value("Employee", employee, "status")
    if cache[employee] != "Active":
        return "inactive"
    if frappe.db.exists(
            "Additional Salary",
            {"employee": employee, "salary_component": component,
             "payroll_date": m_end, "docstatus": 1}):
        return "submitted"
    existing = frappe.db.get_value(
        "Additional Salary",
        {"employee": employee, "salary_component": component,
         "payroll_date": m_end, "docstatus": 0}, "name")
    if flt(amount) <= 0:
        if existing:
            frappe.delete_doc("Additional Salary", existing)
            return "deleted"
        return "skipped"
    if existing:
        doc = frappe.get_doc("Additional Salary", existing)
        doc.amount = flt(amount, 2)
        doc.custom_bgl_note = remark
        doc.overwrite_salary_structure_amount = overwrite
        doc.save()
        return "updated"
    doc = frappe.get_doc({
        "doctype": "Additional Salary",
        "employee": employee,
        "company": frappe.db.get_value("Employee", employee, "company"),
        "salary_component": component,
        "amount": flt(amount, 2),
        "payroll_date": m_end,
        "overwrite_salary_structure_amount": overwrite,
        "custom_bgl_note": remark,
    })
    doc.insert()  # stays DRAFT for HR review
    return "created"


@frappe.whitelist()
def deduction_save(month, loans=None, advances=None, absences=None,
                   new_hires=None, allowances=None, basics=None,
                   prorations=None):
    """Save the Monthly Deduction Sheet.

    loans:    [{loan, amount}]        -> ledger repayment + draft 'Loans'
    advances: [{employee, amount}]    -> draft 'Salary Advance'
    absences: [{employee, days}]      -> draft 'Absent Days' (amount = days)
    All drafts dated to the last day of the month; amount/days 0 removes
    the draft (and the ledger row for loans). Saving twice updates in
    place - never duplicates.
    """
    _require_access()
    if "HR Manager" not in frappe.get_roles() and \
            "System Manager" not in frappe.get_roles():
        frappe.throw("Only HR Manager can save deductions",
                     frappe.PermissionError)

    loans = json.loads(loans) if isinstance(loans, str) else (loans or [])
    advances = json.loads(advances) if isinstance(advances, str) else (advances or [])
    absences = json.loads(absences) if isinstance(absences, str) else (absences or [])
    new_hires = json.loads(new_hires) if isinstance(new_hires, str) else (new_hires or [])
    prorations = json.loads(prorations) if isinstance(prorations, str) \
        else (prorations or [])
    allowances = json.loads(allowances) if isinstance(allowances, str) else (allowances or [])
    basics = json.loads(basics) if isinstance(basics, str) else (basics or [])

    m_end = _month_end(month)
    year, mon = int(month[:4]), int(month[5:7])
    month_label = f"{calendar.month_name[mon]} {year}"
    ref = f"PAYROLL-{month}"
    out = {"loans": 0, "advances": 0, "absences": 0, "new_hires": 0,
           "allowances": 0, "prorations": 0,
           "ssa_created": [], "cleared": [], "errors": [],
           "skipped": [],
           "basics_changed": [], }

    def note_skip(action, employee, what):
        """Turn a refusal into one line a person can act on."""
        if action not in ("inactive", "submitted"):
            return
        nm = frappe.db.get_value("Employee", employee, "employee_name") or employee
        out["skipped"].append(
            f"{nm} - {what} not saved, no longer active staff"
            if action == "inactive" else
            f"{nm} - {what} already submitted, left untouched")


    for row in loans:
        try:
            doc = frappe.get_doc("Staff Loan Advance", row.get("loan"))
            amount = flt(row.get("amount") or 0)
            other = sum(flt(r.amount) for r in doc.repayments if r.reference != ref)
            room = flt(doc.principal) - other
            if amount > room:
                amount = room  # never deduct past the balance
            mine = [r for r in doc.repayments if r.reference == ref]
            if amount <= 0:
                for r in mine:
                    doc.repayments.remove(r)
            elif mine:
                mine[0].amount = amount
                mine[0].payment_date = m_end
            else:
                doc.append("repayments", {
                    "payment_date": m_end, "amount": amount,
                    "source": "Payroll Deduction", "reference": ref,
                    "remarks": f"Deduction sheet {month_label}"})
            doc.total_repaid = sum(flt(r.amount) for r in doc.repayments)
            doc.balance = flt(doc.principal) - flt(doc.total_repaid)
            if doc.balance <= 0:
                doc.status = "Fully Paid"
                out["cleared"].append(doc.employee_name)
            elif doc.status == "Fully Paid":
                doc.status = "Active"
            doc.save()
            note_skip(_upsert_deduction_draft(
                doc.employee, "Loans", amount, m_end,
                f"Loan installment {month_label} ({doc.name}) via deduction sheet"),
                doc.employee, "loan installment")
            if amount > 0:
                out["loans"] += 1
        except Exception as ex:
            out["errors"].append(f"Loan {row.get('loan')}: {ex}")

    for row in advances:
        try:
            act = _upsert_deduction_draft(
                row.get("employee"), "Salary Advance",
                flt(row.get("amount") or 0), m_end,
                f"Salary advance {month_label} via deduction sheet")
            note_skip(act, row.get("employee"), "salary advance")
            if act in ("created", "updated"):
                out["advances"] += 1
        except Exception as ex:
            out["errors"].append(f"Advance {row.get('employee')}: {ex}")

    bases = {}

    def _base(emp):
        if emp not in bases:
            bases[emp] = flt(frappe.db.get_value(
                "Salary Structure Assignment",
                {"employee": emp, "docstatus": 1}, "base",
                order_by="from_date desc"))
        return bases[emp]

    for row in absences:
        try:
            emp = row.get("employee")
            days = flt(row.get("days") or 0)
            base = _base(emp)
            amount = flt((days / 22.0) * base, 2)
            if days > 0 and base <= 0:
                out["errors"].append(
                    f"Absence {emp}: no salary structure base found")
                continue
            act = _upsert_deduction_draft(
                emp, "Absent", amount, m_end,
                f"Absent {month_label}: {days} day(s) x (base {flt(base, 2)}"
                f" / 22) via deduction sheet", overwrite=1)
            note_skip(act, emp, "absent days")
            if act in ("created", "updated"):
                out["absences"] += 1
        except Exception as ex:
            out["errors"].append(f"Absence {row.get('employee')}: {ex}")

    # ---- Existing staff proration (optional) ----------------------------
    # Somebody already on payroll who worked only part of the month. Unlike a
    # new hire there IS a live assignment, so the shape is: put the agreed
    # full salary on an assignment effective the 1st, then deduct the days
    # not worked. SSA FIRST - the Absent line cannot be created without one,
    # and its amount is computed from that base.
    absent_this_save = {r.get("employee") for r in absences
                        if flt(r.get("days") or 0) > 0}
    m_start_p = f"{month}-01"
    for row in prorations:
        try:
            emp = row.get("employee")
            days = flt(row.get("days") or 0)
            full = flt(row.get("full_salary") or 0)
            if not emp or full <= 0 or days <= 0:
                continue
            if days >= 22:
                out["skipped"].append(
                    f"{frappe.db.get_value('Employee', emp, 'employee_name')}"
                    " - 22 days or more is a whole month, nothing to prorate")
                continue
            if emp in absent_this_save:
                # both tabs write the same Absent component; last one wins.
                # Refuse rather than quietly overwrite the other.
                out["skipped"].append(
                    f"{frappe.db.get_value('Employee', emp, 'employee_name')}"
                    " - on the Absences tab as well, pro-ration not applied."
                    " Use one tab or the other, not both")
                continue

            # 1. assignment first
            cur = _q(
                """select base from `tabSalary Structure Assignment`
                   where employee=%(e)s and docstatus=1 and from_date <= %(d)s
                   order by from_date desc limit 1""",
                {"e": emp, "d": m_end})
            if not cur:
                out["errors"].append(
                    f"Proration {emp}: no salary structure assigned yet")
                continue
            if flt(cur[0].base) != full:
                tmpl = _q(
                    """select salary_structure, income_tax_slab, company,
                              currency, payroll_payable_account
                       from `tabSalary Structure Assignment`
                       where employee=%(e)s and docstatus=1
                       order by from_date desc limit 1""", {"e": emp})
                t = tmpl[0] if tmpl else {}
                if not frappe.db.exists("Salary Structure Assignment",
                                        {"employee": emp, "docstatus": 1,
                                         "from_date": m_start_p}):
                    ssa = frappe.get_doc({
                        "doctype": "Salary Structure Assignment",
                        "employee": emp,
                        "salary_structure": t.get("salary_structure")
                            or "Main Structure - BGL",
                        "income_tax_slab": t.get("income_tax_slab"),
                        "company": t.get("company")
                            or frappe.db.get_value("Employee", emp, "company"),
                        "currency": t.get("currency") or "GHS",
                        "payroll_payable_account":
                            t.get("payroll_payable_account"),
                        "from_date": m_start_p,
                        "base": full,
                    })
                    ssa.insert()
                    ssa.submit()
                    out["ssa_created"].append(
                        f"{frappe.db.get_value('Employee', emp, 'employee_name')}"
                        f" (base {flt(full, 2)} from {m_start_p})")

            # 2. then the deduction for the days not worked
            unworked = 22.0 - days
            amount = flt(full * unworked / 22.0, 2)
            act = _upsert_deduction_draft(
                emp, "Absent", amount, m_end,
                f"Part month {month_label}: worked {days} of 22 days. "
                f"{unworked} unworked day(s) x (base {flt(full, 2)} / 22)",
                overwrite=1)
            note_skip(act, emp, "part month pro-ration")
            if act in ("created", "updated"):
                out["prorations"] += 1
        except Exception as ex:
            out["errors"].append(f"Proration {row.get('employee')}: {ex}")

    # ---- New hire proration: Basic Salary override + next-month SSA ----
    if mon == 12:
        nxt_start = f"{year + 1}-01-01"
    else:
        nxt_start = f"{year}-{mon + 1:02d}-01"
    for row in new_hires:
        try:
            emp = row.get("employee")
            actual = flt(row.get("actual_basic") or 0)
            days = flt(row.get("days") or 0)
            if actual <= 0:
                continue
            prorated = flt(actual * min(days, 22) / 22.0, 2)
            # ORDER MATTERS. An Additional Salary cannot be created for an
            # employee with no Salary Structure Assignment, so the SSA has to
            # exist FIRST. Doing the proration override first (as this did
            # before v1.13.1) threw "There is no Salary Structure assigned"
            # and aborted the row before the SSA was ever written - the
            # Pro-Ration tab could never handle a genuinely new hire.
            #
            # SSA carries the FULL basic from the JOINING DATE; the proration
            # override below trims month one to days/22. Every later month
            # then pays full automatically. Dating the SSA next month would
            # leave THIS month with no assignment and the joiner would be
            # skipped by Payroll Entry entirely.
            has_ssa = frappe.db.exists(
                "Salary Structure Assignment",
                {"employee": emp, "docstatus": 1})
            if not has_ssa:
                tmpl = _q(
                    """select salary_structure, income_tax_slab, company,
                              currency, payroll_payable_account
                       from `tabSalary Structure Assignment`
                       where docstatus=1 order by creation desc limit 1""")
                t = tmpl[0] if tmpl else {}
                ssa = frappe.get_doc({
                    "doctype": "Salary Structure Assignment",
                    "employee": emp,
                    "salary_structure": t.get("salary_structure")
                        or "Main Structure - BGL",
                    "income_tax_slab": t.get("income_tax_slab"),
                    "company": t.get("company")
                        or frappe.db.get_value("Employee", emp, "company"),
                    "currency": t.get("currency") or "GHS",
                    "payroll_payable_account": t.get("payroll_payable_account"),
                    "from_date": frappe.db.get_value(
                        "Employee", emp, "date_of_joining") or nxt_start,
                    "base": actual,
                })
                ssa.insert()
                ssa.submit()
                out["ssa_created"].append(
                    f"{frappe.db.get_value('Employee', emp, 'employee_name')}"
                    f" (base {flt(actual, 2)} from {ssa.from_date})")
            act = _upsert_deduction_draft(
                emp, "Basic Salary", prorated, m_end,
                f"New Hire Proration - {month_label}: joined "
                f"{frappe.db.get_value('Employee', emp, 'date_of_joining')}, "
                f"{days}/22 days x actual basic {flt(actual, 2)}",
                overwrite=1)
            note_skip(act, emp, "new hire pro-ration")
            if act in ("created", "updated"):
                out["new_hires"] += 1
        except Exception as ex:
            out["errors"].append(f"New hire {row.get('employee')}: {ex}")

    # ---- Basic salary corrections: NEW SSA effective 1st of this month ----
    m_start = f"{month}-01"
    for row in basics:
        try:
            emp = row.get("employee")
            new_base = flt(row.get("new_base") or 0)
            if new_base <= 0:
                continue
            cur = _q(
                """select name, base, salary_structure, income_tax_slab,
                          company, currency, payroll_payable_account
                   from `tabSalary Structure Assignment`
                   where employee=%(e)s and docstatus=1
                   order by from_date desc limit 1""", {"e": emp})
            if not cur:
                out["errors"].append(
                    f"Basic change {emp}: no existing salary assignment")
                continue
            cur = cur[0]
            if abs(flt(cur.base) - new_base) < 0.005:
                continue
            clash = frappe.db.get_value(
                "Salary Structure Assignment",
                {"employee": emp, "docstatus": 1, "from_date": m_start},
                "name")
            if clash:
                out["errors"].append(
                    f"Basic change {emp}: {clash} already starts {m_start} - "
                    "cancel it first, then save again")
                continue
            ssa = frappe.get_doc({
                "doctype": "Salary Structure Assignment",
                "employee": emp,
                "salary_structure": cur.salary_structure,
                "income_tax_slab": cur.income_tax_slab,
                "company": cur.company,
                "currency": cur.currency or "GHS",
                "payroll_payable_account": cur.payroll_payable_account,
                "from_date": m_start,
                "base": new_base,
            })
            ssa.insert()
            ssa.submit()
            out["basics_changed"].append(
                f"{frappe.db.get_value('Employee', emp, 'employee_name')}: "
                f"{flt(cur.base, 2)} -> {flt(new_base, 2)} from {m_start}")
        except Exception as ex:
            out["errors"].append(f"Basic change {row.get('employee')}: {ex}")

    # ---- Fixed allowances & overtime: carry-forward uploads ----
    ALLOW_MAP = {"housing": "Housing Allowance", "transport": "Transport Allowance",
                 "eda": "Extra Duty Allowance", "ota": "Overtime Allowance"}
    for row in allowances:
        emp = row.get("employee")
        desig = frappe.db.get_value("Employee", emp, "designation")
        for key, comp in ALLOW_MAP.items():
            if key not in row:
                continue
            amt = flt(row.get(key) or 0)
            if key == "ota" and desig in PAY_GROUPS and                     GROUP_UNIT.get(desig) in ("Trip", "Cubic"):
                if amt > 0:
                    out["errors"].append(
                        f"{emp}: fixed OT blocked - employee earns "
                        f"{GROUP_UNIT.get(desig)} overtime")
                continue
            try:
                act = _upsert_deduction_draft(
                    emp, comp, amt, m_end,
                    f"{comp} {month_label} via payroll prep sheet",
                    overwrite=1)
                note_skip(act, emp, comp)
                if act in ("created", "updated"):
                    out["allowances"] += 1
            except Exception as ex:
                out["errors"].append(f"{emp} {comp}: {ex}")

    frappe.db.commit()
    out["errors"] = out["errors"][:10]
    out["skipped"] = out["skipped"][:25]
    return out


@frappe.whitelist()
def loan_create(employee, principal, expected_monthly=None,
                loan_type="Loan", date_taken=None, reason=None):
    """Record a new loan/advance in the ledger straight from the
    deduction sheet - no page hopping."""
    _require_access()
    if "HR Manager" not in frappe.get_roles() and \
            "System Manager" not in frappe.get_roles():
        frappe.throw("Only HR Manager can record a loan",
                     frappe.PermissionError)
    info = frappe.db.get_value(
        "Employee", employee,
        ["employee_name", "department", "designation"], as_dict=True)
    if not info:
        frappe.throw(f"Employee {employee} not found")
    doc = frappe.get_doc({
        "doctype": "Staff Loan Advance",
        "employee": employee,
        "employee_name": info.employee_name,
        "department": info.department,
        "designation": info.designation,
        "loan_type": loan_type or "Loan",
        "status": "Active",
        "principal": flt(principal),
        "date_taken": date_taken or today(),
        "expected_monthly": flt(expected_monthly or 0),
        "total_repaid": 0,
        "balance": flt(principal),
        "reason": reason,
    })
    doc.insert()
    frappe.db.commit()
    return {"name": doc.name, "employee_name": info.employee_name,
            "principal": flt(principal)}


@frappe.whitelist()
def unlock_month(site, month):
    """Reverse a locked trip sheet for correction (HR Manager only).

    Cancels submitted logs and deletes the DRAFT earning entries generated
    from them. Refuses if any generated entry was already SUBMITTED - money
    that entered payroll must be handled in payroll first.
    """
    _require_access()
    if "HR Manager" not in frappe.get_roles() and \
            "System Manager" not in frappe.get_roles():
        frappe.throw("Only HR Manager can unlock a month",
                     frappe.PermissionError)
    m_end = _month_end(month)
    pulled = _q(
        """select distinct employee, salary_component
           from `tabDaily Trip Log`
           where docstatus=1 and payroll_month=%(m)s and branch=%(s)s
             and ifnull(pulled_to_payroll,0)=1""",
        {"m": month, "s": site})
    blocked = []
    for p in pulled:
        if frappe.db.exists("Additional Salary", {
                "employee": p.employee, "salary_component": p.salary_component,
                "payroll_date": m_end, "docstatus": 1}):
            blocked.append(f"{p.employee} / {p.salary_component}")
    if blocked:
        frappe.throw(
            "Cannot unlock: these earnings were already SUBMITTED to payroll: "
            + ", ".join(blocked[:8])
            + ". Cancel them under Additional Salary first.")
    deleted_drafts = 0
    for p in pulled:
        name = frappe.db.get_value("Additional Salary", {
            "employee": p.employee, "salary_component": p.salary_component,
            "payroll_date": m_end, "docstatus": 0}, "name")
        if name:
            frappe.delete_doc("Additional Salary", name)
            deleted_drafts += 1
    names = frappe.get_all(
        "Daily Trip Log",
        filters={"payroll_month": month, "branch": site, "docstatus": 1},
        pluck="name")
    unlocked = 0
    for n in names:
        doc = frappe.get_doc("Daily Trip Log", n)
        doc.db_set("pulled_to_payroll", 0, update_modified=False)
        doc.cancel()
        # recreate as editable draft with the same figures
        newd = frappe.copy_doc(doc)
        newd.docstatus = 0
        newd.pulled_to_payroll = 0
        newd.insert()
        unlocked += 1
    frappe.db.commit()
    return {"unlocked": unlocked, "drafts_deleted": deleted_drafts}


# ---------------------------------------------------------------------------
# Prep Sheet section sign-off
# ---------------------------------------------------------------------------

SIGNOFF_SECTIONS = ["New Hire Pro-Ration", "Basic Salaries", "Loans",
                    "Advances", "Absences", "Allowances and OT"]

_SECTION_COMPONENTS = {
    "Loans": ("Loans",),
    "Advances": ("Salary Advance",),
    "Absences": ("Absent",),
    "New Hire Pro-Ration": ("Basic Salary", "Absent"),
    "Allowances and OT": ("Housing Allowance", "Transport Allowance",
                          "Extra Duty Allowance", "Overtime Allowance"),
}

# The Pro-Ration tab and the Absences tab both write the Absent component,
# so a snapshot keyed on component alone would have the two sections going
# stale on each other's edits. Part month rows carry their own remark and
# belong to Pro-Ration; everything else is a plain absence.
_SECTION_NOTE_FILTER = {
    "New Hire Pro-Ration":
        " and (a.salary_component <> 'Absent'"
        "      or ifnull(a.custom_bgl_note,'') like 'Part month%%')",
    "Absences":
        " and ifnull(a.custom_bgl_note,'') not like 'Part month%%'",
}


def _section_snapshot(month, section):
    """Cached per request - payroll_readiness asks for the same sections
    several times while building its lines, and every workspace load calls it."""
    key = ("bgl_snap", month, section)
    cache = getattr(frappe.local, "_bgl_snap", None)
    if cache is None:
        cache = frappe.local._bgl_snap = {}
    if key in cache:
        return cache[key]
    cache[key] = _section_snapshot_uncached(month, section)
    return cache[key]


def _section_snapshot_uncached(month, section):
    """What this section holds right now: (rows, money, people).

    Basic Salaries is not Additional Salary data - it is the assignments
    payroll will use - so it is measured differently."""
    m_end = _month_end(month)
    if section == "Basic Salaries":
        # max(a.base) not a.base: an employee can hold two assignments on the
        # same from_date, and a bare column beside GROUP BY is rejected
        # outright when the server runs with ONLY_FULL_GROUP_BY.
        rows = _q(
            """select count(*) c, sum(t.base) s from (
                 select a.employee, max(a.base) base
                 from `tabSalary Structure Assignment` a
                 join (select employee, max(from_date) fd
                       from `tabSalary Structure Assignment`
                       where docstatus=1 and from_date <= %(d)s
                       group by employee) x
                   on x.employee = a.employee and x.fd = a.from_date
                 join `tabEmployee` e on e.name = a.employee
                 where a.docstatus=1 and e.status='Active'
                 group by a.employee) t""", {"d": m_end})
        r = rows[0] if rows else {}
        return cint(r.get("c")), flt(r.get("s")), cint(r.get("c"))
    comps = _SECTION_COMPONENTS.get(section)
    if not comps:
        return 0, 0.0, 0
    r = _q(
        """select count(*) c, sum(a.amount) s, count(distinct a.employee) p
           from `tabAdditional Salary` a
           where a.payroll_date between %(ms)s and %(d)s and a.docstatus < 2
             and a.salary_component in %(c)s"""
        + _SECTION_NOTE_FILTER.get(section, ""),
        {"ms": f"{month}-01", "d": m_end, "c": comps})[0]
    return cint(r.c), flt(r.s), cint(r.p)


def _signoffs(month):
    """{section: {...}} for one month, with staleness worked out.

    Returns {} if the table is not there yet - during the migrate that
    creates it, or if the fixture ever fails to sync. Callers then treat
    every section as unsigned, which BLOCKS payroll rather than letting it
    through. Failing closed is the only safe direction here."""
    out = {}
    if not frappe.db.table_exists("BGL Payroll Signoff"):
        return out
    for row in _q(
            """select name, section, status, reviewed_by, reviewed_on,
                      entries_seen, total_seen, note
               from `tabBGL Payroll Signoff` where month = %(m)s""",
            {"m": month}):
        rows, money, _p = _section_snapshot(month, row.section)
        stale = (row.status == "Reviewed"
                 and (cint(row.entries_seen) != rows
                      or abs(flt(row.total_seen) - money) > 0.05))
        out[row.section] = {
            "name": row.name, "status": row.status,
            "reviewed_by": row.reviewed_by, "reviewed_on": str(row.reviewed_on or ""),
            "entries_seen": cint(row.entries_seen),
            "total_seen": flt(row.total_seen),
            "note": row.note, "stale": 1 if stale else 0,
            "rows_now": rows, "total_now": money,
        }
    return out


def _signed(month, section):
    """True only when reviewed AND the numbers have not moved since."""
    s = _signoffs(month).get(section)
    return bool(s and s["status"] == "Reviewed" and not s["stale"])


@frappe.whitelist()
def signoff_set(month, section, note=None):
    """Record that a human reviewed one Prep Sheet section for one month."""
    _require_access()
    if section not in SIGNOFF_SECTIONS:
        frappe.throw(f"Unknown section: {section}")
    rows, money, _p = _section_snapshot(month, section)
    name = frappe.db.get_value("BGL Payroll Signoff",
                               {"month": month, "section": section})
    doc = (frappe.get_doc("BGL Payroll Signoff", name) if name
           else frappe.new_doc("BGL Payroll Signoff"))
    doc.month = month
    doc.section = section
    doc.status = "Reviewed"
    doc.reviewed_by = frappe.session.user
    doc.reviewed_on = frappe.utils.now_datetime()
    doc.entries_seen = rows
    doc.total_seen = money
    if note is not None:
        doc.note = note
    doc.save(ignore_permissions=True)
    return {"section": section, "status": "Reviewed",
            "reviewed_by": doc.reviewed_by,
            "reviewed_on": str(doc.reviewed_on),
            "entries_seen": rows, "total_seen": money}


@frappe.whitelist()
def signoff_clear(month, section):
    """Reopen a section - it goes back to needing a review."""
    _require_access()
    name = frappe.db.get_value("BGL Payroll Signoff",
                               {"month": month, "section": section})
    if name:
        doc = frappe.get_doc("BGL Payroll Signoff", name)
        doc.status = "Reopened"
        doc.save(ignore_permissions=True)
    return {"section": section, "status": "Reopened"}



@frappe.whitelist()
def payroll_readiness(month):
    """Month-by-month pre-payroll checklist for the Command Center."""
    _require_access()
    m_end = _month_end(month)
    lines = []

    def line(key, label, ok, detail, link=None, warn=False):
        lines.append({"key": key, "label": label, "ok": bool(ok),
                      "warn": bool(warn), "detail": detail, "link": link})

    # 1. trip sheets locked per site
    sites = ["Airport", "Tema"]
    for site in sites:
        drafts = frappe.db.count("Daily Trip Log", {
            "payroll_month": month, "branch": site, "docstatus": 0})
        submitted = frappe.db.count("Daily Trip Log", {
            "payroll_month": month, "branch": site, "docstatus": 1})
        ok = drafts == 0 and submitted > 0
        detail = (f"{submitted} locked" if ok else
                  (f"{drafts} still in draft" if drafts else "no logs yet"))
        line(f"sheet_{site.lower()}", f"Trip sheet locked - {site}", ok,
             detail, "/app/trip-log-sheet", warn=(drafts == 0 and not submitted))

    # 2. earnings generated
    unpulled = frappe.db.count("Daily Trip Log", {
        "payroll_month": month, "docstatus": 1, "pulled_to_payroll": 0})
    gen = _q(
        """select count(*) c from `tabAdditional Salary`
           where payroll_date between %(ms)s and %(d)s and docstatus < 2
             and salary_component in %(tc)s""",
        {"ms": f"{month}-01", "d": m_end, "tc": _trip_components()})[0].c
    line("earnings", "Trip earnings generated", unpulled == 0 and gen > 0,
         (f"{gen} entries created" if unpulled == 0 and gen
          else f"{unpulled} locked log(s) not yet pulled"),
         "/app/trip-log-sheet")

    # 3. new hires prorated
    hires = _q(
        """select name, employee_name from `tabEmployee`
           where status='Active' and date_of_joining between %(f)s and %(t)s""",
        {"f": f"{month}-01", "t": m_end})
    unhandled = [h.employee_name for h in hires if not frappe.db.exists(
        "Additional Salary", {"employee": h.name, "payroll_date": m_end,
                              "salary_component": "Basic Salary",
                              "docstatus": ("<", 2)})]
    line("hires", "New hires prorated",
         len(unhandled) == 0,
         ("no joiners this month" if not hires else
          (f"all {len(hires)} handled" if not unhandled else
           f"{len(unhandled)} pending: " + ", ".join(unhandled[:4]))),
         "/app/deduction-sheet", warn=(not hires))

    # 3b. joining-date sanity: employees created this month, DOJ elsewhere
    odd = _q(
        """select employee_name from `tabEmployee`
           where status='Active' and creation >= %(f)s
             and (date_of_joining < %(f)s or date_of_joining > %(t)s)""",
        {"f": f"{month}-01", "t": m_end})
    if odd:
        line("doj", "Confirm joining dates", False,
             "created this month but joining date is outside it: "
             + ", ".join(o.employee_name for o in odd[:4]),
             "/app/employee", warn=True)

    # 4. deductions saved
    ded = _q(
        """select count(*) c from `tabAdditional Salary`
           where payroll_date between %(ms)s and %(d)s and docstatus < 2
             and salary_component in ('Loans','Salary Advance','Absent')""",
        {"ms": f"{month}-01", "d": m_end})[0].c
    line("deductions", "Deductions saved", ded > 0,
         (f"{ded} entries" if ded else "prep sheet not saved yet"),
         "/app/deduction-sheet")

    # 5 + 5b. Allowances and Basic Salaries are SIGNED OFF, not inferred.
    # Row counts cannot tell "reviewed and correctly unchanged" from "never
    # touched" - fixed allowances and untouched basics look the same either
    # way. So a person marks the tab reviewed and the app records who, when,
    # and the numbers at that moment; if those move afterwards the sign-off
    # goes stale and the line turns red again on its own.
    signs = _signoffs(month)

    def signoff_line(key, label, section):
        s = signs.get(section)
        rows_now, money_now, people_now = _section_snapshot(month, section)
        if not s or s["status"] != "Reviewed":
            detail = (f"{people_now} people / GHS {flt(money_now, 2)} on file "
                      "- nobody has marked this reviewed yet")
            line(key, label, False, detail, "/app/deduction-sheet")
        elif s["stale"]:
            line(key, label, False,
                 f"reviewed by {s['reviewed_by']} but the numbers changed "
                 f"since (was {s['entries_seen']} entries / GHS "
                 f"{flt(s['total_seen'], 2)}, now {rows_now} / GHS "
                 f"{flt(money_now, 2)}) - review again",
                 "/app/deduction-sheet")
        else:
            line(key, label, True,
                 f"reviewed by {s['reviewed_by']} on "
                 f"{str(s['reviewed_on'])[:16]} - {people_now} people / GHS "
                 f"{flt(money_now, 2)}",
                 "/app/deduction-sheet")

    signoff_line("allowances", "Allowances and OT reviewed",
                 "Allowances and OT")
    signoff_line("basics", "Basic salaries reviewed", "Basic Salaries")

    # 6. foreign / inactive employee check
    foreign = _q(
        """select distinct a.employee, a.employee_name
           from `tabAdditional Salary` a
           left join `tabEmployee` e on e.name = a.employee
           where a.payroll_date between %(ms)s and %(d)s and a.docstatus < 2
             and (e.name is null or e.status != 'Active')""",
        {"ms": f"{month}-01", "d": m_end})
    line("foreign", "Everyone on payroll is active staff", len(foreign) == 0,
         ("clean" if not foreign else
          "entries exist for: " + ", ".join(
              (f.employee_name or f.employee) for f in foreign[:4])),
         "/app/additional-salary")

    # 7. drafts awaiting review
    pending = frappe.db.count("Additional Salary", {
        "payroll_date": ("between", [f"{month}-01", m_end]), "docstatus": 0})
    total_entries = frappe.db.count("Additional Salary", {
        "payroll_date": ("between", [f"{month}-01", m_end]), "docstatus": ("<", 2)})
    line("review", "All drafts reviewed and submitted",
         pending == 0 and total_entries > 0,
         (f"{pending} draft(s) awaiting review" if pending else
          ("all submitted" if total_entries else
           "no payroll entries yet this month")),
         "/app/additional-salary?docstatus=0")

    ready = all(l["ok"] for l in lines if not l["warn"])
    from bgl_ops import __version__
    return {"month": month, "month_end": m_end, "lines": lines,
            "ready": ready, "app_version": __version__}


# ---------------------------------------------------------------------------
# Review & Approve board
# ---------------------------------------------------------------------------

def _trip_components():
    """Every salary component trips/cubic money can arrive under - read from
    the live rate table so new components join the gate automatically."""
    rows = _q("""select distinct salary_component from `tabBGL Trip Rate`
                 where ifnull(salary_component,'') != ''""")
    comps = {r.salary_component for r in rows} | {"Trips", "Cubic"}
    return sorted(comps)


def _group_components(key):
    if key == "trip_earnings":
        return _trip_components()
    return REVIEW_GROUPS[key]["components"]


REVIEW_GROUPS = {
    "trip_earnings": {"label": "Trip Earnings", "components": ["Trips", "Cubic"]},
    "loans": {"label": "Loans", "components": ["Loans"]},
    "advances": {"label": "Salary Advances", "components": ["Salary Advance"]},
    "absences": {"label": "Absences", "components": ["Absent"]},
    "prorations": {"label": "New Hire Prorations", "components": ["Basic Salary"]},
    "allowances": {"label": "Fixed Allowances & OT",
                   "components": ["Housing Allowance", "Transport Allowance",
                                  "Extra Duty Allowance", "Overtime Allowance"]},
}


@frappe.whitelist()
def review_board(month):
    """Month's Additional Salary entries grouped by source, with
    reconciliation against each group's source of truth."""
    _require_access()
    m_end = _month_end(month)
    prev_end = _prev_month_end(month)
    all_comps = sorted({c for k in REVIEW_GROUPS for c in _group_components(k)})

    rows = _q(
        """select name, employee, employee_name, salary_component,
                  amount, docstatus, ifnull(custom_bgl_note, '') as remark
           from `tabAdditional Salary`
           where payroll_date between %(ms)s and %(d)s and docstatus < 2
             and salary_component in %(comps)s
           order by salary_component, employee_name""",
        {"ms": f"{month}-01", "d": m_end, "comps": all_comps})

    groups = {}
    for key, g in REVIEW_GROUPS.items():
        rws = [r for r in rows if r.salary_component in _group_components(key)]
        groups[key] = {
            "label": g["label"],
            "rows": rws,
            "total": flt(sum(flt(r.amount) for r in rws), 2),
            "drafts": sum(1 for r in rws if r.docstatus == 0),
            "submitted": sum(1 for r in rws if r.docstatus == 1),
        }

    # reconciliation: trip earnings vs locked trip logs
    trips_src = _q(
        """select ifnull(sum(amount),0) v from `tabDaily Trip Log`
           where docstatus=1 and payroll_month=%(m)s
             and ifnull(pulled_to_payroll,0)=1""", {"m": month})[0].v
    groups["trip_earnings"]["source"] = flt(trips_src, 2)
    groups["trip_earnings"]["source_label"] = "locked trip sheets"

    # loans vs ledger repayment rows for this month
    loans_src = _q(
        """select ifnull(sum(amount),0) v from `tabStaff Loan Repayment`
           where reference=%(r)s""", {"r": f"PAYROLL-{month}"})[0].v
    groups["loans"]["source"] = flt(loans_src, 2)
    groups["loans"]["source_label"] = "loan ledger repayments"


    # advances + allowances vs last month (informational)
    for key, comps in (("advances", ["Salary Advance"]),
                       ("allowances", ["Housing Allowance", "Transport Allowance",
                                       "Extra Duty Allowance", "Overtime Allowance"])):
        prev = _q(
            """select ifnull(sum(amount),0) v from `tabAdditional Salary`
               where docstatus=1 and payroll_date=%(d)s
                 and salary_component in %(c)s""",
            {"d": prev_end, "c": comps})[0].v
        groups[key]["source"] = flt(prev, 2)
        groups[key]["source_label"] = "last month (for comparison)"
        groups[key]["informational"] = 1

    # safety checks
    foreign = _q(
        """select distinct a.employee, a.employee_name
           from `tabAdditional Salary` a
           left join `tabEmployee` e on e.name=a.employee
           where a.payroll_date between %(ms)s and %(d)s and a.docstatus < 2
             and (e.name is null or e.status != 'Active')""",
        {"ms": f"{month}-01", "d": m_end})
    dups = _q(
        """select employee, employee_name, salary_component, count(*) c
           from `tabAdditional Salary`
           where payroll_date between %(ms)s and %(d)s and docstatus < 2
           group by employee, salary_component having c > 1""",
        {"ms": f"{month}-01", "d": m_end})

    total_drafts = sum(g["drafts"] for g in groups.values())
    ready = total_drafts == 0 and not foreign and not dups and \
        any(g["submitted"] for g in groups.values())
    from bgl_ops import __version__
    return {"month": month, "month_end": m_end, "groups": groups,
            "foreign": foreign, "duplicates": dups,
            "total_drafts": total_drafts, "ready": ready,
            "app_version": __version__}


@frappe.whitelist()
def approve_group(month, group):
    """Submit every DRAFT in one review group (HR Manager only)."""
    _require_access()
    if "HR Manager" not in frappe.get_roles() and \
            "System Manager" not in frappe.get_roles():
        frappe.throw("Only HR Manager can approve", frappe.PermissionError)
    g = REVIEW_GROUPS.get(group)
    if not g:
        frappe.throw(f"Unknown group {group}")
    m_end = _month_end(month)
    names = frappe.get_all("Additional Salary", filters={
        "payroll_date": ("between", [f"{month}-01", m_end]), "docstatus": 0,
        "salary_component": ("in", _group_components(group))}, pluck="name")
    done, errors = 0, []
    for n in names:
        try:
            frappe.get_doc("Additional Salary", n).submit()
            done += 1
        except Exception as ex:
            errors.append(f"{n}: {ex}")
    frappe.db.commit()
    return {"approved": done, "errors": errors[:8]}


@frappe.whitelist()
def approve_all(month, limit=75):
    """Submit every remaining DRAFT for the month, up to `limit` per call.

    Deliberately batched. A full month can carry 600 drafts, and submitting
    them in one request either times out or leaves the person watching a
    spinner with no idea whether anything is happening. The page calls this
    repeatedly and shows the count climbing.

    Same gate as approving group by group: nobody who has left may be sat
    on payroll, because submitting those is exactly the mistake this whole
    board exists to catch."""
    _require_access()
    if "HR Manager" not in frappe.get_roles() and \
            "System Manager" not in frappe.get_roles():
        frappe.throw("Only HR Manager can approve", frappe.PermissionError)

    m_end = _month_end(month)
    foreign = _q(
        """select distinct a.employee_name, a.employee
           from `tabAdditional Salary` a
           left join `tabEmployee` e on e.name = a.employee
           where a.payroll_date between %(ms)s and %(d)s and a.docstatus = 0
             and (e.name is null or e.status != 'Active')""",
        {"ms": f"{month}-01", "d": m_end})
    if foreign:
        frappe.throw(
            "Cannot approve while people who are not active staff have "
            "drafts: "
            + ", ".join((f.employee_name or f.employee) for f in foreign[:6])
            + ".<br><br>Remove those drafts first.")

    names = frappe.get_all(
        "Additional Salary",
        filters={"payroll_date": ("between", [f"{month}-01", m_end]),
                 "docstatus": 0},
        pluck="name", limit_page_length=cint(limit) or 75)
    done, errors = 0, []
    for n in names:
        try:
            frappe.get_doc("Additional Salary", n).submit()
            done += 1
        except Exception as ex:
            errors.append(f"{n}: {ex}")
    frappe.db.commit()
    remaining = frappe.db.count("Additional Salary", {
        "payroll_date": ("between", [f"{month}-01", m_end]), "docstatus": 0})
    return {"approved": done, "remaining": remaining, "errors": errors[:8]}


# ---------------------------------------------------------------------------
# Employee Hub (cockpit)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def employee_search(q):
    """Quick name search for the cockpit Employee Hub."""
    _require_access()
    q = (q or "").strip()
    if len(q) < 2:
        return []
    return _q(
        """select name, employee_name, designation, branch, status
           from `tabEmployee`
           where employee_name like %(q)s or name like %(q)s
           order by (status='Active') desc, employee_name limit 8""",
        {"q": f"%{q}%"})


@frappe.whitelist()
def employee_card(employee):
    """Everything HR needs about one person, in one call."""
    _require_access()
    e = frappe.db.get_value(
        "Employee", employee,
        ["name", "employee_name", "designation", "department", "branch",
         "status", "date_of_joining", "cell_number", "personal_email",
         "custom_truck_no", "image", "date_of_birth", "company"],
        as_dict=True)
    if not e:
        frappe.throw("Employee not found")
    base = flt(frappe.db.get_value(
        "Salary Structure Assignment",
        {"employee": employee, "docstatus": 1}, "base",
        order_by="from_date desc"))
    loans = _q(
        """select name, loan_type, principal, ifnull(total_repaid,0) repaid,
                  ifnull(balance,0) balance
           from `tabStaff Loan Advance`
           where employee=%(e)s and status='Active'""", {"e": employee})
    leave_taken = flt(_q(
        """select ifnull(sum(total_leave_days),0) v from `tabLeave Application`
           where employee=%(e)s and docstatus=1 and status='Approved'
             and from_date >= %(y)s""",
        {"e": employee, "y": f"{getdate(today()).year}-01-01"})[0].v)
    recent = _q(
        """select name, salary_component, amount, payroll_date, docstatus
           from `tabAdditional Salary`
           where employee=%(e)s and docstatus < 2
           order by payroll_date desc, creation desc limit 5""",
        {"e": employee})
    trips_month = _q(
        """select ifnull(sum(quantity),0) qty, ifnull(sum(amount),0) amt
           from `tabDaily Trip Log`
           where employee=%(e)s and docstatus < 2
             and log_date >= %(ms)s""",
        {"e": employee, "ms": get_first_day(today())})[0]
    return {"emp": e, "base": base, "loans": loans,
            "loan_balance": flt(sum(flt(l.balance) for l in loans), 2),
            "leave_taken": leave_taken, "recent": recent,
            "leave_encashed": flt(_q(
            """select ifnull(sum(encashed_days),0) v
               from `tabBGL Leave Encashment`
               where employee=%(e)s and status != 'Rejected'""",
            {"e": employee})[0].v, 1),
            "trips_month": trips_month}


@frappe.whitelist()
def employee_360(employee, from_date=None, to_date=None):
    """Executive view: everything about one person for a period -
    biodata, earnings and deductions by component, salary slips, trips,
    loans and leave."""
    _require_access()
    from_date = from_date or f"{getdate(today()).year}-01-01"
    to_date = to_date or today()
    card = employee_card(employee)

    slips = _q(
        """select name, start_date, end_date, gross_pay, total_deduction,
                  net_pay, docstatus
           from `tabSalary Slip`
           where employee=%(e)s and docstatus=1
             and start_date >= %(f)s and end_date <= %(t)s
           order by start_date desc""",
        {"e": employee, "f": from_date, "t": to_date})

    def comp_rows(parentfield):
        return _q(
            """select sd.salary_component, sum(sd.amount) amount,
                      count(distinct ss.name) months
               from `tabSalary Detail` sd
               inner join `tabSalary Slip` ss on ss.name = sd.parent
               where ss.employee=%(e)s and ss.docstatus=1
                 and ss.start_date >= %(f)s and ss.end_date <= %(t)s
                 and sd.parentfield=%(pf)s and ifnull(sd.amount,0) != 0
               group by sd.salary_component
               order by amount desc""",
            {"e": employee, "f": from_date, "t": to_date, "pf": parentfield})

    trips = _q(
        """select ifnull(sum(quantity),0) qty, ifnull(sum(amount),0) amt,
                  count(*) days
           from `tabDaily Trip Log`
           where employee=%(e)s and docstatus=1
             and log_date between %(f)s and %(t)s""",
        {"e": employee, "f": from_date, "t": to_date})[0]

    leaves = _q(
        """select leave_type, ifnull(sum(total_leave_days),0) days
           from `tabLeave Application`
           where employee=%(e)s and docstatus=1 and status='Approved'
             and from_date >= %(f)s and to_date <= %(t)s
           group by leave_type""",
        {"e": employee, "f": from_date, "t": to_date})

    # --- one-off Additional Salary entries in the period ---
    extras = _q(
        """select a.name, a.payroll_date, a.salary_component,
                  a.amount, a.docstatus, ifnull(a.custom_bgl_note,'') note,
                  ifnull(c.type,'Earning') ctype
           from `tabAdditional Salary` a
           left join `tabSalary Component` c on c.name = a.salary_component
           where a.employee=%(e)s and a.docstatus < 2
             and a.payroll_date between %(f)s and %(t)s
           order by a.payroll_date desc, a.salary_component""",
        {"e": employee, "f": from_date, "t": to_date})
    extra_pay = [r for r in extras if r.ctype == 'Earning']
    extra_recoveries = [r for r in extras if r.ctype != 'Earning']

    # --- leave picture (as of today, not just the period) ---
    allocs = _q(
        """select leave_type, from_date, to_date,
                  sum(total_leaves_allocated) allocated
           from `tabLeave Allocation`
           where employee=%(e)s and docstatus=1
             and %(d)s between from_date and to_date
           group by leave_type, from_date, to_date""",
        {"e": employee, "d": today()})
    leave_balances = []
    for a in allocs:
        taken = _q(
            """select ifnull(sum(total_leave_days),0) v
               from `tabLeave Application`
               where employee=%(e)s and docstatus=1 and status='Approved'
                 and leave_type=%(lt)s
                 and from_date >= %(f)s and to_date <= %(t)s""",
            {"e": employee, "lt": a.leave_type,
             "f": a.from_date, "t": a.to_date})[0].v
        enc_days = _q(
            """select ifnull(sum(encashed_days),0) v
               from `tabBGL Leave Encashment`
               where employee=%(e)s and leave_type=%(lt)s
                 and status != 'Rejected'""",
            {"e": employee, "lt": a.leave_type})[0].v
        leave_balances.append({
            "leave_type": a.leave_type,
            "allocated": flt(a.allocated, 1),
            "taken": flt(taken, 1),
            "encashed": flt(enc_days, 1),
            "remaining": flt(flt(a.allocated) - flt(taken) - flt(enc_days), 1)})

    pending_leaves = _q(
        """select name, leave_type, from_date, to_date,
                  total_leave_days days, status
           from `tabLeave Application`
           where employee=%(e)s and docstatus=0
           order by from_date desc limit 20""", {"e": employee})

    encashments = _q(
        """select name, leave_type, encashment_date request_date,
                  encashed_days days, encashed_amount amount, status,
                  ifnull(remarks,'') note
           from `tabBGL Leave Encashment`
           where employee=%(e)s
           order by encashment_date desc limit 20""", {"e": employee})

    return {
        "from_date": from_date, "to_date": to_date,
        "card": card,
        "slips": slips,
        "gross": flt(sum(flt(s.gross_pay) for s in slips), 2),
        "deductions_total": flt(sum(flt(s.total_deduction) for s in slips), 2),
        "net": flt(sum(flt(s.net_pay) for s in slips), 2),
        "earnings_by_component": comp_rows("earnings"),
        "deductions_by_component": comp_rows("deductions"),
        "extra_pay": extra_pay,
        "extra_recoveries": extra_recoveries,
        "trips": trips,
        "leaves": leaves,
        "leave_balances": leave_balances,
        "pending_leaves": pending_leaves,
        "encashments": encashments,
    }


@frappe.whitelist()
def whos_out(site=None):
    """Who's Out roster for the Command Center: on leave now, and starting
    within 14 days. Reads approved Leave Applications directly - the Employee
    banner fields hold only one leave each and are owned by server scripts."""
    _require_access()
    t = today()
    horizon = add_days(t, 14)

    rows = _q(
        """select la.employee, la.employee_name, e.department, e.branch,
                  e.designation, la.leave_type, la.from_date, la.to_date,
                  ifnull(la.custom_resume_date,
                         date_add(la.to_date, interval 1 day)) resume_date,
                  la.total_leave_days days
           from `tabLeave Application` la
           inner join `tabEmployee` e on e.name = la.employee
           where la.docstatus=1 and la.status='Approved'
             and e.status='Active'
             and la.to_date >= %(t)s and la.from_date <= %(h)s
             and (%(site)s = 'All' or e.branch = %(site)s)
           order by la.from_date asc""",
        {"t": t, "h": horizon,
         "site": site if site in ("Airport", "Tema") else "All"})

    out_now, upcoming = [], []
    for r in rows:
        (out_now if str(r.from_date) <= str(t) else upcoming).append(r)

    return {"as_of": t, "horizon": horizon,
            "out_now": out_now, "upcoming": upcoming,
            "counts": {"out_now": len(out_now), "upcoming": len(upcoming)}}


@frappe.whitelist()
def leave_roster(site=None):
    """Every active employee's leave balances (current allocations),
    pivoted per leave type - for the Command Center Leave tab."""
    _require_access()
    rows = _q(
        """select la.employee, e.employee_name, e.branch, e.department,
                  la.leave_type,
                  sum(la.total_leaves_allocated) allocated,
                  ifnull((select sum(ap.total_leave_days)
                          from `tabLeave Application` ap
                          where ap.employee=la.employee and ap.docstatus=1
                            and ap.status='Approved'
                            and ap.leave_type=la.leave_type
                            and ap.from_date >= la.from_date
                            and ap.to_date <= la.to_date),0) taken,
                  ifnull((select sum(le.encashed_days)
                          from `tabBGL Leave Encashment` le
                          where le.employee=la.employee
                            and le.leave_type=la.leave_type
                            and le.status != 'Rejected'),0) encashed
           from `tabLeave Allocation` la
           inner join `tabEmployee` e on e.name=la.employee
           where la.docstatus=1 and e.status='Active'
             and %(d)s between la.from_date and la.to_date
             and (%(site)s = 'All' or e.branch = %(site)s)
           group by la.employee, la.leave_type, la.from_date, la.to_date
           order by e.employee_name""",
        {"d": today(), "site": site if site in ("Airport", "Tema") else "All"})

    types, emps = [], {}
    for r in rows:
        if r.leave_type not in types:
            types.append(r.leave_type)
        e = emps.setdefault(r.employee, {
            "employee": r.employee, "employee_name": r.employee_name,
            "branch": r.branch, "department": r.department, "types": {}})
        rem = flt(flt(r.allocated) - flt(r.taken) - flt(r.encashed), 1)
        e["types"][r.leave_type] = {
            "allocated": flt(r.allocated, 1), "taken": flt(r.taken, 1),
            "encashed": flt(r.encashed, 1), "remaining": rem}
    types.sort()
    return {"as_of": today(), "types": types, "rows": list(emps.values())}


@frappe.whitelist()
def recovery_history():
    """Loans / Salary Advance payroll recovery per month, last 13 months -
    lets the Command Center offer a month picker without extra round trips."""
    _require_access()
    rows = _q(
        """select date_format(payroll_date, '%%Y-%%m') month,
                  salary_component,
                  ifnull(sum(amount),0) amt,
                  count(distinct employee) staff,
                  count(*) entries,
                  sum(docstatus=0) drafts
           from `tabAdditional Salary`
           where disabled=0 and docstatus < 2
             and salary_component in ('Loans','Salary Advance')
             and payroll_date >= date_sub(%(d)s, interval 13 month)
           group by month, salary_component
           order by month desc, salary_component""", {"d": today()})
    return {"rows": rows}


# ---------------------------------------------------------------------------
# Two green clicks: automated Payroll Entry + guarded slip submission
# ---------------------------------------------------------------------------

def _month_bounds(month):
    return f"{month}-01", _month_end(month)

def _payroll_entries(month):
    m_start, m_end = _month_bounds(month)
    return _q(
        """select name, docstatus, start_date, end_date, number_of_employees,
                  branch, department, designation
           from `tabPayroll Entry`
           where start_date=%(f)s and end_date=%(t)s and docstatus < 2
           order by creation""", {"f": m_start, "t": m_end})


@frappe.whitelist()
def run_payroll(month, confirm=0):
    """Green click 1: create + submit Payroll Entry(ies) for the month,
    copying every repeating field from the previous month's entries.
    Only allowed when the Review board is fully green. Slip creation is
    ERPNext's own on-submit behaviour (enqueued for large companies)."""
    _require_access()
    if "HR Manager" not in frappe.get_roles() and \
            "System Manager" not in frappe.get_roles():
        frappe.throw("Only HR Manager can run payroll", frappe.PermissionError)

    board = review_board(month)
    if not board.get("ready"):
        frappe.throw("The Review board is not fully green for this month. "
                     "Approve every group (and clear warnings) first.")

    # a green board is not enough if joiners were never prorated - they would
    # have no salary assignment and silently drop off the payroll
    hires_line = [l for l in payroll_readiness(month)["lines"]
                  if l["key"] == "hires"]
    if hires_line and not hires_line[0]["ok"]:
        frappe.throw("New hires are not prorated yet: "
                     + hires_line[0]["detail"]
                     + ".<br>Fill the Pro-Ration tab on the Payroll Prep "
                     "Sheet first - otherwise these joiners would be "
                     "missing from payroll entirely.")

    # Allowances and basic salaries must be signed off by a person. These are
    # the two sections whose correct state is often "unchanged", so nothing
    # the app can measure proves they were looked at.
    unsigned = [s for s in ("Basic Salaries", "Allowances and OT")
                if not _signed(month, s)]
    if unsigned:
        frappe.throw(
            "Not reviewed yet: " + ", ".join(unsigned)
            + ".<br><br>Open the Payroll Prep Sheet, check the tab and press "
            "<b>Mark reviewed</b>. If nothing needed changing that is a fine "
            "answer - but somebody has to say so before payroll runs.")

    m_start, m_end = _month_bounds(month)

    # A month that spilled over must be closed before the next one opens.
    # Without this, running late (or on the 1st) would stack a second
    # Payroll Entry on top of a month still sitting in draft.
    stale = _q(
        """select name, start_date, end_date from `tabPayroll Entry`
           where docstatus = 0 and end_date < %(f)s order by end_date""",
        {"f": m_start})
    if stale:
        frappe.throw(
            "An earlier payroll month is still open: "
            + ", ".join(f"{s.name} ({s.start_date} to {s.end_date})"
                        for s in stale)
            + f".<br><br>Submit or cancel it before opening {month}. "
            "Running a new month on top of an unclosed one is how people "
            "get paid twice.")

    existing = _payroll_entries(month)
    if existing:
        return {"created": [], "existing": [e.name for e in existing],
                "note": "Payroll Entry already exists for this month."}

    # Opening a brand new payroll month is deliberate, never incidental.
    if not cint(confirm):
        head = _q(
            """select count(*) c from `tabEmployee`
               where status='Active'""")[0].c
        return {
            "needs_confirmation": 1, "month": month, "created": [],
            "message": (
                f"No Payroll Entry exists for {month} yet, so this OPENS a "
                f"new payroll month and drafts a salary slip for all {head} "
                "active staff.<br><br>Only do this once the month is really "
                "finished. Open it?")}

    # template(s): the previous month's submitted entries (handles both one
    # combined run and per-branch runs - we replicate whatever they did last)
    templates = _q(
        """select name, company, payroll_frequency, currency, exchange_rate,
                  payroll_payable_account, cost_center, project,
                  payment_account, bank_account, branch, department,
                  designation
           from `tabPayroll Entry`
           where docstatus=1 and end_date < %(f)s
             and end_date = (select max(end_date) from `tabPayroll Entry`
                             where docstatus=1 and end_date < %(f)s)
           order by creation""", {"f": m_start})
    if not templates:
        frappe.throw("No previous submitted Payroll Entry found to copy "
                     "settings from. Run the first month manually.")

    created, excluded_all = [], []
    for t in templates:
        doc = frappe.get_doc({
            "doctype": "Payroll Entry",
            "company": t.company,
            "posting_date": m_end,
            "payroll_frequency": t.payroll_frequency or "Monthly",
            "start_date": m_start,
            "end_date": m_end,
            "currency": t.currency,
            "exchange_rate": t.exchange_rate or 1,
            "payroll_payable_account": t.payroll_payable_account,
            "cost_center": t.cost_center,
            "project": t.project,
            "payment_account": t.payment_account,
            "bank_account": t.bank_account,
            "branch": t.branch,
            "department": t.department,
            "designation": t.designation,
        })
        doc.insert()          # v16 fill needs a persisted doc (name-based
        doc.reload()          # subqueries return nothing on unsaved docs)
        doc.fill_employee_details()
        # narrated exclusions: anything not Active never belongs on payroll
        keep, excluded = [], []
        for row in doc.employees:
            st = frappe.db.get_value("Employee", row.employee, "status")
            if st == "Active":
                keep.append(row)
            else:
                excluded.append(f"{row.employee_name} ({st})")
        doc.employees = []
        for row in keep:
            doc.append("employees", {"employee": row.employee,
                                     "employee_name": row.employee_name,
                                     "department": row.department,
                                     "designation": row.designation})
        doc.number_of_employees = len(doc.employees)
        if not doc.employees:
            continue
        doc.save()
        doc.submit()   # ERPNext creates DRAFT salary slips (queued if many)
        created.append(doc.name)
        excluded_all += excluded
    frappe.db.commit()
    return {"created": created, "existing": [],
            "excluded": excluded_all,
            "expected_slips": sum(
                cint(frappe.db.get_value("Payroll Entry", n,
                                         "number_of_employees"))
                for n in created)}


@frappe.whitelist()
def payroll_status(month):
    """Progress + machine reconciliation for the month's payroll entries.
    Verdict feeds the second green click."""
    _require_access()
    m_start, m_end = _month_bounds(month)
    entries = _payroll_entries(month)
    if not entries:
        return {"entries": [], "phase": "none"}

    names = [e.name for e in entries]
    expected = sum(cint(e.number_of_employees) for e in entries)
    slips = _q(
        """select name, employee, employee_name, docstatus, net_pay, gross_pay
           from `tabSalary Slip`
           where payroll_entry in %(pe)s and docstatus < 2""",
        {"pe": names})
    drafts = [x for x in slips if x.docstatus == 0]
    submitted = [x for x in slips if x.docstatus == 1]

    # --- reconciliation: board group totals vs slip component sums ---
    recon = []
    if slips:
        comp_sums = _q(
            """select sd.salary_component, ifnull(sum(sd.amount),0) amt
               from `tabSalary Detail` sd
               inner join `tabSalary Slip` ss on ss.name = sd.parent
               where ss.payroll_entry in %(pe)s and ss.docstatus < 2
                 and ifnull(sd.amount,0) != 0
               group by sd.salary_component""", {"pe": names})
        cmap = {c.salary_component: flt(c.amt) for c in comp_sums}
        board = review_board(month)
        for key, g in board["groups"].items():
            if not g["rows"]:
                continue
            slip_total = flt(sum(cmap.get(c, 0)
                                 for c in _group_components(key)), 2)
            recon.append({"group": g["label"], "board": g["total"],
                          "slips": slip_total,
                          "ok": abs(slip_total - flt(g["total"])) < 0.05})

    # --- anomalies ---
    anomalies = []
    slip_emps = {x.employee for x in slips}
    owed = _q(
        """select distinct employee, employee_name from `tabAdditional Salary`
           where docstatus=1 and disabled=0
             and payroll_date between %(f)s and %(t)s""",
        {"f": m_start, "t": m_end})
    for o in owed:
        if o.employee not in slip_emps:
            anomalies.append(f"{o.employee_name}: has approved payroll "
                             "entries but NO salary slip")
    for x in slips:
        if flt(x.net_pay) <= 0:
            anomalies.append(f"{x.employee_name}: net pay is "
                             f"{flt(x.net_pay, 2)}")
    prev = _q(
        """select ss.employee, ss.net_pay from `tabSalary Slip` ss
           where ss.docstatus=1 and ss.end_date < %(f)s
             and ss.end_date = (select max(end_date) from `tabSalary Slip`
                                where docstatus=1 and end_date < %(f)s)""",
        {"f": m_start})
    pmap = {p.employee: flt(p.net_pay) for p in prev}
    for x in slips:
        base = pmap.get(x.employee)
        if base and base > 0:
            swing = abs(flt(x.net_pay) - base) / base
            if swing > 0.2:
                anomalies.append(
                    f"{x.employee_name}: net moved "
                    f"{round(swing * 100)}% vs last month "
                    f"({flt(base, 2)} -> {flt(x.net_pay, 2)})")

    phase = "creating"
    if expected and len(slips) >= expected:
        phase = "drafts_ready"
    if submitted and len(submitted) >= expected:
        phase = "submitted"
    return {"entries": [dict(e) for e in entries], "phase": phase,
            "expected": expected, "created": len(slips),
            "submitted": len(submitted), "recon": recon,
            "recon_ok": all(r["ok"] for r in recon) if recon else False,
            "anomalies": anomalies}


@frappe.whitelist()
def submit_payroll(month, confirm=0):
    """Green click 2: submit every draft salary slip for the month's payroll
    entries. Refuses while anomalies stand, unless explicitly confirmed."""
    _require_access()
    if "HR Manager" not in frappe.get_roles() and \
            "System Manager" not in frappe.get_roles():
        frappe.throw("Only HR Manager can submit payroll",
                     frappe.PermissionError)
    st = payroll_status(month)
    if st["phase"] == "none":
        frappe.throw("No Payroll Entry for this month yet.")
    if st["phase"] == "creating":
        frappe.throw(f"Slips still being created "
                     f"({st['created']} of {st['expected']}). Wait a moment.")
    if st["anomalies"] and not cint(confirm):
        frappe.throw("Anomalies need reading first:<br>"
                     + "<br>".join(st["anomalies"][:15]))
    if st["recon"] and not st["recon_ok"] and not cint(confirm):
        frappe.throw("Slip totals do not match the Review board. "
                     "Do not submit until this is explained.")
    for e in st["entries"]:
        frappe.get_doc("Payroll Entry", e["name"]).submit_salary_slips()
    frappe.db.commit()
    return {"queued": True, "entries": [e["name"] for e in st["entries"]]}
