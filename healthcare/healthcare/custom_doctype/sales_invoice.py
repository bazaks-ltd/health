import frappe
from frappe.utils import now_datetime, add_to_date
from frappe import _

from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice


class HealthcareSalesInvoice(SalesInvoice):
	@frappe.whitelist()
	def set_healthcare_services(self, checked_values):
		from erpnext.stock.get_item_details import get_item_details

		for checked_item in checked_values:
			item_line = self.append("items", {})
			price_list, price_list_currency = frappe.db.get_values(
				"Price List", {"selling": 1}, ["name", "currency"]
			)[0]
			args = {
				"doctype": "Sales Invoice",
				"item_code": checked_item["item"],
				"company": self.company,
				"customer": frappe.db.get_value("Patient", self.patient, "customer"),
				"selling_price_list": price_list,
				"price_list_currency": price_list_currency,
				"plc_conversion_rate": 1.0,
				"conversion_rate": 1.0,
			}
			item_details = get_item_details(args)
			item_line.item_code = checked_item["item"]
			item_line.qty = 1
			if checked_item["qty"]:
				item_line.qty = checked_item["qty"]
			if checked_item["rate"]:
				item_line.rate = checked_item["rate"]
			else:
				item_line.rate = item_details.price_list_rate
			item_line.amount = float(item_line.rate) * float(item_line.qty)
			if checked_item["income_account"]:
				item_line.income_account = checked_item["income_account"]
			if checked_item["dt"]:
				item_line.reference_dt = checked_item["dt"]
			if checked_item["dn"]:
				item_line.reference_dn = checked_item["dn"]
			if checked_item["description"]:
				item_line.description = checked_item["description"]
			if checked_item["dt"] == "Lab Test":
				lab_test = frappe.get_doc("Lab Test", checked_item["dn"])
				item_line.service_unit = lab_test.service_unit
				item_line.practitioner = lab_test.practitioner
				item_line.medical_department = lab_test.department

		self.set_missing_values(for_validate=True)


@frappe.whitelist()
def get_outpatient_delivery_notes(patient):
	"""Fetch delivery notes with status 'To Bill' for the patient within 10 hours"""
	if not patient:
		frappe.throw(_("Patient is required"))
	
	# Get customer linked to patient
	customer = frappe.db.get_value("Patient", patient, "customer")
	if not customer:
		return []
	
	# Calculate 10 hours ago from now
	ten_hours_ago = add_to_date(now_datetime(), hours=-10)
	current_datetime = now_datetime()
	
	# Fetch delivery notes
	filters = {
		"customer": customer,
		"status": "To Bill",
		"creation": [">=", ten_hours_ago]
	}
	
	delivery_notes = frappe.get_all(
		"Delivery Note",
		filters=filters,
		fields=["name", "customer", "posting_date", "posting_time", "grand_total", "status"],
		order_by="posting_date desc, posting_time desc"
	)
	
	return delivery_notes


@frappe.whitelist()
def get_delivery_note_items(delivery_note):
	"""Get items from a delivery note"""
	if not delivery_note:
		frappe.throw(_("Delivery Note is required"))
	
	dn_doc = frappe.get_doc("Delivery Note", delivery_note)
	items = []
	
	for item in dn_doc.items:
		items.append({
			"name": item.name,
			"item_code": item.item_code,
			"item_name": item.item_name,
			"description": item.description,
			"qty": item.qty,
			"rate": item.rate,
			"amount": item.amount
		})
	
	return items
