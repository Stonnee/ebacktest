import { L } from "./ebacktesting.core.js";


import "./ebacktesting.loc.js"
import "./ebacktesting.candles.js"
import "./ebacktesting.candles.monitor.js"
import "./ebacktesting.charts.js"
import "./ebacktesting.css.js"
import "./ebacktesting.data.js"
import "./ebacktesting.datetime.js"
import "./ebacktesting.dialogs.js"

import "./ebacktesting.dialogs.analysistimes.js"
import "./ebacktesting.dialogs.gotodate.js"
import "./ebacktesting.dialogs.sessions.js"
import "./ebacktesting.dialogs.settings.js"
import "./ebacktesting.initui.js"
import "./ebacktesting.journal.js"

import "./ebacktesting.positions.js"
import "./ebacktesting.sessionchannel.js"
import "./ebacktesting.sessions.js"
import "./ebacktesting.stats.js"
import "./ebacktesting.snapshots.js"
/*
--------------------------------------
Operations UI
--------------------------------------
*/

L.selectDate = async function (date, skipOffsetAlignment) {
    L.stopAutoPlay();
    
    if(!skipOffsetAlignment) {
        L.temporaryOffset();
    }

    var currentDate = L.r.currentDate().value();
    await L.r.selectDate(date);

    L.selectDateStartTime = Date.now();
    while (currentDate == L.r.currentDate().value()) {
        await L.delay(100);
        if((Date.now() - L.selectDateStartTime) > 10000) {
            break;
        }
    }

    if(!skipOffsetAlignment) {
        L.undoTemporaryOffset();
    }
}

L.selectDateWithWarmup = async function (timestamp) {
    if (L.session.getParameter(L.sessionParameterIds.EnableWarmupStart) == L.s(0, 6) /* true */) {
        L.isWarmingUp = true;

        const symbolInfo = window.TradingViewApi.activeChart().chartModel().mainSeries().symbolInfo();
        const sessionStart = L.convertTimeToUnixTimestamp(symbolInfo.session);
        const sessionStartUtc = L.getUtcDate(sessionStart, symbolInfo.timezone).getTime() / 1000;
        
        const warmupStartOffset = Number(L.session.getParameter(L.sessionParameterIds.WarmupStartOffset));
        const timeSinceSessionStart = timestamp - sessionStart;
        const completedIntervals = Math.floor(timeSinceSessionStart / warmupStartOffset);
        const lastWarmupTimeframeClose = sessionStart + completedIntervals * warmupStartOffset;
        
        await L.selectDate(new Date(lastWarmupTimeframeClose * 1000), true);
        do {
            await L.delay(1000);
        } while(!L.replayInitialized);
        await L.skipTime(timestamp - lastWarmupTimeframeClose + 1, true, 1000);
        
        setTimeout(() => {
            L.isWarmingUp = false;
        }, 2000);
    } else {
        await L.selectDate(new Date(timestamp * 1000));
    }
}

L.exit = function (force, showConfirmation) {
    L.removeGeneratedShapes();
    var chartSaved = false;

    if (!force) {
        const saveService = TradingViewApi.getSaveChartService();
        saveService.chartSaved().subscribe(null, () => {
            clearTimeout(L.exitTimeout);
            L.exitTimeout = setTimeout(() => {
                chartSaved = true;
                if (showConfirmation) {
                    location.reload();
                }
            }, 500);
        });
        if (showConfirmation) {
            L.confirmBox("Exit eBacktesting mode", "Do you want to exit eBacktesting mode and refresh chart?", (ok) => {
                showConfirmation = ok;
                if(ok) {
                    L.r.replayTimingMode().setValue("manual")
                    L.messageBox("Saving chart", "Please wait a moment...");
                    saveService.saveExistentChart();
                }
            });
        }
    } else {
        if (showConfirmation) {
            L.confirmBox("Exit eBacktesting mode", "Do you want to exit eBacktesting mode and refresh chart?", (ok) => {
                if (ok) {
                    L.r.replayTimingMode().setValue("manual")
                    location.reload();
                }
            });
        } else {
            L.r.replayTimingMode().setValue("manual")
            location.reload();
        }
    }
}

/*
--------------------------------------
Data processing
--------------------------------------
*/

