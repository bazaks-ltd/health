// Healthcare
frappe.ui.form.on("Sales Invoice", {
  refresh(frm) {
    if (frm.doc.patient && frm.doc.docstatus === 0 && !frm.doc.inpatient_record) {
      frappe.db.get_value("Patient", frm.doc.patient, "inpatient_record").then((r) => {
        if (!r.message.inpatient_record) {
          frm.add_custom_button(__("Outpatient Bill"), function () {
            get_outpatient_delivery_notes(frm);
          }).css("background-color", "red").css("color", "white");
        }
      });
    }
    // if (frm.doc.docstatus === 0 && !frm.doc.is_return) {
    // 	frm.add_custom_button(__('Healthcare Services'), function() {
    // 		frappe.db.get_value("Patient", frm.doc.patient, "customer")
    // 		.then(r => {
    // 			let link_customer = null;
    // 			let msg = "Patient is not linked to a customer. Do you want to link the selected customer to the patient permanently?";
    // 			if (r.message.customer){
    // 				get_healthcare_services_to_invoice(frm, link_customer);
    // 			} else {
    // 				frappe.confirm(msg,
    // 					() => {
    // 						link_customer = true;
    // 						get_healthcare_services_to_invoice(frm, link_customer);
    // 					}, () => {
    // 						get_healthcare_services_to_invoice(frm, link_customer);
    // 				})
    // 			}
    // 		})
    // 	},__('Get Items From'));
    // 	frm.add_custom_button(__('Prescriptions'), function() {
    // 		frappe.db.get_value("Patient", frm.doc.patient, "customer")
    // 		.then(r => {
    // 			let link_customer = null;
    // 			if (r.message.customer){
    // 				get_drugs_to_invoice(frm, link_customer);
    // 			} else {
    // 				frappe.confirm(msg,
    // 					() => {
    // 						link_customer = true;
    // 						get_drugs_to_invoice(frm, link_customer);
    // 					}, () => {
    // 						get_drugs_to_invoice(frm, link_customer);
    // 				})
    // 			}
    // 		})
    // 	},__('Get Items From'));
    // }
  },

  patient(frm) {
    if (frm.doc.patient) {
      frappe.db.get_value("Patient", frm.doc.patient, "customer").then((r) => {
        if (!r.exc && r.message.customer) {
          frm.set_value("customer", r.message.customer);
        } else {
          frappe.show_alert({
            indicator: "warning",
            message: __("Patient <b>{0}</b> is not linked to a Customer", [
              `<a class='bold' href='/app/patient/${frm.doc.patient}'>${frm.doc.patient}</a>`,
            ]),
          });
          frm.set_value("customer", "");
        }
        frm.set_df_property("customer", "read_only", frm.doc.customer ? 1 : 0);
      });
    } else {
      frm.set_value("customer", "");
      frm.set_df_property("customer", "read_only", 0);
    }
  },

  service_unit: function (frm) {
    set_service_unit(frm);
  },

  items_add: function (frm) {
    set_service_unit(frm);
  },

  inpatient_record: function (frm) {
    if (frm.doc.inpatient_record) {
      frappe.db
        .get_value(
          "Inpatient Record",
          frm.doc.inpatient_record,
          "inp_insurance"
        )
        .then((r) => {
          if (!r.exc && r.message.inp_insurance) {
            frm.set_value("insurance", r.message.inp_insurance);
          } else {
            frm.set_value("insurance", "");
          }
        });
    } else {
      frm.set_value("insurance", "");
    }
  },
});

var set_service_unit = function (frm) {
  if (frm.doc.service_unit && frm.doc.items.length > 0) {
    frm.doc.items.forEach((item) => {
      if (!item.service_unit) {
        frappe.model.set_value(
          item.doctype,
          item.name,
          "service_unit",
          frm.doc.service_unit
        );
      }
    });
  }
};

