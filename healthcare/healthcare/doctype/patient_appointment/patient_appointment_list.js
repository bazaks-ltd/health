/*
(c) ESS 2015-16
*/
const d = (((new Date()).toISOString().split('T')[0]).split('-').reverse()).join('-')

frappe.listview_settings['Patient Appointment'] = {
	filters: [],
	get_indicator: function (doc) {
		var colors = {
			"Open": "orange",
			"Scheduled": "yellow",
			"Closed": "green",
			"Cancelled": "red",
			"Expired": "grey",
			"Checked In": "blue",
			"Checked Out": "orange"
		};
		return [__(doc.status), colors[doc.status], "status,=," + doc.status];
	},
	button: {
		show() {
			const is_doctor = frappe.user.has_role('Doctor')
			return is_doctor;
		},
		get_description() { },
		get_label() {
			return 'Begin Consultation';
		},
		action(doc) {
			const frm = new frappe.ui.form.Form("Patient Appointment")
			frm.doc = doc
			frappe.model.open_mapped_doc({
				method: 'healthcare.healthcare.doctype.patient_appointment.patient_appointment.make_encounter',
				frm,
			});
		}
	},
};
