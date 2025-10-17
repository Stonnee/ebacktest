import { L } from "./ebacktesting.core.js";

L.openPosition = async function (position, shapeChartInfo, shape) {
    L.stopSkipping();
    L.setPositionFunctions(position);

    position.meta.profit = 0;
    position.meta.trackRunUp = true;
    position.meta.trackDrawDown = true;
    position.meta.trackBeRunUp = false;

    position.index = L.session.positions.length + 1;
    position.positionId = shapeChartInfo.shapeInfo.id;

    L.syncShapeWithPosition(shape, position);
    const shapeDataSourceProperties = shape.lineDataSource().properties();
    const shapePoints = shape.getPoints();
    position.positionShapes = [{
        shapeId: shapeChartInfo.shapeInfo.id,
        name: shapeChartInfo.shapeInfo.name,
        stopPrice: shapeDataSourceProperties.stopPrice.value(),
        targetPrice: shapeDataSourceProperties.targetPrice.value(),
        endTime: shapePoints[1].time,
    }];

    L.keepShapeInfoInSync(position, shape, shapeDataSourceProperties);

    position.entryCurrencyRate = shapeDataSourceProperties.entryPointCurrencyRate.value();
    position.meta.initialBalance = shapeDataSourceProperties.accountSize.value();
    position.symbol = await L.dataOps.getOrAddSymbol(shapeChartInfo.chart.symbol(), () => shapeChartInfo.chart.chartModel().mainSeries().symbolInfo());
    position.positionSnapshots = [];

    Object.defineProperty(position.symbol, 'meta', { value: {}, writable: true, enumerable: false });
    position.symbol.meta.contractSize = shapeDataSourceProperties.lotSize.value();
    position.symbol.meta.pointSize = (await L.getContractSize(position.symbol.symbolName, position.symbol.symbolType)).pointSize;

    position.columnValue("Symbol", position.symbol.symbolName.split(":").slice(-1)[0], true);
    position.columnValue("Run-up", 0, true);
    position.columnValue("Drawdown", 0, true);
    position.columnValue("Analysis Time", L.session.meta.analysisTimes.find(at => at.analysisDuration > 5)?.analysisTimespan || "00:00", true);

    position.quantity = shapeDataSourceProperties.qty.value() / position.symbol.meta.contractSize * (shapeChartInfo.shapeInfo.name == 'long_position' ? 1 : -1);
    if (position.quantity) {

        position.stopPrice(position.meta.currentStopPrice = position.getShape().stopPrice, true);
        position.targetPrice(position.meta.currentTargetPrice = position.getShape().targetPrice, true);
        position.risk((position.entryPrice - position.stopPrice()) * position.quantity * position.symbol.meta.contractSize * position.entryCurrencyRate * position.symbol.meta.pointSize, true);

        try {
            const sl = position.stopPrice(undefined, true, 0);
            const tp = position.targetPrice(undefined, true, 0);
            const entry = position.entryPrice;
            if (entry != null && sl != null && tp != null && entry !== sl) {
                const rr = Math.abs(tp - entry) / Math.abs(entry - sl);
                if (Number.isFinite(rr)) {
                    position.columnValue("RR", Number(rr.toFixed(2)), true);
                }
            }
        } catch(_e) { /* ignore RR init errors */ }

        if(L.session.getParameter(L.sessionParameterIds.RiskWarning) == L.s(0, 6) /* true */) {
            setTimeout(() => {
                var shapeRisk = shapeDataSourceProperties.risk.value();
                if(shapeDataSourceProperties.riskDisplayMode.value() == 'money') {
                    shapeRisk = `${shapeRisk} ${shapeDataSourceProperties.currency.value()}`;
                } else {
                    shapeRisk = `${shapeRisk}%`;
                }

                L.messageBox(L.s(1, -3) /* Your first eBacktesting trade */, L.s(1, -4, shapeRisk, position.getQuantity()) /* Your new position has the risk quantity of {0} ({1} lots).\n\nThis can be adjusted from the Risk setting of the position\'s drawing. */);
                L.session.setParameter(L.sessionParameterIds.RiskWarning, 'false');
            }, 2000);
        } else  if (!L.isEbacktestingPanelOpen()) {
            if(L.session.getParameter(L.sessionParameterIds.AutoOpenPanel) == L.s(0, 6) /* true */) {
                setTimeout(() => {
                    $(L.s(1, -5) /* button[data-name=replay_trading] */).click();
                    L.session.setParameter(L.sessionParameterIds.AutoOpenPanel, 'false');    
                }, 2000);
            } else {
                L.toast(L.s(1, -6, position.getOrderType()) /* {0} activated. You can open the eBacktesting panel to view and manage the position. */, 5000);
            }
        }

        await L.createLinesForPosition(position, shapeChartInfo.chart);

        L.session.positions.unshift(position);
        L.addToPositionList(position, true);
        L.updateSessionCapitalInfo();

        await L.dataOps.createPosition(position);
        
        if (L.session.getParameter(L.sessionParameterIds.AutoSnapshot) == L.s(0, 6) /* true */) {
            L.takeSnapshot(position);
        }
    } else {
        L.toast(L.s(1, -7) /* Unable to open position: lot size cannot be set at this time */, 0, "warn");
        L.removeShapeById(position.getShape().shapeId, shapeChartInfo.chart);
    }
}