L.isNumber = function (value) {
    return typeof value === "number" && !isNaN(value);
}

L.getContractSize = async function (symbolName, symbolType) {
    const cacheKey = `getContractSize-${symbolName}-${symbolType}`;
    const cacheEntry = L.cache.getIfExists(cacheKey);
    if(cacheEntry[0]) {
        return cacheEntry[1];
    } else {
        var symbolRuleContractSizes = await L.dataOps.getSymbolRuleContractSizes(symbolType);
        for (const rule of symbolRuleContractSizes) {
            if (rule.symbolNameRegex) {
                var regex = new RegExp(rule.symbolNameRegex);
                if (regex.test(symbolName)) {
                    L.cache.set(cacheKey, rule, 3600);
                    return rule;
                }
            } else {
                return rule;
            }
        }
    }
}

/*
--------------------------------------
Chart Operations
--------------------------------------
*/

L.getReplayResolutions = async function () {
    const cacheKey = 'replayResolutions';
    const cached = L.cache.getIfExists(cacheKey);
    
    if (cached[0]) {
        return cached[1];
    }

    var availableReplayResolutions = L.r.replayResolutions().value().filter(r => r);
    L.getReplayResolutionsStartTime = Date.now();
    while (!availableReplayResolutions.length) {
        await L.delay(100);
        availableReplayResolutions = L.r.replayResolutions().value().filter(r => r);
        if((Date.now() - L.getReplayResolutionsStartTime) > 10000) {
            break;
        }
    }

    L.cache.set(cacheKey, availableReplayResolutions, 1);
    return availableReplayResolutions;
}

L.selectResolution = async function (seconds, resolutionSelectionDelay) {
    const availableReplayResolutions = await L.getReplayResolutions();
    var replayResolution = L.session.getParameter(L.sessionParameterIds.MinReplayResolution);
    if(!replayResolution) {
        replayResolution = availableReplayResolutions.find(r => L.resolutionToSeconds(r) >= 60) || availableReplayResolutions[0];
    }

    for (const resolution of availableReplayResolutions) {
        if (L.resolutionToSeconds(resolution) == seconds) {
            replayResolution = resolution;
            break;
        }
    }

    L.r.changeReplayResolution(replayResolution);
    L.r.autoReplayResolution().setValue(replayResolution);
    if(resolutionSelectionDelay) {
        await L.delay(resolutionSelectionDelay);
    }
    return replayResolution;
}

L.reflectReplayResolutions = async function (resolutions) {
    if (!resolutions) {
        resolutions = await L.getReplayResolutions();
    }

    var minReplayResolution = L.session.getParameter(L.sessionParameterIds.MinReplayResolution);

    if(!minReplayResolution || !resolutions.includes(minReplayResolution)) {
        minReplayResolution = resolutions.find(r => L.resolutionToSeconds(r) >= 60) || resolutions[0];

        if (minReplayResolution) {
            L.session.setParameter(L.sessionParameterIds.MinReplayResolution, minReplayResolution);
        }
    }

    if (minReplayResolution) {
        const minResolutionSeconds = L.resolutionToSeconds(minReplayResolution);
        $(".backtesting-replay-controls").show();

        var allOptions = [
            { text: "5s", value: 5 },
            { text: "30s", value: 30 },
            { text: "1m", value: 60 },
            { text: "5m", value: 60 * 5 },
            { text: "15m", value: 60 * 15 },
            { text: "30m", value: 60 * 30 },
            { text: "1h", value: 60 * 60 },
            { text: "2h", value: 60 * 60 * 2 },
            { text: "4h", value: 60 * 240 },
            { text: "1D", value: 60 * 1440 },
            { text: "1W", value: 60 * 1440 * 7 }
        ];

        var options = allOptions.filter(option => option.value > minResolutionSeconds).slice(0, 6);
        $(".controls.backtesting-replay-controls .skip-intervals").empty();

        options.forEach(optionData => {
            $("<option>")
            .val(optionData.value)
            .text(optionData.text)
            .appendTo($(".controls.backtesting-replay-controls .skip-intervals"));
        });

        if (L.session?.meta?.selectedResolution) {
            $(".controls.backtesting-replay-controls .skip-intervals").val(L.session.meta.selectedResolution);
        }

        $(".forward-button").attr("title", `Step forward (${L.resolutionToFriendlyText(minReplayResolution)})\nShift + ⇨`);
    }
}

