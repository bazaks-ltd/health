frappe.pages["reservation"].on_page_load = function (wrapper) {
  frappe.ui.make_app_page({
    parent: wrapper,
    title: __("Reservation"),
    single_column: true,
  });
};

frappe.pages["reservation"].on_page_show = function (wrapper) {
  load_desk_page(wrapper);
};

function load_desk_page(wrapper) {
  let $parent = $(wrapper).find(".layout-main-section");
  $parent.empty();

  frappe.require("reservation.bundle.js").then(() => {
    frappe.reservation = new frappe.ui.Reservation({
      wrapper: $parent,
      page: wrapper.page,
    });
  });
}
