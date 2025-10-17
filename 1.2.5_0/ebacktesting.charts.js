import { L } from "./ebacktesting.core.js";

L.onSymbolChanged = async function (chart, symbolInfo) {
    if(L.session) {
        L.session.meta.changingSymbol = true;
        L.cache.delete(`getCharts-true`);
        L.cache.delete(`getCharts-false`);
        
        L.temporaryOffset(chart);
        const barsSnapshot = chart.chartModel().mainSeries().bars()._items.map(b => b.value.join()).join();

        chart.barsHistoryEntries = [];
        chart.priceHistoryEntries = [];
        L.symbolChangedStartTime = Date.now();
        while (chart.chartModel().mainSeries().bars()._items.length == 0 || chart.chartModel().mainSeries().bars()._items.map(b => b.value.join()).join() == barsSnapshot) {
            await L.delay(100);
            if((Date.now() - L.symbolChangedStartTime) > 10000) {
                break;
            }
        }

        L.undoTemporaryOffset(chart, 1000);
            
        setTimeout(() => {
            L.session.meta.changingSymbol = false;
        }, 2000);
    }
}

L.onChartIntervalChanged = async function (chart, interval) {
    if(L.session) {
        L.session.meta.isIntervalChanging = true;
        L.cache.delete(`getCharts-true`);
        L.cache.delete(`getCharts-false`);
        
        if (L.session.getParameter(L.sessionParameterIds.PreventHTFCandlePreviews) == 'true') {
            const timeframeSeconds = chart.timeframeSeconds;
            const barsSnapshot = chart.chartModel().mainSeries().bars()._items.map(b => b.value.join()).join();
            L.temporaryOffset();
        
            L.replayTo = L.session.currentDate;
            L.stopSkipping();

            chart.barsHistoryEntries = [];
            chart.priceHistoryEntries = [];

            L.chartIntervalChangedStartTime = Date.now();
            while (timeframeSeconds == chart.timeframeSeconds || chart.chartModel().mainSeries().bars()._items.length == 0 || chart.chartModel().mainSeries().bars()._items.map(b => b.value.join()).join() == barsSnapshot) {
                await L.delay(100);
                L.getCharts();
                if((Date.now() - L.chartIntervalChangedStartTime) > 10000) {
                    break;
                }
            }

            const barInfo = L.getCurrentBarInfo(chart);
            if (barInfo.time + chart.timeframeSeconds - 1 != L.session.currentDate) {
                var selectedDate = barInfo.time - 1;
                if (selectedDate > L.session.currentDate) {
                    selectedDate = L.replayTo - chart.timeframeSeconds;
                }
                if (selectedDate < L.replayTo - chart.timeframeSeconds) {
                    selectedDate = L.replayTo - chart.timeframeSeconds;
                }

                await L.selectDate(new Date(selectedDate * 1000), true);
                L.undoTemporaryOffset();

                if (await L.skipTime(L.replayTo - L.replayApi.currentDate().value(), true, 500)) {
                    L.replayTo = null;
                }
            } else {
                L.undoTemporaryOffset(null, 1000);
            }
        } 
        
        setTimeout(() => {
            L.session.meta.isIntervalChanging = false;
        }, 2000);
    }
}

L.setHistory = function (chart, session) {
    session = session || L.session;
    const bars = chart.chartModel().mainSeries().bars()._items;

    session.meta.lastKnownBarTime = session.meta.lastKnownBarTime || chart.priceHistoryEntries[chart.priceHistoryEntries.length - 1]?.time || session.currentDate;
    const previousBarsSnapshot = chart.barsHistoryEntries.slice(-5);
    chart.barsHistoryEntries = bars.slice(-20).map(b => L.getBarInfo(b, chart.timeframeSeconds))
    if(chart.barsHistoryEntries.length) {
        var adjusted = false;
        for (let i = chart.barsHistoryEntries.length - 1; i > chart.barsHistoryEntries.length - 5; i--) {
            const bar = chart.barsHistoryEntries[i];
            for(let j = previousBarsSnapshot.length - 1; j > 0; j--) {
                const previousBar = previousBarsSnapshot[j];
                if (previousBar.time == bar.time) {
                    if (previousBar.high != bar.high || previousBar.low != bar.low || previousBar.close != bar.close) {
                        bar.time += Math.ceil((((chart.barsHistoryEntries[i + 1]?.time) || session.currentDate) - bar.time) / 2);
                        chart.barsHistoryEntries.splice(i, 0, previousBar);
                        adjusted = true;
                        break;
                    }
                }
            }

            if(adjusted) {
                break;
            }
        }
    }
    
    if (!chart.priceHistoryEntries || chart.priceHistoryEntries.length == 0) {
        chart.priceHistoryEntries = chart.barsHistoryEntries.map(e => ({ price: e.close, time: e.time }));
    }

    const latestPrice = bars[bars.length - 1]?.value?.[4];
    if(latestPrice) {
        const latestPriceHistoryEntry = chart.priceHistoryEntries[chart.priceHistoryEntries.length - 1];
        if (chart.priceHistoryEntries.length == 0 || latestPriceHistoryEntry.price != latestPrice) {
            chart.priceHistoryEntries.push({ price: latestPrice, time: L.replayApi.currentDate().value() });
            while(chart.priceHistoryEntries.length > 50) {
                chart.priceHistoryEntries.shift();
            }
        }
    }
}