L.closePosition = async function (position, exitReason, chart) {
    L.stopSkipping();
    if (chart) {
        position.exitReason = exitReason;
        position.exitTime = position.exitTime || L.session.currentDate;

        const shape = L.getShapeById(position.getShape().shapeId, chart, true);
        if (shape) {
            L.syncShapeWithPosition(shape, position);
        }

        position.meta.profit = position.getProfitAtPrice(position.exitPrice, true);
        L.updatePositionUI(position);

        L.session.meta.equity -= position.getProfit(true);
        L.session.meta.balance += position.getProfit(true);

        if (position.meta.entryLineId) {
            L.removeShapeById(position.meta.entryLineId, chart);
        }
        if (position.meta.stopLineId) {
            L.removeShapeById(position.meta.stopLineId, chart);
        }
        if (position.meta.targetLineId) {
            L.removeShapeById(position.meta.targetLineId, chart);
        }
        if (position.meta.beLineId) {
            L.removeShapeById(position.meta.beLineId, chart);
        }

        L.updateSessionCapitalInfo();
        await L.dataOps.closePosition(position);
    }

    if (L.session.getParameter(L.sessionParameterIds.AutoSnapshot) == L.s(0, 6) /* true */) {
        L.takeSnapshot(position);
    }
}

L.setPositionFunctions = function (position) {
    Object.defineProperty(position, 'meta', { value: {}, writable: true, enumerable: false });

    position.getShape = function () {
        return position.positionShapes[0];
    };

    position.getColumn = function (columnName, sessionColumn) {
        if (!sessionColumn) {
            sessionColumn = L.session.sessionColumns.find(c => c.columnName == columnName);
        }
        if (!position.positionColumns) {
            position.positionColumns = [];
        }
        return position.positionColumns.find(c => c.columnId == sessionColumn?.columnId);
    }

    position.columnValue = function (columnName, value, dontStore) {
        const sessionColumn = L.session.sessionColumns.find(c => c.columnName == columnName);
        if(sessionColumn) {
            var positionColumn = position.getColumn(columnName, sessionColumn);

            if (value !== undefined) {
                if (!positionColumn) {
                    positionColumn = {
                        columnId: sessionColumn.columnId,
                        columnName: sessionColumn.columnName,
                        value: value
                    };
                    position.positionColumns.push(positionColumn);
                }
                
                positionColumn.value = value;
                if (!dontStore) {
                    L.dataOps.setPositionColumn(position.positionId, positionColumn);
                }
            }

            return positionColumn?.value;
        }
    }

    position.stopPrice = function (value, dontStore, index) {
        if (!position.positionSLs) {
            position.positionSLs = [];
        }

        if (value !== undefined) {
            if (position.positionSLs.slice(-1)[0]?.sl != value) {
                const chart = L.getPositionChart(position, true);
                const barTime = chart ? Math.max(chart.barsHistoryEntries.slice(-1)[0]?.time || L.session.currentDate, chart.priceHistoryEntries.slice(-1)[0]?.time || L.session.currentDate) : L.session.currentDate;
                const positionSL = { sl: value, barTime: barTime };
                position.positionSLs.push(positionSL);

                if (!dontStore) {
                    L.dataOps.addPositionSL(position.positionId, positionSL);
                }
            }
        }

        if (position.positionSLs.length) {
            return position.positionSLs[index === undefined ? position.positionSLs.length - 1 : index].sl;
        } else {
            return undefined;
        }
    };

    position.targetPrice = function (value, dontStore, index) {
        if (!position.positionTPs) {
            position.positionTPs = [];
        }

        if (value !== undefined) {
            if (position.positionTPs.slice(-1)[0]?.tp != value) {
                const chart = L.getPositionChart(position, true);
                const barTime = chart ? Math.max(chart.barsHistoryEntries.slice(-1)[0]?.time || L.session.currentDate, chart.priceHistoryEntries.slice(-1)[0]?.time || L.session.currentDate) : L.session.currentDate;
               
                const positionTP = { tp: value, barTime: barTime };
                position.positionTPs.push(positionTP);
                if (!dontStore) {
                    L.dataOps.addPositionTP(position.positionId, positionTP);
                }
            }
        }

        if (position.positionTPs.length) {
            return position.positionTPs[index === undefined ? position.positionTPs.length - 1 : index].tp;
        } else {
            return undefined;
        }
    };

    position.bePrice = function (value, dontStore, index) {
        if (!position.positionBEs) {
            position.positionBEs = [];
        }

        if (value !== undefined) {
            if (position.positionBEs.slice(-1)[0]?.be != value) {
                const chart = L.getPositionChart(position, true);
                const barTime = chart ? Math.max(chart.barsHistoryEntries.slice(-1)[0]?.time || L.session.currentDate, chart.priceHistoryEntries.slice(-1)[0]?.time || L.session.currentDate) : L.session.currentDate;
               
                const positionBE = { be: value, barTime: barTime };
                position.positionBEs.push(positionBE);
                if (!dontStore) {
                    L.dataOps.addPositionBE(position.positionId, positionBE);
                }
            }
        }

        if (position.positionBEs.length) {
            return position.positionBEs[index === undefined ? position.positionBEs.length - 1 : index].be;
        } else {
            return undefined;
        }
    };

    position.risk = function (value, dontStore) {       
        if (!position.positionRisks) {
            position.positionRisks = [];
        }

        if (value != undefined) {
            value = Math.abs(value);

            if (position.positionRisks.slice(-1)[0]?.risk != value) {
                const positionRisk = { risk: value, barTime: L.session.currentDate };
                position.positionRisks.push(positionRisk);
                if (!dontStore) {
                    L.dataOps.addPositionRisk(position.positionId, positionRisk);
                }
            }
        }

        if (position.positionRisks.length) {
            return position.positionRisks[position.positionRisks.length - 1].risk;
        } else {
            return undefined;
        }
    };

    position.getIndex = function () {
        return position.index;
    };

    position.getDirection = function () {
        return position.quantity > 0 ? "long" : "short";
    };

    position.getStatus = function () {
        return position.exitTime ? `${L.s(1, -8) /* Exit */} ${position.getDirection()}` : L.s(1, -9) /* Open */;
    };

    position.getRisk = function (noRounding) {
        return Number(position.risk().toFixed(noRounding ? 100 : 2));
    };

    position.getRiskPercentage = function (noRounding) {
        return Number((position.risk() / position.meta.initialBalance * 100).toFixed(noRounding ? 100 : 2));
    };

    position.getOrderType = function () {
        return position.quantity > 0 ? L.s(2, -1) /* Buy */ : L.s(2, -2) /* Sell */;
    };

    position.getEntryDate = function (chart) {
        return L.toTradingViewDateTimeFormat(position.entryTime, chart.getTimezone());
    };

    position.getExitDate = function (chart) {
        return L.toTradingViewDateTimeFormat(position.exitTime || L.session.currentDate, chart.getTimezone());
    };

    position.getExitPrice = function (noRounding) {
        if (position.exitPrice) {
            return Number(position.exitPrice.toFixed(noRounding ? 100 : position.symbol.pricePrecision));
        }
    };

    position.getEntryPrice = function (noRounding) {
        return Number(position.entryPrice.toFixed(noRounding ? 100 : position.symbol.pricePrecision));
    };

    position.getLatestPrice = function (noRounding) {
        if(!position.exitTime && !position.meta.currentPrice) {
            const chart = L.getPositionChart(position, true);
            if(chart) {
                if(!chart.priceHistoryEntries || !chart.priceHistoryEntries.length) {
                    L.setHistory(chart);
                }

                const bar = chart.barsHistoryEntries.slice(-1)[0];
                position.meta.currentPrice = bar.close;
            } else {
                position.meta.currentPrice = L.session.sessionSymbolLastPrices.find(p => p.symbolId == position.symbol.symbolId).lastPrice;
            }
        }

        return Number((position.exitTime ? position.exitPrice : position.meta.currentPrice).toFixed(noRounding ? 100 : position.symbol.pricePrecision));
    };

    position.getSymbolCurrency = function () {
        return position.symbol.currencyId;
    };

    position.getQuantity = function () {
        return Number(position.quantity.toFixed(position.symbol.quantityPrecision));
    };

    position.getProfit = function (noRounding, session) {
        if(position.meta.profit === undefined || position.meta.profit === null) {
            const chart = L.getPositionChart(position);
            if(!chart.priceHistoryEntries || !chart.priceHistoryEntries.length) {
                L.setHistory(chart, session);
            }

            const bar = chart.barsHistoryEntries.slice(-1)[0];
            position.meta.profit = position.getProfitAtPrice(bar.close, true);
        }

        return Number(position.meta.profit.toFixed(noRounding ? 100 : 2));
    }

    position.getProfitAtPrice = function (price, noRounding) {
        if (price) {
            return Number(L.calculateProfit(position, price).toFixed(noRounding ? 100 : 2));
        }
    }

    position.getProfitPercentage = function (profit, noRounding) {
        if (!profit) {
            profit = position.getProfit(noRounding);
        }

        return Number((profit / position.meta.initialBalance * 100).toFixed(noRounding ? 100 : 2));
    };

    position.getCumulativeProfit = function (profit, noRounding) {
        if (!profit) {
            profit = position.getProfit(noRounding);
        }

        return Number((position.meta.initialBalance + profit).toFixed(noRounding ? 100 : 2));
    };

    position.getCumulativeProfitPercentage = function (profit, noRounding) {
        if (!profit) {
            profit = position.getProfit(noRounding);
        }

        return Number(((position.getCumulativeProfit(profit, noRounding) - L.session.capital) / L.session.capital * 100).toFixed(noRounding ? 100 : 2));
    };

    position.getRunUp = function (noRounding) {
        return Number(Number(position.columnValue("Run-up")).toFixed(noRounding ? 100 : 2));
    };

    position.getRunUpPercentage = function (noRounding) {
        return Number((position.columnValue("Run-up") / position.meta.initialBalance * 100).toFixed(noRounding ? 100 : 2));
    };

    position.getDrawDown = function (noRounding) {
        return -Math.abs(Number(Number(position.columnValue("Drawdown")).toFixed(noRounding ? 100 : 2)));
    };

    position.getDrawDownPercentage = function (noRounding) {
        return -Math.abs(Number((position.columnValue("Drawdown") / position.meta.initialBalance * 100).toFixed(noRounding ? 100 : 2)));
    };

    position.getBERunUp = function (noRounding) {
        const beRunUp = Number(position.columnValue("BE Run-up")) || 0;
        return Number(beRunUp.toFixed(noRounding ? 100 : 2));
    }

    position.getBERunUpPercentage = function (noRounding) {
        const beRunUp = position.columnValue("BE Run-up") || 0;
        return Number((beRunUp / position.meta.initialBalance * 100).toFixed(noRounding ? 100 : 2));
    }

    position.getRR = function(noRounding) {
        var rr = position.columnValue("RR");
        if(!rr) {
            try {
                const sl = position.stopPrice(undefined, true, 0);
                const tp = position.targetPrice(undefined, true, 0);
                const entry = position.entryPrice;
                if (entry != null && sl != null && tp != null && entry !== sl) {
                    rr = Math.abs(tp - entry) / Math.abs(entry - sl);
                }
            } catch(_e) { return 0; }
        }

        return Number((Number(position.columnValue("RR")) || 0).toFixed(noRounding ? 100 : 2));
    }

    position.getLeverage = function() {
        const requiredMargin = position.entryPrice * Math.abs(position.quantity) * position.symbol.meta.contractSize;
        return Math.ceil(requiredMargin / position.meta.initialBalance);
    };
}

