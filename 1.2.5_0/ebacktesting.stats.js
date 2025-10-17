import { L } from "//api.ebacktesting.com/js/ebacktesting.core.js?v=1";
// -----------------------------------------------------------------------------
// Break-even exclusion logic (2025-09-23):
// Requirement: If a trade result is BE (|profit| < 0.1R) it must NOT be taken
// into account when calculating drawdown (MAE based & equity peak/trough) or
// run-up (MFE based & trough/peak) in any statistics.
// Implementation notes:
//  * Added L.isBreakEvenTrade helper used across summary, detailed stats,
//    max run-up computation and overlay series generation.
//  * Equity progression for other metrics (win rate, profit factor, etc.) still
//    includes BE trades; only drawdown/run-up metrics ignore them.
//  * For overlay series (runUpPoints/drawDownPoints) BE trades duplicate prior
//    overlay values to retain temporal alignment without influencing extremes.
//  * Intra-trade MAE/MFE from BE trades are ignored.
// -----------------------------------------------------------------------------
import { createChart } from "https://unpkg.com/lightweight-charts@4.2.0?module";
import html2canvas from "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js";

// Global cost adjustment for stats/charts (negative percentage of starting capital)
// Example: -0.05 means total costs = 5% of starting capital, distributed proportionally across lots of closed trades
if (typeof L.statsCostPct !== 'number') {
    L.statsCostPct = 0; // default: no cost
}

// Helper (back-compat name): compute per-LOT cost using all closed positions in the current session
// The parameter is ignored; callers historically passed closedCount, but we now allocate by lots.
L._computePerTradeCost = function(_ignored) {
    const cap = Number(L.session && L.session.capital) || 0;
    const pct = Number(L.statsCostPct) || 0; // negative or zero
    const totalCost = -pct * cap; // since pct is negative, -pct is positive amount
    if (!Number.isFinite(totalCost) || totalCost <= 0) return 0;
    const positions = (L.session && Array.isArray(L.session.positions)) ? L.session.positions : [];
    const closedPositions = positions.filter(p => p && p.exitTime);
    let totalLots = 0;
    for (const p of closedPositions) {
        let q = 0;
        try {
            q = Number(p && p.getQuantity ? p.getQuantity() : p && p.quantity);
        } catch(_e) { q = Number(p && p.quantity); }
        const lots = Math.abs(q) || 0;
        totalLots += lots;
    }
    if (!Number.isFinite(totalLots) || totalLots <= 0) return 0;
    return totalCost / totalLots; // cost per 1 lot
};

// Helper: adjusted realized profit for a position (subtract per-lot cost × abs(quantity))
L._profitWithCosts = function(position, perLotCost) {
    const base = Number(position && position.getProfit && position.getProfit(true)) || 0;
    const plc = Number(perLotCost) || 0;
    let qty = 0;
    try {
        qty = Number(position && position.getQuantity ? position.getQuantity() : position && position.quantity);
    } catch(_e) { qty = Number(position && position.quantity); }
    const lots = Math.abs(qty) || 0;
    return base - (plc * lots);
};

// Helper: determine if a closed position should be considered BreakEven for R based filtering
// BE definition: absolute realized profit < 0.1R (risk/10) *after* cost adjustments applied by caller
// profitFn passed must already include any cost adjustments (like profitOf in contexts below)
if(typeof L.isBreakEvenTrade !== 'function') {
    L.isBreakEvenTrade = function(position, profitFn){
        try {
            if(!position) return false;
            const risk = Number(position.getRisk && position.getRisk(true)) || 0;
            if(!(risk>0)) return false; // if no risk info treat as not BE so metrics remain conservative
            const p = Number(typeof profitFn === 'function' ? profitFn(position) : (position.getProfit && position.getProfit(true))) || 0;
            return Math.abs(p) < (risk / 10);
        } catch(_e){ return false; }
    };
}

L.exportStats = function () {
    if (L.permissions.includes("JournalExport")) {
        var positionsTable = $("div.replay_trading:not(.js-hidden) div.backtesting.deep-history table");
        if (positionsTable.length) {
            L.toast("Exporting session statistics...");

            var positionEntries = [];
            positionsTable.find("tr.V_POSITION").each((rowIndex, row) => {
                row = $(row);
                var positionEntry = new Map();
                var positionId = row.attr("id").split("_")[1];
                var position = L.session.positions.find(p => p.positionId == positionId);

                row.find("td[column-name]").each((columnIndex, cell) => {
                    cell = $(cell);
                    var columnName = cell.attr("column-name");
                    if (columnName == "Trade") {
                        positionEntry["Trade"] = position.getDirection().toUpperCase();
                        const entryDate = L.getDateInTimezone(position.entryTime, window.TradingViewApi.activeChart().getTimezone());
                        positionEntry["Entry Date"] = entryDate.toISOString().split("T")[0];
                        positionEntry["Entry Time"] = entryDate.toISOString().split("T")[1].slice(0, 5);

                        const exitDate = position.exitTime ? L.getDateInTimezone(position.exitTime, window.TradingViewApi.activeChart().getTimezone()) : null;
                        positionEntry["Exit Date"] = exitDate ? exitDate.toISOString().split("T")[0] : null;
                        positionEntry["Exit Time"] = exitDate ? exitDate.toISOString().split("T")[1].slice(0, 5) : null;
                    } else if (columnName == "Price") {
                        positionEntry["Entry Price"] = position.entryPrice;
                        positionEntry["Exit Price"] = position.exitPrice || null;
                    } else if (columnName == "Risk") {
                        positionEntry[`Risk ${cell.find(".currency").text()}`] = cell.find(".V_RISK").text().trim();
                        positionEntry[`Risk %`] = cell.find(".V_RISKPERCENTAGE").text().trim();

                        positionEntry[`SL`] = position.stopPrice(undefined, true, 0) || null;
                        positionEntry[`TP`] = position.targetPrice(undefined, true, 0) || null;
                        positionEntry[`BE`] = position.bePrice(undefined, true, 0) || null;
                    } else if (columnName == "Profit") {
                        positionEntry[`Profit ${cell.find(".currency").text()}`] = cell.find(".V_PROFIT").text().trim();
                        positionEntry[`Profit %`] = cell.find(".V_PROFITPERCENTAGE").text().trim();
                    } else if (columnName == "Cumulative profit") {
                        positionEntry[`Cumulative profit ${cell.find(".currency").text()}`] = cell.find(".V_CUMULATIVEPROFIT").text().trim();
                        positionEntry[`Cumulative profit %`] = cell.find(".V_CUMULATIVEPROFITPERCENTAGE").text().trim();
                    } else if (columnName == "Run-up") {
                        positionEntry[`Run-up ${cell.find(".currency").text()}`] = cell.find(".V_RUNUP").text().trim();
                        positionEntry[`Run-up %`] = cell.find(".V_RUNUPPERCENTAGE").text().trim();
                    } else if (columnName == "Drawdown") {
                        positionEntry[`Drawdown ${cell.find(".currency").text()}`] = cell.find(".V_DRAWDOWN").text().trim();
                        positionEntry[`Drawdown %`] = cell.find(".V_DRAWDOWNPERCENTAGE").text().trim();
                    } else if (columnName == "BE Run-up") {
                        positionEntry[`BE Run-up ${cell.find(".currency").text()}`] = cell.find(".V_BERUNUP").text().trim();
                        positionEntry[`BE Run-up %`] = cell.find(".V_BERUNUPPERCENTAGE").text().trim();
                    } else if (columnName == "Snapshots") {
                        positionEntry["Snapshots"] = position.positionSnapshots.map(snapshot => `${L.snapshotUrlPrefix}${snapshot.snapshotUrl}`).join(", ");
                    } else {
                        var value = position.columnValue(columnName) || null;
                        if (!value) {
                            const input = cell.find('input, select, textarea').first();
                            if (input.is(":checkbox")) {
                                value = input.is(":checked") ? "true" : "false";
                            } else {
                                if (input.length > 0) {
                                    value = input.val();
                                } else {
                                    value = cell.text().trim();
                                }
                            }
                        }

                        positionEntry[columnName] = value;
                    }
                });

                positionEntries.push(positionEntry);
            });

            return L.dataOps.exportSessionStatistics(L.session.name, { userId: L.user.userId, sessionId: L.session.sessionId, positionEntries }).then(() => {
                L.toast("Session statistics exported successfully!", 3000);
            });
        } else {
            // Fallback: build from in-memory positions when journal table isn't open
            const positions = (L.session && Array.isArray(L.session.positions)) ? L.session.positions : [];
            if (!positions.length) {
                L.messageBox("Usage info", "No positions found to export.");
                return Promise.resolve();
            }
            L.toast("Exporting session statistics...");
            const tz = (window.TradingViewApi && window.TradingViewApi.activeChart) ? window.TradingViewApi.activeChart().getTimezone() : 'Etc/UTC';
            const positionEntries = positions.map((position) => {
                const entry = {};
                entry["Trade"] = position.getDirection().toUpperCase();
                const entryDate = L.getDateInTimezone(position.entryTime, tz);
                entry["Entry Date"] = entryDate.toISOString().split("T")[0];
                entry["Entry Time"] = entryDate.toISOString().split("T")[1].slice(0,5);
                const exitDate = position.exitTime ? L.getDateInTimezone(position.exitTime, tz) : null;
                entry["Exit Date"] = exitDate ? exitDate.toISOString().split("T")[0] : null;
                entry["Exit Time"] = exitDate ? exitDate.toISOString().split("T")[1].slice(0,5) : null;
                entry["Entry Price"] = position.entryPrice;
                entry["Exit Price"] = position.exitPrice || null;
                entry["Risk "+(L.session.currencyId||'')]= (position.getRisk && position.getRisk()) || position.risk || '';
                entry["Profit "+(L.session.currencyId||'')] = (position.getProfit && position.getProfit(true)) || position.profit || 0;
                entry["Snapshots"] = (position.positionSnapshots||[]).map(s=>`${L.snapshotUrlPrefix}${s.snapshotUrl}`).join(", ");
                // Include a few commonly used columns if present
                entry["Symbol"] = position.symbol || position.ticker || '';
                entry["Strategy"] = position.strategyName || '';
                return entry;
            });
            return L.dataOps.exportSessionStatistics(L.session.name, { userId: L.user.userId, sessionId: L.session.sessionId, positionEntries }).then(() => {
                L.toast("Session statistics exported successfully!", 3000);
            });
        }
    } else {
        L.messageBox("Feature disabled", "Unable to export: please subscribe to a free plan or start a free trial on eBacktesting.com");
        return Promise.resolve();
    }
}
        

// Using top-level ESM import for Lightweight Charts; no runtime injection or dynamic import.

L.getStatsSummary = function () {
    const positions = (L.session.positions || []).map(p => p).sort((a, b) => a.entryTime - b.entryTime).filter(p => p.exitTime);
    const cacheKey = `getStatsSummary-${positions.length}-cost-${Number(L.statsCostPct||0)}`;

    const cacheEntry = L.cache.getIfExists(cacheKey);
    if(cacheEntry[0]) {
        return cacheEntry[1];
    }

    const perLotCost = L._computePerTradeCost(positions.length);
    const profitOf = (p) => L._profitWithCosts(p, perLotCost);
    const filteredPositions = positions.filter(p => Math.abs(profitOf(p)) >= p.getRisk(true) / 10);
    const totalTrades = filteredPositions.length;
    const winningTrades = filteredPositions.filter(p => profitOf(p) > 0).length;
    const losingTrades = filteredPositions.filter(p => profitOf(p) < 0).length;
    const breakevenTrades = positions.length - winningTrades - losingTrades;

    const totalProfit = filteredPositions.reduce((sum, p) => { const pr = profitOf(p); return sum + (pr > 0 ? pr : 0); }, 0);
    const totalLoss = filteredPositions.reduce((sum, p) => { const pr = profitOf(p); return sum + (pr < 0 ? pr : 0); }, 0);

    const winrate = totalTrades > 0 ? (((winningTrades / totalTrades) * 100).toFixed(0) + "%") : "N/A";
    const profitFactor = totalLoss !== 0 ? Math.abs((totalProfit / totalLoss).toFixed(2)) : "N/A";

    const avgRiskToReward = (losingTrades != 0 && winningTrades != 0 && totalLoss != 0)
        ? (
            (totalProfit / winningTrades) /
            (Math.abs(totalLoss) / losingTrades)
          ).toFixed(2)
        : "N/A";

    const profits = positions.map(p => profitOf(p));
    const sharpeRatio = L.calculateSharpeRatio(profits);

    // Calculate streaks
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let maxConsecutiveBes = 0;
    let currentWins = 0;
    let currentLosses = 0;
    let currentBes = 0;

    let runningBalance = L.session.capital; // full equity progression (includes BE trades so subsequent metrics like profit factor unaffected)
    let peak = runningBalance; // peak for equity including all trades
    let maxDrawdown = 0; // percent, excluding BE trades impacts
    let currentDrawdown = 0;
    // Separate equity used for drawdown logic that excludes BE trades' effect on trough/peak discovery
    let ddEquity = L.session.capital;
    let ddPeak = ddEquity;

    for (const position of positions) {
        const risk = Number(position.getRisk && position.getRisk(true)) || 0;
        const profit = profitOf(position);
        const isBE = L.isBreakEvenTrade(position, profitOf);

        if (!isBE && profit >= risk / 10) {
            currentWins++; currentLosses = 0; currentBes = 0;
        } else if (!isBE && profit <= -risk / 10) {
            currentLosses++; currentWins = 0; currentBes = 0;
        } else { // treat BE
            currentBes++; currentWins = 0; currentLosses = 0;
        }

        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
        maxConsecutiveBes = Math.max(maxConsecutiveBes, currentBes);

        // Drawdown calculation ignoring BE trades: we only adjust ddEquity with non-BE trade profit
        // Intra-trade MAE also only impacts if trade not a loser and not BE (i.e., winner) OR requirement: exclude BE from drawdown entirely
        if(!isBE){
            const entryDdEquity = ddEquity;
            const posDD = Number(position.getDrawDown && position.getDrawDown(true)); // negative or 0
            if (profit > -risk/10 && Number.isFinite(posDD) && posDD < 0) { // MAE contribution
                const equityMinWithinTrade = entryDdEquity + posDD;
                if (equityMinWithinTrade < ddPeak) {
                    const ddPctWithin = ((ddPeak - equityMinWithinTrade) / ddPeak) * 100;
                    maxDrawdown = Math.max(maxDrawdown, ddPctWithin);
                }
            }
            // apply non-BE profit to ddEquity then update standard drawdown
            ddEquity += profit;
            if (ddEquity > ddPeak) {
                ddPeak = ddEquity;
            } else if (ddPeak > 0) {
                currentDrawdown = ((ddPeak - ddEquity) / ddPeak) * 100;
                maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
            }
        }

        // Always apply profit to runningBalance for other metrics & equity progression (includes BE)
        runningBalance += profit;
        if (runningBalance > peak) peak = runningBalance; // maintain peak (not used for excluded DD)
    }

    function summaryLabel(label) {
        return `\t${label}\n`;
    }

    function summaryValue(value) {
        return value.toString().padStart(8, " ");
    }

    const summary = summaryValue(winrate) + summaryLabel("Winrate") +
                    summaryValue(profitFactor) + summaryLabel("Profit factor") +
                    summaryValue(avgRiskToReward) + summaryLabel("R:R ratio") +
                    summaryValue(sharpeRatio) + summaryLabel("Sharpe ratio") +
                    (winningTrades > 0 ? (summaryValue(winningTrades) + summaryLabel("Winning trades")) : "") +
                    (losingTrades > 0 ? (summaryValue(losingTrades) + summaryLabel("Losing trades")) : "") +
                    (breakevenTrades > 0 ? (summaryValue(breakevenTrades) + summaryLabel("BE trades")) : "") +
                    (maxConsecutiveWins > 1 ? (summaryValue(maxConsecutiveWins) + summaryLabel("Win streak")) : "") +
                    (maxConsecutiveLosses > 1 ? (summaryValue(maxConsecutiveLosses) + summaryLabel("Loss streak")) : "") +
                    (maxConsecutiveBes > 1 ? (summaryValue(maxConsecutiveBes) + summaryLabel("BE streak")) : "") +
                    (maxDrawdown > 0 ? (summaryValue(`${maxDrawdown.toFixed(1)}%`) + summaryLabel("Max drawdown")) : "");

    L.cache.set(cacheKey, summary, 3600); // Cache for 1 hour
    return summary;
};

L.calculateSharpeRatio = function (returns) {
    if (!returns || returns.length === 0) return "N/A";

    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const squaredDiffs = returns.map(r => Math.pow(r - meanReturn, 2));
    const stdDev = Math.sqrt(squaredDiffs.reduce((sum, diff) => sum + diff, 0) / returns.length);

    return stdDev !== 0 ? (meanReturn / stdDev).toFixed(2) : "N/A";
};


