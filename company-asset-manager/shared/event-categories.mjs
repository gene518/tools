export const EVENT_CATEGORIES = [
  {
    key: "device",
    label: "设备信息",
    actions: ["create", "edit", "repair", "restore", "retire", "attachment"],
  },
  {
    key: "handover",
    label: "领用交接",
    actions: [
      "assign",
      "transfer",
      "return",
      "reserve",
      "confirm",
      "cancel",
      "ownership",
    ],
  },
  {
    key: "people",
    label: "人员变更",
    actions: ["employee_create", "employee_edit"],
  },
  {
    key: "account",
    label: "账号安全",
    actions: ["account_create", "account_edit", "password", "login", "logout"],
  },
];
