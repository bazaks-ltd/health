# -*- coding: utf-8 -*-
# Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt


import json

import frappe
from frappe import _
from frappe.contacts.address_and_contact import load_address_and_contact
from frappe.utils import cint, cstr
from frappe.utils.nestedset import NestedSet


class HealthcareServiceUnit(NestedSet):
	nsm_parent_field = "parent_healthcare_service_unit"

	def onload(self):
		"""Load address and contacts in `__onload`"""
		load_address_and_contact(self)

	def validate(self):
		self.set_service_unit_properties()

	def autoname(self):
		if self.company:
			suffix = " - " + frappe.get_cached_value("Company", self.company, "abbr")
			if not self.healthcare_service_unit_name.endswith(suffix):
				self.name = self.healthcare_service_unit_name + suffix
		else:
			self.name = self.healthcare_service_unit_name

	def on_update(self):
		super(HealthcareServiceUnit, self).on_update()
		self.validate_one_root()

	def on_trash(self):
		if self.flags.on_trash_company:
			NestedSet.on_trash(self, allow_root_deletion=True)
		else:
			NestedSet.on_trash(self)

	def set_service_unit_properties(self):
		if cint(self.is_group):
			self.allow_appointments = False
			self.overlap_appointments = False
			self.inpatient_occupancy = False
			self.service_unit_capacity = 0
			self.occupancy_status = ""
			self.service_unit_type = ""
		elif self.service_unit_type != "":
			service_unit_type = frappe.get_doc("Healthcare Service Unit Type", self.service_unit_type)
			self.allow_appointments = service_unit_type.allow_appointments
			self.inpatient_occupancy = service_unit_type.inpatient_occupancy

			if self.inpatient_occupancy and not self.occupancy_status:
				self.occupancy_status = "Vacant"

			if service_unit_type.overlap_appointments:
				self.overlap_appointments = True
			else:
				self.overlap_appointments = False
				self.service_unit_capacity = 0

		if self.overlap_appointments:
			if not self.service_unit_capacity:
				frappe.throw(
					_("Please set a valid Service Unit Capacity to enable Overlapping Appointments"),
					title=_("Mandatory"),
				)


@frappe.whitelist()
def add_multiple_service_units(parent, data):
	"""
	parent - parent service unit under which the service units are to be created
	data (dict) - company, healthcare_service_unit_name, count, service_unit_type, warehouse, service_unit_capacity
	"""
	if not parent or not data:
		return

	data = json.loads(data)
	company = (
		data.get("company")
		or frappe.defaults.get_defaults().get("company")
		or frappe.db.get_single_value("Global Defaults", "default_company")
	)

	if not data.get("healthcare_service_unit_name") or not company:
		frappe.throw(
			_("Service Unit Name and Company are mandatory to create Healthcare Service Units"),
			title=_("Missing Required Fields"),
		)

	count = cint(data.get("count") or 0)
	if count <= 0:
		frappe.throw(
			_("Number of Service Units to be created should at least be 1"),
			title=_("Invalid Number of Service Units"),
		)

	capacity = cint(data.get("service_unit_capacity") or 1)

	service_unit = {
		"doctype": "Healthcare Service Unit",
		"parent_healthcare_service_unit": parent if parent != company else None,
		"service_unit_type": data.get("service_unit_type") or None,
		"service_unit_capacity": capacity if capacity > 0 else 1,
		"warehouse": data.get("warehouse") or None,
		"company": company,
	}

	service_unit_name = "{}".format(data.get("healthcare_service_unit_name").strip(" -"))

	last_suffix = frappe.db.sql(
		"""SELECT
		IFNULL(MAX(CAST(SUBSTRING(name FROM %(start)s FOR 4) AS UNSIGNED)), 0)
		FROM `tabHealthcare Service Unit`
		WHERE name like %(prefix)s AND company=%(company)s""",
		{
			"start": len(service_unit_name) + 2,
			"prefix": "{}-%".format(service_unit_name),
			"company": company,
		},
		as_list=1,
	)[0][0]
	start_suffix = cint(last_suffix) + 1

	failed_list = []
	for i in range(start_suffix, count + start_suffix):
		# name to be in the form WARD-####
		service_unit["healthcare_service_unit_name"] = "{}-{}".format(
			service_unit_name, cstr("%0*d" % (4, i))
		)
		service_unit_doc = frappe.get_doc(service_unit)
		try:
			service_unit_doc.insert()
		except Exception:
			failed_list.append(service_unit["healthcare_service_unit_name"])

	return failed_list


@frappe.whitelist()
def vacate_room(room_name):
	"""Discharge a room by setting occupancy status to Vacant"""
	try:
		current_status = frappe.db.sql("""
			SELECT occupancy_status, inpatient_occupancy 
			FROM `tabHealthcare Service Unit` 
			WHERE name = %s
		""", (room_name,), as_dict=True)
		
		if not current_status:
			return f"Healthcare Service Unit {room_name} not found"
		
		room_data = current_status[0]
		
		if not room_data.get('inpatient_occupancy'):
			return f"Healthcare Service Unit {room_name} is not an inpatient room"
		
		if room_data.get('occupancy_status') == 'Vacant':
			return "Room already vacant"
		
		if room_data.get('occupancy_status') == 'Occupied':
			# Check via tabInpatient Occupancy (active rows only) — more reliable than
			# healthcare_service_unit field on Inpatient Record which can be stale after transfers
			active_inpatient = frappe.db.sql("""
				SELECT ir.name, ir.patient_name FROM `tabInpatient Occupancy` io
				JOIN `tabInpatient Record` ir ON ir.name = io.parent
				WHERE io.service_unit = %s
				AND (io.left IS NULL OR io.left != 1)
				AND ir.status IN ('Admitted', 'Discharge Scheduled')
				LIMIT 1
			""", (room_name,), as_dict=True)
			
			if active_inpatient:
				patient_name = active_inpatient[0].get('patient_name')
				return f"Cannot vacate room because room is physically occupied by {patient_name}"
			
			frappe.db.sql("""
				UPDATE `tabHealthcare Service Unit` 
				SET occupancy_status = 'Vacant', modified = NOW(), modified_by = %s
				WHERE name = %s
			""", (frappe.session.user, room_name))
			
			frappe.db.commit()
			return f"Healthcare Service Unit {room_name} vacant"
		
		return f"Room status unclear"
		
	except Exception as e:
		frappe.log_error(f"Error discharging room {room_name}: {str(e)}")
		return f"Error discharging room: {str(e)}"


def on_doctype_update():
	frappe.db.add_unique(
		"Healthcare Service Unit",
		["healthcare_service_unit_name", "company"],
		constraint_name="unique_service_unit_company",
	)
