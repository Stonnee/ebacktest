import { L } from "./ebacktesting.core.js";

L.subscribeToData = async function(ctx) {
    const chart  = L.getCharts()[0];
    const model  = chart.chartModel();
    const series = model.mainSeries();
    const c = {}; // for unsubscribes
  
    let rafId = 0, rafId2 = 0;
    const read = async () => {
        if (L.replayTo 
            || L.session.meta.changingSymbol
            || L.session.meta.isIntervalChanging
            || L.isWarmingUp) {
            return;
        }
    
        const v = series.lastValueData(undefined, /*lastBar*/ true, /*includePrice*/ true);
        
        const lastBar = series.bars?.().last?.() ?? series.bars?._items?.at?.(-1);
        const currentBarInfo = L.getBarInfo(lastBar, chart.timeframeSeconds);
        currentBarInfo.close = v?.price ?? currentBarInfo.close;
        if (currentBarInfo.time !== ctx.previousBarInfo.time || currentBarInfo.close !== ctx.previousBarInfo.close || currentBarInfo.high !== ctx.previousBarInfo.high || currentBarInfo.low !== ctx.previousBarInfo.low || currentBarInfo.open !== ctx.previousBarInfo.open) {
            const previousBarInfo = ctx.previousBarInfo;
            ctx.previousBarInfo = currentBarInfo;
            await L.onBarActivity(previousBarInfo, currentBarInfo);
        }
    };
  
    // schedule read after TV has applied updates (and even painted)
    const scheduleRead = () => {
      cancelAnimationFrame(rafId); cancelAnimationFrame(rafId2);
      rafId = requestAnimationFrame(() => {
        // sometimes commit → paint is another turn; do a second rAF
        rafId2 = requestAnimationFrame(read);
      });
    };
  
    // LIVE: fires on realtime updates
    series.dataEvents().barReceived().subscribe(c, scheduleRead);
    series.dataEvents().dataUpdated().subscribe(c, scheduleRead); // symbol/res changes etc.
  
    // REPLAY: drive off the playhead time; then read on next frame
    (async () => {
      L.replayApi.currentDate().subscribe(scheduleRead);
    })();
}

L.pollBarActivity = async function(ctx) {
    if(L.replayTo && L.replayApi.currentDate().value() > L.replayTo) {
        L.replayTo = null;
    }

    if(ctx.replayTimestampCounter <= 0) {
        setTimeout(() => {
            L.createReplayTimestampUI();
            $("#eBacktestingCurrentDate").text(L.toTradingViewDateTimeFormat(L.replayApi.currentDate().value(), window.TradingViewApi.activeChart().getTimezone()));
        }, 200);
        ctx.replayTimestampCounter = 5;
    }

    ctx.replayTimestampCounter--;

    if (L.replayTo 
        || L.session.meta.changingSymbol
        || L.session.meta.isIntervalChanging
        || L.isWarmingUp) {
        return;
    }

    const currentBarInfo = L.getCurrentBarInfo();
    if (currentBarInfo) {
        if (currentBarInfo.time !== ctx.previousBarInfo.time || currentBarInfo.close !== ctx.previousBarInfo.close || currentBarInfo.high !== ctx.previousBarInfo.high || currentBarInfo.low !== ctx.previousBarInfo.low || currentBarInfo.open !== ctx.previousBarInfo.open) {
            const previousBarInfo = ctx.previousBarInfo;
            ctx.previousBarInfo = currentBarInfo;
            await L.onBarActivity(previousBarInfo, currentBarInfo);
        }

        L.syncLinesWithPositions();
    }
}