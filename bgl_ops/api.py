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
def dashboard_data(from_date=None, to_date=None, site=None):
    """All figures for the /command-center page in one call.

    from_date/to_date scope the trip metrics (default: month to date).
    site filters trips to one branch ('All' or empty = both).
    Loans, leave and encashment are point-in-time and ignore the period.
    """
    _require_access()
    period_start = str(getdate(from_date)) if from_date else str(get_first_day(today()))
    period_end = str(getdate(to_date)) if to_date else today()
    if period_start > period_end:
        period_start, period_end = period_end, period_start
    site = site if site in ("Airport", "Tema") else "All"
    yesterday = add_days(today(), -1)

    p = {"f": period_start, "t": period_end, "site": site}
    site_cond = " and (%(site)s = 'All' or branch = %(site)s)"
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
           where docstatus=1 and log_date between %(f)s and %(t)s""" + site_cond + """
           group by branch, pay_group order by amt desc""", p)
    trend = _q(
        """select log_date d, ifnull(sum(amount),0) amt, ifnull(sum(quantity),0) qty
           from `tabDaily Trip Log`
           where docstatus=1 and log_date between %(f)s and %(t)s""" + site_cond + """
           group by log_date order by log_date limit 92""", p)

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
        "period": {"from_date": period_start, "to_date": period_end, "site": site},
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
                "remark": (f"Auto-generated from {site} trip sheet "
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

    # Current month's saved drafts (so reloading shows what was entered)
    drafts = _q(
        """select name, employee, salary_component, amount
           from `tabAdditional Salary`
           where docstatus=0 and payroll_date=%(d)s
             and salary_component in %(comps)s""",
        {"d": m_end, "comps": DEDUCT_COMPONENTS})

    # Last month's submitted advances = this month's pre-fill
    prev_adv = _q(
        """select employee, employee_name, amount
           from `tabAdditional Salary`
           where docstatus=1 and payroll_date=%(d)s
             and salary_component='Salary Advance'
           order by employee_name""",
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

    return {"month": month, "month_end": m_end, "prev_month_end": prev_end,
            "loans": loans, "drafts": drafts, "prev_advances": prev_adv,
            "employees": employees,
            "bases": {b.employee: flt(b.base) for b in bases}}


def _upsert_deduction_draft(employee, component, amount, m_end, remark,
                            overwrite=0):
    """Create/update/delete ONE draft Additional Salary. Returns action."""
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
        doc.remark = remark
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
        "remark": remark,
    })
    doc.insert()  # stays DRAFT for HR review
    return "created"


@frappe.whitelist()
def deduction_save(month, loans=None, advances=None, absences=None):
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

    m_end = _month_end(month)
    year, mon = int(month[:4]), int(month[5:7])
    month_label = f"{calendar.month_name[mon]} {year}"
    ref = f"PAYROLL-{month}"
    out = {"loans": 0, "advances": 0, "absences": 0, "cleared": [], "errors": []}

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
            _upsert_deduction_draft(
                doc.employee, "Loans", amount, m_end,
                f"Loan installment {month_label} ({doc.name}) via deduction sheet")
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
            if act in ("created", "updated"):
                out["absences"] += 1
        except Exception as ex:
            out["errors"].append(f"Absence {row.get('employee')}: {ex}")

    frappe.db.commit()
    out["errors"] = out["errors"][:10]
    return out
