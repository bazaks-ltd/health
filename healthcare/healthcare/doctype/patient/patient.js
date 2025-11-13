// Copyright (c) 2016, ESS LLP and contributors
// For license information, please see license.txt
/* eslint-disable */
{% include 'healthcare/regional/india/abdm/js/patient.js' %}

frappe.ui.form.on('Patient', {
	refresh: function (frm) {
		clear_duplicate_ui(frm);

		frm.set_query('patient', 'patient_relation', function () {
			return {
				filters: [
					['Patient', 'name', '!=', frm.doc.name]
				]
			};
		});
		frm.set_query('customer_group', {'is_group': 0});
		frm.set_query('default_price_list', { 'selling': 1});

		if (frappe.defaults.get_default('patient_name_by') != 'Naming Series') {
			frm.toggle_display('naming_series', false);
		} else {
			erpnext.toggle_naming_series();
		}

		if (frappe.defaults.get_default('collect_registration_fee') && frm.doc.status == 'Disabled') {
			frm.add_custom_button(__('Invoice Patient Registration'), function () {
				invoice_registration(frm);
			});
		}

		if (frm.doc.patient_name && frappe.user.has_role('Physician')) {
			frm.add_custom_button(__('Patient Progress'), function() {
				frappe.route_options = {'patient': frm.doc.name};
				frappe.set_route('patient-progress');
			}, __('View'));

			frm.add_custom_button(__('Patient History'), function() {
				frappe.route_options = {'patient': frm.doc.name};
				frappe.set_route('patient_history');
			}, __('View'));
		}

		frappe.dynamic_link = {doc: frm.doc, fieldname: 'name', doctype: 'Patient'};
		frm.toggle_display(['address_html', 'contact_html'], !frm.is_new());

		if (!frm.is_new()) {
			if ((frappe.user.has_role('Nursing User') || frappe.user.has_role('Physician'))) {
				frm.add_custom_button(__('Medical Record'), function () {
					create_medical_record(frm);
				}, __('Create'));
				frm.toggle_enable(['customer'], 0);
			}
			
			// Add admin-only button to clear inpatient status
			if ((frappe.user.has_role('System Manager') || frappe.user.has_role('Administrator')) && 
				(frm.doc.inpatient_status || frm.doc.inpatient_record)) {
				frm.add_custom_button(__('Clear Inpatient Status'), function () {
					clear_inpatient_status(frm);
				}, __('Tools'));
			}
			
			frappe.contacts.render_address_and_contact(frm);
			erpnext.utils.set_party_dashboard_indicators(frm);
		} else {
			frappe.contacts.clear_address_and_contact(frm);
		}
		
		// Add duplicate check button for new patients
		if (frm.is_new() && frm.doc.first_name) {
			frm.add_custom_button(__('Check for Duplicates'), function() {
				check_patient_duplicates_manual(frm);
			}, __('Tools'));
		}
	},

	onload: function (frm) {
		if (frm.doc.dob) {
			$(frm.fields_dict['age_html'].wrapper).html(`${__('AGE')} : ${get_age(frm.doc.dob)}`);
		} else {
			$(frm.fields_dict['age_html'].wrapper).html('');
		}
		
		// Initialize duplicate check timeout
		frm.duplicate_check_timeout = null;
		frm.flags = frm.flags || {};
		frm.flags.duplicate_panel_visible = false;
	},
	onload_post_render: function(frm) {
		clear_duplicate_ui(frm);
	},
	
	// Real-time duplicate checking on key fields
	first_name: function(frm) {
		if (frm.is_new()) {
			trigger_duplicate_check(frm);
		}
	},
	
	last_name: function(frm) {
		if (frm.is_new()) {
			trigger_duplicate_check(frm);
		}
	},
	
	middle_name: function(frm) {
		if (frm.is_new()) {
			trigger_duplicate_check(frm);
		}
	},
	
	mobile: function(frm) {
		if (frm.is_new()) {
			trigger_duplicate_check(frm, true); // Quick check for mobile
		}
	},
	
	email: function(frm) {
		if (frm.is_new()) {
			trigger_duplicate_check(frm, true); // Quick check for email
		}
	},
	
	uid: function(frm) {
		if (frm.is_new()) {
			trigger_duplicate_check(frm, true); // Quick check for uid
		}
	},
	
	dob: function(frm) {
		if (frm.is_new()) {
			trigger_duplicate_check(frm);
		}
	}
});

