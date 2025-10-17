

const files = [
    "ebacktesting.loc.js",
    "ebacktesting.js",
    "ebacktesting.core.js",
    "ebacktesting.candles.js",
    "ebacktesting.candles.monitor.js",
    "ebacktesting.charts.js",
    "ebacktesting.css.js",
    "ebacktesting.data.js",
    "ebacktesting.datetime.js",
    "ebacktesting.dialogs.analysistimes.js",
    "ebacktesting.dialogs.gotodate.js",
    "ebacktesting.dialogs.js",
    "ebacktesting.dialogs.sessions.js",
    "ebacktesting.dialogs.settings.js",
    "ebacktesting.initui.js",
    "ebacktesting.journal.js",
    "ebacktesting.positions.js",
    "ebacktesting.sessionchannel.js",
    "ebacktesting.sessions.js",
    "ebacktesting.snapshots.js",
    "ebacktesting.stats.js"
];

for (let i = 0; i < files.length; i++) {
    script = document.createElement("script");
    script.src = chrome.runtime.getURL(`${files[i]}`);
    script.type = "module";
    console.log(script)

    document.documentElement.appendChild(script);
    
}