L.setPositionShapeSettings = function (shapeDataSourceProperties, shapeProperties) {
    shapeDataSourceProperties.accountSize.setValue(shapeProperties.accountSize);
    shapeDataSourceProperties.currency.setValue(shapeProperties.currency);
    shapeDataSourceProperties.lotSize.setValue(shapeProperties.lotSize);

    shapeDataSourceProperties.accountSize.subscribe(null, () => {
        if (shapeDataSourceProperties.accountSize.value() != shapeProperties.accountSize && (!L.session.meta.lastSyncTime || L.session.meta.lastSyncTime + 1000 < Date.now())) {
            L.session.meta.lastSyncTime = Date.now();
            shapeDataSourceProperties.accountSize.setValue(shapeProperties.accountSize);
        }
    });
    shapeDataSourceProperties.currency.subscribe(null, () => {
        if (shapeDataSourceProperties.currency.value() != shapeProperties.currency && (!L.session.meta.lastSyncTime || L.session.meta.lastSyncTime + 1000 < Date.now())) {
            L.session.meta.lastSyncTime = Date.now();
            shapeDataSourceProperties.currency.setValue(shapeProperties.currency);
        }
    });
    shapeDataSourceProperties.lotSize.subscribe(null, () => {
        if (shapeDataSourceProperties.lotSize.value() != shapeProperties.lotSize && (!L.session.meta.lastSyncTime || L.session.meta.lastSyncTime + 1000 < Date.now())) {
            L.session.meta.lastSyncTime = Date.now();
            shapeDataSourceProperties.lotSize.setValue(shapeProperties.lotSize);
        }
    });
    shapeDataSourceProperties.risk.subscribe(null, () => {
        if (shapeDataSourceProperties.risk.value() != shapeProperties.risk && (!L.session.meta.lastSyncTime || L.session.meta.lastSyncTime + 1000 < Date.now())) {
            L.session.meta.lastSyncTime = Date.now();
            shapeDataSourceProperties.risk.setValue(shapeProperties.risk);
        }
    });
    shapeDataSourceProperties.riskDisplayMode.subscribe(null, () => {
        if (shapeDataSourceProperties.riskDisplayMode.value() != shapeProperties.riskDisplayMode && (!L.session.meta.lastSyncTime || L.session.meta.lastSyncTime + 1000 < Date.now())) {
            L.session.meta.lastSyncTime = Date.now();
            shapeDataSourceProperties.riskDisplayMode.setValue(shapeProperties.riskDisplayMode);
        }
    });
    shapeDataSourceProperties.entryPointCurrencyRate.subscribe(null, () => {
        if (!shapeDataSourceProperties.entryPointCurrencyRate.value()) {
            shapeDataSourceProperties.entryPointCurrencyRate.setValue(1);
        }
    });
    shapeDataSourceProperties.closePointCurrencyRate.subscribe(null, () => {
        if (!shapeDataSourceProperties.closePointCurrencyRate.value()) {
            shapeDataSourceProperties.closePointCurrencyRate.setValue(1);
        }
    });
    if (shapeProperties.entryPrice) {
        shapeDataSourceProperties.entryPrice.subscribe(null, () => {
            if (shapeDataSourceProperties.entryPrice.value() != shapeProperties.entryPrice && (!L.session.meta.lastSyncTime || L.session.meta.lastSyncTime + 1000 < Date.now())) {
                L.session.meta.lastSyncTime = Date.now();
                shapeDataSourceProperties.entryPrice.setValue(shapeProperties.entryPrice);
            }
        });
    }
}