frappe.ui.form.on('Patient', 'dob', function(frm) {
	if (frm.doc.dob) {
		let today = new Date();
		let birthDate = new Date(frm.doc.dob);
		if (today < birthDate) {
			frappe.msgprint(__('Please select a valid Date'));
			frappe.model.set_value(frm.doctype,frm.docname, 'dob', '');
		} else {
			let age_str = get_age(frm.doc.dob);
			$(frm.fields_dict['age_html'].wrapper).html(`${__('AGE')} : ${age_str}`);
		}
	} else {
		$(frm.fields_dict['age_html'].wrapper).html('');
	}
});

frappe.ui.form.on('Patient Relation', {
	patient_relation_add: function(frm){
		frm.fields_dict['patient_relation'].grid.get_field('patient').get_query = function(doc){
			let patient_list = [];
			if(!doc.__islocal) patient_list.push(doc.name);
			$.each(doc.patient_relation, function(idx, val){
				if (val.patient) patient_list.push(val.patient);
			});
			return { filters: [['Patient', 'name', 'not in', patient_list]] };
		};
	}
});

let create_medical_record = function (frm) {
	frappe.route_options = {
		'patient': frm.doc.name,
		'status': 'Open',
		'reference_doctype': 'Patient Medical Record',
		'reference_owner': frm.doc.owner
	};
	frappe.new_doc('Patient Medical Record');
};

let get_age = function (birth) {
	let birth_moment = moment(birth);
	let current_moment = moment(Date());
	let diff = moment.duration(current_moment.diff(birth_moment));
	return `${diff.years()} ${__('Year(s)')} ${diff.months()} ${__('Month(s)')} ${diff.days()} ${__('Day(s)')}`
};

let create_vital_signs = function (frm) {
	if (!frm.doc.name) {
		frappe.throw(__('Please save the patient first'));
	}
	frappe.route_options = {
		'patient': frm.doc.name,
	};
	frappe.new_doc('Vital Signs');
};

let create_encounter = function (frm) {
	if (!frm.doc.name) {
		frappe.throw(__('Please save the patient first'));
	}
	frappe.route_options = {
		'patient': frm.doc.name,
	};
	frappe.new_doc('Patient Encounter');
};

let invoice_registration = function (frm) {
	frappe.call({
		doc: frm.doc,
		method: 'invoice_patient_registration',
		callback: function(data) {
			if (!data.exc) {
				if (data.message.invoice) {
					frappe.set_route('Form', 'Sales Invoice', data.message.invoice);
				}
				cur_frm.reload_doc();
			}
		}
	});
};

// Duplicate Detection Functions

let trigger_duplicate_check = function(frm, is_immediate = false) {
	// Clear previous timeout
	if (frm.duplicate_check_timeout) {
		clearTimeout(frm.duplicate_check_timeout);
	}
	
	// Only check if we have minimum required information
	if (!frm.doc.first_name && !frm.doc.mobile && !frm.doc.email && !frm.doc.uid) {
		return;
	}
	
	// Debounce the check - wait for user to stop typing
	const delay = is_immediate ? 500 : 1500; // Faster for unique identifiers
	
	frm.duplicate_check_timeout = setTimeout(function() {
		check_patient_duplicates(frm);
	}, delay);
};

let begin_duplicate_check = function(frm) {
	frm.flags = frm.flags || {};
	frm.flags.latest_duplicate_request = (frm.flags.latest_duplicate_request || 0) + 1;
	return frm.flags.latest_duplicate_request;
};

let is_latest_duplicate_request = function(frm, request_id) {
	return frm.flags && frm.flags.latest_duplicate_request === request_id;
};

