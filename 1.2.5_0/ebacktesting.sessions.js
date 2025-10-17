import { L } from "./ebacktesting.core.js";
import Hotjar from "https://cdn.jsdelivr.net/npm/@hotjar/browser@1.0.9/+esm";

L.startSession = async function (sessionId) {
    L.hotJar();

    L.removeGeneratedShapes();
    
    $(L.s(3, -2) /* button#header-toolbar-replay */).hide();
    $(L.s(3, -2) /* button#header-toolbar-replay */).next("div[class*='wrapper']:has(div[class*='arrow'])").hide();

    $(L.s(3, -3) /* button#header-toolbar-ebacktesting */).attr("aria-pressed", true);
    $(L.s(3, -3) /* button#header-toolbar-ebacktesting */).addClass("isActive");
    $("head").append(`<style>div.chart-toolbar.chart-controls-bar button[data-name="time-zone-menu"] div.js-button-text {display:none}</style>`);

    L.session = await L.dataOps.getSession(sessionId);
    L.setSessionFunctions(L.session);

    L.session.positions = await L.dataOps.getSessionPositions(sessionId);

    Object.defineProperty(L.session, 'meta', { value: {}, writable: true, enumerable: false });
    L.session.meta.balance = await L.getBalanceAfterPositions(L.session.capital, L.session.positions);
    L.session.meta.sortByDesc = true;
    L.session.meta.dateIncrements = [];
    
    for (const position of L.session.positions) {
        for (const shape of position.positionShapes) {
            Object.defineProperty(shape, 'meta', { value: {}, writable: true, enumerable: false });
        }
    }

    L.monitorEntryShapes();

    const currentBarTime = L.getCharts()[0].chartModel().mainSeries().bars()._items.slice(-1)[0].value[0];

    const onReplayMode = async function () {
        while (!L.getCharts()[0].chartModel().mainSeries().bars()._items.slice(-1)[0] || L.getCharts()[0].chartModel().mainSeries().bars()._items.slice(-1)[0].value[0] == currentBarTime) {
            await L.delay(1000);
        }

        L.r.isReplayStarted().unsubscribe(onReplayMode);
        L.tryExec(() => L.r._replayUIController.tradingUIController().destroy(), true);
        const switchToMinReplayResolution = function (replayResolutions) {
            replayResolutions = replayResolutions.filter(r => r);
            if (replayResolutions.length > 0) {
                L.r.changeReplayResolution(replayResolutions.find(r => L.resolutionToSeconds(r) >= 60) || replayResolutions[0]);
                L.r.replayResolutions().unsubscribe(switchToMinReplayResolution);
            }
        };

        L.r.replayResolutions().subscribe(switchToMinReplayResolution);

        L.createUI();
        L.asyncInterval(async () => {
            L.createReplayControls();
            L.createPositionsListHeader();

            const replayTradingButton = $(L.s(1, -5) /* button[data-name=replay_trading] */);
            replayTradingButton.attr("aria-label", replayTradingButton.attr("data-active") == L.s(0, 6) /* true */ ? L.s(3, -4) /* Close eBacktesting */ : L.s(3, -5) /* Open eBacktesting */);
            replayTradingButton.attr("data-tooltip", replayTradingButton.attr("data-active") == L.s(0, 6) /* true */ ? L.s(3, -4) /* Close eBacktesting */ : L.s(3, -5) /* Open eBacktesting */);
        }, 1000);

        L.r.currentDate().subscribe(L.onCurrentDateChange);
            
        setInterval(() => {
            L.tryExec(() => { L.r.changeAutoplayDelay(1000); }, true);
                
            setTimeout(() => {
                L.tryExec(() => { L.r.changeAutoplayDelay(100); }, true);
            }, 1000);
        }, 10000);

        L.asyncInterval(async () => {
            if (!L.session.meta.autoplayDelayChangeDate) {
                L.session.meta.autoplayDelayChangeDate = new Date().getTime() / 1000;
            }

            const currentTime = new Date().getTime() / 1000;
            if (currentTime - L.session.meta.autoplayDelayChangeDate > 10) {
                L.session.meta.autoplayDelayChangeDate = currentTime;
                L.tryExec(() => {
                    L.r.changeAutoplayDelay(1000);
                    setTimeout(() => {
                        L.r.changeAutoplayDelay(100);
                    }, 2000);
                }, true);
            }
        }, 50);

        var ctx = {
            previousBarInfo: {},
            replayTimestampCounter: 5
        };

        L.asyncInterval(() => L.pollBarActivity(ctx), 10);
        // L.subscribeToData(ctx);

        for (const position of L.session.getActivePositions()) {
            const chartShapes = await L.drawShapeForPosition(position);
            const shape = chartShapes[0];
            if(shape) {
                position.meta.hasShapeRedraw = false;
                L.keepShapeInfoInSync(position, shape, shape.lineDataSource().properties());
            }
        }

        await L.selectResolution(0, 1000);

        L.initSessionChannel();
        L.replayInitialized = true;
    };

    L.applyOnCharts(chart => {
        const chartModel = chart.chartModel();
        const chartWidget = chart.chartWidget();
        if(!chartModel.mainSeries().priceScale().isScaleSeriesOnly()) {
            chartWidget.actions().scaleSeriesOnly.execute();
        }

        chartWidget.properties().chartEventsSourceProperties.visible.setValue(true)
        chartWidget.properties().chartEventsSourceProperties.futureOnly.setValue(false);
        chartModel.watermarkSource().properties().childs().replay.setValue(false);
    });

    L.r._replayUIController._ignoreReplayStateRestoring = true;
    // L.r._replayUIController._chartWidgetCollection.updateReplaySessionState(null)
    // L.r._replayUIController._chartWidgetCollection.updateReplaySessionState = function (_state) { /* disabled */ };
    // L.r._replayUIController._chartWidgetCollection.replaySessionState = function () { return null; };

    L.r.replayMode().setValue("AllCharts");
    L.r.replayResolutions().subscribe(resolutions => L.reflectReplayResolutions(resolutions.filter(r => r)));
    L.r.isReplayStarted().subscribe(onReplayMode);
    if (L.session.getParameter(L.sessionParameterIds.EnableWarmupStart) == "true") {
        L.toast(L.s(3, -6) /* Warmup: playing candles to where you left off to prevent candle previews... */, 5000)
    }

    var timeNow = new Date();
    var timeNowInTimezone = L.getDateInTimezone(timeNow / 1000, TradingViewApi.activeChart().getTimezone());

    const offsetHours = timeNowInTimezone.getUTCHours() - timeNow.getHours();
    const offsetMinutes = timeNowInTimezone.getUTCMinutes() - timeNow.getMinutes();

    const adjustedDateTime = new Date(L.session.currentDate * 1000);
    adjustedDateTime.setHours(adjustedDateTime.getHours() - offsetHours);
    adjustedDateTime.setMinutes(adjustedDateTime.getMinutes() - offsetMinutes);
    
    await L.selectDateWithWarmup(L.session.currentDate);
    if(!L.isEbacktestingPanelOpen()) {
        L.toast(L.s(3, -7) /* Session synced to last active time. You can now open the eBacktesting journal panel below to view your trades. */, 10000);
    }

    setTimeout(() => {
        if (L.session.getParameter(L.sessionParameterIds.ShowOpenPositionTip) != "false") {
            TradingViewApi.activeChart().createAnchoredShape({ x: 0.1, y: 0.3 }, { shape: "anchored_text", text: L.s(3, -9, L.session.currencyId) /* Quick tip:\nTo enter a position, simply \n- draw a Long Position or Short Position on the chart\n- double click to set its risk percentage or {0}\n- and start playing some candles */, overrides: { color: "white", backgroundColor: "rgb(0,0,0)", backgroundTransparency: 1, fillBackground: true, fontsize: 18 } })
            L.session.setParameter(L.sessionParameterIds.ShowOpenPositionTip, "false");
        } else {
            if(L.user.plan.planId.toUpperCase() != L.dataOps.plans.full.planId) {
                L.toast(L.s(3, -8) /* All eBacktesting features are open, regardless of plan, while eBacktesting is in early stage */);
            }
        }
    }, 10000);
}