var get_healthcare_services_to_invoice = function (frm, link_customer) {
  var me = this;
  let selected_patient = "";
  var dialog = new frappe.ui.Dialog({
    title: __("Get Items from Healthcare Services"),
    fields: [
      {
        fieldtype: "Link",
        options: "Patient",
        label: "Patient",
        fieldname: "patient",
        reqd: true,
      },
      { fieldtype: "Section Break" },
      { fieldtype: "HTML", fieldname: "results_area" },
    ],
  });
  var $wrapper;
  var $results;
  var $placeholder;
  dialog.set_values({
    patient: frm.doc.patient,
  });
  dialog.fields_dict["patient"].df.onchange = () => {
    var patient = dialog.fields_dict.patient.input.value;
    if (patient && patient != selected_patient) {
      selected_patient = patient;
      var method =
        "healthcare.healthcare.utils.get_healthcare_services_to_invoice";
      var args = {
        patient: patient,
        customer: frm.doc.customer,
        company: frm.doc.company,
        link_customer: link_customer,
      };
      var columns = ["service", "reference_name", "reference_type"];
      get_healthcare_items(
        frm,
        true,
        $results,
        $placeholder,
        method,
        args,
        columns
      );
    } else if (!patient) {
      selected_patient = "";
      $results.empty();
      $results.append($placeholder);
    }
  };
  $wrapper = dialog.fields_dict.results_area.$wrapper
    .append(`<div class="results"
		style="border: 1px solid #d1d8dd; border-radius: 3px; height: 300px; overflow: auto;"></div>`);
  $results = $wrapper.find(".results");
  $placeholder = $(`<div class="multiselect-empty-state">
				<span class="text-center" style="margin-top: -40px;">
					<i class="fa fa-2x fa-heartbeat text-extra-muted"></i>
					<p class="text-extra-muted">No billable Healthcare Services found</p>
				</span>
			</div>`);
  $results.on("click", ".list-item--head :checkbox", (e) => {
    $results
      .find(".list-item-container .list-row-check")
      .prop("checked", $(e.target).is(":checked"));
  });
  set_primary_action(frm, dialog, $results, true);
  dialog.show();
};

var get_healthcare_items = function (
  frm,
  invoice_healthcare_services,
  $results,
  $placeholder,
  method,
  args,
  columns
) {
  var me = this;
  $results.empty();
  frappe.call({
    method: method,
    args: args,
    callback: function (data) {
      if (data.message) {
        $results.append(make_list_row(columns, invoice_healthcare_services));
        for (let i = 0; i < data.message.length; i++) {
          $results.append(
            make_list_row(columns, invoice_healthcare_services, data.message[i])
          );
        }
      } else {
        $results.append($placeholder);
      }
    },
  });
};

var make_list_row = function (
  columns,
  invoice_healthcare_services,
  result = {}
) {
  var me = this;
  // Make a head row by default (if result not passed)
  let head = Object.keys(result).length === 0;
  let contents = ``;
  columns.forEach(function (column) {
    contents += `<div class="list-item__content ellipsis">
			${
        head
          ? `<span class="ellipsis">${__(frappe.model.unscrub(column))}</span>`
          : column !== "name"
          ? `<span class="ellipsis">${__(result[column])}</span>`
          : `<a class="list-id ellipsis">
						${__(result[column])}</a>`
      }
		</div>`;
  });

  let $row = $(`<div class="list-item">
		<div class="list-item__content" style="flex: 0 0 10px;">
			<input type="checkbox" class="list-row-check" ${
        result.checked ? "checked" : ""
      }>
		</div>
		${contents}
	</div>`);

  $row = list_row_data_items(head, $row, result, invoice_healthcare_services);
  return $row;
};

var set_primary_action = function (
  frm,
  dialog,
  $results,
  invoice_healthcare_services
) {
  var me = this;
  dialog.set_primary_action(__("Add"), function () {
    frm.clear_table("items");
    let checked_values = get_checked_values($results);
    if (checked_values.length > 0) {
      if (invoice_healthcare_services) {
        frm.set_value("patient", dialog.fields_dict.patient.input.value);
      }
      add_to_item_line(frm, checked_values, invoice_healthcare_services);
      dialog.hide();
    } else {
      if (invoice_healthcare_services) {
        frappe.msgprint(__("Please select Healthcare Service"));
      } else {
        frappe.msgprint(__("Please select Drug"));
      }
    }
  });
};

