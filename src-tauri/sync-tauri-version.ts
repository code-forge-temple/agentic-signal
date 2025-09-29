const pkg = JSON.parse(await Deno.readTextFile("package.json"));
const tauriConfPath = "src-tauri/tauri.conf.json";
const tauriConf = JSON.parse(await Deno.readTextFile(tauriConfPath));

tauriConf.version = pkg.version;

await Deno.writeTextFile(tauriConfPath, JSON.stringify(tauriConf, null, 2));
console.log(`Synced tauri.conf.json version to ${pkg.version}`);