L.updateActivePositions = async function () {
    var openProfit = 0;
    for (const position of L.session.getActivePositions()) {
        const currentPositionPrice = position.meta.currentPrice;
        await L.updatePosition(position);

        clearTimeout(position.symbol.meta.updateLastPriceTimeout);
        position.symbol.meta.updateLastPriceTimeout = setTimeout(() => {
            if (currentPositionPrice != position.meta.currentPrice) {
                L.dataOps.updateLastPrice(L.session.sessionId, position.symbol.symbolId, position.meta.currentPrice);
            }
        }, 1000);

        L.updatePositionUI(position);

        if (!position.exitTime) {
            L.createLinesForPosition(position, L.getPositionChart(position, true));
            openProfit += position.getProfit(true);
        }
    }

    L.session.meta.balance = L.session.meta.balance || L.session.capital;
    L.session.meta.equity = L.session.meta.balance + openProfit;

    L.updateSessionCapitalInfo();
}

L.assessTracking = async function (position, bar) {
    if (position.quantity > 0) {
        if (position.meta.trackBeRunUp && (bar.low || bar.price) <= position.entryPrice && position.positionSLs[position.positionSLs.length - 1].barTime <= bar.time) {
            position.meta.trackBeRunUp = false;
        }

        if ((position.meta.trackRunUp || position.meta.trackBeRunUp) && (bar.low || bar.price) <= position.positionSLs[0]?.sl && position.positionSLs[position.positionSLs.length - 1].barTime <= bar.time) {
            position.meta.trackRunUp = false;
            position.meta.trackBeRunUp = false;
        }

        if (position.meta.trackDrawDown && (bar.high || bar.price) >= position.positionTPs[0]?.tp && position.positionTPs[position.positionTPs.length - 1].barTime <= bar.time) {
            position.meta.trackDrawDown = false;
        }
    }
    else if (position.quantity < 0) {
        if (position.meta.trackBeRunUp && (bar.high || bar.price) >= position.entryPrice && position.positionSLs[position.positionSLs.length - 1].barTime <= bar.time) {
            position.meta.trackBeRunUp = false;
        }

        if ((position.meta.trackRunUp || position.meta.trackBeRunUp) && (bar.high || bar.price) >= position.positionSLs[0]?.sl && position.positionSLs[position.positionSLs.length - 1].barTime <= bar.time) {
            position.meta.trackRunUp = false;
            position.meta.trackBeRunUp = false;
        }

        if (position.meta.trackDrawDown && (bar.low || bar.price) <= position.positionTPs[0]?.tp && position.positionTPs[position.positionTPs.length - 1].barTime <= bar.time) {
            position.meta.trackDrawDown = false;
        }
    }

    if(position.exitTime) {
        const dbUpdates = [];
        var positionElement;
        var runUp;
        
        if(position.meta.trackRunUp) {
            runUp = Math.max(position.columnValue("Run-up") || 0, position.quantity > 0 ? position.getProfitAtPrice(bar.high || bar.price, true) : position.getProfitAtPrice(bar.low || bar.price, true));
            if (runUp > position.columnValue("Run-up")) {
                position.columnValue("Run-up", runUp, true);
                dbUpdates.push(L.dataOps.setPositionColumn(position.positionId, position.getColumn("Run-up")));
                positionElement = positionElement || $(`#ID_${position.positionId}.V_POSITION`);
                positionElement.find(".V_RUNUP").text(position.getRunUp());
                positionElement.find(".V_RUNUPPERCENTAGE").text(position.getRunUpPercentage());
            } else {
                runUp = position.columnValue("Run-up");
            }
        }

        if(position.meta.trackDrawDown) {
            const drawDown = Math.min(position.columnValue("Drawdown") || 0, position.quantity > 0 ? position.getProfitAtPrice(bar.low || bar.price, true) : position.getProfitAtPrice(bar.high || bar.price, true));
            if (drawDown < position.columnValue("Drawdown")) {
                position.columnValue("Drawdown", drawDown, true);
                dbUpdates.push(L.dataOps.setPositionColumn(position.positionId, position.getColumn("Drawdown")));
                positionElement = positionElement || $(`#ID_${position.positionId}.V_POSITION`);
                positionElement.find(".V_DRAWDOWN").text(position.getDrawDown());
                positionElement.find(".V_DRAWDOWNPERCENTAGE").text(position.getDrawDownPercentage());
            }
        }

        if(position.meta.trackBeRunUp) {
            if (position.columnValue("BE Run-up")) {
                const beRunUp = position.columnValue("Run-up");
                if (beRunUp != position.columnValue("BE Run-up")) {
                    position.columnValue("BE Run-up", beRunUp, true);
                    dbUpdates.push(L.dataOps.setPositionColumn(position.positionId, position.getColumn("BE Run-up")));
                    positionElement = positionElement || $(`#ID_${position.positionId}.V_POSITION`);
                    positionElement.find(".V_BERUNUP").text(position.getBERunUp());
                    positionElement.find(".V_BERUNUPPERCENTAGE").text(position.getBERunUpPercentage());
                }
            }
        }

        await Promise.all(dbUpdates);
    }
}