var get_checked_values = function ($results) {
  return $results
    .find(".list-item-container")
    .map(function () {
      let checked_values = {};
      if ($(this).find(".list-row-check:checkbox:checked").length > 0) {
        checked_values["dn"] = $(this).attr("data-dn");
        checked_values["dt"] = $(this).attr("data-dt");
        checked_values["item"] = $(this).attr("data-item");
        if ($(this).attr("data-rate") != "undefined") {
          checked_values["rate"] = $(this).attr("data-rate");
        } else {
          checked_values["rate"] = false;
        }
        if ($(this).attr("data-income-account") != "undefined") {
          checked_values["income_account"] = $(this).attr(
            "data-income-account"
          );
        } else {
          checked_values["income_account"] = false;
        }
        if ($(this).attr("data-qty") != "undefined") {
          checked_values["qty"] = $(this).attr("data-qty");
        } else {
          checked_values["qty"] = false;
        }
        if ($(this).attr("data-description") != "undefined") {
          checked_values["description"] = $(this).attr("data-description");
        } else {
          checked_values["description"] = false;
        }
        return checked_values;
      }
    })
    .get();
};

var get_drugs_to_invoice = function (frm, link_customer) {
  var me = this;
  let selected_encounter = "";
  var dialog = new frappe.ui.Dialog({
    title: __("Get Items from Medication Requests"),
    fields: [
      {
        fieldtype: "Link",
        options: "Patient",
        label: "Patient",
        fieldname: "patient",
        reqd: true,
      },
      {
        fieldtype: "Link",
        options: "Patient Encounter",
        label: "Patient Encounter",
        fieldname: "encounter",
        reqd: true,
        description:
          'Quantity will be calculated only for items which has "Nos" as UoM. You may change as required for each invoice item.',
        get_query: function (doc) {
          return {
            filters: {
              patient: dialog.get_value("patient"),
              company: frm.doc.company,
              docstatus: 1,
            },
          };
        },
      },
      { fieldtype: "Section Break" },
      { fieldtype: "HTML", fieldname: "results_area" },
    ],
  });
  var $wrapper;
  var $results;
  var $placeholder;
  dialog.set_values({
    patient: frm.doc.patient,
    encounter: "",
  });
  dialog.fields_dict["encounter"].df.onchange = () => {
    var encounter = dialog.fields_dict.encounter.input.value;
    if (encounter && encounter != selected_encounter) {
      selected_encounter = encounter;
      var method = "healthcare.healthcare.utils.get_drugs_to_invoice";
      var args = {
        encounter: encounter,
        customer: frm.doc.customer,
        link_customer: link_customer,
      };
      var columns = ["drug_code", "quantity", "description"];
      get_healthcare_items(
        frm,
        false,
        $results,
        $placeholder,
        method,
        args,
        columns
      );
    } else if (!encounter) {
      selected_encounter = "";
      $results.empty();
      $results.append($placeholder);
    }
  };
  $wrapper = dialog.fields_dict.results_area.$wrapper
    .append(`<div class="results"
		style="border: 1px solid #d1d8dd; border-radius: 3px; height: 300px; overflow: auto;"></div>`);
  $results = $wrapper.find(".results");
  $placeholder = $(`<div class="multiselect-empty-state">
				<span class="text-center" style="margin-top: -40px;">
					<i class="fa fa-2x fa-heartbeat text-extra-muted"></i>
					<p class="text-extra-muted">No Drug Prescription found</p>
				</span>
			</div>`);
  $results.on("click", ".list-item--head :checkbox", (e) => {
    $results
      .find(".list-item-container .list-row-check")
      .prop("checked", $(e.target).is(":checked"));
  });
  set_primary_action(frm, dialog, $results, false);
  dialog.show();
};

var list_row_data_items = function (
  head,
  $row,
  result,
  invoice_healthcare_services
) {
  if (invoice_healthcare_services) {
    head
      ? $row.addClass("list-item--head")
      : ($row = $(`<div class="list-item-container"
				data-dn= "${result.reference_name}" data-dt= "${result.reference_type}" data-item= "${result.service}"
				data-rate = ${result.rate}
				data-income-account = "${result.income_account}"
				data-qty = ${result.qty}
				data-description = "${result.description}">
				</div>`).append($row));
  } else {
    head
      ? $row.addClass("list-item--head")
      : ($row = $(`<div class="list-item-container"
				data-item= "${result.drug_code}"
				data-qty = ${result.quantity}
				data-dn= "${result.reference_name}"
				data-dt= "${result.reference_type}"
				data-rate = ${result.rate}
				data-description = "${result.description}">
				</div>`).append($row));
  }
  return $row;
};

