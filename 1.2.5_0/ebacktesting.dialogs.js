import { L } from "./ebacktesting.core.js";

L.showInputPrompt = function (message, defaultValue, placeholder, parent) {
    return new Promise((resolve) => {
        const dialog = $("<div>")
            .addClass("ebacktesting-prompt-dialog")
            .appendTo(parent);

        const dialogContent = $("<div>")
            .addClass("ebacktesting-prompt-dialog-content")
            .appendTo(dialog);

        const messageElement = $("<h3>")
            .text(message)
            .appendTo(dialogContent);

        const input = $("<input>")
            .val(defaultValue)
            .attr("spellcheck", "false")
            .attr("placeholder", placeholder)
            .appendTo(dialogContent);

        const buttons = $("<div>")
            .appendTo(dialogContent);

        const okButton = $("<button>")
            .text("OK")
            .addClass("lightButton secondary xsmall typography-regular14px ")
            .on("click", () => {
                dialog.remove();
                resolve(input.val());
            })
            .appendTo(buttons);

        const cancelButton = $("<button>")
            .text("Cancel")
            .addClass("lightButton secondary xsmall typography-regular14px ")
            .on("click", () => {
                dialog.remove();
                resolve(null);
            })
            .appendTo(buttons);

        dialog.on("click mousedown mouseup focusin", (e) => {
            if ($(e.target).hasClass("ebacktesting-prompt-dialog")) {
                e.stopPropagation();
                e.preventDefault();
                e.stopImmediatePropagation();
                cancelButton.click();
            }
        });

        input.on("keydown", (e) => {
            if (e.key === "Enter") {
                okButton.click();
            } else if (e.key === "Escape") {
                cancelButton.click();
            }
        });

        setTimeout(() => {
            input.focus();
        }, 300);
    });
}

L.showDialog = async function (title) {
    const hideDefaultDialogCss = `div[role="dialog"][data-name="source-properties-editor"] { display: none; }`
    $("head").append(`<style>${hideDefaultDialogCss}</style>`);
    
    L.removeDummyShape();
    const chart = L.getCharts()[0];
    const dummyProperties = {
        shape: "emoji",
        disableSelection: true,
        disableSave: true,
        disableUndo: true,
        frozen: true,
        visible: false,
        showInObjectsTree: false,
        title: title,
        size: 0,
    };

    const dummyShapeId = await chart.createShape({ time: 0 }, dummyProperties);
    L.setGeneratedShape(dummyShapeId);

    const dummyShape = L.getShapeById(dummyShapeId, chart);
    dummyShape.setProperties(dummyProperties);
    L.monitorDialogs();
    chart.showPropertiesDialog(dummyShapeId);
};

L.showSessions = async function () {
    await L.showDialog("eBacktesting");
};

L.showSettings = async function () {
    await L.showDialog(L.session.name);
};

L.showGotoDateDialog = async function () {
    await L.showDialog("Go to Date/Time");
};

L.showAnalysisTimesDialog = async function () {
    await L.showDialog("Analysis Times");
};

L.monitorDialogs = function () {
    L.monitorDialogsStartTime = Date.now();
    L.monitorDialogsTimer = setInterval(() => {
        if (Date.now() - L.monitorDialogsStartTime > 10000) {
            clearInterval(L.monitorDialogsTimer);
            return;
        }

        const dialogs = [
            { name: "eBacktesting", handler: L.createSessionsUI },
            { name: L.session?.name, handler: L.createSettingsUI },
            { name: "Go to Date/Time", handler: L.createGotoDateUI },
            { name: "Analysis Times", handler: L.createAnalysisTimesUI },
        ];

        for (const dialog of dialogs) {
            const dialogContainer = $(`div[role="dialog"][data-name="source-properties-editor"][data-dialog-name="${dialog.name}"]:not([handled])`);
            if (dialogContainer.length && $("div[class*='popupDialog']").length == 0) {
                dialogContainer.attr("handled", 1);
                dialog.handler(dialogContainer);
                const showDefaultDialogCss = `div[role="dialog"][data-name="source-properties-editor"] { display: revert; }`
                $("head").append(`<style>${showDefaultDialogCss}</style>`);
            
                clearInterval(L.monitorDialogsTimer);
                return;
            }
        }
    }, 200);
}

L.setGeneratedShape = function (shapeId) {
    if (!L.generatedShapes) {
        L.generatedShapes = [];
    }
    L.generatedShapes.push(shapeId);
}

L.removeGeneratedShapes = function () {
    L.applyOnCharts(chart => {
        const shapes = chart.getAllShapes();
        for (const shapeInfo of shapes) {
            if (L.isGeneratedShape(shapeInfo.id)) {
                L.removeShapeById(shapeInfo.id, chart, true);
            }
        }
    });
}

L.isGeneratedShape = function (shapeId) {
    return (L.generatedShapes || []).includes(shapeId);
}

L.removeDummyShape = function () {
    const chart = L.getCharts()[0];
    const dummyShapes = chart.getAllShapes().filter(s => s.name == "emoji");
    for (const dummyShapeInfo of dummyShapes) {
        if (L.isGeneratedShape(dummyShapeInfo.id)) {
            L.removeShapeById(dummyShapeInfo.id, chart, true);
        }
    }
}

L.messageBox = function (title, content, callback) {
    TradingViewApi.showNoticeDialog({ title: title, body: content, callback: callback });
}

L.confirmBox = function (title, content, callback) {
    //callback is (answer: bool) => { if(answer) { ... } }
    TradingViewApi.showConfirmDialog({ title: title, body: content, callback: callback });
}

L.toast = function(message, timeout, type) {
    type = type || "info";

    L.applyOnCharts(c => c.chartWidget()._hideHint());
    const chartWidget = TradingViewApi.activeChart().chartWidget();
    
    if(type == "info") {
        chartWidget.showHint(0, message);
    } else if(type == "warn") {
        chartWidget.showHint(1, {text: message});
    }

    clearTimeout(L.toastTimeout);
    if(timeout) {
        L.toastTimeout = setTimeout(() => {
            L.applyOnCharts(c => c.chartWidget()._hideHint());
        }, timeout);
    }
}