L.updatePositionStats = async function(position, bar) {
    const dbUpdates = [];
    L.assessTracking(position, bar);

    if(position.meta.trackRunUp) {
        var runUp = Math.max(position.columnValue("Run-up") || 0, position.quantity > 0 ? position.getProfitAtPrice(bar.high || bar.price, true) : position.getProfitAtPrice(bar.low || bar.price, true));
        if (runUp > position.columnValue("Run-up")) {
            position.columnValue("Run-up", runUp, true);
            dbUpdates.push(L.dataOps.setPositionColumn(position.positionId, position.getColumn("Run-up")));
        }
    }

    if(position.meta.trackDrawDown) {
        const drawDown = Math.min(position.columnValue("Drawdown") || 0, position.quantity > 0 ? position.getProfitAtPrice(bar.low || bar.price, true) : position.getProfitAtPrice(bar.high || bar.price, true));
        if (drawDown < position.columnValue("Drawdown")) {
            position.columnValue("Drawdown", drawDown, true);
            dbUpdates.push(L.dataOps.setPositionColumn(position.positionId, position.getColumn("Drawdown")));
        }
    }

    if(position.meta.trackBeRunUp) {
        if (position.columnValue("BE Run-up")) {
            const beRunUp = position.columnValue("Run-up");
            if (beRunUp != position.columnValue("BE Run-up")) {
                position.columnValue("BE Run-up", beRunUp, true);
                dbUpdates.push(L.dataOps.setPositionColumn(position.positionId, position.getColumn("BE Run-up")));
            }
        }
    }

    await Promise.all(dbUpdates);
}