var add_to_item_line = function (
  frm,
  checked_values,
  invoice_healthcare_services
) {
  if (invoice_healthcare_services) {
    frappe.call({
      doc: frm.doc,
      method: "set_healthcare_services",
      args: {
        checked_values: checked_values,
      },
      callback: function () {
        frm.trigger("validate");
        frm.refresh_fields();
      },
    });
  } else {
    for (let i = 0; i < checked_values.length; i++) {
      var si_item = frappe.model.add_child(
        frm.doc,
        "Sales Invoice Item",
        "items"
      );
      frappe.model.set_value(
        si_item.doctype,
        si_item.name,
        "item_code",
        checked_values[i]["item"]
      );
      frappe.model.set_value(si_item.doctype, si_item.name, "qty", 1);
      frappe.model.set_value(
        si_item.doctype,
        si_item.name,
        "reference_dn",
        checked_values[i]["dn"]
      );
      frappe.model.set_value(
        si_item.doctype,
        si_item.name,
        "reference_dt",
        checked_values[i]["dt"]
      );
      if (checked_values[i]["qty"] > 1) {
        frappe.model.set_value(
          si_item.doctype,
          si_item.name,
          "qty",
          parseFloat(checked_values[i]["qty"])
        );
      }
    }
    frm.refresh_fields();
  }
};

var get_outpatient_delivery_notes = function (frm) {
  if (!frm.doc.customer) {
    frappe.msgprint(__("Please select a customer first"));
    return;
  }

  // Fetch outpatient delivery notes using custom query
  frappe.call({
    method: "erpnext.controllers.queries.get_outpatient_bills_to_be_billed",
    args: {
      doctype: "Delivery Note",
      txt: "",
      searchfield: "name",
      start: 0,
      page_len: 100,
      filters: {
        docstatus: 1,
        company: frm.doc.company,
        status: "To Bill",
        customer: frm.doc.customer,
      },
      as_dict: true,
    },
    callback: function (r) {
      if (r.message && r.message.length > 0) {
        show_outpatient_delivery_notes_dialog(frm, r.message);
      } else {
        frappe.msgprint(__("No outpatient delivery notes found for billing"));
      }
    },
  });
};