/*
--------------------------------------
General Operations
--------------------------------------
*/

L.isTyping = function () {
    const activeElement = document.activeElement;
    if (activeElement.tagName.toUpperCase() == 'INPUT' 
        || activeElement.tagName.toUpperCase() == 'TEXTAREA' 
        || activeElement.isContentEditable) {
        return true;
    }
}

L.delay = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

L.asyncInterval = async function (callback, delay, decay, ignoreSession) {
    const sessionId = L.session?.sessionId || 0;
    var adjustedDelay = delay;

    while (ignoreSession || L.session?.sessionId === sessionId) {
        await L.delay(adjustedDelay);
        try {
            const r = await callback();
            if(r === -1) {
                break;
            }
        } catch (e) {
            console.warn("Error while executing timer", e);
        }

        if(decay) {
            adjustedDelay *= decay;
            if(adjustedDelay > delay * 2) {
                adjustedDelay = delay * 2;
            }
            if(adjustedDelay < delay / 2) {
                adjustedDelay = delay / 2;
            }
        }
    }
}

L.tryExec = function (func, surpressError) {
    try {
        return func();
    } catch (e) {
        if (!surpressError) {
            console.warn(e);
        }
    }
}

L.changeSymbol = async function (chart, symbolName) {
    chart.changingSymbol = true;
    await chart.setSymbol(symbolName);
    L.changeSymbolStartTime = Date.now();
    while (chart.changingSymbol) {
        await L.delay(100);
        if((Date.now() - L.changeSymbolStartTime) > 10000) {
            break;
        }
    }
}

L.cs = function (obj, i, j, ...params) {
    const s = obj[i][j];
    if (!s || s.indexOf("{") < 0) {
        if(params.length === 0) {
            return s;
        } else {
            throw "232";
        }
    } else {
        return s.replace(/{(\d+)}/g, (match, index) => {
            return typeof params[index] !== 'undefined' ? params[index] : match;
        });
    }
}

L.s = function (i, j, ...params) {
    return L.cs(L, i, j, ...params);
}

L.r.s = function (i, j, ...params) {
    return L.cs(L.r, i, j, ...params);
}

/*
--------------------------------------
Manage positions logic
--------------------------------------
*/

L.monitorEntryShapes = function () {
    L.asyncInterval(async () => {
        if (L.entryShapeCharts) {
            for (const shapeChartInfo of L.entryShapeCharts) {
                const shape = L.getShapeById(shapeChartInfo.shapeInfo.id, shapeChartInfo.chart, true);
                if (shape) {
                    const shapeDataSourceProperties = shape.lineDataSource().properties();
                    const entryPrice = shapeDataSourceProperties.entryPrice.value();
                    if (entryPrice != shapeChartInfo.shapeInfo._entryPrice) {
                        shapeChartInfo.shapeInfo._entryPrice = entryPrice;
                        shapeChartInfo.shapeInfo.timeAdded = L.session.currentDate;
                    }
                }
            }
        }
    }, 100);
}

L.getPositionShapes = function (chart) {
    if(!chart) {
        chart = TradingViewApi.activeChart();
    }
    return chart.getAllShapes()
        .filter(s => s.name == 'long_position' || s.name == 'short_position')
        .map(s => L.getShapeById(s.id, chart, true));
}