let check_patient_duplicates = function(frm) {
	// Show a subtle indicator that we're checking without blocking the UI
	const request_id = begin_duplicate_check(frm);
	show_duplicate_check_indicator(frm);

	frappe.call({
		method: 'healthcare.healthcare.doctype.patient.patient_duplicate_checker.check_patient_duplicates',
		args: {
			first_name: frm.doc.first_name,
			last_name: frm.doc.last_name,
			middle_name: frm.doc.middle_name,
			mobile: frm.doc.mobile,
			email: frm.doc.email,
			uid: frm.doc.uid,
			dob: frm.doc.dob,
			sex: frm.doc.sex,
			patient_name: frm.doc.name
		},
		callback: function(r) {
			if (!is_latest_duplicate_request(frm, request_id)) {
				return;
			}
			hide_duplicate_check_indicator(frm);
			
			if (r.message && r.message.has_duplicates) {
				show_duplicate_warning(frm, r.message);
			} else {
				render_duplicate_panel(frm, { duplicates: [] }, { show: false });
				render_duplicate_status(frm, { state: 'idle' });
			}
		},
		error: function(r) {
			if (!is_latest_duplicate_request(frm, request_id)) {
				return;
			}
			hide_duplicate_check_indicator(frm);
			render_duplicate_panel(frm, { duplicates: [] }, { show: false });
			render_duplicate_status(frm, { state: 'error' });
		}
	});
};

let check_patient_duplicates_manual = function(frm, opts = {}) {
	const request_id = begin_duplicate_check(frm);
	show_duplicate_check_indicator(frm);

	frappe.call({
		method: 'healthcare.healthcare.doctype.patient.patient_duplicate_checker.check_patient_duplicates',
		args: {
			first_name: frm.doc.first_name,
			last_name: frm.doc.last_name,
			middle_name: frm.doc.middle_name,
			mobile: frm.doc.mobile,
			email: frm.doc.email,
			uid: frm.doc.uid,
			dob: frm.doc.dob,
			sex: frm.doc.sex,
			patient_name: frm.doc.name
		},
		callback: function(r) {
			if (!is_latest_duplicate_request(frm, request_id)) {
				return;
			}
			hide_duplicate_check_indicator(frm);

			if (r.message && r.message.has_duplicates) {
				frm.duplicate_data = r.message;
				const should_show = opts.show_panel !== undefined ? opts.show_panel : true;
				render_duplicate_panel(frm, r.message, { show: should_show });
				render_duplicate_status(frm, {
					state: 'warning',
					count: (r.message.high_confidence_count || 0) + (r.message.medium_confidence_count || 0) + (r.message.low_confidence_count || 0)
				});
			} else {
				render_duplicate_panel(frm, { duplicates: [] }, { show: false });
				frappe.show_alert({
					message: __('No duplicate patients found'),
					indicator: 'green'
				});
				render_duplicate_status(frm, { state: opts.show_panel ? 'success' : 'idle' });
			}
		},
		error: function() {
			if (!is_latest_duplicate_request(frm, request_id)) {
				return;
			}
			hide_duplicate_check_indicator(frm);
			render_duplicate_panel(frm, { duplicates: [] }, { show: false });
			render_duplicate_status(frm, { state: 'error' });
		}
	});
};