L.updatePosition = async function (position) {
    const chart = L.getPositionChart(position, true);
    var continueParsing = !!chart;

    if (continueParsing) {
        if (continueParsing) {
            for (var i = 0; i <= chart.barsHistoryEntries.length - 1; i++) {
                const bar = chart.barsHistoryEntries[i];
                if (bar.time > position.entryTime) {
                    continueParsing = await parseBarAction(bar, null, i == chart.barsHistoryEntries.length - 1);
                    if (!continueParsing) {
                        break;
                    }
                }
            }
        }

        if (continueParsing) {
            for (var i = 0; i < chart.priceHistoryEntries.length; i++) {
                const bar = chart.priceHistoryEntries[i];
                const previousBar = chart.priceHistoryEntries[i - 1];
                continueParsing = await parseBarAction(bar, previousBar, i == chart.priceHistoryEntries.length - 1);
                if(!continueParsing) {
                    break;
                }
            }
        }
    } else {
        console.warn(L.s(2, -3, position.symbol.symbolName) /* Position chart not found for symbol {0} */);
    }

    async function parseBarAction(bar, previousBar, isLatestBar) {
        if (bar.time >= position.entryTime) {
            if (isLatestBar) {
                position.meta.profit = position.getProfitAtPrice(bar.close || bar.price, true);
                position.meta.currentPrice = (bar.close || bar.price);
            }

            L.updatePositionStats(position, bar);

            if (L.detectExit(position, chart, bar, previousBar)) {
                return false;
            }
        }

        return true;
    }
}

L.detectExit = function (position, chart, bar, previousBar) {
    if (L.session.meta.isReviewMode) {
        return;
    }

    if (position.bePrice()) {
        var beHit = true;
        beHit = beHit && (position.positionBEs[position.positionBEs.length - 1].barTime <= bar.time);
        if(position.quantity > 0) {
            beHit = beHit && ((bar.low || previousBar?.price) <= position.bePrice() && position.bePrice() <= (bar.high || bar.price));
        } else {
            beHit = beHit && ((bar.high || previousBar?.price) >= position.bePrice() && position.bePrice() >= (bar.low || bar.price));
        }

        if (beHit) {
            position.meta.trackBeRunUp = true;
            L.toast(L.s(2, -4) /* BE hit, moving SL to entry */, 2000);
            L.stopSkipping();
            L.removeBeLine(position, chart);
            if(L.permissions.includes("CanSetBE")) {
                L.applyOnCharts((c) => {
                    const stopLine = L.getShapeById(position.meta.stopLineId, c, true);
                    stopLine?.setPoints([{ price: position.entryPrice, time: position.entryTime }]);
                });
                
                L.setStopPrice(position, position.entryPrice, true);
                position.columnValue("BE Run-up", position.columnValue("Run-up"));
                
                if (L.session.getParameter(L.sessionParameterIds.AutoSnapshot) == 'true') {
                    L.takeSnapshot(position);
                }
            } else {
                L.toast(L.s(2, -5) /* BE hit, but the auto-BE feature is disabled: please subscribe to a free plan or start a free trial on eBacktesting.com */, 0, "warn");
            }
        }
    }
    
    if (position.quantity > 0) {
        if ((bar.low || bar.price) <= position.stopPrice() && position.positionSLs[position.positionSLs.length - 1].barTime <= bar.time) {
            position.exitPrice = position.stopPrice();
        }

        if ((bar.high || bar.price) >= position.targetPrice() && position.positionTPs[position.positionTPs.length - 1].barTime <= bar.time) {
            position.exitPrice = position.targetPrice();
        }
    }
    else if (position.quantity < 0) {
        if ((bar.high || bar.price) >= position.stopPrice() && position.positionSLs[position.positionSLs.length - 1].barTime <= bar.time) {
            position.exitPrice = position.stopPrice();
        }

        if ((bar.low || bar.price) <= position.targetPrice() && position.positionTPs[position.positionTPs.length - 1].barTime <= bar.time) {
            position.exitPrice = position.targetPrice();
        }
    }

    if (position.exitPrice) {
        if(position.exitPrice == position.stopPrice()) {
            L.toast(L.s(2, -6) /* Stop loss hit */, 2000, "warn");
        } else if(position.exitPrice == position.targetPrice()) {
            L.toast(L.s(2, -7) /* Take profit hit */, 2000);
        }

        position.exitTime = bar.time + chart.timeframeSeconds > L.session.currentDate ? L.session.currentDate : bar.time + chart.timeframeSeconds;
        L.closePosition(position, 1 /* TP/SL */, chart);
        return true;
    }
}