L.generateEntryShapeCharts = function () {
    L.session.meta.entryShapeCharts = L.session.meta.entryShapeCharts || [];
    const cacheKey = `allShapes`;
    const cached = L.cache.getIfExists(cacheKey);
    
    if (!cached[0]) {
        L.applyOnCharts(chart => {
            const shapes = chart.getAllShapes();
            for (var i = shapes.length - 1; i >= 0; i--) {
                const shapeInfo = shapes[i];

                var isEntry = true;
                isEntry = isEntry && (shapeInfo.name === 'long_position' || shapeInfo.name === 'short_position');
                isEntry = isEntry && !L.session.meta.entryShapeCharts.some(s => s.shapeInfo.id == shapeInfo.id);
                isEntry = isEntry && !L.session.positions.some(position => position.getShape().shapeId === shapeInfo.id);
                isEntry = isEntry && chart.barsHistoryEntries.length;

                if (isEntry) {
                    shapeInfo.timeAdded = chart.barsHistoryEntries.slice(-1)[0].time;
                    L.session.meta.entryShapeCharts.push({ shapeInfo, chart });
                }
            }
        });

        for (var shapeChartIndex = L.session.meta.entryShapeCharts.length - 1; shapeChartIndex >= 0; shapeChartIndex--) {
            const shapeChartInfo = L.session.meta.entryShapeCharts[shapeChartIndex];
            const shape = L.getShapeById(shapeChartInfo.shapeInfo.id, shapeChartInfo.chart, true);
            if(!shape) {
                L.session.meta.entryShapeCharts.splice(shapeChartIndex, 1);
                continue;
            }
        }
        
        L.cache.set(cacheKey, true, 1); // Cache for 5 seconds
    }
}

L.detectEntries = async function () {
    if (!L.session.meta.canDetectEntries || L.replayTo) {
        return;
    }

    if(L.session.meta.isReviewMode) {
        return;
    }

    L.generateEntryShapeCharts();
    for (var shapeChartIndex = L.session.meta.entryShapeCharts.length - 1; shapeChartIndex >= 0; shapeChartIndex--) {
        const shapeChartInfo = L.session.meta.entryShapeCharts[shapeChartIndex];
        const shape = L.getShapeById(shapeChartInfo.shapeInfo.id, shapeChartInfo.chart, true);
        const shapePoints = shape?.getPoints();
        if (shape && shapePoints.length && shapePoints[1].time > L.session.currentDate) {
            const shapeDataSourceProperties = shape.lineDataSource().properties();

            if (!shape._lockedProperties) {
                shape._lockedProperties = true;
                var symbolInfo = shapeChartInfo.chart.chartModel().mainSeries().symbolInfo();
                const lotSize = (await L.getContractSize(symbolInfo.full_name, symbolInfo.type)).contractSize * shapeDataSourceProperties.entryPointCurrencyRate.value();
                var shapeProperties = shape.getProperties();
                L.setPositionShapeSettings(shapeDataSourceProperties, { id: shapeChartInfo.shapeInfo.id, ...shapeProperties, accountSize: L.session.meta.balance || L.session.capital, currency: L.session.currencyId, lotSize });
            }

            if (shapeChartInfo.chart.barsHistoryEntries.length > 1) {
                var entryPrice = 0;
                var entryTime = 0;

                for (var barIndex = 1; barIndex < shapeChartInfo.chart.priceHistoryEntries.length; barIndex++) {
                    var previousBar = shapeChartInfo.chart.priceHistoryEntries[barIndex - 1];
                    var bar = shapeChartInfo.chart.priceHistoryEntries[barIndex];
                    if (bar.time >= shapeChartInfo.shapeInfo.timeAdded) {
                        const shapeEntryPrice = shapeDataSourceProperties.entryPrice.value();

                        if (previousBar.price <= shapeEntryPrice && shapeEntryPrice <= bar.price) {
                            entryPrice = shapeEntryPrice;
                            entryTime = bar.time;
                            break;
                        }
                    }
                }

                for (var barIndex = 1; barIndex < shapeChartInfo.chart.barsHistoryEntries.length; barIndex++) {
                    var previousBar = shapeChartInfo.chart.barsHistoryEntries[barIndex - 1];
                    var bar = shapeChartInfo.chart.barsHistoryEntries[barIndex];
                    if (bar.time >= shapeChartInfo.shapeInfo.timeAdded) {
                        const shapeEntryPrice = shapeDataSourceProperties.entryPrice.value();

                        if (Math.min(previousBar.close, bar.open) <= shapeEntryPrice && shapeEntryPrice <= Math.max(previousBar.close, bar.open) && bar.time > shapeChartInfo.shapeInfo.timeAdded) {
                            entryPrice = bar.open;
                            entryTime = bar.time;

                            break;
                        }
                        else if (bar.low <= shapeEntryPrice && shapeEntryPrice <= bar.high) {
                            entryPrice = shapeEntryPrice;
                            entryTime = bar.time;

                            break;
                        }

                    }
                }

                if (entryPrice && entryTime) {
                    if(!(L.session.positions.length < 20 || L.permissions.includes("MoreThan20Trades") || L.permissions.includes("UnlimitedTrades"))) {
                        L.stopSkipping();
                        L.messageBox("Feature disabled", "Cannot open more than 20 trades: please subscribe to a free plan or start a free trial on eBacktesting.com");
                        break;
                    }

                    if(!(L.session.positions.length < 50 || L.permissions.includes("UnlimitedTrades"))) {
                        L.stopSkipping();
                        L.messageBox("Feature disabled", "Cannot open more than 50 trades: please subscribe to a free plan or start a free trial on eBacktesting.com");
                        break;
                    }

                    shapeDataSourceProperties.entryPrice.setValue(entryPrice);
                    shapeDataSourceProperties.entryPrice.subscribe(null, () => {
                        if (shapeDataSourceProperties.entryPrice.value() != entryPrice && (!L.session.meta.lastSyncTime || L.session.meta.lastSyncTime + 1000 < Date.now())) {
                            L.session.meta.lastSyncTime = Date.now();
                            shapeDataSourceProperties.entryPrice.setValue(entryPrice);
                        }
                    });

                    await L.openPosition({ entryPrice, entryTime }, shapeChartInfo, shape);
                    L.session.meta.entryShapeCharts.splice(shapeChartIndex, 1);
                    break;
                }
            } else {
                console.warn("No history bars on shape's chart");
            }
        }
    }
}