L.calculateDetailedStats = function(positions) {
    const closed = positions.filter(p => p.exitTime);
    const perLotCost = L._computePerTradeCost(closed.length);
    const profitOf = (p) => L._profitWithCosts(p, perLotCost);
    const filteredPositions = positions.filter(p => Math.abs(profitOf(p)) >= p.getRisk(true) / 10);
    const totalTrades = filteredPositions.length;
    const winningTrades = filteredPositions.filter(p => profitOf(p) > 0).length;
    const losingTrades = filteredPositions.filter(p => profitOf(p) < 0).length;
    const breakevenTrades = positions.length - winningTrades - losingTrades;

    const totalProfit = filteredPositions.reduce((sum, p) => { const pr = profitOf(p); return sum + (pr > 0 ? pr : 0); }, 0);
    const totalLoss = filteredPositions.reduce((sum, p) => { const pr = profitOf(p); return sum + (pr < 0 ? pr : 0); }, 0);

    const winrate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const profitFactor = totalLoss !== 0 ? Math.abs(totalProfit / totalLoss) : "∞";

    const avgRiskToReward = (losingTrades != 0 && winningTrades != 0 && totalLoss != 0)
        ? (totalProfit / winningTrades) / (Math.abs(totalLoss) / losingTrades)
        : "N/A";

    const profits = positions.map(p => profitOf(p));
    const sharpeRatio = L.calculateSharpeRatio(profits);

    // Calculate win/loss amounts
    const winAmounts = filteredPositions.filter(p => profitOf(p) > 0).map(p => profitOf(p));
    const lossAmounts = filteredPositions.filter(p => profitOf(p) < 0).map(p => profitOf(p));

    const avgWin = winAmounts.length > 0 ? winAmounts.reduce((sum, w) => sum + w, 0) / winAmounts.length : 0;
    const avgLoss = lossAmounts.length > 0 ? lossAmounts.reduce((sum, l) => sum + l, 0) / lossAmounts.length : 0;
    const largestWin = winAmounts.length > 0 ? Math.max(...winAmounts) : 0;
    const largestLoss = lossAmounts.length > 0 ? Math.min(...lossAmounts) : 0;

    // Calculate streaks
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let maxConsecutiveBes = 0;
    let currentWins = 0;
    let currentLosses = 0;
    let currentBes = 0;
    let currentStreak = { type: 'none', count: 0 };

    let runningBalance = L.session.capital; // includes all trades including BE for net profit etc
    let peak = runningBalance;
    let maxDrawdown = 0; // excludes BE
    let maxDrawdownAmount = 0; // excludes BE
    let ddEquity = L.session.capital; // equity for drawdown excluding BE
    let ddPeak = ddEquity;
    const equityData = [{ date: 'Start', balance: runningBalance }];

    for (const position of positions) {
        const profit = profitOf(position);
        const risk = Number(position.getRisk && position.getRisk(true)) || 0;
        const isBE = L.isBreakEvenTrade(position, profitOf);

        let tradeType = 'breakeven';
        if(!isBE && profit >= risk/10){
            currentWins++; currentLosses=0; currentBes=0; tradeType='win';
        } else if(!isBE && profit <= -risk/10){
            currentLosses++; currentWins=0; currentBes=0; tradeType='loss';
        } else { // BE
            currentBes++; currentWins=0; currentLosses=0; tradeType='breakeven';
        }

        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
        maxConsecutiveBes = Math.max(maxConsecutiveBes, currentBes);

        // Drawdown excluding BE trades
        if(!isBE){
            const entryDdEquity = ddEquity;
            const posDD = Number(position.getDrawDown && position.getDrawDown(true));
            if (profit > -risk/10 && Number.isFinite(posDD) && posDD < 0){
                const equityMinWithinTrade = entryDdEquity + posDD;
                if (equityMinWithinTrade < ddPeak){
                    const ddAmtWithin = (ddPeak - equityMinWithinTrade);
                    const ddPctWithin = (ddAmtWithin / ddPeak) * 100;
                    if (ddPctWithin > maxDrawdown) maxDrawdown = ddPctWithin;
                    if (ddAmtWithin > maxDrawdownAmount) maxDrawdownAmount = ddAmtWithin;
                }
            }
            ddEquity += profit;
            if (ddEquity > ddPeak){ ddPeak = ddEquity; }
            else if (ddPeak > 0){
                const ddAmt = (ddPeak - ddEquity);
                const currentDrawdown = (ddAmt / ddPeak) * 100;
                if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown;
                if (ddAmt > maxDrawdownAmount) maxDrawdownAmount = ddAmt;
            }
        }

        // Always apply profit to full equity
        runningBalance += profit;
        if (runningBalance > peak) peak = runningBalance;

        equityData.push({
            date: L.toTradingViewDateTimeFormat(position.exitTime, window.TradingViewApi.activeChart().getTimezone()),
            balance: runningBalance,
            profit: profit,
            tradeType: tradeType
        });
    }

    // Determine current streak
    if (positions.length > 0) {
        const lastPosition = positions[positions.length - 1];
        const lastProfit = lastPosition.getProfit(true);
        const lastRisk = lastPosition.getRisk(true);
        
        if (lastProfit >= lastRisk / 10) {
            currentStreak = { type: 'win', count: currentWins };
        } else if (lastProfit <= -lastRisk / 10) {
            currentStreak = { type: 'loss', count: currentLosses };
        } else if (currentBes > 0) {
            currentStreak = { type: 'be', count: currentBes };
        }
    }

    const netProfit = runningBalance - L.session.capital;
    const totalReturnPercent = ((runningBalance - L.session.capital) / L.session.capital * 100);

    // Generate monthly data
    const monthlyData = L.generateMonthlyData(positions, profitOf);

    return {
        totalTrades,
        winningTrades,
        losingTrades,
        breakevenTrades,
        winrate,
        winratePercent: `${winrate.toFixed(1)}%`,
        profitFactor: typeof profitFactor === 'number' ? profitFactor.toFixed(2) : profitFactor,
        avgRiskToReward: typeof avgRiskToReward === 'number' ? avgRiskToReward.toFixed(2) : avgRiskToReward,
        sharpeRatio,
        avgWin: avgWin.toFixed(2),
        avgLoss: avgLoss.toFixed(2),
        largestWin: largestWin.toFixed(2),
        largestLoss: largestLoss.toFixed(2),
        maxConsecutiveWins,
        maxConsecutiveLosses,
    maxConsecutiveBes,
        currentStreak,
    maxDrawdown,
    maxDrawdownAmount,
    maxDrawdownPercent: `${maxDrawdown.toFixed(1)}%`,
        finalBalance: runningBalance,
        netProfit,
        totalReturnPercent: totalReturnPercent.toFixed(2),
        equityData,
        monthlyData
    };
}

L.drawEquityCurve = function(positions) {
    const canvas = document.getElementById('ebacktesting-equity-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas size
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const width = rect.width;
    const height = rect.height;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    // Find min/max values
    const balances = positions.map(d => d.meta.initial);
    const minBalance = Math.min(...balances);
    const maxBalance = Math.max(...balances);
    const balanceRange = maxBalance - minBalance || 1;
    
    // Clear canvas
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--tv-color-platform-background').trim() || '#131722';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--tv-color-line-divider').trim() || '#434651';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
        const y = padding + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + chartWidth, y);
        ctx.stroke();
        
        // Labels
        const value = maxBalance - (balanceRange / 5) * i;
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--tv-color-text').trim() || '#d1d4dc';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(value.toFixed(0), padding - 5, y + 3);
    }
    
    // Draw equity curve
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--tv-color-brand').trim() || '#2962ff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    positions.forEach((position, index) => {
        const x = padding + (chartWidth / (positions.length - 1)) * index;
        const y = padding + chartHeight - ((position.balance - minBalance) / balanceRange) * chartHeight;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // Draw points for trades
    positions.forEach((position, index) => {
        if (index === 0) return; // Skip starting point

        const x = padding + (chartWidth / (positions.length - 1)) * index;
        const y = padding + chartHeight - ((position.balance - minBalance) / balanceRange) * chartHeight;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);

        if (position.tradeType === 'win') {
            ctx.fillStyle = '#4caf50';
        } else if (position.tradeType === 'loss') {
            ctx.fillStyle = '#f44336';
        } else {
            ctx.fillStyle = '#9e9e9e';
        }
        
        ctx.fill();
    });
    
    // Draw starting capital line
    const startY = padding + chartHeight - ((L.session.capital - minBalance) / balanceRange) * chartHeight;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--tv-color-text-secondary').trim() || '#868ca0';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, startY);
    ctx.lineTo(padding + chartWidth, startY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Add labels
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--tv-color-text').trim() || '#d1d4dc';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Equity Curve', width / 2, 20);
}

// ---- Helpers to compute extra stats for UI ----
L.generateMonthlyData = function(positions, profitFn) {
    try {
        const tz = window.TradingViewApi.activeChart().getTimezone();
        const map = new Map();
        for (const p of positions) {
            const t = p.exitTime || p.entryTime;
            if (!t) continue;
            const d = L.getDateInTimezone(t, tz);
            const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
            const profit = typeof profitFn === 'function' ? profitFn(p) : (p.getProfit(true) || 0);
            const rec = map.get(key) || { month: key, profit: 0, count: 0 };
            rec.profit += profit;
            rec.count += 1;
            map.set(key, rec);
        }
        return Array.from(map.values()).sort((a,b)=> a.month.localeCompare(b.month));
    } catch(e) {
        return [];
    }
};

L._formatDuration = function(totalSeconds) {
    if (!Number.isFinite(totalSeconds)) return 'N/A';
    const abs = Math.abs(totalSeconds);
    const days = Math.floor(abs / 86400);
    const hours = Math.floor((abs % 86400) / 3600);
    const mins = Math.floor((abs % 3600) / 60);
    const parts = [];
    if (days) parts.push(days + 'd');
    if (hours) parts.push(hours + 'h');
    if (mins || parts.length === 0) parts.push(mins + 'm');
    return (totalSeconds < 0 ? '-' : '') + parts.join(' ');
};

L._computeAverageTradeDuration = function(positions) {
    const closed = positions.filter(p => p.exitTime && p.entryTime);
    if (!closed.length) return 'N/A';
    const avgSec = closed.reduce((s,p) => s + (p.exitTime - p.entryTime), 0) / closed.length;
    return L._formatDuration(avgSec);
};

// Compute optimal Stop-Loss size as a percentage of original SL (risk),
// by simulating hypothetical PnL if each trade were stopped at k * risk when its MAE exceeds that level.
// Returns { k, kPercent, baseline, hypothetical, delta, deltaPercent }
L._computeOptimalSLSize = function(positions) {
    const filteredPositions = positions.filter(p => p.exitTime);
    var optimalSl = 0;
    var maxBalance = -Infinity;

    for(var k = 0.1; k <= 5; k += 0.1) {
        var runningBalance = 0;
        for (const position of filteredPositions) {
            if(position.getDrawDown(true) < -k * position.getRisk(true)) {
                runningBalance += -k * position.getRisk(true);
            } else {
                runningBalance += position.getProfit(true);
            }
        }

        if(runningBalance > maxBalance) {
            optimalSl = k;
            maxBalance = runningBalance;
        }
    }

    return optimalSl;
};

// Helper: compute the original TP profit in currency for a position using its configured target price.
// Returns NaN if target price is unavailable or invalid.
L._getOriginalTPProfitCurrency = function(position){
    try {
        if (!position || !position.targetPrice) return NaN;
        const tpPrice = position.targetPrice(undefined, true, 0);
        if (!Number.isFinite(tpPrice)) return NaN;
        const tpProfit = Number(L.calculateProfit(position, tpPrice));
        return Number.isFinite(tpProfit) ? tpProfit : NaN; // should be > 0 for valid targets
    } catch(_e){
        return NaN;
    }
};

L._computeOptimalTPSize = function(positions) {
    // Optimal TP as a percentage of each trade's original TP (per-trade scaling),
    // rather than a single fixed R multiple for all trades.
    const filteredPositions = positions.filter(p => p && p.exitTime);
    let optimalK = 0; // fraction of original TP profit
    let maxBalance = -Infinity;
    const costEach = L._computePerTradeCost(filteredPositions.length) || 0; // per-lot cost

    // Pre-compute per-trade original TP profit (currency). If missing/invalid, mark as NaN to skip TP simulation for that trade
    const tpProfitById = new Map();
    for (const p of filteredPositions) {
        const tpCur = L._getOriginalTPProfitCurrency(p);
        tpProfitById.set(p.positionId || p, tpCur);
    }

    // Scan k from 10% to 200% of original TP, step 10%
    for (let k = 0.1; k <= 2.0 + 1e-9; k += 0.1) {
        let runningBalance = 0;
        for (const p of filteredPositions) {
            const base = Number(p.getProfit && p.getProfit(true)) || 0;
            // cost proportional to lots
            let qty = 0; try { qty = Number(p && p.getQuantity ? p.getQuantity() : p && p.quantity); } catch(_e) { qty = Number(p && p.quantity); }
            const lots = Math.abs(qty) || 0;
            const risk = Number(p.getRisk && p.getRisk(true)) || 0;
            const mfe = Number(p.getRunUp && p.getRunUp(true)) || 0; // currency
            const tpCur = tpProfitById.get(p.positionId || p);

            // Default: realized profit minus cost
            let adj = base - (costEach * lots);
            if (Number.isFinite(tpCur) && tpCur > 0) {
                const need = k * tpCur; // currency required to hit scaled TP
                if (mfe >= need) {
                    adj = need - (costEach * lots);
                } else {
                    // Fallback: keep realized if near BE; otherwise treat as stopped at -risk
                    const fallback = (!p.exitReason || Math.abs(base) < (risk / 10)) ? base : -risk;
                    adj = fallback - (costEach * lots);
                }
            }
            runningBalance += adj;
        }
        if (runningBalance > maxBalance) {
            optimalK = k;
            maxBalance = runningBalance;
        }
    }
    return optimalK;
};

L._computeMaxRunup = function(positions, profitFn) {
    // Using equity curve with intra-trade run-up (MFE) for non-winning trades
    // and realized PnL updates per closed trade
    let equity = L.session?.capital || 0;
    let minEquity = equity; // running trough
    let maxRunupPercent = 0;
    let maxRunupAmount = 0;
    const ordered = positions.filter(p => p.exitTime).slice().sort((a,b)=>a.exitTime-b.exitTime);
    for (const p of ordered) {
        const profit = Number(typeof profitFn === 'function' ? profitFn(p) : (p.getProfit(true) || 0)) || 0;
        const risk = Number(p.getRisk && p.getRisk(true)) || 0;
        const isBE = L.isBreakEvenTrade(p, profitFn);
        const entryEquity = equity;

        // Intra-trade run-up: exclude BE trades entirely per requirement, and original logic only included for non-winners
        if(!isBE){
            const posRun = Number(p.getRunUp && p.getRunUp(true)); // >=0
            if (profit < (risk / 10) && Number.isFinite(posRun) && posRun > 0 && minEquity > 0) {
                const equityMaxWithinTrade = entryEquity + posRun;
                if (equityMaxWithinTrade > minEquity) {
                    const runupAmtWithin = (equityMaxWithinTrade - minEquity);
                    const runupPctWithin = (runupAmtWithin / minEquity) * 100;
                    if (runupPctWithin > maxRunupPercent) maxRunupPercent = runupPctWithin;
                    if (runupAmtWithin > maxRunupAmount) maxRunupAmount = runupAmtWithin;
                }
            }
        }

        // Apply final PnL. Equity progression includes all trades for baseline, but run-up evaluation of trough/peak should ignore BE adjustments (so skip equity add for BE when updating trough-based run-up metrics)
        equity += profit; // always move equity baseline
        if(!isBE){
            minEquity = Math.min(minEquity, equity);
            if (minEquity > 0) {
                const runupAmt = (equity - minEquity);
                const currentRunupPct = (runupAmt / minEquity) * 100;
                if (currentRunupPct > maxRunupPercent) maxRunupPercent = currentRunupPct;
                if (runupAmt > maxRunupAmount) maxRunupAmount = runupAmt;
            }
        }
    }
    return { percent: maxRunupPercent, amount: maxRunupAmount };
};