L.keepShapeInfoInSync = function (position, shape, shapeDataSourceProperties) {
    shapeDataSourceProperties.stopPrice.subscribe(null, () => {
        if (position.meta.setShapeStopPriceTimeout) {
            clearTimeout(position.meta.setShapeStopPriceTimeout);
        }

        position.meta.setShapeStopPriceTimeout = setTimeout(() => {
            if (!position.exitTime && position.getShape().stopPrice != shapeDataSourceProperties.stopPrice.value()) {
                position.getShape().stopPrice = shapeDataSourceProperties.stopPrice.value();
            }
        }, 1000);
    });

    shapeDataSourceProperties.stopPrice.subscribe(null, () => {
        if (position.meta.setShapeTargetPriceTimeout) {
            clearTimeout(position.meta.setShapeTargetPriceTimeout);
        }

        position.meta.setShapeTargetPriceTimeout = setTimeout(() => {
            if (!position.exitTime && position.getShape().targetPrice != shapeDataSourceProperties.targetPrice.value()) {
                position.getShape().targetPrice = shapeDataSourceProperties.targetPrice.value();
            }
        }, 1000);
    });

    shapeDataSourceProperties.stopPrice.subscribe(null, () => {
        if (position.meta.setShapeEndTimeTimeout) {
            clearTimeout(position.meta.setShapeEndTimeTimeout);
        }

        position.meta.setShapeEndTimeTimeout = setTimeout(() => {
            const endTime = shape.getPoints()[1].time;
            if (!position.exitTime && position.getShape().endTime != endTime) {
                position.getShape().endTime = endTime;
            }
        }, 1000);
    });
}

L.setStopPrice = function (position, price, immediate) {
    if (position.meta.pendingNewStopPrice != price) {
        position.meta.pendingNewStopPrice = price;
        if (position.positionSLs?.slice(-1)[0] != price) {
            const setStopPrice = () => {
                const positionChart = L.getShapeChart(position.meta.stopLineId);
                if (positionChart) {
                    const bar = positionChart.priceHistoryEntries.slice(-1)[0];

                    const isInvalidPrice = !!immediate
                    || (position.quantity > 0 && price >= bar.price)
                    || (position.quantity < 0 && price <= bar.price)
                    || (position.quantity > 0 && position.bePrice() && price > position.bePrice())
                    || (position.quantity < 0 && position.bePrice() && price < position.bePrice())
                    ;
        
                    if (!immediate && isInvalidPrice) {
                        L.applyOnCharts((chart) => {
                            L.getShapeById(position.meta.stopLineId, chart, true)?.setPoints(
                                [{ price: position.stopPrice(), time: position.entryTime }]);
                        });
                        L.toast(L.s(2, -8) /* Invalid stop price */, 3000, "warn");
                    }
                    else {
                        position.stopPrice(price);

                        L.applyOnCharts((chart) => {
                            L.getShapeById(position.meta.stopLineId, chart, true)?.setProperties({
                                text: `${position.getProfitAtPrice(position.stopPrice())} ${L.session.currencyId} (${position.getProfitPercentage(position.getProfitAtPrice(position.stopPrice(), true))}%)`,
                            });
                        });
                    }
                }
            }

            if (immediate) {
                setStopPrice();
            } else {
                if (position.meta.setStopPriceTimeout) {
                    clearTimeout(position.meta.setStopPriceTimeout);
                }
            
                position.meta.setStopPriceTimeout = setTimeout(setStopPrice, 1000);
            }
        }
    }
}

L.setTargetPrice = function (position, price) {
    if (position.meta.pendingNewTargetPrice != price) {
        position.meta.pendingNewTargetPrice = price;
        if (position.positionTPs?.slice(-1)[0] != price) {
            if (position.meta.setTargetPriceTimeout) {
                clearTimeout(position.meta.setTargetPriceTimeout);
            }

            position.meta.setTargetPriceTimeout = setTimeout(() => {
                const positionChart = L.getShapeChart(position.meta.targetLineId);
                if (positionChart) {
                    const bar = positionChart.priceHistoryEntries.slice(-1)[0];

                    const isInvalidPrice = false
                    || (position.quantity > 0 && price <= bar.price)
                    || (position.quantity < 0 && price >= bar.price)
                    || (position.quantity > 0 && position.bePrice() && price < position.bePrice())
                    || (position.quantity < 0 && position.bePrice() && price > position.bePrice())
                    ;
        
                    if (isInvalidPrice) {
                        L.applyOnCharts((chart) => {
                            L.getShapeById(position.meta.targetLineId, chart, true)?.setPoints(
                                [{ price: position.targetPrice(), time: position.entryTime }]);
                        });
                        L.toast(L.s(2, -9) /* Invalid target price */, 3000, "warn");
                    }
                    else {
                        position.targetPrice(price);
                        
                        L.applyOnCharts((chart) => {
                            L.getShapeById(position.meta.targetLineId, chart, true)?.setProperties({
                                text: `${position.getProfitAtPrice(position.targetPrice())} ${L.session.currencyId} (${position.getProfitPercentage(position.getProfitAtPrice(position.targetPrice(), true))}%)`,
                            });
                        });
                    }
                }
            }, 1000);
        }
    }
}

