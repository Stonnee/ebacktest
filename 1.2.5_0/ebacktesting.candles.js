import { L } from "./ebacktesting.core.js";

L.onCurrentDateChange = function (currentTime) {
    clearTimeout(L.session.meta.updateSessionTimeout);
    if (!L.replayTo) {
        const dateIncrement = currentTime - (L.session.delayedCurrentDate || L.session.currentDate);
        L.session.currentDate = currentTime;

        L.session.meta.updateSessionTimeout = setTimeout(() => {
            L.session.delayedCurrentDate = L.session.currentDate;
            var updateSession = true;
            if(!L.session.meta.isReviewMode) {
                if (L.session.meta.dateIncrements.length > 10) {
                    const avg = L.session.meta.dateIncrements.reduce((a, b) => a + b, 0) / L.session.meta.dateIncrements.length;
                    if (dateIncrement < 0) {
                        updateSession = false;
                        L.session.meta.disableCurrentDateTracking = true;
                        L.messageBox(L.s(0, 8) /* eBacktesting error */, L.s(0, 1, (dateIncrement / 60 / 60 / 24).toFixed(1)) /* An accidental backward time jump was detected ({0} days).\n\neBacktesting will exit at this point and restart the session. */ );
                        L.exit(true, false);
                    } else if (dateIncrement < avg * 100) {
                        L.session.meta.dateIncrements.push(dateIncrement);
                    } else if(dateIncrement > 3 * 60 * 60 * 24) {
                        updateSession = false;
                        L.messageBox(L.s(0, 2) /* Warning */ , L.s(0, 3, (dateIncrement / 60 / 60 / 24).toFixed(1)) /* An unusually large time jump was detected ({0} days).\n\nIf this was unintended, please exit eBacktesting at this point and restart the session. */ );
                        L.session.meta.disableCurrentDateTracking = true;
                    }
                } else {
                    L.session.meta.dateIncrements.push(dateIncrement);
                }
            }

            clearTimeout(L.session.meta.updateUsageTimeout);
            if (updateSession) {
                L.session.meta.updateUsageTimeout = setTimeout(() => {
                    if(!L.session.meta.disableCurrentDateTracking) {
                        L.session.lastUpdate = new Date();
                        L.dataOps.updateSession({ sessionId: L.session.sessionId, currentDate: L.session.currentDate, lastUpdate: L.session.lastUpdate }, L.session.meta.isReviewMode);
                    }
                }, 1000);
            }
        }, 1000);
    }
}

L.onBarActivity = async function (previousBarInfo, currentBarInfo) {
    var firstChart;
    for (const chart of L.getCharts()) {
        L.setHistory(chart);
        if(!firstChart) {
            firstChart = chart;
        }
    }

    await L.detectEntries();
    L.session.assessPositionsTracking();
    await L.updateActivePositions();
    L.updatePositionsList();
    await L.stopAtPredefinedTime();
    L.session.meta.lastKnownBarTime = firstChart.priceHistoryEntries[firstChart.priceHistoryEntries.length - 1]?.time;
}

L.getBarInfo = function (bar, duration) {
    if (!bar) return null;
    if (!bar.value) return null;

    return {
        time: bar.value[0],
        open: bar.value[1],
        high: bar.value[2],
        low: bar.value[3],
        close: bar.value[4],
        duration: duration
    };
}

L.getCurrentBarInfo = function (chart) {
    if (!chart) {
        chart = L.getCharts()[0];
    }

    return L.getBarInfo(chart.chartModel().mainSeries().bars().last(), chart.timeframeSeconds);
}

L.skipTime = async function (seconds, nonStop, resolutionSelectionDelay) {
    var skipped = true;

    L.session.meta.canDetectEntries = true;
    L.isSkippingCandles = true;
    $(L.s(0, 4) /* .play-pause-button.play */).hide();
    $(L.s(0, 5) /* .play-pause-button.pause */).show();

    if(seconds) {
        var currentTimestamp = L.r.currentDate().value();
        const minReplayResolution = await L.selectResolution(0, resolutionSelectionDelay);

        var skipBySeconds = L.resolutionToSeconds(minReplayResolution);
        var targetTimestamp = 0;

        if (nonStop) {
            targetTimestamp = currentTimestamp + seconds;
        }
        else {
            var hasChart = false;

            for (const chart of L.getCharts()) {
                if (chart.timeframeSeconds == seconds) {
                    targetTimestamp = chart.chartModel().mainSeries().bars().last().value[0] + seconds;
                    hasChart = true;
                    break;
                }
            }

            if (!hasChart) {
                const symbolInfo = window.TradingViewApi.activeChart().chartModel().mainSeries().symbolInfo();
                const sessionStart = L.convertTimeToUnixTimestamp(symbolInfo.session);
                const sessionStartUtc = L.getUtcDate(sessionStart, symbolInfo.timezone).getTime() / 1000;
                targetTimestamp = currentTimestamp + (seconds - ((currentTimestamp - sessionStartUtc) % seconds));
            }

            while (currentTimestamp + skipBySeconds >= targetTimestamp) {
                targetTimestamp += seconds;
            }

            // if (hasChart && currentTimestamp == targetTimestamp - seconds - 1) {
            //     var chartResolution = await L.selectResolution(seconds, 1000); //this may cause indicators to reload. Check back in: 24-02-2026
            //     skipBySeconds = L.resolutionToSeconds(chartResolution);
            // }
        }

        while (currentTimestamp + skipBySeconds <= targetTimestamp) {
            if (L.isSkippingCandles) {
                const stepped = await L.stepForward();
                if (!stepped) {
                    skipped = false;
                    break;
                }
            }
            else {
                skipped = false;
                break;
            }

            currentTimestamp = L.r.currentDate().value();
        }
    } else {
        await L.stepForward();
    }

    $(L.s(0, 4) /* .play-pause-button.play */).show();
    $(L.s(0, 5) /* .play-pause-button.pause */).hide();
    L.isSkippingCandles = false;

    return skipped;
}

