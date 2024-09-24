<script setup>
import { ref, watch } from "vue";
import Reservation from "./components/Reservation.vue";
import ReservationList from "./components/ReservationList.vue";



const reservedItem = ref(null);
const resources = ref([]);
const update = ref(1);
watch(reservedItem, (val) => {
  frappe.db.get_list("Healthcare Service Unit", {
    fields: ["*"],
    filters: [
      ["Healthcare Service Unit", "parent_healthcare_service_unit", "=", val],
    ],
    order_by: "name",
    limit: 0
  }).then(res => {
    resources.value = res.map((r, i) => ({ id: r.name, label: r.healthcare_service_unit_name, ...r, class: `split-${(i % 9)}` }));

  })
});


const makeReservation = (unit) => {
  let d = new frappe.ui.Dialog({
    title: 'Patient Appoinment',
    fields: [
      {
        label: 'Patient',
        fieldname: 'patient',
        fieldtype: 'Link',
        options: 'Patient',
        reqd: 1
      },
      {
        label: 'Healthcare Practitioner',
        fieldname: 'referring_practitioner',
        fieldtype: 'Link',
        options: 'Healthcare Practitioner',
      },
      {
        label: 'Service Unit',
        fieldname: 'service_unit',
        fieldtype: 'Link',
        options: 'Healthcare Service Unit',
        default: unit,
        reqd: 1
      },
      {
        label: 'Start Date',
        fieldname: 'start_date',
        fieldtype: 'Date',
        reqd: 1
      },
      {
        label: 'Start Time',
        fieldname: 'start_time',
        fieldtype: 'Time',
        reqd: 1
      },
      {
        label: 'Duration in Hours',
        fieldname: 'duration',
        fieldtype: 'Float',
        default: 1,
        reqd: 1
      }
    ],
    size: 'small', // small, large, extra-large 
    primary_action_label: 'Submit',
    primary_action(values) {

      const doc = {
        doctype: 'Patient Appointment',
        patient: values.patient,
        appointment_type: 'Service Unit',
        appointment_for: 'Service Unit',
        referring_practitioner: values.referring_practitioner,
        service_unit: values.service_unit,
        appointment_date: values.start_date,
        appointment_time: values.start_time,
        duration: values.duration * 60,
        doctstatus: 1
      };

      frappe.call({
        method: "frappe.client.save",
        args: {
          doc,
        },
        callback: function (r) {

          frappe.show_alert({
            message: __('Appointment Created'),
            indicator: 'green'
          }, 5);
          update.value += 1;
        },
        error: function () {
          frappe.msgprint('Error creating appointment');
        }
      });

      d.hide();
    },
  });

  d.show();
}


</script>
<template>
  <ReservationList v-model="reservedItem" />
  <h4 v-if="resources.length > 0" class="px-3">Click on the wards below to create appointments</h4>
  <div v-if="resources.length > 0" class="px-3 d-flex flex-wrap w-50">

    <button v-for="r in resources" class="btn btn-primary mr-2 mt-2" @click="makeReservation(r.name)">{{
      r.healthcare_service_unit_name }}</button>
  </div>
  <Reservation class="p-3" :resources="resources" :update="update" />
</template>