L._breakdownByWeekday = function(positions, profitFn) {
    // returns array of { label, profit, count }
    const tz = window.TradingViewApi.activeChart().getTimezone();
    const days = [
        { label: 'Mon', profit: 0, count: 0, idx: 1 },
        { label: 'Tue', profit: 0, count: 0, idx: 2 },
        { label: 'Wed', profit: 0, count: 0, idx: 3 },
        { label: 'Thu', profit: 0, count: 0, idx: 4 },
        { label: 'Fri', profit: 0, count: 0, idx: 5 },
        { label: 'Sat', profit: 0, count: 0, idx: 6 },
        { label: 'Sun', profit: 0, count: 0, idx: 0 },
    ];
    for (const p of positions) {
        if (!p.entryTime) continue;
        const d = L.getDateInTimezone(p.entryTime, tz);
        const dow = d.getUTCDay();
        const rec = days.find(x => x.idx === dow);
        if (!rec) continue;
        rec.profit += (typeof profitFn === 'function' ? profitFn(p) : p.getProfit(true));
        rec.count += 1;
    }
    // Normalize order Mon..Sun for charts
    return [days[0],days[1],days[2],days[3],days[4],days[5],days[6]];
};

L._breakdownByHour = function(positions, profitFn) {
    // returns array of length 24 { label, profit, count, hour }
    const tz = window.TradingViewApi.activeChart().getTimezone();
    const arr = Array.from({length:24}, (_,h)=>({label: h.toString().padStart(2,'0')+':00', profit:0, count:0, hour:h}));
    for (const p of positions) {
        if (!p.entryTime) continue;
        const d = L.getDateInTimezone(p.entryTime, tz);
        const hour = d.getUTCHours();
        arr[hour].profit += (typeof profitFn === 'function' ? profitFn(p) : p.getProfit(true));
        arr[hour].count += 1;
    }
    return arr;
};

// Aggregate realized profit by calendar day (timezone-aware)
L._aggregateByDay = function(positions, profitFn) {
    const tz = window.TradingViewApi.activeChart().getTimezone();
    const map = new Map(); // key: YYYY-MM-DD
    for (const p of positions) {
        const t = p.exitTime || p.entryTime; if (!t) continue;
        const d = L.getDateInTimezone(t, tz);
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth()+1;
        const day = d.getUTCDate();
        const key = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const rec = map.get(key) || { key, profit: 0, count: 0, y, m, day };
        rec.profit += (typeof profitFn === 'function' ? profitFn(p) : p.getProfit(true));
        rec.count += 1;
        map.set(key, rec);
    }
    const arr = Array.from(map.values()).sort((a,b)=> a.key.localeCompare(b.key));
    return arr.map(r=>({ time: Date.UTC(r.y, r.m-1, r.day) / 1000, value: Number(r.profit.toFixed(2)) }));
};

// Aggregate realized profit by ISO-week starting Monday (timezone-aware)
L._aggregateByWeek = function(positions, profitFn) {
    const tz = window.TradingViewApi.activeChart().getTimezone();
    const map = new Map(); // key: YYYY-MM-DD (monday)
    for (const p of positions) {
        const t = p.exitTime || p.entryTime; if (!t) continue;
        const d = L.getDateInTimezone(t, tz);
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth()+1;
        const day = d.getUTCDate();
        // Find Monday (ISO week) for this date
        const jsDate = new Date(Date.UTC(y, m-1, day));
        const dow = jsDate.getUTCDay(); // 0..6, Sun=0
        const offset = (dow + 6) % 7; // 0 for Mon, 6 for Sun
        const mondayUTC = new Date(Date.UTC(y, m-1, day - offset));
        const my = mondayUTC.getUTCFullYear();
        const mm = mondayUTC.getUTCMonth()+1;
        const md = mondayUTC.getUTCDate();
        const key = `${my}-${String(mm).padStart(2,'0')}-${String(md).padStart(2,'0')}`;
        const rec = map.get(key) || { key, profit: 0, count: 0, y: my, m: mm, day: md };
        rec.profit += (typeof profitFn === 'function' ? profitFn(p) : p.getProfit(true));
        rec.count += 1;
        map.set(key, rec);
    }
    const arr = Array.from(map.values()).sort((a,b)=> a.key.localeCompare(b.key));
    return arr.map(r=>({ time: Date.UTC(r.y, r.m-1, r.day) / 1000, value: Number(r.profit.toFixed(2)) }));
};

// Count trades per ISO-week starting Monday (timezone-aware)
L._tradesPerWeek = function(positions) {
    const tz = window.TradingViewApi.activeChart().getTimezone();
    const map = new Map(); // key: YYYY-MM-DD (monday)
    for (const p of positions) {
        const t = p.exitTime || p.entryTime; if (!t) continue;
        const d = L.getDateInTimezone(t, tz);
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth()+1;
        const day = d.getUTCDate();
        const jsDate = new Date(Date.UTC(y, m-1, day));
        const dow = jsDate.getUTCDay();
        const offset = (dow + 6) % 7; // 0 for Mon
        const mondayUTC = new Date(Date.UTC(y, m-1, day - offset));
        const my = mondayUTC.getUTCFullYear();
        const mm = mondayUTC.getUTCMonth()+1;
        const md = mondayUTC.getUTCDate();
        const key = `${my}-${String(mm).padStart(2,'0')}-${String(md).padStart(2,'0')}`;
        const rec = map.get(key) || { key, count: 0, y: my, m: mm, day: md };
        rec.count += 1;
        map.set(key, rec);
    }
    const arr = Array.from(map.values()).sort((a,b)=> a.key.localeCompare(b.key));
    return arr.map(r=>({ time: Date.UTC(r.y, r.m-1, r.day) / 1000, value: r.count }));
};

// Note: No new windows and no script injection as per requirement