/*
--------------------------------------
Manage positions UI
--------------------------------------
*/

L.showBeLine = async function (position, chart) {
    if (chart && !position.exitTime) {
        if (!(position.meta.beLineId && L.getShapeById(position.meta.beLineId, chart))) {
            position.meta.beLineId = await chart.createShape(
                { price: position.bePrice() || (position.entryPrice + Math.sign(position.quantity) * Math.abs(position.targetPrice() - position.entryPrice) / 2), time: position.entryTime },
                {
                    shape: "horizontal_line",
                    disableSelection: true,
                    disableSave: true,
                    //disableUndo: true, //this leads to the shape being drawn only on 1 chart
                    showInObjectsTree: false,
                    lineWidth: 1,
                });
        }

        L.setGeneratedShape(position.meta.beLineId);
        const beLine = L.getShapeById(position.meta.beLineId, chart);

        beLine.lineDataSource().properties().linestyle.setValue(2);
        beLine.lineDataSource().properties().linecolor.setValue("#FFFF00CC");

        $(`tr#ID_${position.positionId}.V_POSITION .action-buttons .show-be-button`).hide();
        $(`tr#ID_${position.positionId}.V_POSITION .action-buttons .hide-be-button`).show();
    }
}

L.removeBeLine = function (position, chart) {
    if (chart) {
        if (position.meta.beLineId) {
            L.removeShapeById(position.meta.beLineId, chart);
        }

        delete position.meta.beLineId;
        position.bePrice(0);

        $(`tr#ID_${position.positionId}.V_POSITION .action-buttons .show-be-button`).show();
        $(`tr#ID_${position.positionId}.V_POSITION .action-buttons .hide-be-button`).hide();
    }
}

L.syncLinesWithPositions = function () {
    if (L.session.meta.lastSyncLinesWithPositions && (new Date() - L.session.meta.lastSyncLinesWithPositions) < 2000) {
        return;
    }
    L.session.meta.lastSyncLinesWithPositions = new Date();

    for (const position of L.session.getActivePositions()) {
        if (position.meta.stopLineId) {
            const stopLine = L.getShapeById(position.meta.stopLineId);
            if (stopLine) {
                L.setStopPrice(position, stopLine.lineDataSource().points()[0].price);
            }
        }

        if (position.meta.targetLineId) {
            const targetLine = L.getShapeById(position.meta.targetLineId);
            if (targetLine) {
                L.setTargetPrice(position, targetLine.lineDataSource().points()[0].price);
            }
        }

        if (position.meta.beLineId) {
            const beLine = L.getShapeById(position.meta.beLineId);
            if (beLine) {
                L.setBePrice(position, beLine.lineDataSource().points()[0].price);
            }
        }
    }
}