L.getPositionChart = function (position, surpressError) {
    const chart = L.getShapeChart(position.getShape().shapeId) || L.getCharts().find(c => c.symbol() == position.symbol.symbolName || c.chartModel().mainSeries().symbolInfo().pro_name == position.symbol.symbolName);
    if (!chart && !surpressError) {
        throw new Error("Chart not found while trying to get position chart");
    }

    return chart;
}

L.getShapeChart = function (shapeId) {
    return L.getCharts().find(c => L.tryExec(() => {
        const shape = L.getShapeById(shapeId, c, true);
        if (shape) {
            return c.symbol() == shape.symbol() || c.chartModel().mainSeries().symbolInfo().pro_name == shape.symbol();
        }
    }));
}

L.getShapeById = function (shapeId, chart, surpressError) {
    if(!shapeId) {
        return null;
    }

    chart = chart || L.getShapeChart(shapeId);
    if (chart) {
        return L.tryExec(() => chart.getShapeById(shapeId), surpressError);
    }
}

L.removeShapeById = function (shapeId, chart, ignoreErrors) {
    chart = chart || L.getShapeChart(shapeId)
    if (chart) {
        chart.removeEntity(shapeId);
    } else {
        if (!ignoreErrors) {
            throw new Error("Chart not found while trying to remove shape");
        }
    }
}

L.onChartMouseMove = function (chart, event) {
    L.keepSessionActive();
}

L.keepSessionActive = function() {
    clearTimeout(L.session.meta.isActiveTimeout);
    L.session.meta.isActive = true;
    L.session.meta.isActiveTimeout = setTimeout(() => {
        L.session.meta.isActive = false;
    }, 30000);
}

L.getCharts = function (reverse) {
    const cacheKey = `getCharts-${reverse}`;
    const cacheEntry = L.cache.getIfExists(cacheKey);
    if(cacheEntry[0]) {
        return cacheEntry[1];
    } else {
        var chartInfoEntries = [];

        const chartCount = window.TradingViewApi.chartsCount();

        for (let i = 0; i < chartCount; i++) {
            const chart = window.TradingViewApi.chart(i);
            chart.timeframeSeconds = L.resolutionToSeconds(chart.resolution());
            if (!chart.__changeMonitored) {
                chart.onSymbolChanged().subscribe(null, (symbolInfo) => L.onSymbolChanged(chart, symbolInfo));
                chart.chartModel().mainSeries().onIntervalChanged().subscribe(null, (interval, t) => L.onChartIntervalChanged(chart, interval));
                chart.__changeMonitored = true;
            }

            if(!chart.__mouseMonitored && L.session?.getParameter(L.sessionParameterIds.AnalysisTimer) == 'true') {
                chart.chartModel().crosshairSource().moved().subscribe(null, (e) => L.onChartMouseMove(chart, e));
                chart.__mouseMonitored = true;
            }

            chartInfoEntries.push(chart);
        }

        chartInfoEntries.sort((c1, c2) => reverse ? (c2.timeframeSeconds - c1.timeframeSeconds) : (c1.timeframeSeconds - c2.timeframeSeconds));
        L.cache.set(cacheKey, chartInfoEntries, 5); // Cache for 5 sec
        return chartInfoEntries;
    }
}

L.applyOnCharts = function (action, reverse) {
    var actions = [];

    const charts = L.getCharts(reverse);
    for (const chart of charts) {
        actions.push(action(chart));
    }

    return actions;
}

L.applyOnChartsAsync = async function (action, reverse, ignoreErrors) {
    var actions = [];
    const charts = L.getCharts(reverse);
    for (const chart of charts) {
        try {
            actions.push(await action(chart));
        } catch (e) {
            if(ignoreErrors) {
                console.warn(e);
            } else {
                throw e;
            }
        }
    }

    return actions;
}

L.isSameSymbol = function(chart, position) {
    return chart.symbol() == position.symbol.symbolName || chart.chartModel().mainSeries().symbolInfo().pro_name == position.symbol.symbolName;
}

L.temporaryOffset = function (exclusiveChart) {
    L.applyOnCharts(chart => {
        if(chart == exclusiveChart || !exclusiveChart) {
            const chartTimeScale = chart.getTimeScale();
            const rightOffset = chartTimeScale.rightOffset();
            chartTimeScale.defaultRightOffset().setValue(rightOffset);
            chartTimeScale.setRightOffset(-10);
        }
    });
}

L.undoTemporaryOffset = function (exclusiveChart, timeout) {
    timeout =  timeout || 3000;

    L.applyOnCharts(chart => {
        if(chart == exclusiveChart || !exclusiveChart) {
            setTimeout(() => {
                const chartTimeScale = chart.getTimeScale();
                chartTimeScale.setRightOffset(chartTimeScale.defaultRightOffset().readonly().value());
            }, timeout);
        }
    });
}