let show_duplicate_warning = function(frm, data) {
	const high_conf = data.high_confidence_count || 0;
	const medium_conf = data.medium_confidence_count || 0;
	const low_conf = data.low_confidence_count || 0;
	
	if (high_conf > 0) {
		// Show prominent warning for high confidence duplicates
		frappe.show_alert({
			message: __('Warning: {0} potential duplicate(s) found! Click to review.', [high_conf]),
			indicator: 'red'
		}, 10);
		
		// Add a prominent HTML banner at the top to indicate potential duplicates (since no dashboard)
		const warning_banner_id = 'potential-duplicate-warning-banner';
		// Remove any existing banner first
		$(`#${warning_banner_id}`).remove();
		const warning_html = `
			<div id="${warning_banner_id}" style="background: #ffebee; color: #b71c1c; border: 1px solid #b71c1c; padding: 8px 16px; margin-bottom: 12px; border-radius: 4px; display:flex; align-items:center; gap:10px; z-index:5;">
				<span class="indicator red"></span>
				<strong>${__('Potential Duplicates Found')}: ${high_conf}</strong>
				<button class="btn btn-xs btn-danger" id="review-duplicates-btn-inline" style="margin-left:auto;">
					${__('Review Duplicates')}
				</button>
			</div>
		`;
		// Insert at the top of the form
		$(frm.wrapper).find('.form-print-wrapper, .form-dashboard, .form-section').first().before(warning_html);

		// Attach event for inline review button
		setTimeout(() => {
			const btn = document.getElementById('review-duplicates-btn-inline');
			if (btn) {
				btn.onclick = () => {
					if (cur_frm) {
						render_duplicate_panel(cur_frm, cur_frm.duplicate_data, { show: true });
					}
				};
			}
		}, 100);

		// Add an explicit message box (msgprint) to ensure it's visible to user
		frappe.msgprint({
			title: __('Potential Duplicate Patients Detected'),
			indicator: 'red',
			message: `
				<div style="padding:8px 0">
					<span class="indicator red" style="margin-right:8px"></span>
					<strong>${__('Potential duplicate patients detected!')}</strong>
					<br>
					<button class="btn btn-xs btn-primary" id="review-duplicates-btn">
						${__('Review Duplicates')}
					</button>
				</div>
			`
		});

		// Attach event handler for review button after msgprint is rendered
		setTimeout(() => {
			const btn = document.getElementById('review-duplicates-btn');
			if (btn) {
				btn.onclick = () => {
					if (cur_frm) {
						render_duplicate_panel(cur_frm, cur_frm.duplicate_data, { show: true });
					}
				};
			}
		}, 100);

		
	} else if (medium_conf > 0) {
		// Show moderate warning for medium confidence
		frappe.show_alert({
			message: __('Note: {0} possible duplicate(s) found. Click to review.', [medium_conf]),
			indicator: 'orange'
		}, 7);
		
		frm.dashboard.add_indicator(__('Possible Duplicates: {0}', [medium_conf]), 'orange');
	}
	
	// Store duplicate data on form for later access
	frm.duplicate_data = data;
	render_duplicate_panel(frm, data, { show: high_conf > 0 });
	render_duplicate_status(frm, { state: 'warning', count: high_conf + medium_conf + low_conf });
};