L.syncShapeWithPosition = function (shape, position) {
    const points = shape.getPoints();

    if (points[0].price !== position.entryPrice || points[1].price !== position.entryPrice || points[0].time !== position.entryTime || position.exitTime) {
        const shapeLength = points[1].time - points[0].time;
        shape.setPoints([{ price: position.entryPrice, time: position.entryTime }, { price: position.entryPrice, time: Math.max(position.exitTime || 0, position.entryTime + shapeLength) }]);
    }
}

L.createLinesForPosition = async function (position, chart) {
    if(!chart)
    {
        return;
    }
        
    var lineProperties = {
        shape: "horizontal_ray",
        disableSelection: true,
        disableSave: true,
        //disableUndo: true, //this leads to the shape being drawn only on 1 chart
        lock: true,
        showInObjectsTree: false,
        lineWidth: 1,
        showLabel: true,
        horzLabelsAlign: "right",
        text: position.quantity > 0 ? "⬆️" : "⬇️",
        vertLabelsAlign: position.quantity > 0 ? "top" : "bottom",
        linestyle: 1,
        linecolor: "#0000FFCC",
        textcolor: "#0000FFCC"
    };

    var lineShape = L.getShapeById(position.meta.entryLineId, chart, true);
    if (!lineShape) {
        position.meta.entryLineId = await chart.createShape(
            { price: position.entryPrice, time: position.entryTime },
            lineProperties);
        lineShape = L.getShapeById(position.meta.entryLineId, chart);
    }

    lineShape.setPoints([{ price: position.entryPrice, time: position.entryTime }]);
    lineShape.setProperties(lineProperties);
    L.setGeneratedShape(position.meta.entryLineId);

    const stopPrice = position.stopPrice();
    if (!position.meta.disableStopsTargets && stopPrice !== undefined) {
        lineProperties = {
            shape: "horizontal_line",
            disableSelection: true,
            disableSave: true,
            //disableUndo: true, //this leads to the shape being drawn only on 1 chart
            showInObjectsTree: false,
            lineWidth: 1,
            showLabel: true,
            horzLabelsAlign: "right",
            text: `${position.getProfitAtPrice(stopPrice)} ${L.session.currencyId} (${position.getProfitPercentage(position.getProfitAtPrice(stopPrice, true))}%)`,
            vertLabelsAlign: position.quantity > 0 ? "top" : "bottom",
            linestyle: 1,
            linecolor: "#FF0000CC",
            textcolor: "#FF0000CC"
        };

        lineShape = L.getShapeById(position.meta.stopLineId, chart, true);
        if (!lineShape) {
            position.meta.stopLineId = await chart.createShape(
                { price: stopPrice, time: position.entryTime },
                lineProperties);
            lineShape = L.getShapeById(position.meta.stopLineId, chart);
        }

        lineShape.setPoints([{ price: stopPrice, time: position.entryTime }]);
        lineShape.setProperties(lineProperties);
        L.setGeneratedShape(position.meta.stopLineId);
    } else if (position.meta.stopLineId) {
        L.removeShapeById(position.meta.stopLineId, chart, true);
        position.meta.stopLineId = null;
    }

    const targetPrice = position.targetPrice();
    if (!position.meta.disableStopsTargets && targetPrice !== undefined) {
        lineProperties = {
            shape: "horizontal_line",
            disableSelection: true,
            disableSave: true,
            //disableUndo: true, //this leads to the shape being drawn only on 1 chart
            showInObjectsTree: false,
            lineWidth: 1,
            showLabel: true,
            horzLabelsAlign: "right",
            text: `${position.getProfitAtPrice(targetPrice)} ${L.session.currencyId} (${position.getProfitPercentage(position.getProfitAtPrice(targetPrice, true))}%)`,
            vertLabelsAlign: position.quantity > 0 ? "bottom" : "top",
            linestyle: 1,
            linecolor: "#00FF00CC",
            textcolor: "#00FF00CC"
        };

        lineShape = L.getShapeById(position.meta.targetLineId, chart, true);
        if (!lineShape) {
            position.meta.targetLineId = await chart.createShape(
                { price: targetPrice, time: position.entryTime },
                lineProperties);
            lineShape = L.getShapeById(position.meta.targetLineId, chart);
        }

        lineShape.setPoints([{ price: targetPrice, time: position.entryTime }]);
        lineShape.setProperties(lineProperties);
        L.setGeneratedShape(position.meta.targetLineId);
    } else if (position.meta.targetLineId) {
        L.removeShapeById(position.meta.targetLineId, chart, true);
        position.meta.targetLineId = null;
    }

    lineProperties = {
        shape: "horizontal_line",
        disableSelection: true,
        disableSave: true,
        //disableUndo: true, //this leads to the shape being drawn only on 1 chart
        showInObjectsTree: false,
        lineWidth: 1,
        linestyle: 2,
        linecolor: "#FFFF00CC"
    };

    if(position.bePrice()) {
        lineShape = L.getShapeById(position.meta.beLineId, chart, true);
        if (!lineShape) {
            position.meta.beLineId = await chart.createShape(
                { price: position.bePrice(), time: position.entryTime },
                lineProperties);
            lineShape = L.getShapeById(position.meta.beLineId, chart);
        }

        lineShape.setPoints([{ price: position.bePrice(), time: position.entryTime }]);
        lineShape.setProperties(lineProperties);
        L.setGeneratedShape(position.meta.beLineId);
    }
}