L.setBePrice = function (position, price) {
    if (position.meta.pendingNewBEPrice != price) {
        position.meta.pendingNewBEPrice = price;
        if (position.positionBEs?.slice(-1)[0] != price) {
            position.meta.currentBePrice = price;
            if (position.meta.setBePriceTimeout) {
                clearTimeout(position.meta.setBePriceTimeout);
            }

            position.meta.setBePriceTimeout = setTimeout(() => {
                const positionChart = L.getShapeChart(position.meta.beLineId);
                if (positionChart) {                   
                    const isInvalidPrice = false
                    || (position.quantity > 0 && price <= position.stopPrice())
                    || (position.quantity < 0 && price >= position.stopPrice())
                    || (position.quantity > 0 && price >= position.targetPrice())
                    || (position.quantity < 0 && price <= position.targetPrice())
                    || (position.quantity > 0 && price <= position.entryPrice)
                    || (position.quantity < 0 && price >= position.entryPrice)
                    ;
        
                    if (isInvalidPrice) {
                        L.applyOnCharts((chart) => {
                            L.getShapeById(position.meta.beLineId, chart, true)?.setPoints(
                                [{ price: position.bePrice(), time: position.entryTime }]);
                        });
                        L.toast(L.s(3, -1) /* Invalid BE price */, 3000, "warn");
                    }
                    else {
                        position.bePrice(price);
                    }
                }
            }, 1000);
        }
    }

}

L.sortPositions = function (field) {
    const comparePosition = function (position1, position2, valueFunction) {
        const a = valueFunction(position1);
        const b = valueFunction(position2);
        var valueComparison = 0;

        // Treat null or undefined as smaller than any defined value
        const isANullish = a === null || a === undefined;
        const isBNullish = b === null || b === undefined;

        if (isANullish && !isBNullish) { valueComparison = -1; }
        else if (!isANullish && isBNullish) { valueComparison = 1; }
        else if (a < b) { valueComparison = -1; }
        else if (a > b) { valueComparison = 1; }

        L.session.meta.sortByColumn = field;

        return (position2.exitTime ? 1 : 0) - (position1.exitTime ? 1 : 0)
            || (L.session.meta.sortByDesc ? -valueComparison : valueComparison)
            || (L.session.meta.sortByDesc ? (position2.index - position1.index) : (position1.index - position2.index));
    }

    if (L.session.positions.length > 1 && field) {
        if (L.session.meta.sortByColumn == field) {
            L.session.meta.sortByDesc = !L.session.meta.sortByDesc;
        }
        const accessors = {
            "Trade": p => p.getDirection(),
            "Date/Time": p => p.entryTime,
            "Price": p => p.entryPrice,
            "Lots": p => Math.abs(p.quantity),
            "Risk": p => p.getRisk(),
            "Profit": p => p.getProfitPercentage(),
            "Cumulative profit": p => p.getCumulativeProfit(),
            "Run-up": p => p.getRunUpPercentage(),
            "Drawdown": p => p.getDrawDownPercentage(),
            "BE Run-up": p => p.getBERunUpPercentage()
        };

        const accessor = accessors[field];

        if (accessor) {
            L.session.positions.sort((a, b) => comparePosition(a, b, accessor));
        } else {
            const column = L.session.sessionColumns.find(c => c.columnName === field);
            if (column?.sortable) {
                L.session.positions.sort((a, b) => comparePosition(a, b, p => p.columnValue(field)));
            }
        }
    }
    L.updatePositionsList(true);
}

L.calculateProfit = function (position, currentPrice) {
    return (currentPrice - position.entryPrice) * position.quantity * position.symbol.meta.contractSize * position.entryCurrencyRate * position.symbol.meta.pointSize;
}

L.getBalanceAfterPositions = async function (initialBalance, positions, session) {
    positions = positions.slice().sort((a, b) => a.exitTime - b.exitTime);

    for (const position of positions) {
        Object.defineProperty(position.symbol, 'meta', { value: {}, writable: true, enumerable: false });
        L.setPositionFunctions(position);
        if (!position.symbol.meta.contractSize) {
            position.symbol.meta.contractSize = (await L.getContractSize(position.symbol.symbolName, position.symbol.symbolType)).contractSize;
        }

        if (!position.symbol.meta.pointSize) {
            position.symbol.meta.pointSize = (await L.getContractSize(position.symbol.symbolName, position.symbol.symbolType)).pointSize;
        }

        position.meta.initialBalance = initialBalance;
        if (position.exitTime) {
            position.meta.profit = position.getProfitAtPrice(position.exitPrice, true);
            initialBalance += position.getProfit(true, session);
        } else {
            if (L.session?.sessionSymbolLastPrices) {
                try {
                    position.meta.currentPrice = L.session.sessionSymbolLastPrices.find(p => p.symbolId == position.symbol.symbolId).lastPrice;
                } catch(e) {
                    console.log(e);
                }
                position.meta.profit = position.getProfitAtPrice(position.meta.currentPrice, true);
            }
        }
    }

    return initialBalance;
}