let render_duplicate_panel = function(frm, data = {}, options = {}) {
	const panel_id = 'duplicate-review-panel';
	const duplicates = data.duplicates || [];
	const show_panel = options.show !== undefined ? options.show : !!frm.flags.duplicate_panel_visible;

	let panel = $(frm.wrapper).find(`#${panel_id}`);
	if (!panel.length) {
		const panel_html = `
			<div id="${panel_id}" class="alert alert-danger duplicate-review-panel" style="margin-bottom: 12px; display: none;">
			</div>
		`;
		const banner_anchor = $(frm.wrapper).find('#potential-duplicate-warning-banner');
		if (banner_anchor.length) {
			$(panel_html).insertAfter(banner_anchor);
		} else {
			const fallback_anchor = $(frm.wrapper).find('.form-dashboard, .form-section, .form-horizontal').first();
			if (fallback_anchor.length) {
				$(panel_html).insertBefore(fallback_anchor);
			} else {
				$(frm.wrapper).find('.layout-main-section').prepend(panel_html);
			}
		}
		panel = $(frm.wrapper).find(`#${panel_id}`);
	}

	if (duplicates.length === 0) {
		panel.hide().empty();
		frm.flags.duplicate_panel_visible = false;
		return;
	}

	panel.removeClass('alert-info alert-warning alert-success').addClass('alert-danger');

	let html = `
		<div class="duplicate-patients-container">
			<div class="duplicate-patients-header" style="display:flex; align-items:center; gap:12px; margin-bottom: 8px;">
				<h5 style="margin:0; font-weight:600;">${__('Potential duplicate patients ({0})', [duplicates.length])}</h5>
				<span class="indicator red">${__('Review recommended')}</span>
				<div style="margin-left:auto; display:flex; gap:6px;">
					<button class="btn btn-xs btn-default duplicate-panel-collapse" type="button">
						${(show_panel || frm.flags.duplicate_panel_visible) ? __('Hide details') : __('Show details')}
					</button>
				</div>
			</div>
			<div class="duplicate-panel-content" style="${(show_panel || frm.flags.duplicate_panel_visible) ? '' : 'display:none;'}">
			<table class="table table-bordered" style="margin-top: 0; background: #fff;">
				<thead>
					<tr>
						<th>${__('Confidence')}</th>
						<th>${__('Patient Name')}</th>
						<th>${__('Patient ID')}</th>
						<th>${__('Mobile')}</th>
						<th>${__('DOB')}</th>
						<th>${__('Reason')}</th>
						<th>${__('Action')}</th>
					</tr>
				</thead>
				<tbody>
	`;
	
	duplicates.forEach(function(dup, index) {
		let confidence_color = 'red';
		let confidence_label = 'High';
		
		if (dup.score < 60) {
			confidence_color = 'yellow';
			confidence_label = 'Low';
		} else if (dup.score < 80) {
			confidence_color = 'orange';
			confidence_label = 'Medium';
		}
		
		const reason_list = Array.isArray(dup.reasons) ? dup.reasons : (dup.reasons ? [dup.reasons] : []);
		const reason_text = reason_list
			.filter(reason => !!reason)
			.map(reason => escape_html(reason))
			.join('<br>');
		const patient_name = escape_html(dup.patient_name || '');
		const patient_id = dup.name || '';
		const encoded_patient_id = encodeURIComponent(patient_id);
		const mobile = escape_html(dup.mobile || '-');
		const dob = escape_html(dup.dob || '-');
		
		html += `
			<tr>
				<td><span class="indicator ${confidence_color}">${confidence_label} (${dup.score})</span></td>
				<td><strong>${patient_name}</strong></td>
				<td><a href="/app/patient/${encoded_patient_id}" target="_blank">${escape_html(patient_id)}</a></td>
				<td>${mobile}</td>
				<td>${dob}</td>
				<td style="font-size: 11px;">${reason_text}</td>
				<td>
					<button class="btn btn-xs btn-primary duplicate-open-btn" data-patient="${encoded_patient_id}" type="button">
						${__('Open')}
					</button>
				</td>
			</tr>
		`;
	});
	
	html += `
				</tbody>
			</table>
			<div class="alert alert-warning" style="margin-top: 15px;">
				<strong>${__('Important:')}</strong> ${__('Please review the patients listed above before creating a new record to avoid duplicates.')}
			</div>
			</div>
		</div>
		<div class="duplicate-panel-footer" style="display:flex; justify-content:flex-end; margin-top:8px; gap:8px;">
			<button class="btn btn-xs btn-default duplicate-panel-dismiss" type="button">${__('Dismiss')}</button>
		</div>
	`;
	
	panel.html(html);

	const content = panel.find('.duplicate-panel-content');
	panel.show();
	if (show_panel) {
		content.show();
		frm.flags.duplicate_panel_visible = true;
	} else {
		content.hide();
		frm.flags.duplicate_panel_visible = false;
	}

	const collapse_btn = panel.find('.duplicate-panel-collapse');
	collapse_btn.text(frm.flags.duplicate_panel_visible ? __('Hide details') : __('Show details'));

	panel
		.off('click', '.duplicate-open-btn')
		.on('click', '.duplicate-open-btn', function() {
			const patient = $(this).data('patient');
			if (patient) {
				clear_duplicate_ui(frm);
				frappe.set_route('Form', 'Patient', decodeURIComponent(patient));
			}
		});

	panel
		.off('click', '.duplicate-panel-dismiss')
		.on('click', '.duplicate-panel-dismiss', function() {
			panel.slideUp(150);
			frm.flags.duplicate_panel_visible = false;
			frm.duplicate_data = null;
		});

	panel
		.off('click', '.duplicate-panel-collapse')
		.on('click', '.duplicate-panel-collapse', function() {
			const btn = $(this);
			if (content.is(':visible')) {
				content.slideUp(150);
				frm.flags.duplicate_panel_visible = false;
				btn.text(__('Show details'));
			} else {
				content.slideDown(150);
				frm.flags.duplicate_panel_visible = true;
				btn.text(__('Hide details'));
			}
		});

	if (!panel.is(':visible')) {
		panel.slideDown(150);
	}
};