L.drawShapeForPosition = function (position) {
    var shapeExists = null;
    return L.applyOnChartsAsync(async (chart) => {
        var shapeId = position.getShape().shapeId;
        var shape = L.getShapeById(shapeId, chart, true);
        if(shapeExists == null) {
            shapeExists = !!shape;
        }

        if (chart && L.isSameSymbol(chart, position)) {
            const firstBarTime = chart.chartModel().mainSeries().firstBar()[0];
            if(position.entryTime >= firstBarTime) {
                const points = [{ price: position.entryPrice, time: position.entryTime }, { price: position.entryPrice, time: position.getShape().endTime }];
                if (!shape) {
                    shapeId = await chart.createShape(
                        points,
                        {
                            shape: position.getShape().name,
                        }
                    );
                    L.setGeneratedShape(shapeId);
                    shape = L.getShapeById(shapeId, chart);
                }

                if (!position.exitTime) {
                    L.createLinesForPosition(position, chart);
                }

                await L.delay(200);
                if(!shapeExists) {
                    L.tryExec(() => shape.setPoints(points), true);

                    L.syncShapeWithPosition(shape, position);

                    const shapeDataSourceProperties = shape.lineDataSource().properties();

                    if (position.meta.disableStopsTargets) {
                        shapeDataSourceProperties.targetPrice.setValue(position.entryPrice);
                        shapeDataSourceProperties.stopPrice.setValue(position.entryPrice);
                    } else {
                        shapeDataSourceProperties.targetPrice.setValue(position.getShape().targetPrice);
                        shapeDataSourceProperties.stopPrice.setValue(position.getShape().stopPrice);
                    }

                    const shapeProperties = {
                        currency: L.session.currencyId,
                        accountSize: position.meta.initialBalance,
                        lotSize: position.symbol.meta.contractSize,
                        entryPrice: position.entryPrice,
                        risk: position.getRiskPercentage(true),
                        riskDisplayMode: "percents",
                    }

                    L.setPositionShapeSettings(shapeDataSourceProperties, {id: shapeId, ...shapeProperties});

                    shape.setProperties(position.getShape());

                    shapeDataSourceProperties.riskDisplayMode.setValue("percents");
                    shapeDataSourceProperties.risk.setValue(shapeProperties.risk);
                    position.getShape().shapeId = shapeId;
                    position.meta.hasShapeRedraw = true;
                }
            }
        }
        
        return shape;
    }, true, true);
}

L.removeShapeForPosition = function (position, ignoreErrors) {
    if (position.exitTime && position.positionId != position.getShape().shapeId) {
        L.removeShapeById(position.getShape().shapeId, null, ignoreErrors);
        position.meta.hasShapeRedraw = false;
    }
}

L.addCss();
L.createToolbarButton();
L.r.replayTimingMode().setValue("manual");
L.toast("eBacktesting is ready. Start from the top toolbar when needed.", 3000);

L.dataOps.getAddons().then(addons => {
    for(const addon of addons) {
        $('<script>',{type:'module',src:`//api.ebacktesting.com/js/addon.${addon}.js?v=1`,nonce:$('script')[0].nonce}).appendTo('head');
    }
});