L.stepForward = async function () {
    try {
        await L.r.doStep();
        L.keepSessionActive();
        return true;
    } catch(e) {
        // L.exit(true, false);
        return false;
    }
}

L.startAutoplay = async function () {
    if (L.r.isAutoplayStarted().value()) {
        L.r.toggleAutoplay();
    }

    if (!L.session.meta.autoplayStarted) {
        L.session.meta.autoplayStarted = true;
        while (L.session.meta.autoplayStarted) {
            await L.stepForward();
        }
    }
}

L.stopAutoPlay = function () {
    L.session.meta.autoplayStarted = false;

    if (L.r.isAutoplayStarted().value()) {
        L.r.toggleAutoplay();
    }
}

L.startSkipping = function () {
    L.startAutoplay();

    $(L.s(0, 4) /* .play-pause-button.play */).hide();
    $(L.s(0, 5) /* .play-pause-button.pause */).show();
    L.session.meta.canDetectEntries = true;
}

L.stopSkipping = function () {
    L.stopAutoPlay();

    $(L.s(0, 5) /* .play-pause-button.pause */).hide();
    $(L.s(0, 4) /* .play-pause-button.play */).show();
    L.isSkippingCandles = false;
}

L.stopAtPredefinedTime = async function () {
    if(L.isSkippingCandles) {
        return false;
    }

    if(!(L.session.meta.autoplayStarted || L.r.isAutoplayStarted().value())) {
        return false;
    }

    if(L.session.getParameter(L.sessionParameterIds.EnablePredefinedTimes) != L.s(0, 6) /* true */) {
        return false;
    }

    if(L.session.currentDate <= (L.session.meta.latestPredefinedTime || 0)) {
        return false;
    }

    var isNearPredefinedTime = false;

    const predefinedTimes = L.session.getParameter(L.sessionParameterIds.PredefinedTimes).split(L.s(0, 7) /* , */).map(t => t.trim()).filter(t => t.length > 0);
    const chart = L.getCharts()[0];

    var minResolution = L.session.getParameter(L.sessionParameterIds.MinReplayResolution);
    if(!minResolution) {
        const availableReplayResolutions = await L.getReplayResolutions();
        minResolution = availableReplayResolutions.find(r => L.resolutionToSeconds(r) >= 60) || availableReplayResolutions[0];
    }

    var minReplayResolution = L.resolutionToSeconds(minResolution);

    const formattedLastKnownBarTime = L.formatLocalTime(L.session.meta.lastKnownBarTime);
    const formattedLatestBarTime = L.formatLocalTime(chart.priceHistoryEntries[chart.priceHistoryEntries.length - 1].time + minReplayResolution * 4);

    if (predefinedTimes.length > 0) {
        for (const time of predefinedTimes) {
            if (formattedLastKnownBarTime < time && time <= formattedLatestBarTime) {
                L.toast(L.s(0, 0, time) /* Auto stopping candle playback at {0} */, 3000);
                L.stopSkipping();
                L.session.meta.autoStopRetries = 5;
                L.asyncInterval(async () => {
                    if(L.session.meta.autoStopRetries-- < 0) {
                        return -1;
                    }

                    if(L.session.meta.forceStopPlayback) {
                        return -1;
                    }

                    if(L.formatLocalTime(L.session.currentDate + 1) < time) {           
                        await L.skipTime(minReplayResolution, false, 500);
                    } else {
                        // if (L.session?.sessionId && L.session?.currentDate) {
                        //     L.sessionChannel.postMessage({
                        //         type: 'DATE-SYNC',
                        //         sessionId: L.session.sessionId,
                        //         currentDate: L.session.currentDate
                        //     });
                        // }
                        L.session.meta.latestPredefinedTime = L.session.currentDate + minReplayResolution * 4;
                        return -1;
                    }
                }, 500, 1.1);
                
                isNearPredefinedTime = true;
                break;
            }
        }
    }

    return isNearPredefinedTime;
}