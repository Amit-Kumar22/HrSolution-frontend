const fs = require('fs');
const p = 'src/app/admin/dashboard.js';
let c = fs.readFileSync(p, 'utf8');
if (c.includes('Deployments')) { console.log('exists'); process.exit(0); }
if (!c.includes('ArrowRightLeft')) {
  c = c.replace('Activity, Bell, BriefcaseBusiness', 'Activity, ArrowRightLeft, Bell, BriefcaseBusiness');
}
if (!/Deployments/.test(c)) {
  c = c.replace('  { label: "Requisitions", view: "requisitions", icon: ClipboardList, section: "main" },\n',
    '  { label: "Requisitions", view: "requisitions", icon: ClipboardList, section: "main" },\n  { label: "Deployments", view: "deployments", icon: ArrowRightLeft, section: "main" },\n');
}
if (!c.includes('DeploymentsPanel')) {
  c = c.replace('import WorkerPanel from "./worker-panel";\n',
    'import WorkerPanel from "./worker-panel";\nimport DeploymentsPanel from "./deployments-panel";\n');
}
if (c.includes('activeView === "workers"') && !c.includes('activeView === "deployments"')) {
  c = c.replace('            <WorkerPanel session={sessionState} />\n          ) : activeView === "interviews" ? (',
    '            <WorkerPanel session={sessionState} />\n          ) : activeView === "deployments" ? (\n            <DeploymentsPanel session={sessionState} />\n          ) : activeView === "interviews" ? (');
}
fs.writeFileSync(p, c, 'utf8');
console.log('done');