var show_outpatient_delivery_notes_dialog = function (frm, delivery_notes) {
  // Get already added delivery notes for display
  let existing_dns = [];
  frm.doc.items.forEach(item => {
    if (item.delivery_note && !existing_dns.includes(item.delivery_note)) {
      existing_dns.push(item.delivery_note);
    }
  });

  var dialog = new frappe.ui.Dialog({
    title: __("Outpatient Delivery Notes"),
    fields: [
      { fieldtype: "HTML", fieldname: "delivery_notes_area" },
    ],
    primary_action_label: __("Add Selected"),
    primary_action: function () {
      let checked_items = [];
      dialog.$wrapper.find('input[type="checkbox"]:checked').each(function () {
        let dn_name = $(this).data("dn-name");
        if (dn_name) {
          checked_items.push(dn_name);
        }
      });
      
      if (checked_items.length > 0) {
        // Get already added delivery notes
        let existing_dns = [];
        frm.doc.items.forEach(item => {
          if (item.delivery_note && !existing_dns.includes(item.delivery_note)) {
            existing_dns.push(item.delivery_note);
          }
        });
        
        // Filter out already added delivery notes
        let new_dns = checked_items.filter(dn => !existing_dns.includes(dn));
        
        if (new_dns.length > 0) {
          add_delivery_notes_to_invoice(frm, new_dns);
          frappe.msgprint(__("{0} new delivery note(s) added to invoice", [new_dns.length]));
        } else {
          frappe.msgprint(__("Selected delivery notes are already in the invoice"));
        }
        
        dialog.hide();
      } else {
        frappe.msgprint(__("Please select at least one delivery note"));
      }
    },
  });

  let html = `<div class="delivery-notes-list">
    <div class="list-item" style="padding: 10px; font-weight: bold;">
      <label style="display: flex; align-items: center;">
        <input type="checkbox" id="select-all-dns" style="margin-right: 10px;">
        <div>Select All</div>
      </label>
    </div>`;
    
  delivery_notes.forEach(function (dn) {
    let dn_name = dn.name;
    let dn_customer = dn.customer || 'N/A';
    let dn_date = dn.posting_date || '';
    
    // Fetch additional data for each delivery note
    frappe.db.get_value("Delivery Note", dn_name, ["grand_total"]).then((r) => {
      let dn_total = r.message.grand_total || 0;
    
      let is_already_added = existing_dns.includes(dn_name);
      let checkbox_style = is_already_added ? 'disabled style="margin-right: 10px;"' : 'style="margin-right: 10px;"';
      let row_style = is_already_added ? 'padding: 10px; border-bottom: 1px solid #ddd; background-color: #f8f9fa; opacity: 0.6;' : 'padding: 10px; border-bottom: 1px solid #ddd;';
      let status_text = is_already_added ? ' <span style="color: green; font-weight: bold;">(Already Added)</span>' : '';
    
      let row_html = `
        <div class="list-item" style="${row_style}">
          <label style="display: flex; align-items: center;">
            <input type="checkbox" data-dn-name="${dn_name}" ${checkbox_style} ${is_already_added ? 'checked' : ''}>
            <div>
              <strong>${dn_name}</strong> - ${dn_date}${status_text}<br>
              <small>Customer: ${dn_customer} | Total: ${format_currency(dn_total)}</small>
            </div>
          </label>
        </div>
      `;
      
      // Append the row to the dialog
      dialog.fields_dict.delivery_notes_area.$wrapper.find('.delivery-notes-list').append(row_html);
    });
  });
  
  html += `</div>`;
  dialog.fields_dict.delivery_notes_area.$wrapper.html(html);
  
  // Add event handler for select-all checkbox
  dialog.$wrapper.find('#select-all-dns').on('change', function() {
    let isChecked = $(this).is(':checked');
    dialog.$wrapper.find('input[data-dn-name]:not(:disabled)').prop('checked', isChecked);
  });
  
  dialog.show();
};



var add_delivery_notes_to_invoice = function (frm, delivery_note_names) {
  delivery_note_names.forEach(function (dn_name) {
    frappe.model.with_doc("Delivery Note", dn_name, function () {
      let delivery_note = frappe.model.get_doc("Delivery Note", dn_name);
      
      frappe.call({
        method: "erpnext.stock.doctype.delivery_note.delivery_note.make_sales_invoice",
        args: {
          source_name: dn_name
        },
        callback: function (r) {
          if (r.message && r.message.items) {
            r.message.items.forEach(function (item) {
              let existing_item = frm.doc.items.find(si_item => 
                si_item.delivery_note === dn_name && si_item.dn_detail === item.dn_detail
              );
              
              if (!existing_item) {
                var si_item = frappe.model.add_child(frm.doc, "Sales Invoice Item", "items");
                frappe.model.set_value(si_item.doctype, si_item.name, "item_code", item.item_code);
                frappe.model.set_value(si_item.doctype, si_item.name, "item_name", item.item_name);
                frappe.model.set_value(si_item.doctype, si_item.name, "description", item.description);
                frappe.model.set_value(si_item.doctype, si_item.name, "qty", item.qty);
                frappe.model.set_value(si_item.doctype, si_item.name, "rate", item.rate);
                frappe.model.set_value(si_item.doctype, si_item.name, "delivery_note", dn_name);
                frappe.model.set_value(si_item.doctype, si_item.name, "dn_detail", item.dn_detail);
                if (item.income_account) {
                  frappe.model.set_value(si_item.doctype, si_item.name, "income_account", item.income_account);
                }
                if (item.cost_center) {
                  frappe.model.set_value(si_item.doctype, si_item.name, "cost_center", item.cost_center);
                }
              }
            });
            frm.refresh_fields();
          }
        },
      });
    });
  });
};
