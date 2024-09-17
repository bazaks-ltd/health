/*
(c) ESS 2015-16
*/
frappe.listview_settings['Patient Appointment'] = {
	filters: [["status", "=", "Open"]],
	hide_name_column: true,
	get_indicator: function(doc) {
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
			return true;
			const is_doctor = frappe.user.has_role("Doctor");
			return is_doctor;
		},
		get_description() { },
		get_label() {
			return "Begin Consultation";
		},
		action(doc) {
			const { name, patient } = doc;
			window.open(
				`/clinic/consultation/?patient=${patient}&appointment=${name}`
			);
		}
	}
};