L.updateSessionCapitalInfo = function () {
    if (L.session.meta.sessionCapitalCalculationTimeout) {
        clearTimeout(L.session.meta.sessionCapitalCalculationTimeout);
    }

    L.session.meta.sessionCapitalCalculationTimeout = setTimeout(() => {
        const balanceValue = (L.session.meta.balance || L.session.capital)
            .toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        $(`.${L.s(4, -1) /* ebacktesting-session-balance-balance-value */}`).text(balanceValue);

        if (L.session.meta.equity !== undefined) {
            const equityValue = L.session.meta.equity
                .toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            $(`.${L.s(4, -2) /* ebacktesting-session-balance-equity-value */}`).text(equityValue);
        }

        if (L.session.getActivePositions().length == 0) {
            $(`.${L.s(4, -3) /* ebacktesting-session-balance-equity */}`).hide();
        } else {
            $(`.${L.s(4, -3) /* ebacktesting-session-balance-equity */}`).show();
        }

        $(`.${L.s(4, -4) /* ebacktesting-stats-button */}`)
            .attr("aria-label", L.getStatsSummary())
            .attr("data-tooltip", L.getStatsSummary());
        
    }, 1000);
}

L.setSessionFunctions = function (session) {
    session.retrieveParameters = async function () {
        session.sessionParameters = await L.dataOps.getSessionParameters(L.session.sessionId);
    };

    session.getParameter = function (parameterId) {
        return session.sessionParameters?.find(p => p.parameterId == parameterId)?.parameterValue || "";
    };

    session.setParameter = function (parameterId, value) {
        L.dataOps.setSessionParameterValue(L.session.sessionId, parameterId, value);
        if (!session.sessionParameters) {
            session.sessionParameters = [{ parameterId, parameterValue: value }];
        }

        const param = session.sessionParameters.find(p => p.parameterId == parameterId);
        if (param) {
            param.parameterValue = value;
        }
    };
    session.getActivePositions = function () {
        return (L.session?.positions || []).filter(p => !p.exitTime);
    };
    session.stopAssessTracking = function () {
        for (const position of L.session.positions) {
            position.meta.trackRunUp = false;
            position.meta.trackDrawDown = false;
            position.meta.trackBeRunUp = false;
        }
    };
    session.assessPositionsTracking = async function() {
        for (const position of L.session.positions) {
            if(position.meta.trackRunUp || position.meta.trackDrawDown || position.meta.trackBeRunUp) {
                const cacheKey = `getPositionChart-${position.symbol.symbolId}`;

                var chart = L.cache.get(cacheKey);
                if(!chart) {
                    chart = L.getPositionChart(position, true);
                    L.cache.set(cacheKey, chart, 5);
                }

                if(chart) {
                    var bar = chart.priceHistoryEntries[chart.priceHistoryEntries.length - 1];
                    L.assessTracking(position, bar);

                    bar = chart.barsHistoryEntries[chart.barsHistoryEntries.length - 1];
                    L.assessTracking(position, bar);
                }
            }
        }
    }
}