let escape_html = function(value) {
	if (value === null || value === undefined) {
		return '';
	}
	return $('<div/>').text(value).html();
};

let show_duplicate_check_indicator = function(frm) {
	if (!frm) {
		return;
	}
	hide_duplicate_check_indicator(frm);
	frm.flags = frm.flags || {};
	render_duplicate_status(frm, { state: 'checking' });
};

let hide_duplicate_check_indicator = function(frm) {
	if (!frm) {
		return;
	}
	render_duplicate_status(frm, { state: 'idle' });
};

let render_duplicate_status = function(frm, opts = {}) {
	const status_id = 'duplicate-check-status';
	const state = opts.state || 'idle';

	let status = $(frm.wrapper).find(`#${status_id}`);
	if (!status.length) {
		const status_html = `
			<div id="${status_id}" class="alert duplicate-check-status" style="margin-bottom: 12px; display:none;">
			</div>
		`;
		const anchor = $(frm.wrapper).find('#potential-duplicate-warning-banner');
		if (anchor.length) {
			$(status_html).insertBefore(anchor);
		} else {
			const fallback_anchor = $(frm.wrapper).find('.form-dashboard, .form-section, .form-horizontal').first();
			if (fallback_anchor.length) {
				$(status_html).insertBefore(fallback_anchor);
			} else {
				$(frm.wrapper).find('.layout-main-section').prepend(status_html);
			}
		}
		status = $(frm.wrapper).find(`#${status_id}`);
	}

	const classes = ['alert-info', 'alert-warning', 'alert-success', 'alert-danger'];
	status.removeClass(classes.join(' '));

	if (state === 'idle') {
		status.hide().empty();
		return;
	}

	let content = '';
	let alert_class = 'alert-info';

	if (state === 'checking') {
		content = `<i class="fa fa-spinner fa-spin"></i> ${__('Checking for duplicates...')}`;
		alert_class = 'alert-info';
	} else if (state === 'warning') {
		const count = opts.count || 0;
		content = `<span class="indicator red"></span> ${__('Potential duplicates detected ({0})', [count])}`;
		alert_class = 'alert-warning';
	} else if (state === 'success') {
		content = `<span class="indicator green"></span> ${__('No duplicate patients found')}`;
		alert_class = 'alert-success';
	} else if (state === 'error') {
		content = `<span class="indicator red"></span> ${__('Unable to check duplicates. Please try again.')}`;
		alert_class = 'alert-danger';
	}

	status.addClass(alert_class).html(content).show();
};

let clear_duplicate_ui = function(frm) {
	if (!frm) {
		return;
	}

	const panel = $(frm.wrapper).find('#duplicate-review-panel');
	if (panel.length) {
		panel.hide().empty();
	}

	frm.flags = frm.flags || {};
	frm.flags.duplicate_panel_visible = false;
	frm.duplicate_data = null;

	render_duplicate_status(frm, { state: 'idle' });
};

let clear_inpatient_status = function(frm) {
	if (!frm.doc.name) {
		frappe.throw(__('Please save the patient first'));
	}
	
	frappe.confirm(
		__('Are you sure you want to clear the inpatient status and record for this patient?'),
		function() {
			// Yes
			frappe.call({
				method: 'healthcare.healthcare.doctype.patient.patient.clear_inpatient_status',
				args: {
					patient: frm.doc.name
				},
				callback: function(r) {
					if (!r.exc) {
						frm.reload_doc();
					}
				}
			});
		},
		function() {
			// No
		}
	);
};

// Add custom event handler for review button
frappe.ui.form.on('Patient', 'check_duplicates_btn', function(frm) {
	if (frm.duplicate_data) {
		render_duplicate_panel(frm, frm.duplicate_data, { show: true });
	} else {
		check_patient_duplicates_manual(frm, { show_panel: true });
	}
});
