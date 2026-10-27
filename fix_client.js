const fs = require('fs');
const p = 'D:/web_project/manpower/src/components/client-dashboard.js';
let s = fs.readFileSync(p, 'utf8');
if (!s.includes('ClientDeploymentsPanel')) {
  s = s.replace('import RequisitionsPanel from "@/app/admin/requisitions-panel";\n',
    'import RequisitionsPanel from "@/app/admin/requisitions-panel";\nimport ClientDeploymentsPanel from "@/components/client-deployments-panel";\n');
}
if (!s.includes('"deployments"')) {
  s = s.replace('  { label: "Requisitions", view: "requisitions", icon: ClipboardList, section: "WORKSPACE" },\n',
    '  { label: "Requisitions", view: "requisitions", icon: ClipboardList, section: "WORKSPACE" },\n  { label: "Deployments", view: "deployments", icon: ArrowRightLeft, section: "WORKSPACE" },\n');
}
if (!s.includes('activeView === "deployments"')) {
  s = s.replace('          ) : activeView === "requisitions" ? (\n            <RequisitionsPanel session={sessionState} readOnly={!canEditCompany} />\n          ) : activeView === "account-settings" ? (',
    '          ) : activeView === "requisitions" ? (\n            <RequisitionsPanel session={sessionState} readOnly={!canEditCompany} />\n          ) : activeView === "deployments" ? (\n            <ClientDeploymentsPanel session={sessionState} />\n          ) : activeView === "account-settings" ? (');
}
fs.writeFileSync(p, s, 'utf8');
console.log('done');