L.hotJar = async function() {
    if(user.username == 'claudiu-i') {
        return;
    }
    
    if(!L.hotjarStarted) {
        const nonce = $('script[nonce]').prop('nonce'); 
        if (!nonce) return; // nothing to do if the page wasn't nonce'd
        
        const setNonce = (node) => {
            if (node && node.tagName === 'SCRIPT' && !node.nonce) node.nonce = nonce;
            return node;
        };
        
        const origHeadAppendChild = HTMLHeadElement.prototype.appendChild;
        HTMLHeadElement.prototype.appendChild = function(child) {
            setNonce(child);
            return origHeadAppendChild.call(this, child);
        };
        
        // Helpful extras: catch other insertion paths too
        const origAppendChild = Node.prototype.appendChild;
        Node.prototype.appendChild = function(child) {
            setNonce(child);
            return origAppendChild.call(this, child);
        };
        
        const origInsertBefore = Node.prototype.insertBefore;
        Node.prototype.insertBefore = function(newNode, ref) {
            setNonce(newNode);
            return origInsertBefore.call(this, newNode, ref);
        };
        
        const origAppend = Element.prototype.append;
        Element.prototype.append = function(...nodes) {
            nodes.forEach(setNonce);
            return origAppend.call(this, ...nodes);
        };
        
        const origPrepend = Element.prototype.prepend;
        Element.prototype.prepend = function(...nodes) {
            nodes.forEach(setNonce);
            return origPrepend.call(this, ...nodes);
        };

        const ok = Hotjar.init(6507452, 6, {nonce});
        if(ok) {
            L.hotjarStarted = true;

            window.hj('identify',
                user.username,
                {
                  email: L.user.email,
                  entryDate: L.user.creationDate,
                  plan: L.user.plan?.name,
                  tv: user.pro_plan
                });
        }
    }
}
