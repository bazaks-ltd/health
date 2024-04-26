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
			// when clicking this button should open new consultation with prefilled values

			// const link = '/app/patient-encounter/new-patient-encounter' + '/?' + 'patient=' + encodeURIComponent(doc.patient);
			// frappe.set_route(link);

			frappe.set_route("Form", "Patient Encounter", "new-patient-encounter");
		}
	},
};