// ---- Main overlay UI ----
L.showSessionStatistics = async function() {
    
    if (!L.session || !(L.session.positions||[]).length) {
        L.messageBox('No data', 'There are no positions in the current session to compute statistics.');
        return;
    }

    // Gate advanced stats: if missing, we'll blur the stats backdrop and close after user acknowledges
    const gateAdvanced = (!Array.isArray(L.permissions) || !L.permissions.includes('AdvancedMetrics'));
    // Charts created via top-level-imported createChart

    const positions = L.session.positions.slice().sort((a,b)=> a.entryTime - b.entryTime);
    const closed = positions.filter(p => p.exitTime);
    const perLotCost = L._computePerTradeCost(closed.length);
    const profitOf = (p) => L._profitWithCosts(p, perLotCost);
    const detailed = L.calculateDetailedStats(positions);
    const avgDuration = L._computeAverageTradeDuration(closed);
    const maxRunupRes = L._computeMaxRunup(positions, profitOf);
    const maxRunup = (maxRunupRes && typeof maxRunupRes === 'object') ? (maxRunupRes.percent || 0) : (Number(maxRunupRes) || 0);
    const maxRunupAmount = (maxRunupRes && typeof maxRunupRes === 'object') ? (maxRunupRes.amount || 0) : 0;
    const optSL = L._computeOptimalSLSize(positions);
    const optTP = L._computeOptimalTPSize(positions);
    // Determine if optimal SL is within acceptable near-optimal range (90% - 110%)
    const optSlPercent = Number.isFinite(optSL) ? optSL * 100 : NaN;
    const optSlIsOk = optSlPercent >= 90 && optSlPercent <= 110;
    // Determine if optimal TP (percentage of original TP) is near 100%
    const optTpPercent = Number.isFinite(optTP) ? optTP * 100 : NaN;
    const optTpIsOk = optTpPercent >= 90 && optTpPercent <= 110;
    // Heuristic thresholds for OK/Not-OK flags
    const parseNum = (v) => {
        if (v === null || v === undefined) return NaN;
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
            if (v === '∞') return Infinity;
            const m = v.match(/-?\d+(?:\.\d+)?/);
            return m ? parseFloat(m[0]) : NaN;
        }
        return NaN;
    };
    const thresholds = {
        winrate: 50,          // %
        profitFactor: 1.5,    // >= 1.5 is OK
        avgRR: 1.0,           // >= 1.0 is OK
        sharpe: 1.0,          // >= 1.0 is OK
        winStreak: 3,         // >= 3 is OK
        lossStreak: 3,        // <= 3 is OK
        maxDrawdown: 20,      // <= 20% is OK
        maxRunup: 10          // >= 10% is OK
    };
    const okWinrate = (detailed.winrate || 0) >= thresholds.winrate;
    const okProfitFactor = parseNum(detailed.profitFactor) >= thresholds.profitFactor;
    const okAvgRR = parseNum(detailed.avgRiskToReward) >= thresholds.avgRR;
    const okSharpe = parseNum(detailed.sharpeRatio) >= thresholds.sharpe;
    const okWinStreak = (detailed.maxConsecutiveWins || 0) >= thresholds.winStreak;
    const okLossStreak = (detailed.maxConsecutiveLosses || 0) <= thresholds.lossStreak;
    const okMaxDrawdown = (detailed.maxDrawdown || 0) <= thresholds.maxDrawdown;
    const okMaxRunup = (maxRunup || 0) >= thresholds.maxRunup;
    const iconCheck = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17 4.83 12 3.41 13.41 9 19 21 7l-1.41-1.41z"/></svg>';
    const iconCross = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M18.3 5.71 12 12.01 5.71 5.71 4.29 7.12 10.59 13.41 4.29 19.71 5.71 21.12 12 14.83 18.3 21.12 19.71 19.71 13.41 13.41 19.71 7.12z"/></svg>';
    const byWeekday = L._breakdownByWeekday(positions, profitOf);
    const byHour = L._breakdownByHour(positions, profitOf);

    // Equity curve and overlays (run-up/drawdown) for Lightweight Charts using real entry/exit times
    let equity = L.session.capital;
    const equityPoints = [];
    const runUpPoints = [];
    const drawDownPoints = [];
    let lastTimeSec = null;
    const toSec = (t) => {
        if (!t) return null;
        if (typeof t === 'number') {
            if (t > 1e12) return Math.floor(t / 1000); // ms -> s
            if (t > 1e9) return Math.floor(t); // already seconds
            // too small, assume milliseconds (older/smaller values)
            return Math.floor(t / 1000);
        }
        const d = new Date(t);
        const ms = d.getTime();
        return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
    };
    // Seed with an initial point just before the first valid trade time
    for (let i=0;i<closed.length;i++) {
        const sec = toSec(closed[i].entryTime || closed[i].exitTime);
        if (sec && Number.isFinite(sec)) { lastTimeSec = sec - 1; equityPoints.push({ time: lastTimeSec, value: equity }); runUpPoints.push({ time: lastTimeSec, value: equity }); drawDownPoints.push({ time: lastTimeSec, value: equity }); break; }
    }
    for (let i=0;i<closed.length;i++) {
        const sec = toSec(closed[i].entryTime || closed[i].exitTime);
        if (!Number.isFinite(sec)) continue; // skip if invalid time
        const timeSec = (lastTimeSec !== null && sec <= lastTimeSec) ? lastTimeSec + 1 : sec;
        const p = closed[i];
        const entryEquity = equity;
        const profit = Number(profitOf(p)) || 0;
        const risk = Number(p.getRisk && p.getRisk(true)) || 0;
        const isBE = L.isBreakEvenTrade(p, profitOf);
        // Drawdown overlay: exclude BE trades entirely; include MAE for non-losing & non-BE
        let troughWithin = entryEquity + profit; // default realized result
        if(!isBE){
            const dd = Number(p.getDrawDown && p.getDrawDown(true)); // negative when valid
            if (profit > -(risk/10) && Number.isFinite(dd) && dd < 0) {
                troughWithin = entryEquity + dd;
            }
        }
        // Run-up overlay: exclude BE trades entirely; include MFE for non-winning & non-BE
        let peakWithin = entryEquity + profit;
        if(!isBE){
            const ru = Number(p.getRunUp && p.getRunUp(true)); // positive
            if (profit < (risk/10) && Number.isFinite(ru) && ru > 0) {
                peakWithin = entryEquity + ru;
            }
        }
        if(!isBE){
            runUpPoints.push({ time: timeSec, value: peakWithin });
            drawDownPoints.push({ time: timeSec, value: troughWithin });
        } else {
            // replicate last overlay point to keep time continuity without altering extremes
            if(runUpPoints.length){ runUpPoints.push({ time: timeSec, value: runUpPoints[runUpPoints.length-1].value }); }
            if(drawDownPoints.length){ drawDownPoints.push({ time: timeSec, value: drawDownPoints[drawDownPoints.length-1].value }); }
        }
        // Equity progression always includes profit
        equity += profit;
        equityPoints.push({ time: timeSec, value: equity });
        lastTimeSec = timeSec;
    }
    if (!equityPoints.length) {
        // fallback to now if no valid times found
        const nowSec = Math.floor(Date.now()/1000);
        equityPoints.push({ time: nowSec, value: equity });
        runUpPoints.push({ time: nowSec, value: equity });
        drawDownPoints.push({ time: nowSec, value: equity });
        lastTimeSec = nowSec;
    }

    // Compute MAR (always finite) for the tile using unified helper
    let marRatio = null;
    try {
        marRatio = (function(){
            const pts = equityPoints.slice().sort((a,b)=> a.time - b.time);
            return _calcMar(pts);
        })();
    } catch(_e) { /* ignore */ }

    // Build overlay container (using a backdrop to allow outside-click close)
    $(".session-stats-backdrop").remove();
    const shell = $(`
        <div class="session-stats-backdrop" style="position:fixed; inset:0; z-index:147; background-color: rgba(0,0,0,0.5); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);"></div>
    `);
        const viewer = $(`
            <div class="session-stats-viewer" style="position:fixed; top:50%; left:50%; transform: translate(-50%, -50%); width:96%; height:96%; z-index:146; background:var(--tv-color-platform-background,var(--color-popup-background, #0c0e12)); border:1px solid var(--tv-color-line-divider,#2a2e39); box-shadow:0 10px 30px rgba(0,0,0,0.5); border-radius:8px; display:flex; flex-direction:column;">
            <div style="display:flex; align-items:center; padding:8px 12px; border-bottom:1px solid var(--tv-color-line-divider,#2a2e39);">
                <div style="font-weight:600; font-size:14px;">eBacktesting Session: ${L.session.name || ''}</div>
                <div style="flex:1"></div>
                <button class="lightButton secondary xsmall typography-regular14px stats-screenshot" title="Copy & download a screenshot of the current stats" style="cursor:pointer; margin-right:6px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" style="vertical-align:middle; margin-right:6px;"><g fill="none" fill-rule="evenodd" stroke="currentColor"><path d="M13.111 18.5H10.5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-8.389z"></path><path d="M18.5 20v1.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H8"></path></g></svg>
                    Copy image
                </button>
                <button class="lightButton secondary xsmall typography-regular14px stats-export" title="Export all positions to Excel (as they appear in the eBacktesting journal panel)" style="cursor:pointer;">
                   <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" style="vertical-align: middle;margin-right:6px;"><path stroke="currentColor" d="M6.5 16v4.5a1 1 0 001 1h14a1 1 0 001-1V16M14.5 5V17m-4-3.5l4 4l4-4"></path></svg>
                   Export
                </button>
            </div>
                                    <style>
                            /* Responsive grids */
                            .session-stats-viewer { display:flex; flex-direction:column; }
                            .session-stats-viewer .metrics-grid { display:grid; gap:0px 6px; grid-template-columns: repeat(12, 1fr); grid-auto-rows: minmax(50px, auto); align-content:start; align-items:start; padding:8px 12px; }
                            .session-stats-viewer .charts-grid { display:grid; gap:12px; grid-template-columns: repeat(12, 1fr); grid-auto-rows: 1fr; align-content:stretch; align-items:stretch; flex:1 1 auto; overflow:auto; padding:8px 12px; }
                            .session-stats-viewer .chart-tile { overflow:hidden; position:relative; isolation:isolate; contain:paint; display:grid; grid-template-rows: 24px 1fr; background: var(--tv-color-platform-background,var(--color-popup-background, #0c0e12)); height:auto; }
                                                    .session-stats-viewer .chart-header { display:grid; grid-template-columns: 1fr; align-items:center; }
                                                    .session-stats-viewer .chart-title { opacity:.8; font-size:12px; padding-left:8px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
                                                    .session-stats-viewer .chart-title .expand-icon { width:12px; height:12px; opacity:.7; }
                                                    .session-stats-viewer .chart-title:hover .expand-icon { opacity:1; }
                                                      .session-stats-viewer .chart-container { width:100%; height:100%; position:relative; overflow:hidden; min-height: 120px; box-sizing: border-box; padding-bottom: 1.25em; }
                                                      .session-stats-viewer .stats-large-overlay .chart-host { box-sizing: border-box; padding-bottom: 1.25em; }
                            /* Hide TradingView attribution/logo strictly inside stats overlay */
                            .session-stats-backdrop .session-stats-viewer .chart-container .tv-attr-logo,
                            .session-stats-backdrop .session-stats-viewer .chart-container [class^="tv-attr"],
                            .session-stats-backdrop .session-stats-viewer .chart-container [class*="tv-attr"],
                            .session-stats-backdrop .session-stats-viewer .chart-container a[href*="tradingview.com"],
                            .session-stats-backdrop .session-stats-viewer .stats-large-overlay .tv-attr-logo,
                            .session-stats-backdrop .session-stats-viewer .stats-large-overlay [class^="tv-attr"],
                            .session-stats-backdrop .session-stats-viewer .stats-large-overlay [class*="tv-attr"],
                            .session-stats-backdrop .session-stats-viewer .stats-large-overlay a[href*="tradingview.com"],
                            .session-stats-backdrop .session-stats-viewer .chart-container [data-name="logo"] {
                                display: none !important;
                                pointer-events: none !important;
                            }
                            /* Tile heights are controlled by charts-grid row sizing; Monte Carlo spans two rows */
                            .session-stats-viewer .tile-equity { height:auto; min-height: 24px; }
                            .session-stats-viewer .tile-small  { height:auto; min-height: 24px; }
                            @media (max-width: 1400px) {
                                .session-stats-viewer .metrics-grid { grid-template-columns: repeat(6, 1fr); }
                                .session-stats-viewer .charts-grid { grid-template-columns: repeat(6, 1fr); }
                                .session-stats-viewer .span-12 { grid-column: span 6 !important; }
                                .session-stats-viewer .span-6 { grid-column: span 6 !important; }
                                .session-stats-viewer .span-3 { grid-column: span 3 !important; }
                            }
                            @media (max-width: 900px) {
                                .session-stats-viewer .metrics-grid { grid-template-columns: repeat(1, 1fr); }
                                .session-stats-viewer .charts-grid { grid-template-columns: repeat(1, 1fr); grid-auto-rows: minmax(180px, 1fr); }
                                .session-stats-viewer .span-12,
                                .session-stats-viewer .span-6,
                                .session-stats-viewer .span-3 { grid-column: span 1 !important; }
                                /* Row-based sizing manages heights in single column */
                            }
                            /* Stat OK/NOK indicator */
                            .session-stats-viewer .stat-flag { display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:50%; margin-left:6px; vertical-align:middle; }
                            .session-stats-viewer .stat-flag.ok { background: rgba(0, 200, 83, .15); color:#00C853; }
                            .session-stats-viewer .stat-flag.nok { background: rgba(244, 67, 54, .15); color:#F44336; }
                            .session-stats-viewer h2 { margin-top: 5px; font-size: 1.3em; }
                        </style>
                        <div class="metrics-grid stats-grid">
                        <div class="metric-winrate" style="grid-column: span 3; cursor:pointer;" title="Winrate = percent of trades that made money (ignoring tiny results < 0.1R).">
                    <div style="opacity:0.7; font-size:12px;">Winrate</div>
                                    <div style="font-size:16px;">${detailed.winratePercent}</div>
                </div>
                <div class="metric-profit-factor" style="grid-column: span 3; cursor:pointer;" title="Profit factor = gross profit / gross loss. Higher is better (must be > 1).">
                    <div style="opacity:0.7; font-size:12px;">Profit factor</div>
                    <div style="font-size:16px;">${detailed.profitFactor}<span class="stat-flag ${okProfitFactor ? 'ok' : 'nok'}">${okProfitFactor ? iconCheck : ""}</span></div>
                </div>
                <div class="metric-avg-rr" style="grid-column: span 3; cursor:pointer;" title="Average risk:reward per trade (avg win / avg loss). Higher is better.">
                    <div style="opacity:0.7; font-size:12px;">Average R:R</div>
                                    <div style="font-size:16px;">${detailed.avgRiskToReward}</div>
                </div>
                <div class="metric-sharpe" style="grid-column: span 3; cursor:pointer;" title="Sharpe ratio (simplified here): average return / volatility. Higher is better.">
                    <div style="opacity:0.7; font-size:12px;">Sharpe ratio</div>
                    <div style="font-size:16px;">${detailed.sharpeRatio}<span class="stat-flag ${okSharpe ? 'ok' : 'nok'}">${okSharpe ? iconCheck : ""}</span></div>
                </div>

                <div style="grid-column: span 3;" title="Number of closed trades with profit (>= 0.1R).">
                    <div style="opacity:0.7; font-size:12px;">Winning trades</div>
                    <div style="font-size:16px;">${detailed.winningTrades}</div>
                </div>
                <div style="grid-column: span 3;" title="Number of closed trades with loss (<= -0.1R).">
                    <div style="opacity:0.7; font-size:12px;">Losing trades</div>
                    <div style="font-size:16px;">${detailed.losingTrades}</div>
                </div>
                <div style="grid-column: span 3;" title="Number of closed trades near breakeven (between -0.1R and +0.1R).">
                    <div style="opacity:0.7; font-size:12px;">BE trades</div>
                    <div style="font-size:16px;">${detailed.breakevenTrades}</div>
                </div>
                <div class="metric-avg-duration" style="grid-column: span 3; cursor:pointer;" title="Average time a trade stays open (entry to exit).">
                    <div style="opacity:0.7; font-size:12px;">Avg trade duration</div>
                    <div style="font-size:16px;">${avgDuration}</div>
                </div>

                <div class="metric-win-streak" style="grid-column: span 3; cursor:pointer;" title="Longest run of consecutive winning trades."><div style=\"opacity:0.7; font-size:12px;\">Win streak</div><div style=\"font-size:16px;\">${detailed.maxConsecutiveWins}</div></div>
                <div class="metric-loss-streak" style="grid-column: span 3; cursor:pointer;" title="Longest run of consecutive losing trades.">
                    <div style="opacity:0.7; font-size:12px;">Loss streak</div>
                    <div style="font-size:16px;">${detailed.maxConsecutiveLosses}</div>
                </div>
                <div class="metric-max-dd" style="grid-column: span 3; cursor:pointer;" title="Largest peak-to-trough equity drop (includes intra-trade MAE for non-losing trades). Lower is better.">
                    <div style="opacity:0.7; font-size:12px;">Max drawdown</div>
                    <div style="font-size:16px;">${detailed.maxDrawdownPercent} <span style="opacity:.75; font-size:12px;">( ${(detailed.maxDrawdownAmount||0).toFixed(2)} ${L.session.currencyId||''} )</span></div>
                </div>
                <div class="metric-max-ru" style="grid-column: span 3; cursor:pointer;" title="Largest trough-to-peak equity rise (includes intra-trade MFE for non-winning trades). Higher is better.">
                    <div style="opacity:0.7; font-size:12px;">Max run-up</div>
                    <div style="font-size:16px;">${maxRunup.toFixed(1)}% <span style="opacity:.75; font-size:12px;">( ${maxRunupAmount.toFixed(2)} ${L.session.currencyId||''} )</span></div>
                </div>

                

                <div class="metric-opt-sl" style="grid-column: span 3; cursor:pointer;" title="The percent-based SL size that would have yielded the highest net profit if it had been applied to all trades.">
                    <div style="opacity:0.7; font-size:12px;">Optimal SL size</div>
                    <div style="font-size:16px;">${Number.isFinite(optSL) ? (optSL * 100).toFixed(0) + '%' : 'N/A'}
                        ${optSlIsOk ? '<span class="stat-flag ok" title="100% means your current (average) SL size is effectively optimal. Making it larger would have added unnecessary loss on stopped trades; making it smaller would have increased premature stop-outs before reaching targets, hurting overall performance.">'+iconCheck+'</span>' : ''}
                    </div>
                </div>

                <div class="metric-opt-tp" style="grid-column: span 3; cursor:pointer;" title="The optimal take-profit as a percentage of each trade's original TP (per-position scaling) that yields the highest net profit.">
                    <div style="opacity:0.7; font-size:12px;">Optimal TP</div>
                    <div style="font-size:16px;">${Number.isFinite(optTP) ? (optTP * 100).toFixed(0) + '%' : 'N/A'}
                        ${optTpIsOk ? '<span class="stat-flag ok" title="100% means your current TP sizing is effectively optimal relative to each trade\'s original TP target. Increasing it would have left more unrealized gains on the table as fewer trades reached the higher target; decreasing it would have cut winners too early, lowering overall performance.">'+iconCheck+'</span>' : ''}
                    </div>
                </div>

                <div class="metric-mar" style="grid-column: span 3; cursor:pointer;" title="Compounded annual growth rate (CAGR) of the strategy since inception divided by its largest drawdown. Higher is better.">
                    <div style="opacity:0.7; font-size:12px;">MAR (CAGR / Max DD)</div>
                    <div style="font-size:16px;">${(function(){
                        const fmt = (v)=>{ if (v===Infinity) return '∞'; if (v===-Infinity) return '-∞'; return Number.isFinite(v)? v.toFixed(2) : 'N/A'; };
                        try { return fmt(marRatio); } catch(_e){ return 'N/A'; }
                    })()}</div>
                </div>

                </div>
                <div class="charts-grid">
                <div class="chart-tile span-12 tile-equity" style="grid-column: span 12; grid-row: span 2; border:1px solid var(--tv-color-line-divider,#2a2e39); border-radius:6px; padding:8px; overflow:hidden;" id="ebt-chart-montecarlo-main">
                    <div class="chart-header">
                        <div class="chart-title">Overall performance <span class="expand-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h7v2H7v10h10v-5h2v7H5V5Z"/></svg></span></div>
                    </div>
                    <div class="chart-container"></div>
                </div>

                <div class="chart-tile span-6 tile-small" style="grid-column: span 6; border:1px solid var(--tv-color-line-divider,#2a2e39); border-radius:6px; padding:8px; overflow:hidden;" id="ebt-chart-weekday">
                    <div class="chart-header">
                        <div class="chart-title">Profits by weekday <span class="expand-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h7v2H7v10h10v-5h2v7H5V5Z"/></svg></span></div>
                    </div>
                    <div class="chart-container"></div>
                </div>
                <div class="chart-tile span-6 tile-small" style="grid-column: span 6; border:1px solid var(--tv-color-line-divider,#2a2e39); border-radius:6px; padding:8px; overflow:hidden;" id="ebt-chart-hour">
                    <div class="chart-header">
                        <div class="chart-title">Profits by hour <span class="expand-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h7v2H7v10h10v-5h2v7H5V5Z"/></svg></span></div>
                    </div>
                    <div class="chart-container"></div>
                </div>

                <div class="chart-tile span-6 tile-small" style="grid-column: span 6; border:1px solid var(--tv-color-line-divider,#2a2e39); border-radius:6px; padding:8px; overflow:hidden;" id="ebt-chart-daily">
                    <div class="chart-header">
                        <div class="chart-title">Daily profit <span class="expand-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h7v2H7v10h10v-5h2v7H5V5Z"/></svg></span></div>
                    </div>
                    <div class="chart-container"></div>
                </div>
                <div class="chart-tile span-6 tile-small" style="grid-column: span 6; border:1px solid var(--tv-color-line-divider,#2a2e39); border-radius:6px; padding:8px; overflow:hidden;" id="ebt-chart-weekly">
                    <div class="chart-header">
                        <div class="chart-title">Weekly profit <span class="expand-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h7v2H7v10h10v-5h2v7H5V5Z"/></svg></span></div>
                    </div>
                    <div class="chart-container"></div>
                </div>
                <div class="chart-tile span-6 tile-small" style="grid-column: span 6; border:1px solid var(--tv-color-line-divider,#2a2e39); border-radius:6px; padding:8px; overflow:hidden;" id="ebt-chart-monthly">
                    <div class="chart-header">
                        <div class="chart-title">Monthly profit <span class="expand-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h7v2H7v10h10v-5h2v7H5V5Z"/></svg></span></div>
                    </div>
                    <div class="chart-container"></div>
                </div>
                <div class="chart-tile span-6 tile-small" style="grid-column: span 6; border:1px solid var(--tv-color-line-divider,#2a2e39); border-radius:6px; padding:8px; overflow:hidden;" id="ebt-chart-trades-week">
                    <div class="chart-header">
                        <div class="chart-title">Trades per week <span class="expand-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h7v2H7v10h10v-5h2v7H5V5Z"/></svg></span></div>
                    </div>
                    <div class="chart-container"></div>
                </div>
            </div>
            <div class="chart-tile span-12 tile-small" style="grid-column: span 12; padding:10px; overflow:hidden; min-height: 50px; height: 50px; display: block;" id="ebt-tile-costs">
                    <div class="chart-header">
                        <div class="chart-title">Trading costs impact (spreads + commissions) <span class="help-icon" title="Click to read more" style="display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:50%; background:rgba(255,255,255,0.08); color:inherit; font-weight:700; font-size:12px;">?</span></div>
                    </div>
                    <div class="chart-container" style="display:flex; flex-direction:column; gap:8px; padding:8px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <input type="range" min="0" max="20" step="0.5" class="ebt-cost-slider" style="flex:1;" />
                            <div style="text-align:right;">-<span class="ebt-cost-value">0%</span> impact</div>
                        </div>
                    </div>
                </div>
        </div>
    `);
    shell.append(viewer);
    $('body').append(shell);
    // If advanced metrics are gated, blur the backdrop and close after user acknowledges
    if (gateAdvanced) {
        try {
            const $backdrop = $(".session-stats-backdrop");
            $backdrop.css({ 'filter': 'blur(5px)', '-webkit-filter': 'blur(5px)' });
        } catch(_e) { /* noop */ }
        L.messageBox("Feature disabled", "Unable to show the advanced statistics: please subscribe to a free plan or start a free trial on eBacktesting.com", () => {
            try { shell.remove(); } catch(_e) {}
        });
    }
    // Initialize CSS variable for overlay height to drive tile heights
    const setViewerHeightVar = () => {
        const r = viewer[0].getBoundingClientRect();
        viewer.css('--viewer-h', r.height + 'px');
    };
    setViewerHeightVar();
    // Set initial size similar to previous max caps while respecting viewport
    try {
        const vw = window.innerWidth || 0;
        const vh = window.innerHeight || 0;
        const targetW = Math.min(Math.floor(vw * 0.96), 2000);
        const targetH = Math.min(Math.floor(vh * 0.96), 1500);
        viewer.css({ width: targetW + 'px', height: targetH + 'px' });
    } catch(_e) { /* ignore */ }
    // Keep in sync on window resize
    const onWindowResizeViewerVar = () => setViewerHeightVar();
    window.addEventListener('resize', onWindowResizeViewerVar);
    // Track content grid height for better chart fill
    const statsGridEl = viewer.find('.stats-grid')[0];
    if (window.ResizeObserver && statsGridEl) {
        const roGrid = new ResizeObserver(() => {
            const r = statsGridEl.getBoundingClientRect();
            viewer.css('--content-h', r.height + 'px');
        });
        roGrid.observe(statsGridEl);
        // Set initial content height var
        const r0 = statsGridEl.getBoundingClientRect();
        viewer.css('--content-h', r0.height + 'px');
    }
    viewer.find('.stats-export').on('click', async (e)=>{
        e.preventDefault();
        const btn = $(e.currentTarget);
        // Show a lightweight spinner overlay near the button
        btn.hide();
        const spinner = $(`
            <span class="ebt-spin" style="margin-right:10px">
                <svg class="spin" width="14" height="14" viewBox="0 0 24 24" style="animation: ebtspin 1s linear infinite;">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.2"/>
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="2" fill="none"/>
                </svg>
            </span>`);
        // Keyframes only within this viewer shell to avoid global CSS pollution
        const style = $(`<style>@keyframes ebtspin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>`);
        viewer.append(style);
        btn.after(spinner);
        // Delay slightly so spinner renders before heavy work
        setTimeout(async () => {
            try {
                await L.exportStats();
            } catch (err) {
                console.error('Export failed', err);
                L.toast('Export failed. Please try again.', 3000);
            } finally {
                // Remove spinner and re-enable button
                btn.show();
                viewer.find('.ebt-spin').remove();
            }
        }, 100);
    });
    // Screenshot button: capture entire stats popup, copy to clipboard, and download (with spinner)
    viewer.find('.stats-screenshot').on('click', async (e)=>{
        e.preventDefault();
            // Show a lightweight spinner overlay near the button
            const btn = $(e.currentTarget);
            btn.hide();
            const spinner = $(`
                <span class="ebt-spin" style="margin-right:10px">
                    <svg class="spin" width="14" height="14" viewBox="0 0 24 24" style="animation: ebtspin 1s linear infinite;">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.2"/>
                        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="2" fill="none"/>
                    </svg>
                </span>`);
            // Keyframes only within this viewer shell to avoid global CSS pollution
            const style = $(`<style>@keyframes ebtspin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>`);
            viewer.append(style);
            btn.after(spinner);
            setTimeout(async () => {
                try {
                    const el = viewer[0];
                    // Temporarily ensure charts are fully visible and no overlays obscure content
                    const dpr = Math.min(window.devicePixelRatio || 1, 2);
                    const canvas = await html2canvas(el, {
                        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--tv-color-platform-background').trim() || '#0c0e12',
                        scale: dpr,
                        useCORS: true,
                        logging: false,
                        windowWidth: document.documentElement.scrollWidth,
                        windowHeight: document.documentElement.scrollHeight
                    });
                    // Convert to blob
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                    if (!blob) throw new Error('Failed to generate PNG');
                    // Try copy to clipboard (requires secure context and permissions)
                    let copied = false;
                    try {
                        if (navigator.clipboard && window.ClipboardItem) {
                            const item = new ClipboardItem({ 'image/png': blob });
                            await navigator.clipboard.write([item]);
                            copied = true;
                        }
                    } catch(_e) {
                        copied = false;
                    }
                    // Trigger download
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const ts = new Date().toISOString().replace(/[:T]/g,'-').replace(/\..+/, '');
                    // Sanitize session name for Windows filenames
                    const rawName = String((L.session && L.session.name) || 'session');
                    let safeName = rawName
                        .replace(/[\\/:*?"<>|]+/g, '-') // replace forbidden chars with '-'
                        .replace(/\s+/g, ' ') // collapse whitespace
                        .trim()
                        .replace(/[\. ]+$/g, ''); // remove trailing dots/spaces
                    if (!safeName) safeName = 'session';
                    const reserved = new Set(['CON','PRN','AUX','NUL','COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9','LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9']);
                    if (reserved.has(safeName.toUpperCase())) safeName = `${safeName}_`;
                    safeName = safeName.slice(0, 80);
                    a.href = url;
                    a.download = `eBacktesting-stats-${safeName}.png`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(()=>{ try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch(_e){} }, 0);
                    // Toast feedback
                    if (copied) L.toast('Screenshot copied to clipboard and downloaded.', 3000); else L.toast('Screenshot downloaded. Clipboard copy may be blocked by browser.', 3000);
                } catch(err) {
                    console.error('Screenshot failed', err);
                    L.messageBox('Screenshot failed', 'Could not create the screenshot. Please try again.');
                } finally {
                    // Remove spinner and re-enable button
                    const btn = viewer.find('.stats-screenshot');
                    btn.show();
                    viewer.find('.ebt-spin').remove();
                }
            }, 100);
    });
    // Close only when clicking on the backdrop itself, or pressing Esc
    let shellDownOnBackdrop = false;
    shell.on('mousedown', (e)=> { shellDownOnBackdrop = (e.target === shell[0]); });
    shell.on('click', (e)=> { if (e.target === shell[0] && shellDownOnBackdrop) { shell.remove(); } });
    const onEsc = (e) => {
        if (e.key === 'Escape') {
            const topLarge = shell.find('.stats-large-overlay');
            if (topLarge.length) topLarge.remove(); else shell.remove();
        }
    };
    $(document).on('keydown.statsEsc', onEsc);
    shell.on('remove', ()=> {
        $(document).off('keydown.statsEsc', onEsc);
        window.removeEventListener('resize', onWindowResizeViewerVar);
    });
    // Enable resizing by dragging any corner (no visible handles; cursor changes near corners)
    (function enableCornerResize(){
        const el = viewer[0];
        if (!el) return;
        const edge = 12; // px hotspot size for corners
    const minW = 600, minH = 380; // sensible minimums
    let maxW = Infinity, maxH = Infinity; // allow beyond previous max; viewport will still bound
        let resizing = null; // { corner, startX, startY, startW, startH, startL, startT }

        const getCorner = (x, y) => {
            const r = el.getBoundingClientRect();
            const nearLeft = (x - r.left) <= edge;
            const nearRight = (r.right - x) <= edge;
            const nearTop = (y - r.top) <= edge;
            const nearBottom = (r.bottom - y) <= edge;
            if (nearLeft && nearTop) return 'nw';
            if (nearRight && nearTop) return 'ne';
            if (nearLeft && nearBottom) return 'sw';
            if (nearRight && nearBottom) return 'se';
            return null;
        };
        const cursorFor = (corner) => {
            if (!corner) return '';
            return (corner === 'nw' || corner === 'se') ? 'nwse-resize' : 'nesw-resize';
        };
        const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

        const onMoveHover = (e) => {
            if (resizing) return; // cursor handled in active resize
            const c = getCorner(e.clientX, e.clientY);
            el.style.cursor = cursorFor(c);
        };
        const beginResize = (e) => {
            const c = getCorner(e.clientX, e.clientY);
            if (!c) return;
            e.preventDefault(); e.stopPropagation();
            const r = el.getBoundingClientRect();
            // If centered via transform, switch to absolute pixel positioning for resizing
            const computed = getComputedStyle(el);
            const hasTransform = (computed.transform && computed.transform !== 'none');
            if (hasTransform) {
                el.style.transform = 'none';
                el.style.left = r.left + 'px';
                el.style.top = r.top + 'px';
            }
            resizing = {
                corner: c,
                startX: e.clientX,
                startY: e.clientY,
                startW: r.width,
                startH: r.height,
                startL: r.left,
                startT: r.top,
                centerX: r.left + r.width / 2,
                centerY: r.top + r.height / 2
            };
            document.addEventListener('mousemove', onResizing, true);
            document.addEventListener('mouseup', endResize, true);
        };
        const onResizing = (e) => {
            if (!resizing) return;
            const dx = e.clientX - resizing.startX;
            const dy = e.clientY - resizing.startY;
            // Resize symmetrically to keep center fixed
            const signX = (resizing.corner === 'se' || resizing.corner === 'ne') ? 1 : -1;
            const signY = (resizing.corner === 'se' || resizing.corner === 'sw') ? 1 : -1;
            let newW = resizing.startW + 2 * signX * dx;
            let newH = resizing.startH + 2 * signY * dy;
            // Constrain minimum sizes
            newW = Math.max(minW, newW);
            newH = Math.max(minH, newH);
            // Keep within viewport while maintaining center
            const vw = window.innerWidth, vh = window.innerHeight;
            const maxWByViewport = 2 * Math.min(resizing.centerX, vw - resizing.centerX);
            const maxHByViewport = 2 * Math.min(resizing.centerY, vh - resizing.centerY);
            if (Number.isFinite(maxWByViewport) && maxWByViewport > 0) newW = Math.min(newW, maxWByViewport);
            if (Number.isFinite(maxHByViewport) && maxHByViewport > 0) newH = Math.min(newH, maxHByViewport);
            const newL = Math.round(resizing.centerX - newW / 2);
            const newT = Math.round(resizing.centerY - newH / 2);
            el.style.width = Math.round(newW) + 'px';
            el.style.height = Math.round(newH) + 'px';
            el.style.left = newL + 'px';
            el.style.top = newT + 'px';
            el.style.cursor = cursorFor(resizing.corner);
            e.preventDefault();
        };
        const endResize = (e) => {
            if (!resizing) return;
            document.removeEventListener('mousemove', onResizing, true);
            document.removeEventListener('mouseup', endResize, true);
            el.style.cursor = '';
            resizing = null;
            if (e) { try { e.preventDefault(); e.stopPropagation(); } catch(_e){} }
        };
        el.addEventListener('mousemove', onMoveHover);
        el.addEventListener('mousedown', beginResize);
        // Cleanup when shell is removed
        shell.on('remove', ()=>{
            try {
                el.removeEventListener('mousemove', onMoveHover);
                el.removeEventListener('mousedown', beginResize);
                document.removeEventListener('mousemove', onResizing, true);
                document.removeEventListener('mouseup', endResize, true);
            } catch(_e){}
        });
    })();

    // Render small charts
    const makeChart = (el, defSeries) => {
    const container = $(el).find('.chart-container')[0];
    const rect = container.getBoundingClientRect();
    const pb0 = parseFloat(getComputedStyle(container).paddingBottom||'0') || 0; // computed px for em-based padding
            const chart = createChart(container, {
                width: rect.width,
                height: Math.max(0, rect.height - pb0),
                layout:{ background:{ type:'solid', color:'transparent' }, textColor: getComputedStyle(document.documentElement).getPropertyValue('--color-toolbar-button-text-hover').trim() || '#d1d4dc' },
                grid: { vertLines: { visible: false }, horzLines: { visible: false } },
                leftPriceScale: { visible: false },
                rightPriceScale:{ borderVisible:false },
                timeScale:{ borderVisible:false }
            });
        for (const s of defSeries) {
            // Defaults keep labels hidden unless the series explicitly enables them
            let base = Object.assign({ lastValueVisible: false, priceLineVisible: false }, s.options || {});
            let series;
            if (s.type === 'area') series = chart.addAreaSeries(base);
            else if (s.type === 'histogram') series = chart.addHistogramSeries(base);
            else series = chart.addLineSeries(base);
            series.setData(s.data||[]);
        }
        chart.timeScale().fitContent();
        // If this chart includes a primary area series followed by series with future-only points (forecast),
        // zoom to fit the equity history and just the start of the forecast (not the full forecast)
        try {
            const primary = (defSeries[0] && defSeries[0].data) ? defSeries[0].data : null;
            if (primary && primary.length > 1) {
                const from = primary[0].time;
                const lastEq = primary[primary.length - 1].time;
                // Find earliest forecast time and step from any subsequent series
                let firstFuture = Infinity;
                let step = NaN;
                for (let i = 1; i < defSeries.length; i++) {
                    const d = defSeries[i].data || [];
                    for (let j = 0; j < d.length; j++) {
                        const t = d[j].time;
                        if (t > lastEq) {
                            if (t < firstFuture) {
                                firstFuture = t;
                                // try infer step as next point in same series
                                if (j + 1 < d.length) {
                                    const t2 = d[j + 1].time;
                                    if (Number.isFinite(t2)) step = t2 - t;
                                }
                            }
                            break;
                        }
                    }
                }
                if (Number.isFinite(from) && Number.isFinite(lastEq) && Number.isFinite(firstFuture) && firstFuture !== Infinity) {
                    if (!Number.isFinite(step) || step <= 0) step = Math.max(1, firstFuture - lastEq);
                    const to = lastEq + step * 3; // include only first ~3 forecast steps
                    chart.timeScale().setVisibleRange({ from, to });
                }
            }
        } catch(_e) { /* ignore if range cannot be set */ }
        // If this is the Weekday chart, format axis ticks to day names
        if (typeof title === 'string' && title.toLowerCase().includes('weekday')) {
            try {
                chart.applyOptions({
                    timeScale: {
                        tickMarkFormatter: (time) => {
                            let sec;
                            if (typeof time === 'number') {
                                sec = time;
                            } else if (time && typeof time === 'object') {
                                if (typeof time.timestamp === 'number') sec = time.timestamp;
                                else if (typeof time.year === 'number') sec = Math.floor(Date.UTC(time.year, (time.month||1)-1, time.day||1)/1000);
                            }
                            if (!Number.isFinite(sec)) return '';
                            const d = new Date(sec * 1000);
                            return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getUTCDay()];
                        }
                    }
                });
                chart.applyOptions({
                    localization: {
                        timeFormatter: (time) => {
                            const sec = typeof time === 'number' ? time : (time && typeof time.timestamp === 'number' ? time.timestamp : null);
                            if (!Number.isFinite(sec)) return '';
                            const d = new Date(sec * 1000);
                            return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getUTCDay()];
                        }
                    }
                });
            } catch(_e) { /* ignore if formatter not supported */ }
        }
        // Keep in sync with container size
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => {
                const r = container.getBoundingClientRect();
                const w = Math.max(0, Math.floor(r.width));
                const pb = parseFloat(getComputedStyle(container).paddingBottom||'0') || 0; // computed px
                const h = Math.max(0, Math.floor(r.height - pb));
                chart.applyOptions({ width: w, height: h });
            });
            ro.observe(container);
        } else {
            window.addEventListener('resize', () => {
                const r = container.getBoundingClientRect();
                const pb = parseFloat(getComputedStyle(container).paddingBottom||'0') || 0; // computed px
                chart.applyOptions({ width: r.width, height: Math.max(0, r.height - pb) });
            });
        }
        return chart;
    };

    // Equity
    const equitySeries = [{ type:'area', data: equityPoints, options:{ lineColor:'#21c77d', topColor:'rgba(33,199,125,0.2)', bottomColor:'rgba(33,199,125,0.0)' } }];
    // Equity chart kept for potential future use; not rendered as a tile by default

    // Weekday histogram using BusinessDay times for reliable tick formatting (Mon=1970-01-05 .. Sun=1970-01-11)
    const weekdayStart = { year: 1970, month: 1, day: 5 }; // Monday
    const weekdayData = byWeekday.map((d,i)=>{
        const v = Number(d.profit.toFixed(2));
        return {
            time: { year: 1970, month: 1, day: 5 + i },
            value: v,
            color: (v < 0 ? '#ff5c7c' : v > 0 ? '#38a2ff' : '#9e9e9e')
        };
    });
    const weekdaySeries = [{ type:'histogram', data: weekdayData, options:{ color:'#38a2ff', priceFormat:{ type:'price', precision:2, minMove:0.01 } } }];
    const weekdayChart = makeChart($('#ebt-chart-weekday')[0], weekdaySeries);
    // Show weekday names on axis
    try {
        weekdayChart.applyOptions({
            timeScale: {
                tickMarkFormatter: (time) => {
                    let sec;
                    if (typeof time === 'number') {
                        sec = time;
                    } else if (time && typeof time === 'object') {
                        if (typeof time.timestamp === 'number') sec = time.timestamp;
                        else if (typeof time.year === 'number') sec = Math.floor(Date.UTC(time.year, (time.month||1)-1, time.day||1)/1000);
                    }
                    if (!Number.isFinite(sec)) return '';
                    const d = new Date(sec * 1000);
                    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getUTCDay()];
                }
            }
        });
        weekdayChart.applyOptions({
            localization: {
                timeFormatter: (time) => {
                    const sec = typeof time === 'number' ? time : (time && typeof time.timestamp === 'number' ? time.timestamp : null);
                    if (!Number.isFinite(sec)) return '';
                    const d = new Date(sec * 1000);
                    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getUTCDay()];
                }
            }
        });
    } catch(_e) { /* ignore if formatter not supported */ }

    // Hour histogram 0..23 mapped to time = base + hour*3600
    const hourBase = 0;
    const hourData = byHour.map((d)=>{
        const v = Number(d.profit.toFixed(2));
        return { time: hourBase + d.hour*3600, value: v, color: (v < 0 ? '#ff5c7c' : v > 0 ? '#ff9f38' : '#9e9e9e') };
    });
    const hourSeries = [{ type:'histogram', data: hourData, options:{ color:'#ff9f38', priceFormat:{ type:'price', precision:2, minMove:0.01 } } }];
    const hourChart = makeChart($('#ebt-chart-hour')[0], hourSeries);
    // Show hour-of-day labels (0..23) on axis and crosshair
    const fmtHour = (t)=> {
        const sec = (typeof t === 'number') ? t : 0;
        const h = ((sec / 3600) | 0) % 24;
        return String(h).padStart(2,'0');
    };
    hourChart.applyOptions({
        timeScale: {
            tickMarkFormatter: (t)=> fmtHour(t)
        },
        localization: {
            timeFormatter: (t)=> `${fmtHour(t)}:00`
        }
    });

    // Daily / Weekly / Monthly profit histograms
    const dailyPoints = L._aggregateByDay(closed, profitOf);
    const weeklyPoints = L._aggregateByWeek(closed, profitOf);
    const monthlyPoints = (L.generateMonthlyData(closed, profitOf) || []).map(m=>{
        const [yy,mm] = m.month.split('-').map(Number);
        return { time: Date.UTC(yy, (mm||1)-1, 1)/1000, value: Number((m.profit||0).toFixed(2)) };
    });
    // Color maps: negatives red, positives keep original series color, zeros neutral gray
    const dailyData = dailyPoints.map(p=>({ time: p.time, value: p.value, color: (p.value < 0 ? '#ff5c7c' : p.value > 0 ? '#6fbf73' : '#9e9e9e') }));
    const weeklyData = weeklyPoints.map(p=>({ time: p.time, value: p.value, color: (p.value < 0 ? '#ff5c7c' : p.value > 0 ? '#7e57c2' : '#9e9e9e') }));
    const monthlyData = monthlyPoints.map(p=>({ time: p.time, value: p.value, color: (p.value < 0 ? '#ff5c7c' : p.value > 0 ? '#26c6da' : '#9e9e9e') }));
    const weeklyTradesPoints = L._tradesPerWeek(positions);
    const dailySeries = [{ type:'histogram', data: dailyData, options:{ color:'#6fbf73', priceFormat:{ type:'price', precision:2, minMove:0.01 } } }];
    const weeklySeries = [{ type:'histogram', data: weeklyData, options:{ color:'#7e57c2', priceFormat:{ type:'price', precision:2, minMove:0.01 } } }];
    const monthlySeries = [{ type:'histogram', data: monthlyData, options:{ color:'#26c6da', priceFormat:{ type:'price', precision:2, minMove:0.01 } } }];
    const weeklyTradesSeries = [{ type:'histogram', data: weeklyTradesPoints, options:{ color:'#ffca28', priceFormat:{ type:'volume' } } }];
    makeChart($('#ebt-chart-daily')[0], dailySeries);
    makeChart($('#ebt-chart-weekly')[0], weeklySeries);
    const monthlyChart = makeChart($('#ebt-chart-monthly')[0], monthlySeries);
    // Format monthly axis to show only month name (e.g., May, Jun) instead of 'May 1'
    try {
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        monthlyChart.applyOptions({
            timeScale: {
                tickMarkFormatter: (t)=> {
                    const sec = (typeof t === 'number') ? t : (t && typeof t === 'object' && typeof t.timestamp === 'number' ? t.timestamp : null);
                    if (!Number.isFinite(sec)) return '';
                    const d = new Date(sec*1000);
                    return monthNames[d.getUTCMonth()];
                }
            },
            localization: {
                timeFormatter: (t)=> {
                    const sec = (typeof t === 'number') ? t : (t && typeof t.timestamp === 'number' ? t.timestamp : null);
                    if (!Number.isFinite(sec)) return '';
                    const d = new Date(sec*1000);
                    return monthNames[d.getUTCMonth()];
                }
            }
        });
    } catch(_e) { /* ignore if formatter unsupported */ }
    makeChart($('#ebt-chart-trades-week')[0], weeklyTradesSeries);

    // Compute and label winrates (positives/total) for daily/weekly/monthly charts
    const calcWinrate = (points) => {
        const total = Array.isArray(points) ? points.length : 0;
        const pos = total ? points.reduce((acc, p) => acc + ((Number(p.value) || 0) > 0 ? 1 : 0), 0) : 0;
        const pct = total ? Math.round((pos / total) * 100) : 0;
        return { pct, pos, total };
    };
    const wrDaily = calcWinrate(dailyPoints);
    const wrWeekly = calcWinrate(weeklyPoints);
    const wrMonthly = calcWinrate(monthlyPoints);
    const addWinrateBadge = (tileSelector, wr) => {
        const titleEl = viewer.find(tileSelector + ' .chart-title');
        titleEl.find('.wr-badge').remove();
        const text = `${wr.pct}% (${wr.pos}/${wr.total})`;
        const badge = $(`<span class="wr-badge" style="opacity:.75; font-size:12px; margin-left:8px;">${text}</span>`);
        titleEl.append(badge);
    };
    addWinrateBadge('#ebt-chart-daily', wrDaily);
    addWinrateBadge('#ebt-chart-weekly', wrWeekly);
    addWinrateBadge('#ebt-chart-monthly', wrMonthly);

    // Progression charts: Winrate (%), Profit Factor, Average R:R over time (by exit time), excluding BE trades for counts
    const closedSorted = closed.slice().sort((a,b)=> (a.exitTime||0) - (b.exitTime||0));
    let cumWins = 0, cumLosses = 0;
    let cumProfitPos = 0, cumProfitNeg = 0; // negative sum of losses
    let lastWr = null, lastPf = null, lastRR = null;
    const wrProg = [];
    const pfProg = [];
    const rrProg = [];
    // For Sharpe progression: maintain running mean and variance (Welford) on per-trade returns (profit values)
    let nSharpe = 0, meanSharpe = 0, m2Sharpe = 0;
    const sharpeProg = [];
    // For Avg duration progression: cumulative average of (exit - entry) in seconds for closed trades
    let nDur = 0, sumDur = 0;
    const durProg = [];
    for (const p of closedSorted) {
        const t = toSec(p.exitTime || p.entryTime);
        const pr = profitOf(p);
        const risk = Number(p.getRisk && p.getRisk(true)) || 0;
        const isBE = L.isBreakEvenTrade(p, profitOf);
        if (!isBE) {
            if (pr >= risk/10) { cumWins++; cumProfitPos += pr; }
            else if (pr <= -risk/10) { cumLosses++; cumProfitNeg += pr; }
        }
        const denom = (cumWins + cumLosses);
        if (denom > 0) lastWr = (cumWins / denom) * 100;
        wrProg.push({ time: t, value: (lastWr===null? null : Number(lastWr.toFixed(2))) });
        if (cumLosses > 0 && cumProfitNeg !== 0) lastPf = Math.abs(cumProfitPos / cumProfitNeg);
        pfProg.push({ time: t, value: (lastPf===null? null : Number(lastPf.toFixed(2))) });
        if (cumWins > 0 && cumLosses > 0 && cumProfitNeg !== 0) {
            const avgWin = cumProfitPos / cumWins;
            const avgLossAbs = Math.abs(cumProfitNeg) / cumLosses;
            if (avgLossAbs > 0) lastRR = avgWin / avgLossAbs;
        }
        rrProg.push({ time: t, value: (lastRR===null? null : Number(lastRR.toFixed(2))) });

        // Sharpe progression (use all returns including BE so volatility reflects reality)
        if (Number.isFinite(pr)) {
            nSharpe += 1;
            const delta = pr - meanSharpe;
            meanSharpe += delta / nSharpe;
            const delta2 = pr - meanSharpe;
            m2Sharpe += delta * delta2;
            const variance = nSharpe > 1 ? (m2Sharpe / nSharpe) : 0; // population variance to match existing L.calculateSharpeRatio
            const stdDev = Math.sqrt(variance);
            const sharpe = stdDev !== 0 ? (meanSharpe / stdDev) : null;
            sharpeProg.push({ time: t, value: sharpe === null ? null : Number(sharpe.toFixed(2)) });
        } else {
            sharpeProg.push({ time: t, value: null });
        }

        // Avg duration progression (only when trade has both entry and exit)
        if (p.entryTime && p.exitTime) {
            const durSec = (p.exitTime - p.entryTime);
            if (Number.isFinite(durSec)) {
                nDur += 1;
                sumDur += durSec;
                const avgDurSec = sumDur / nDur;
                durProg.push({ time: t, value: Number((avgDurSec/60).toFixed(2)) }); // minutes for readability
            } else {
                durProg.push({ time: t, value: null });
            }
        } else {
            durProg.push({ time: t, value: null });
        }
    }
    const wrSeries = [{ type:'line', data: wrProg.filter(p=>p.value!==null), options:{ color:'#ffd166', lineWidth:2 } }];
    const pfSeries = [{ type:'line', data: pfProg.filter(p=>p.value!==null), options:{ color:'#26c6da', lineWidth:2 } }];
    const rrSeries = [{ type:'line', data: rrProg.filter(p=>p.value!==null), options:{ color:'#7e57c2', lineWidth:2 } }];
    const sharpeSeries = [{ type:'line', data: sharpeProg.filter(p=>p.value!==null), options:{ color:'#66bb6a', lineWidth:2 } }];
    const avgDurSeries = [{ type:'line', data: durProg.filter(p=>p.value!==null), options:{ color:'#ef6c00', lineWidth:2 } }];

    // Initialize and wire the cost slider to re-render stats with new costs
    (function initCostSlider(){
        const tile = viewer.find('#ebt-tile-costs');
        const slider = tile.find('.ebt-cost-slider');
        const valueEl = tile.find('.ebt-cost-value');
        const currentAbs = Math.round(Math.abs(Number(L.statsCostPct||0)) * 100 * 10) / 10; // as % with 1 decimal
        slider.val(String(Math.min(20, Math.max(0, currentAbs))));
        valueEl.text(`${currentAbs.toFixed(1)}%`);
        const apply = (absPct) => {
            const pct = -absPct / 100; // store as negative fraction of starting capital
            L.statsCostPct = pct;
            const oldShell = shell; // keep current shell to remove after new one mounts
            setTimeout(()=> {
                L.showSessionStatistics();
                try { oldShell.remove(); } catch(_e) {}
            }, 0);
        };
        // While dragging: update label only (no full re-render to avoid flicker)
        slider.on('input', function(){
            const v = Number(this.value) || 0;
            valueEl.text(`${v.toFixed(1)}%`);
        });
        // Apply once when the user releases the slider or commits the value
        const commit = () => {
            const v = Number(slider.val()) || 0;
            apply(v);
        };
        slider.on('change', commit);
        slider.on('pointerup mouseup touchend', commit);
        // Help popup on title click
        const openCostsHelp = () => {
            const large = $(`
                <div class="stats-large-overlay" style="position:absolute; inset:0; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); display:flex; align-items:center; justify-content:center; z-index:149;">
                    <div style="position:relative; width: min(900px, 95%); max-height: 80%; overflow:auto; background: var(--tv-color-platform-background,var(--color-popup-background, #0c0e12)); border:1px solid var(--tv-color-line-divider,#2a2e39); border-radius:8px; padding:16px 20px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                            <div style="font-weight:600;">Trading costs impact (spreads + commissions)</div>
                            <div style="flex:1"></div>
                        </div>
                        <div style="font-size:12px; opacity:.9; line-height:1.5;">
                            <p>Adjust how much trading costs weigh on the portfolio over time. The slider applies a negative percentage of starting capital, distributed across all closed trades (larger-size trades incur proportionally more cost). All metrics and charts above reflect this adjustment.</p>
                            <h3 style="margin:8px 0 6px;">The costs depend a lot on:</h3>
                            <ul style="margin:0 0 10px 18px;">
                                <li>Instruments (futures vs. forex vs. stocks vs. crypto)</li>
                                <li>Trading frequency (scalping with dozens/hundreds of trades daily vs. 1–2 entries)</li>
                                <li>Position size and account size (fixed commissions vs. per contract vs. per lot)</li>
                                <li>Broker (ECN low-spread + small commission vs. market maker with wide spreads)</li>
                            </ul>
                            <h3 style="margin:8px 0 6px;">Typical ranges:</h3>
                            <ul style="margin:0 0 10px 18px;">
                                <li><strong>Medium-frequency traders</strong> (intraday, a few trades per day): around 1–3% per month; roughly −1% yearly if not very active.</li>
                                <li><strong>Very active scalpers:</strong> can be −5% to −15% monthly, sometimes more with wide spreads.</li>
                                <li><strong>Swing/position trading:</strong> usually &lt;1% yearly due to fewer trades.</li>
                            </ul>
                            <p>For active day trading (not extreme), a typical medium/long-term range is −2% to −5% of the portfolio. Values near −20% usually imply extremely high frequency trading or a costly broker.</p>
                        </div>
                    </div>
                </div>
            `);
            viewer.append(large);
            // Close on a single outside click (no need for mousedown gating)
            large.on('click', (e)=> {
                if (e.target === large[0]) {
                    try { e.stopPropagation(); e.preventDefault(); } catch(_e){}
                    large.remove();
                }
            });
            large.find('.btn-close').on('click', ()=> large.remove());
            const onEsc = (e) => { if (e.key === 'Escape') large.remove(); };
            $(document).on('keydown.costsHelpEsc', onEsc);
            large.on('remove', ()=> $(document).off('keydown.costsHelpEsc', onEsc));
        };
        // Bind title and help icon separately to avoid double-open when clicking the icon
        tile.find('.chart-title').css('cursor','pointer').on('click', openCostsHelp);
        tile.find('.help-icon').css('cursor','pointer').on('click', function(e){
            try { e.stopPropagation(); e.preventDefault(); } catch(_e){}
            openCostsHelp();
        });
    })();

    // Monte Carlo: generate quantile bands for 100 trials of next 100 trades using bootstrapped returns
    const returns = closed.map(p=>profitOf(p));
    const trials = 300; const steps = Math.min(150, Math.max(30, closed.length));
    const mcPaths = [];
    for (let t=0;t<trials;t++) {
        let val = equityPoints[equityPoints.length-1].value;
        const path=[];
        for (let s=0;s<steps;s++) {
            const inc = returns.length ? returns[Math.floor(Math.random()*returns.length)] : 0;
            val += inc;
            path.push(val);
        }
        mcPaths.push(path);
    }
    // Compute quantiles per step
    function quantile(arr, q){ const a=arr.slice().sort((x,y)=>x-y); const pos=(a.length-1)*q; const base=Math.floor(pos); const rest=pos-base; return a[base] + (a[base+1]!==undefined?rest*(a[base+1]-a[base]):0); }
    const q05=[], q50=[], q95=[];
    const startFuture = equityPoints.length ? equityPoints[equityPoints.length - 1].time : Math.floor(Date.now()/1000);
    for (let s=0;s<steps;s++) {
        const vals = mcPaths.map(p=>p[s]);
        const t = startFuture + (s+1)*86400; // daily step after last entry time
        q05.push({ time: t, value: quantile(vals, 0.05) });
        q50.push({ time: t, value: quantile(vals, 0.50) });
        q95.push({ time: t, value: quantile(vals, 0.95) });
    }
    const mcSeries = [
        { type:'area', data: equityPoints, options:{ lineColor:'#21c77d', topColor:'rgba(33,199,125,0.1)', bottomColor:'rgba(33,199,125,0.0)', lastValueVisible:true, priceLineVisible:true }},
    // Overlays: run-up (MFE for non-winners) and drawdown (MAE for non-losers)
    { type:'line', data: runUpPoints, options:{ color:'#4cc9f0', lineWidth:1, lineStyle:2, crosshairMarkerVisible:false } },
        { type:'line', data: drawDownPoints, options:{ color:'#ff5c7c', lineWidth:1, lineStyle:2, crosshairMarkerVisible:false } },
        { type:'line', data: q05, options:{ color:'#ff5c7c', lineWidth:1, crosshairMarkerVisible:false } },
        { type:'line', data: q50, options:{ color:'#cccccc', lineWidth:2, crosshairMarkerVisible:false } },
        { type:'line', data: q95, options:{ color:'#5af04cff', lineWidth:1, crosshairMarkerVisible:false } },
    ];
    // Render Monte Carlo as main chart
    makeChart($('#ebt-chart-montecarlo-main')[0], mcSeries);

    // Build hypothetical equity given a multiplier k and mode ('sl' or 'tp')
    function buildHypotheticalEquity(k, mode) {
        let eq = L.session.capital;
        const out = [];
        if (!closed.length) return out;
        // seed with first point time to align with original
        let seedTime = equityPoints.length ? equityPoints[0].time : null;
        if (seedTime != null) out.push({ time: seedTime, value: eq });
        let lastT = seedTime;
        const costEach = L._computePerTradeCost(closed.length) || 0; // per-lot cost
        for (let i=0;i<closed.length;i++) {
            const p = closed[i];
            const sec = toSec(p.entryTime || p.exitTime);
            if (!Number.isFinite(sec)) continue; // keep alignment with realized equity construction
            const t = (lastT != null && sec <= lastT) ? lastT + 1 : sec;
            const base = Number(p.getProfit && p.getProfit(true)) || 0;
            const risk = Number(p.getRisk && p.getRisk(true)) || 0;
            // cost proportional to lots
            let qty = 0; try { qty = Number(p && p.getQuantity ? p.getQuantity() : p && p.quantity); } catch(_e) { qty = Number(p && p.quantity); }
            const lots = Math.abs(qty) || 0;
            let adj = base - (costEach * lots); // default: realized minus per-lot cost
            if (Number.isFinite(risk) && risk > 0) {
                if (mode === 'sl') {
                    // Hypothetical: shrink stop to k * original distance while KEEPING the same monetary risk.
                    // That implies position size increases by factor = 1/k. If the tighter stop would have
                    // been hit (MAE >= k * risk), loss remains -risk (same monetary risk). Otherwise, profit
                    // scales up by sizeFactor because distance to targets stays the same in price terms but
                    // size is larger. Costs also scale with size.
                    const dd = Number(p.getDrawDown && p.getDrawDown(true)); // negative (MAE in currency)
                    const mae = Number.isFinite(dd) ? Math.max(0, -dd) : 0; // positive currency
                    const thresh = k * risk; // currency amount of adverse move that would hit new (tighter) stop
                    const sizeFactor = k > 0 ? (1 / k) : 1; // new size multiple
                    const newLots = lots * sizeFactor;
                    if (mae >= thresh) {
                        // Stopped out earlier: full monetary risk lost (not scaled), costs based on new size
                        adj = (-risk) - (costEach * newLots);
                    } else {
                        // Trade survives; scale profit linearly with size, subtract scaled costs
                        const scaledProfit = base * sizeFactor;
                        adj = scaledProfit - (costEach * newLots);
                    }
                } else if (mode === 'tp') {
                    const tpCur = L._getOriginalTPProfitCurrency(p);
                    const mfe = Number(p.getRunUp && p.getRunUp(true)) || 0; // currency
                    if (Number.isFinite(tpCur) && tpCur > 0) {
                        const need = k * tpCur;
                        if (mfe >= need) {
                            adj = need - (costEach * lots);
                        } else {
                            const fallback = (!p.exitReason || Math.abs(base) < (risk / 10)) ? base : -risk;
                            adj = fallback - (costEach * lots);
                        }
                    }
                }
            }
            eq += adj;
            out.push({ time: t, value: eq });
            lastT = t;
        }
        return out;
    }


    // Embedded enlarged view overlay inside the stats viewer
    const openLarge = (title, defSeries, opts) => {
                const options = Object.assign({ showForecast: true }, opts||{});
                const large = $(`
                    <div class="stats-large-overlay" style="position:absolute; inset:0; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); display:flex; align-items:center; justify-content:center; z-index:149;">
                            <div style="position:relative; width: min(1200px, 95%); height: min(80%, 700px); background: var(--tv-color-platform-background,var(--color-popup-background, #0c0e12)); border:1px solid var(--tv-color-line-divider,#2a2e39); border-radius:8px;">
                                <div style="position:absolute; top:8px; left:12px; right:12px; display:flex; align-items:center; gap:8px;">
                                    <div style="font-weight:600;">${title}</div>
                                    <div style="flex:1"></div>
                                    ${(String(title).toLowerCase().includes('overall') && options.showForecast) ? `
                                    <button class="lightButton xsmall typography-regular14px btn-randomize" title="Forecast the overall performance considering ±20% variance in trade results" style="cursor:pointer;">Forecast</button>
                                    ` : ''}
                                </div>
                                <div class="chart-host" style="position:absolute; inset:36px 8px 8px 8px;"></div>
                            </div>
                        </div>
                `);
        viewer.append(large);
    const container = large.find('.chart-host')[0];
        const rect = container.getBoundingClientRect();
        const pbLarge = parseFloat(getComputedStyle(container).paddingBottom||'0') || 0;
        const baseOpts = {
            width: rect.width,
            height: Math.max(0, rect.height - pbLarge),
            layout:{ background:{ type:'solid', color:'transparent' }, textColor:'#d1d4dc' },
            grid: { vertLines: { visible: false }, horzLines: { visible: false } },
            leftPriceScale: { visible: false },
            rightPriceScale:{ borderVisible:false },
            timeScale:{ borderVisible:false }
        };
        // Sensitivity charts: show k% on the horizontal axis
        if (typeof title === 'string' && title.toLowerCase().includes('sensitivity')) {
            baseOpts.timeScale.tickMarkFormatter = (time) => {
                const k = typeof time === 'number' ? time : (time && typeof time.timestamp === 'number' ? time.timestamp : NaN);
                if (!Number.isFinite(k)) return '';
                return `${k}%`;
            };
            baseOpts.localization = {
                timeFormatter: (time) => {
                    const k = typeof time === 'number' ? time : (time && typeof time.timestamp === 'number' ? time.timestamp : NaN);
                    if (!Number.isFinite(k)) return '';
                    return `${k}%`;
                }
            };
        }
        // If this is the Weekday chart, set axis formatters at creation time
        if (typeof title === 'string' && title.toLowerCase().includes('weekday')) {
            baseOpts.timeScale.tickMarkFormatter = (time) => {
                let sec;
                if (typeof time === 'number') sec = time; else if (time && typeof time === 'object') {
                    if (typeof time.timestamp === 'number') sec = time.timestamp;
                    else if (typeof time.year === 'number') sec = Math.floor(Date.UTC(time.year, (time.month||1)-1, time.day||1)/1000);
                }
                if (!Number.isFinite(sec)) return '';
                const d = new Date(sec * 1000);
                return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getUTCDay()];
            };
            baseOpts.localization = {
                timeFormatter: (time) => {
                    const sec = typeof time === 'number' ? time : (time && typeof time.timestamp === 'number' ? time.timestamp : null);
                    if (!Number.isFinite(sec)) return '';
                    const d = new Date(sec * 1000);
                    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getUTCDay()];
                }
            };
        }
        // If this is the Hour chart, set axis formatters to show 0..23 hours
        if (typeof title === 'string' && title.toLowerCase().includes('hour')) {
            const fmtHour = (time) => {
                let sec;
                if (typeof time === 'number') sec = time; else if (time && typeof time === 'object') {
                    if (typeof time.timestamp === 'number') sec = time.timestamp;
                }
                if (!Number.isFinite(sec)) return '';
                const h = ((sec / 3600) | 0) % 24;
                return String(h).padStart(2,'0');
            };
            baseOpts.timeScale.tickMarkFormatter = (t) => fmtHour(t);
            baseOpts.localization = {
                timeFormatter: (t) => `${fmtHour(t)}:00`
            };
        }
        const chart = createChart(container, baseOpts);
    const isOverall = String(title).toLowerCase().includes('overall');
        let area0 = null;
        let original = [];
    if (isOverall) {
            // Create our own primary area series first and keep a reference
            original = (defSeries[0] && defSeries[0].data) ? defSeries[0].data.slice() : [];
            const firstOpts = Object.assign({ lastValueVisible:true, priceLineVisible:true }, (defSeries[0] && defSeries[0].options) || { lineColor:'#21c77d', topColor:'rgba(33,199,125,0.1)', bottomColor:'rgba(33,199,125,0.0)' });
            area0 = chart.addAreaSeries(firstOpts);
            area0.setData(original);
            // Add the rest of series (e.g., quantile lines) after
            for (let i=1;i<defSeries.length;i++){
                const s = defSeries[i];
                let base = Object.assign({}, s.options || {}, { lastValueVisible: false, priceLineVisible: false });
                let series;
                if (s.type === 'area') series = chart.addAreaSeries(base);
                else if (s.type === 'histogram') series = chart.addHistogramSeries(base);
                else series = chart.addLineSeries(base);
                series.setData(s.data||[]);
            }
        } else {
            // Default path: add all provided series
            for (const s of defSeries) {
                let base = Object.assign({}, s.options || {});
                if (!Object.prototype.hasOwnProperty.call(base, 'lastValueVisible')) base.lastValueVisible = false;
                if (!Object.prototype.hasOwnProperty.call(base, 'priceLineVisible')) base.priceLineVisible = false;
                let series;
                if (s.type === 'area') series = chart.addAreaSeries(base);
                else if (s.type === 'histogram') series = chart.addHistogramSeries(base);
                else series = chart.addLineSeries(base);
                series.setData(s.data||[]);
            }
        }
        chart.timeScale().fitContent();
        // If Overall Performance large view, zoom to equity plus just the start of the forecast
        try {
            if (isOverall && original && original.length > 1) {
                const from = original[0].time;
                const lastEq = original[original.length - 1].time;
                // scan defSeries (excluding primary) for earliest future point and step
                let firstFuture = Infinity;
                let step = NaN;
                for (let i = 1; i < defSeries.length; i++) {
                    const d = defSeries[i].data || [];
                    for (let j = 0; j < d.length; j++) {
                        const t = d[j].time;
                        if (t > lastEq) {
                            if (t < firstFuture) {
                                firstFuture = t;
                                if (j + 1 < d.length) {
                                    const t2 = d[j + 1].time;
                                    if (Number.isFinite(t2)) step = t2 - t;
                                }
                            }
                            break;
                        }
                    }
                }
                if (Number.isFinite(from) && Number.isFinite(lastEq) && Number.isFinite(firstFuture) && firstFuture !== Infinity) {
                    if (!Number.isFinite(step) || step <= 0) step = Math.max(1, firstFuture - lastEq);
                    const to = lastEq + step * 3; // include only first ~3 forecast steps
                    chart.timeScale().setVisibleRange({ from, to });
                }
            }
        } catch(_e) { /* ignore */ }
        // Apply optional initial visible range (safe zoom-in for highlighted windows)
        if (options.initialRange && Number.isFinite(options.initialRange.from) && Number.isFinite(options.initialRange.to)) {
            try { chart.timeScale().setVisibleRange({ from: options.initialRange.from, to: options.initialRange.to }); } catch(_e) { /* ignore */ }
        }
        // If Overall Performance, wire Randomize/Reset to our primary series reference
        if (isOverall && area0 && options.showForecast) {
            const btnRand = large.find('.btn-randomize');
            // Helper: build randomized equity path using closed trades shuffled and ±20% variance; preserve spacing after last point in 1-day steps
            const buildRandomized = () => {
                const closedTrades = (L.session && L.session.positions ? L.session.positions : []).filter(p=>p.exitTime);
                const profits = closedTrades.map(p=>p.getProfit(true));
                // Shuffle
                for (let i=profits.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const tmp=profits[i]; profits[i]=profits[j]; profits[j]=tmp; }
                // Apply ±20% variance
                const varied = profits.map(v=> v * (0.8 + Math.random()*0.4));
                // Start from last known equity/time from the original path
                const base = original.slice();
                const last = base.length ? base[base.length-1] : { time: Math.floor(Date.now()/1000), value: (L.session ? L.session.capital : 0) };
                let val = last.value;
                const out = base.slice();
                const step = 86400; // 1 day
                for (let k=0;k<varied.length;k++){
                    val += varied[k];
                    const t = last.time + (k+1)*step;
                    out.push({ time: t, value: val });
                }
                return out;
            };
            btnRand.on('click', ()=>{
                const randData = buildRandomized();
                area0.setData(randData);
                chart.timeScale().fitContent();
                // After randomize, apply the same partial-forecast zoom
                try {
                    const from = randData.length ? randData[0].time : null;
                    const lastEq = randData.length ? randData[randData.length - 1].time : null;
                    let firstFuture = Infinity;
                    let step = NaN;
                    for (let i = 1; i < defSeries.length; i++) {
                        const d = defSeries[i].data || [];
                        for (let j = 0; j < d.length; j++) {
                            const t = d[j].time;
                            if (Number.isFinite(lastEq) && t > lastEq) {
                                if (t < firstFuture) {
                                    firstFuture = t;
                                    if (j + 1 < d.length) {
                                        const t2 = d[j + 1].time;
                                        if (Number.isFinite(t2)) step = t2 - t;
                                    }
                                }
                                break;
                            }
                        }
                    }
                    if (Number.isFinite(from) && Number.isFinite(lastEq) && Number.isFinite(firstFuture) && firstFuture !== Infinity) {
                        if (!Number.isFinite(step) || step <= 0) step = Math.max(1, firstFuture - lastEq);
                        const to = lastEq + step * 3;
                        chart.timeScale().setVisibleRange({ from, to });
                    }
                } catch(_e) { /* ignore */ }
            });
        }
    // Close only when clicking on the backdrop itself, or pressing Esc
    let largeDownOnBackdrop = false;
    large.on('mousedown', (e)=> { largeDownOnBackdrop = (e.target === large[0]); });
    large.on('click', (e)=> { if (e.target === large[0] && largeDownOnBackdrop) large.remove(); });
    const onLargeEsc = (e) => { if (e.key === 'Escape') large.remove(); };
    $(document).on('keydown.statsLargeEsc', onLargeEsc);
    large.on('remove', ()=> $(document).off('keydown.statsLargeEsc', onLargeEsc));
        const onResize = () => {
            const r = container.getBoundingClientRect();
            const pb = parseFloat(getComputedStyle(container).paddingBottom||'0') || 0;
            chart.applyOptions({ width: r.width, height: Math.max(0, r.height - pb) });
        };
        window.addEventListener('resize', onResize);
        large.on('remove', ()=> window.removeEventListener('resize', onResize));
        // Manual resize for enlarged window removed per requirements; window scales responsively.
    };

    // Open buttons
    // Clickable titles open enlarged views
    viewer.find('#ebt-chart-weekday .chart-title').on('click', ()=> openLarge('Performance by Weekday', weekdaySeries));
    viewer.find('#ebt-chart-hour .chart-title').on('click', ()=> openLarge('Performance by Hour', hourSeries));
    viewer.find('#ebt-chart-daily .chart-title').on('click', ()=> openLarge(`Daily Profit — ${wrDaily.pct}% (${wrDaily.pos}/${wrDaily.total})`, dailySeries));
    viewer.find('#ebt-chart-weekly .chart-title').on('click', ()=> openLarge(`Weekly Profit — ${wrWeekly.pct}% (${wrWeekly.pos}/${wrWeekly.total})`, weeklySeries));
    viewer.find('#ebt-chart-monthly .chart-title').on('click', ()=> openLarge(`Monthly Profit — ${wrMonthly.pct}% (${wrMonthly.pos}/${wrMonthly.total})`, monthlySeries));
    viewer.find('#ebt-chart-montecarlo-main .chart-title').on('click', ()=> openLarge('Overall Performance', mcSeries));
    viewer.find('#ebt-chart-trades-week .chart-title').on('click', ()=> openLarge('Trades per Week', weeklyTradesSeries));

    // Bind clicks on metric tiles to open progression charts
    viewer.find('.metric-winrate').off('click').on('click', ()=> openLarge('Winrate progression (%)', wrSeries, { showForecast:false }));
    viewer.find('.metric-profit-factor').off('click').on('click', ()=> openLarge('Profit factor progression', pfSeries, { showForecast:false }));
    viewer.find('.metric-avg-rr').off('click').on('click', ()=> openLarge('Average R:R progression', rrSeries, { showForecast:false }));
    viewer.find('.metric-sharpe').off('click').on('click', ()=> openLarge('Sharpe ratio progression', sharpeSeries, { showForecast:false }));
    viewer.find('.metric-avg-duration').off('click').on('click', ()=> openLarge('Avg trade duration progression (min)', avgDurSeries, { showForecast:false }));

    // Clickable Optimal SL/TP tiles open comparison chart (actual vs would-be)
    const openComparison = (title, k, mode) => {
        const hypo = buildHypotheticalEquity(k, mode);
        // Compute how many trades would have been affected at this k and the delta
        const filteredPositions = positions.filter(p=>p.exitTime);
        let baseline = 0, hypothetical = 0, hits = 0; // hits means TP hits for TP mode; SL hits for SL mode
        const costEach = L._computePerTradeCost(filteredPositions.length) || 0; // per-lot cost
        for (const p of filteredPositions) {
            const base = Number(p.getProfit && p.getProfit(true)) || 0;
            let qty = 0; try { qty = Number(p && p.getQuantity ? p.getQuantity() : p && p.quantity); } catch(_e) { qty = Number(p && p.quantity); }
            const lots = Math.abs(qty) || 0;
            const profit = base - (costEach * lots);
            const risk = Number(p.getRisk && p.getRisk(true)) || 0;
            baseline += profit;
            if (!(Number.isFinite(risk) && risk > 0)) { hypothetical += profit; continue; }
            if (mode === 'sl') {
                if(p.getDrawDown(true) < -k * p.getRisk(true)) {
                    // when SL hits, it's -k*risk minus per-lot cost
                    hypothetical += (-k * p.getRisk(true)) - (costEach * lots);
                    hits++;
                } else {
                    hypothetical += base - (costEach * lots);
                }
            } else {
                // TP mode: use per-trade original TP currency and compare MFE against k * TP(original)
                const tpCur = L._getOriginalTPProfitCurrency(p);
                const mfe = Number(p.getRunUp && p.getRunUp(true)) || 0; // currency
                const risk = Number(p.getRisk && p.getRisk(true)) || 0;
                if (Number.isFinite(tpCur) && tpCur > 0) {
                    const need = k * tpCur;
                    if (mfe >= need) {
                        hypothetical += need - (costEach * lots);
                        hits++;
                    } else {
                        const fallback = (!p.exitReason || Math.abs(base) < (risk / 10)) ? base : -risk;
                        hypothetical += fallback - (costEach * lots);
                    }
                } else {
                    // No valid original TP: keep realized
                    hypothetical += base - (costEach * lots);
                }
            }
        }
        const delta = hypothetical - baseline;
        const denom = Math.abs(baseline) > 1e-9 ? Math.abs(baseline) : 1;
        const dPct = (delta / denom) * 100;
        const labelHits = mode==='tp' ? 'TP hits' : 'SL hits';
        const extra = ` <span style="opacity:.8; font-weight:400;">• ${labelHits} ${hits}/${filteredPositions.length} • Δ ${(delta>=0?'+':'')}${delta.toFixed(2)} ${L.session.currencyId||''} (${dPct>=0?'+':''}${dPct.toFixed(1)}%)</span>`;
        const titled = title + extra;
        const seriesDef = [
            { type:'area', data: equityPoints, options:{ lineColor:'#21c77d', topColor:'rgba(33,199,125,0.1)', bottomColor:'rgba(33,199,125,0.0)'}},
            { type:'line', data: hypo, options:{ color: mode==='sl' ? '#ff9f38' : '#4cc9f0', lineWidth:2, crosshairMarkerVisible:false }}
        ];
        openLarge(titled, seriesDef, { showForecast: false });
    };
    if (Number.isFinite(optSL)) {
        viewer.find('.metric-opt-sl').on('click', ()=> openComparison(`Overall Performance vs Optimal SL (${(optSL *100).toFixed(0)}%)`, optSL, 'sl'));
    }
    if (Number.isFinite(optTP)) {
        viewer.find('.metric-opt-tp').on('click', ()=> openComparison(`Overall Performance vs Optimal TP (${(optTP*100).toFixed(0)}% of original)`, optTP, 'tp'));
    }

    // Helpers for sensitivity popups
    function _calcCagrAndMaxDD(series) {
        if (!series || series.length < 2) return { cagr: 0, maxDD: 0 };
        const start = series[0]; const end = series[series.length-1];
        const years = Math.max((end.time - start.time) / (365 * 86400), 0);
        const cagr = (start.value > 0 && years > 0) ? Math.pow(end.value / start.value, 1 / years) - 1 : 0;
        let peak = series[0].value; let maxDD = 0;
        for (const pt of series) {
            if (pt.value > peak) peak = pt.value; else if (peak > 0) {
                const dd = (peak - pt.value) / peak * 100;
                if (dd > maxDD) maxDD = dd;
            }
        }
        return { cagr, maxDD };
    }
    // Unified MAR helper: always finite. MAR = (CAGR%)/MaxDD%
    function _calcMar(series) {
        const { cagr, maxDD } = _calcCagrAndMaxDD(series);
        return maxDD > 0 ? (cagr * 100) / maxDD : 0;
    }

    // MAR: show a graph of MAR (CAGR / max drawdown %) over time using a rolling window (10% of session duration)
    viewer.find('.metric-mar').off('click').on('click', () => {
        if (!equityPoints || equityPoints.length < 3) return;
        const eq = equityPoints;
        const totalSec = (eq[eq.length - 1].time - eq[0].time) || 0;
        if (totalSec <= 0) return;
        const windowSec = Math.max(1, Math.floor(totalSec * 0.10));
        const marSeries = [];
        let j = 0; // sliding window start index
        for (let i = 1; i < eq.length; i++) {
            const endT = eq[i].time;
            const startT = endT - windowSec;
            while (j < i && eq[j].time < startT) j++;
            const slice = eq.slice(j, i + 1);
            const mar = (slice.length >= 2) ? _calcMar(slice) : 0;
            marSeries.push({ time: endT, value: mar });
        }
        const winDays = (windowSec / 86400);
        const title = `Rolling MAR (10% window ≈ ${winDays >= 1 ? winDays.toFixed(1)+'d' : windowSec + 's'})`;
        const seriesDef = [
            { type:'line', data: marSeries, options:{ color:'#ffd166', lineWidth:2, crosshairMarkerVisible:false } }
        ];
        openLarge(title, seriesDef, { showForecast:false });
    });

    // Drawdown helpers and metrics: Max Drawdown window and Longest time underwater
    function _findMaxDrawdownWindow(points) {
        // Kadane-like scan on equity for max drawdown window
        if (!points || points.length < 2) return null;
        let peakIdx = 0; let peakVal = points[0].value;
        let maxDrop = 0; let troughIdx = 0; let peakIdxForMax = 0;
        for (let i=1;i<points.length;i++) {
            const v = points[i].value;
            if (v > peakVal) { peakVal = v; peakIdx = i; }
            const drop = peakVal - v;
            if (drop > maxDrop) { maxDrop = drop; troughIdx = i; peakIdxForMax = peakIdx; }
        }
        if (maxDrop <= 0) return null;
        const peak = points[peakIdxForMax];
        const trough = points[troughIdx];
        const pct = peak.value > 0 ? (maxDrop / peak.value) * 100 : 0;
        return { peakIdx: peakIdxForMax, troughIdx, peak, trough, amount: maxDrop, percent: pct };
    }

    function _findLongestUnderwaterPeriod(points) {
        if (!points || points.length < 2) return null;
        let athVal = points[0].value;
        let athIdx = 0;
        let uwStartIdx = null; // start at peak index when entering underwater
        let best = { duration: 0, startIdx: null, endIdx: null };
        for (let i=1;i<points.length;i++) {
            const v = points[i].value;
            if (v > athVal) {
                // recovered only when price STRICTLY exceeds prior ATH
                if (uwStartIdx !== null) {
                    const dur = points[i].time - points[uwStartIdx].time;
                    if (dur > best.duration) best = { duration: dur, startIdx: uwStartIdx, endIdx: i };
                    uwStartIdx = null;
                }
                // Update ATH only on strict increase
                athVal = v;
                athIdx = i;
            } else {
                // v <= athVal → no new profit; enter/continue underwater if we've dipped below ATH at least once
                if (v < athVal && uwStartIdx === null) uwStartIdx = athIdx;
                // If v === athVal and we're already underwater, keep it open (do not close or shift ATH)
            }
        }
        // If still underwater at the end, consider open drawdown
        if (uwStartIdx !== null) {
            const lastIdx = points.length - 1;
            const dur = points[lastIdx].time - points[uwStartIdx].time;
            if (dur > best.duration) best = { duration: dur, startIdx: uwStartIdx, endIdx: lastIdx };
        }
        if (best.startIdx === null) return null;
        return {
            startIdx: best.startIdx,
            endIdx: best.endIdx,
            start: points[best.startIdx],
            end: points[best.endIdx],
            durationSec: best.duration
        };
    }

    const ddWindow = _findMaxDrawdownWindow(equityPoints);
    if (ddWindow) {
        // Click on Max drawdown metric opens the DD window chart
        viewer.find('.metric-max-dd').off('click').on('click', () => {
            const startIdx = Math.max(0, ddWindow.peakIdx - 30);
            const endIdx = Math.min(equityPoints.length - 1, ddWindow.troughIdx + 30);
            const highlight = equityPoints.slice(ddWindow.peakIdx, ddWindow.troughIdx + 1);
            const seriesDef = [
                // Full session for context
                { type:'area', data: equityPoints, options:{ lineColor:'#21c77d', topColor:'rgba(33,199,125,0.1)', bottomColor:'rgba(33,199,125,0.0)'}},
                // Highlight only the DD window
                { type:'line', data: highlight, options:{ color:'#ff5c7c', lineWidth:4, crosshairMarkerVisible:false, priceLineVisible:false, lastValueVisible:false } }
            ];
            const t = `Max Drawdown • ${ddWindow.percent.toFixed(1)}% (−${ddWindow.amount.toFixed(2)} ${L.session.currencyId||''})`;
            const initialRange = { from: equityPoints[startIdx].time, to: equityPoints[endIdx].time };
            openLarge(t, seriesDef, { showForecast:false, initialRange });
        });
    }

    // Max run-up popup (mirror of drawdown but trough->peak)
    // Uses runUpPoints already filtered to exclude BE trades' impact.
    (function(){
        // Build a run-up window using runUpPoints vs equityPoints: look for max difference from a trough to a later peak
        if (!runUpPoints || runUpPoints.length < 2) return;
        let troughIdx = 0; let troughVal = runUpPoints[0].value;
        let maxRise = 0; let peakIdx = 0; let troughIdxForMax = 0;
        for (let i=1;i<runUpPoints.length;i++) {
            const v = runUpPoints[i].value;
            if (v < troughVal) { troughVal = v; troughIdx = i; }
            const rise = v - troughVal;
            if (rise > maxRise) { maxRise = rise; peakIdx = i; troughIdxForMax = troughIdx; }
        }
        if (maxRise <= 0) return;
        const startIdx = Math.max(0, troughIdxForMax - 30);
        const endIdx = Math.min(equityPoints.length - 1, peakIdx + 30);
        const highlight = runUpPoints.slice(troughIdxForMax, peakIdx + 1);
        const pct = runUpPoints[troughIdxForMax].value > 0 ? (maxRise / runUpPoints[troughIdxForMax].value) * 100 : 0;
        const seriesDef = [
            // Full session for context
            { type:'area', data: equityPoints, options:{ lineColor:'#21c77d', topColor:'rgba(33,199,125,0.1)', bottomColor:'rgba(33,199,125,0.0)'}},
            // Highlight only the run-up window (using runUpPoints values)
            { type:'line', data: highlight, options:{ color:'#4cc9f0', lineWidth:4, crosshairMarkerVisible:false, priceLineVisible:false, lastValueVisible:false } }
        ];
        const t = `Max Run-up • ${pct.toFixed(1)}% (+${maxRise.toFixed(2)} ${L.session.currencyId||''})`;
        const initialRange = { from: equityPoints[startIdx].time, to: equityPoints[endIdx].time };
        viewer.find('.metric-max-ru').off('click').on('click', () => openLarge(t, seriesDef, { showForecast:false, initialRange }));
    })();

    // Win/Loss streak popups: highlight ALL max-length streak segments on equity
    (function(){
        const closed = positions.filter(p => p.exitTime);
        if (!closed.length) return;
        // Build per-trade timing aligned to equityPoints (entry and exit), to span the full streak visually
        const tradeTimes = [];
        for (const p of closed) {
            const entrySec = toSec(p.entryTime || p.exitTime);
            const exitSec = toSec(p.exitTime || p.entryTime);
            if (Number.isFinite(entrySec) || Number.isFinite(exitSec)) {
                tradeTimes.push({
                    entry: Number.isFinite(entrySec) ? entrySec : exitSec,
                    exit: Number.isFinite(exitSec) ? exitSec : entrySec,
                    profit: Number(p.getProfit(true))||0
                });
            }
        }
        tradeTimes.sort((a,b)=> (a.entry||a.exit) - (b.entry||b.exit));
        if (!tradeTimes.length) return;
        // Collect all win/loss streak segments
        const segments = []; // { type:'win'|'loss', startIdx, endIdx, count }
        let wCount = 0, wStart = 0;
        let lCount = 0, lStart = 0;
        const flushWin = (i) => { if (wCount>0) { segments.push({ type:'win', startIdx:wStart, endIdx:i-1, count:wCount }); wCount=0; } };
        const flushLoss = (i) => { if (lCount>0) { segments.push({ type:'loss', startIdx:lStart, endIdx:i-1, count:lCount }); lCount=0; } };
        for (let i=0;i<tradeTimes.length;i++) {
            const isWin = tradeTimes[i].profit > 0.0000001; // near-zero treated as BE
            const isLoss = tradeTimes[i].profit < -0.0000001;
            if (isWin) {
                if (wCount===0) wStart=i; wCount++;
                flushLoss(i);
            } else if (isLoss) {
                if (lCount===0) lStart=i; lCount++;
                flushWin(i);
            } else {
                // Breakeven: terminate both
                flushWin(i); flushLoss(i);
            }
        }
        flushWin(tradeTimes.length); flushLoss(tradeTimes.length);
        const maxWin = segments.filter(s=>s.type==='win').reduce((m,s)=>Math.max(m,s.count), 0);
        const maxLoss = segments.filter(s=>s.type==='loss').reduce((m,s)=>Math.max(m,s.count), 0);
        const winSegs = segments.filter(s=>s.type==='win' && s.count===maxWin && s.count>=2);
        const lossSegs = segments.filter(s=>s.type==='loss' && s.count===maxLoss && s.count>=2);
        if (!winSegs.length && !lossSegs.length) return;
        // Map streak indices to equityPoints range helpers
        function findFirstIndexAtOrAfter(arr, t){
            let lo=0, hi=arr.length-1, ans=arr.length-1;
            while (lo<=hi) { const mid=(lo+hi)>>1; if (arr[mid].time>=t){ ans=mid; hi=mid-1; } else lo=mid+1; }
            return ans;
        }
        function findLastIndexAtOrBefore(arr, t){
            let lo=0, hi=arr.length-1, ans=0;
            while (lo<=hi) { const mid=(lo+hi)>>1; if (arr[mid].time<=t){ ans=mid; lo=mid+1; } else hi=mid-1; }
            return ans;
        }
        function openStreaks(title, streaks, color){
            if (!streaks || !streaks.length) return;
            // Build highlight series for each streak and compute overall range
            let minFrom = Infinity, maxTo = -Infinity;
            const highlightSeries = [];
            for (const s of streaks) {
                const startTime = tradeTimes[s.startIdx].entry || tradeTimes[s.startIdx].exit;
                const endTime = tradeTimes[s.endIdx].entry || tradeTimes[s.endIdx].exit;
                const hiStart = findFirstIndexAtOrAfter(equityPoints, startTime);
                const hiEnd = findLastIndexAtOrBefore(equityPoints, endTime);
                const seg = equityPoints.slice(hiStart, hiEnd+1);
                if (seg.length) {
                    highlightSeries.push({ type:'line', data: seg, options:{ color, lineWidth:4, crosshairMarkerVisible:false, priceLineVisible:false, lastValueVisible:false } });
                    minFrom = Math.min(minFrom, equityPoints[Math.max(0, hiStart-30)].time);
                    maxTo = Math.max(maxTo, equityPoints[Math.min(equityPoints.length-1, hiEnd+30)].time);
                }
            }
            if (!highlightSeries.length) return;
            const seriesDef = [
                { type:'area', data: equityPoints, options:{ lineColor:'#21c77d', topColor:'rgba(33,199,125,0.1)', bottomColor:'rgba(33,199,125,0.0)'}},
                ...highlightSeries
            ];
            const from = Number.isFinite(minFrom) ? minFrom : equityPoints[0].time;
            const to = Number.isFinite(maxTo) ? maxTo : equityPoints[equityPoints.length-1].time;
            openLarge(title, seriesDef, { showForecast:false, initialRange: { from, to } });
        }
        // Bind click handlers to open charts with ALL max-length streaks highlighted
        if (winSegs.length) viewer.find('.metric-win-streak').off('click').on('click', () => {
            openStreaks(`Win streak • ${maxWin} trades`, winSegs, '#ffd166');
        });
        if (lossSegs.length) viewer.find('.metric-loss-streak').off('click').on('click', () => {
            openStreaks(`Loss streak • ${maxLoss} trades`, lossSegs, '#ff5c7c');
        });
    })();

    // Insert "Max time in drawdown" tile (longest continuous underwater period), unconditional
    const uw = _findLongestUnderwaterPeriod(equityPoints);
    {
        const grid = viewer.find('.metrics-grid');
        const hasUw = !!uw;
        const endPoint = equityPoints[equityPoints.length - 1] || { time: 0 };
        const startDate = hasUw ? new Date(uw.start.time*1000).toISOString().slice(0,10) : new Date(endPoint.time*1000).toISOString().slice(0,10);
        const endDate = hasUw ? new Date(uw.end.time*1000).toISOString().slice(0,10) : new Date(endPoint.time*1000).toISOString().slice(0,10);
        const days = hasUw ? Math.max(0, Math.round(uw.durationSec/86400)) : 0;
        const tileHtml = `
            <div class="metric-uw-duration" style="grid-column: span 3; cursor:pointer;" title="Longest continuous time from a peak until equity recovers to that peak (time spent underwater).">
                <div style="opacity:0.7; font-size:12px;">Max time in drawdown</div>
                <div style="font-size:16px;">${days}d${hasUw ? ` • ${startDate} → ${endDate}` : ''}</div>
            </div>`;
    // Place it before Optimal SL tile if possible; otherwise append
    const optSlTile = grid.find('.metric-opt-sl').first();
    if (optSlTile.length) $(tileHtml).insertBefore(optSlTile); else grid.append($(tileHtml));
        // Click: open full equity chart; highlight if underwater exists (apply zoom range)
        viewer.find('.metric-uw-duration').off('click').on('click', () => {
            const hasRange = hasUw;
            const startIdx = hasRange ? Math.max(0, uw.startIdx - 30) : 0;
            const endIdx = hasRange ? Math.min(equityPoints.length - 1, uw.endIdx + 30) : equityPoints.length - 1;
            const highlight = hasRange ? equityPoints.slice(uw.startIdx, uw.endIdx + 1) : [];
            const t = hasRange ? `Max time in drawdown • ${days}d (${startDate} → ${endDate})` : `Max time in drawdown • 0d`;
            const seriesDef = [
                { type:'area', data: equityPoints, options:{ lineColor:'#21c77d', topColor:'rgba(33,199,125,0.1)', bottomColor:'rgba(33,199,125,0.0)'}},
                ...(hasRange ? [{ type:'line', data: highlight, options:{ color:'#ff5c7c', lineWidth:4, crosshairMarkerVisible:false, priceLineVisible:false, lastValueVisible:false } }] : [])
            ];
            const initialRange = { from: equityPoints[startIdx].time, to: equityPoints[endIdx].time };
            openLarge(t, seriesDef, { showForecast:false, initialRange });
        });
    }
};

// Keyboard shortcut: Ctrl + Shift + S to open stats overlay
$(document).on('keydown.statsui', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 's') {
        if (L.isTyping && L.isTyping()) return;
        event.preventDefault();
        L.showSessionStatistics();
    }
});
