import fs from "node:fs";

const serverPath = new URL("../dist/server/index.js", import.meta.url);
const htmlPath = new URL("../dist/index.html", import.meta.url);
const snapshotPath = new URL("../src/data.json", import.meta.url);
const source = fs.readFileSync(serverPath, "utf8");
const match = source.match(/export default createDataAppWorker\(JSON\.parse\((.*)\)\);\s*$/s);
if (!match) throw new Error("Unable to locate the packaged Data app payload.");
const config = JSON.parse(JSON.parse(match[1]));
config.html = fs.readFileSync(htmlPath, "utf8");
config.seedSnapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const encoded = JSON.stringify(JSON.stringify(config));
const updated = source.slice(0, match.index) + `export default createDataAppWorker(JSON.parse(${encoded}));\n`;
fs.writeFileSync(serverPath, updated);
console.log(JSON.stringify({ htmlBytes: config.html.length, generatedAt: config.seedSnapshot.generatedAt }));
