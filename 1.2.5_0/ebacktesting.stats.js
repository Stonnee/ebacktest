import { L } from "./ebacktesting.core.js";
import { createChart } from "https://unpkg.com/lightweight-charts@4.2.0?module";

L.exportStats = function () {
    L.confirmBox("Export to Excel", "Do you want to export your eBacktesting positions and session statistics?", (ok) => {
        if (ok) {
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

                                positionEntry[`SL`] = position.stopPrice() || null;
                                positionEntry[`TP`] = position.targetPrice() || null;
                                positionEntry[`BE`] = position.bePrice() || null;
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

                    L.dataOps.exportSessionStatistics(L.session.name, { userId: L.user.userId, sessionId: L.session.sessionId, positionEntries }).then(() => {
                        L.toast("Session statistics exported successfully!", 3000);
                    });
                } else {
                    // Fallback: build from in-memory positions when journal table isn't open
                    const positions = (L.session && Array.isArray(L.session.positions)) ? L.session.positions : [];
                    if (!positions.length) {
                        L.messageBox("Usage info", "No positions found to export.");
                    return;
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
                        entry["Risk "+(L.session.currency||'')]= (position.getRisk && position.getRisk()) || position.risk || '';
                        entry["Profit "+(L.session.currency||'')] = (position.getProfit && position.getProfit(true)) || position.profit || 0;
                        entry["Snapshots"] = (position.positionSnapshots||[]).map(s=>`${L.snapshotUrlPrefix}${s.snapshotUrl}`).join(", ");
                        // Include a few commonly used columns if present
                        entry["Symbol"] = position.symbol || position.ticker || '';
                        entry["Strategy"] = position.strategyName || '';
                        return entry;
                    });
                    L.dataOps.exportSessionStatistics(L.session.name, { userId: L.user.userId, sessionId: L.session.sessionId, positionEntries }).then(() => {
                        L.toast("Session statistics exported successfully!", 3000);
                    });
                }
            } else {
                L.messageBox("Feature disabled", "Unable to export: please subscribe to a free plan or start a free trial on eBacktesting.com");
            }
        }
    });
}

// Using top-level ESM import for Lightweight Charts; no runtime injection or dynamic import.

L.getStatsSummary = function () {
    const positions = (L.session.positions || []).map(p => p).sort((a, b) => a.entryTime - b.entryTime).filter(p => p.exitTime);
    const cacheKey = `getStatsSummary-${positions.length}`;

    const cacheEntry = L.cache.getIfExists(cacheKey);
    if(cacheEntry[0]) {
        return cacheEntry[1];
    }

    const filteredPositions = positions.filter(p => Math.abs(p.getProfit(true)) >= p.getRisk(true) / 10);
    const totalTrades = filteredPositions.length;
    const winningTrades = filteredPositions.filter(p => p.getProfit(true) > 0).length;
    const losingTrades = filteredPositions.filter(p => p.getProfit(true) < 0).length;
    const breakevenTrades = positions.length - winningTrades - losingTrades;

    const totalProfit = filteredPositions.reduce((sum, p) => sum + (p.getProfit(true) > 0 ? p.getProfit(true) : 0), 0);
    const totalLoss = filteredPositions.reduce((sum, p) => sum + (p.getProfit(true) < 0 ? p.getProfit(true) : 0), 0);

    const winrate = totalTrades > 0 ? (((winningTrades / totalTrades) * 100).toFixed(0) + "%") : "N/A";
    const profitFactor = totalLoss !== 0 ? Math.abs((totalProfit / totalLoss).toFixed(2)) : "N/A";

    const avgRiskToReward = (losingTrades != 0 && winningTrades != 0 && totalLoss != 0)
        ? (
            (totalProfit / winningTrades) /
            (Math.abs(totalLoss) / losingTrades)
          ).toFixed(2)
        : "N/A";

    const profits = positions.map(p => p.getProfit(true));
    const sharpeRatio = L.calculateSharpeRatio(profits);

    // Calculate streaks
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let maxConsecutiveBes = 0;
    let currentWins = 0;
    let currentLosses = 0;
    let currentBes = 0;

    let runningBalance = L.session.capital;
    let peak = runningBalance;
    let maxDrawdown = 0;
    let currentDrawdown = 0;

    for (const position of positions) {
        const profit = position.getProfit(true);
        const risk = position.getRisk(true);
        if (profit >= risk / 10) {
            currentWins++;
            currentLosses = 0;
            currentBes = 0;
        } else if (profit <= -risk / 10) {
            currentLosses++;
            currentWins = 0;
            currentBes = 0;
        } else {
            currentBes++;
            currentWins = 0;
            currentLosses = 0;
        }

        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
        maxConsecutiveBes = Math.max(maxConsecutiveBes, currentBes);

        runningBalance += position.getProfit(true);
        
        if (runningBalance > peak) {
            peak = runningBalance;
        } else {
            currentDrawdown = ((peak - runningBalance) / peak) * 100;
            maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
        }            
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
    const filteredPositions = positions.filter(p => Math.abs(p.getProfit(true)) >= p.getRisk(true) / 10);
    const totalTrades = filteredPositions.length;
    const winningTrades = filteredPositions.filter(p => p.getProfit(true) > 0).length;
    const losingTrades = filteredPositions.filter(p => p.getProfit(true) < 0).length;
    const breakevenTrades = positions.length - winningTrades - losingTrades;

    const totalProfit = filteredPositions.reduce((sum, p) => sum + (p.getProfit(true) > 0 ? p.getProfit(true) : 0), 0);
    const totalLoss = filteredPositions.reduce((sum, p) => sum + (p.getProfit(true) < 0 ? p.getProfit(true) : 0), 0);

    const winrate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const profitFactor = totalLoss !== 0 ? Math.abs(totalProfit / totalLoss) : "∞";

    const avgRiskToReward = (losingTrades != 0 && winningTrades != 0 && totalLoss != 0)
        ? (totalProfit / winningTrades) / (Math.abs(totalLoss) / losingTrades)
        : "N/A";

    const profits = positions.map(p => p.getProfit(true));
    const sharpeRatio = L.calculateSharpeRatio(profits);

    // Calculate win/loss amounts
    const winAmounts = filteredPositions.filter(p => p.getProfit(true) > 0).map(p => p.getProfit(true));
    const lossAmounts = filteredPositions.filter(p => p.getProfit(true) < 0).map(p => p.getProfit(true));

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

    let runningBalance = L.session.capital;
    let peak = runningBalance;
    let maxDrawdown = 0;
    const equityData = [{ date: 'Start', balance: runningBalance }];

    for (const position of positions) {
        const profit = position.getProfit(true);
        const risk = position.getRisk(true);
        
        let tradeType = 'breakeven';
        if (profit >= risk / 10) {
            currentWins++;
            currentLosses = 0;
            currentBes = 0;
            tradeType = 'win';
        } else if (profit <= -risk / 10) {
            currentLosses++;
            currentWins = 0;
            currentBes = 0;
            tradeType = 'loss';
        } else {
            currentWins = 0;
            currentLosses = 0;
            currentBes++;
        }

        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
        maxConsecutiveBes = Math.max(maxConsecutiveBes, currentBes);

        runningBalance += profit;
        
        if (runningBalance > peak) {
            peak = runningBalance;
        } else {
            const currentDrawdown = ((peak - runningBalance) / peak) * 100;
            maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
        }

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
    const monthlyData = L.generateMonthlyData(positions);

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
L.generateMonthlyData = function(positions) {
    try {
        const tz = window.TradingViewApi.activeChart().getTimezone();
        const map = new Map();
        for (const p of positions) {
            const t = p.exitTime || p.entryTime;
            if (!t) continue;
            const d = L.getDateInTimezone(t, tz);
            const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
            const profit = p.getProfit(true) || 0;
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

L._computeMaxRunup = function(positions) {
    // Using equity curve based on realized PnL (closed trades only)
    let equity = L.session?.capital || 0;
    let minEquity = equity;
    let maxRunup = 0;
    const ordered = positions.filter(p => p.exitTime).slice().sort((a,b)=>a.exitTime-b.exitTime);
    for (const p of ordered) {
        equity += p.getProfit(true);
        // run-up is equity - running minimum
        minEquity = Math.min(minEquity, equity);
        maxRunup = Math.max(maxRunup, equity - minEquity);
    }
    return maxRunup;
};

L._breakdownByWeekday = function(positions) {
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
        rec.profit += p.getProfit(true);
        rec.count += 1;
    }
    // Normalize order Mon..Sun for charts
    return [days[0],days[1],days[2],days[3],days[4],days[5],days[6]];
};

L._breakdownByHour = function(positions) {
    // returns array of length 24 { label, profit, count, hour }
    const tz = window.TradingViewApi.activeChart().getTimezone();
    const arr = Array.from({length:24}, (_,h)=>({label: h.toString().padStart(2,'0')+':00', profit:0, count:0, hour:h}));
    for (const p of positions) {
        if (!p.entryTime) continue;
        const d = L.getDateInTimezone(p.entryTime, tz);
        const hour = d.getUTCHours();
        arr[hour].profit += p.getProfit(true);
        arr[hour].count += 1;
    }
    return arr;
};

// Aggregate realized profit by calendar day (timezone-aware)
L._aggregateByDay = function(positions) {
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
        rec.profit += p.getProfit(true);
        rec.count += 1;
        map.set(key, rec);
    }
    const arr = Array.from(map.values()).sort((a,b)=> a.key.localeCompare(b.key));
    return arr.map(r=>({ time: Date.UTC(r.y, r.m-1, r.day) / 1000, value: Number(r.profit.toFixed(2)) }));
};

// Aggregate realized profit by ISO-week starting Monday (timezone-aware)
L._aggregateByWeek = function(positions) {
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
        rec.profit += p.getProfit(true);
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

    // Charts created via top-level-imported createChart

    const positions = L.session.positions.slice().sort((a,b)=> a.entryTime - b.entryTime);
    const closed = positions.filter(p => p.exitTime);
    const detailed = L.calculateDetailedStats(positions);
    const avgDuration = L._computeAverageTradeDuration(closed);
    const maxRunup = L._computeMaxRunup(positions);
    const byWeekday = L._breakdownByWeekday(positions);
    const byHour = L._breakdownByHour(positions);

    // Equity curve data for Lightweight Charts using real entry times (normalized to epoch seconds)
    let equity = L.session.capital;
    const equityPoints = [];
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
        if (sec && Number.isFinite(sec)) { lastTimeSec = sec - 1; equityPoints.push({ time: lastTimeSec, value: equity }); break; }
    }
    for (let i=0;i<closed.length;i++) {
        const sec = toSec(closed[i].entryTime || closed[i].exitTime);
        if (!Number.isFinite(sec)) continue; // skip if invalid time
        const timeSec = (lastTimeSec !== null && sec <= lastTimeSec) ? lastTimeSec + 1 : sec;
        equity += closed[i].getProfit(true);
        equityPoints.push({ time: timeSec, value: equity });
        lastTimeSec = timeSec;
    }
    if (!equityPoints.length) {
        // fallback to now if no valid times found
        const nowSec = Math.floor(Date.now()/1000);
        equityPoints.push({ time: nowSec, value: equity });
        lastTimeSec = nowSec;
    }

    // Build overlay container (using a backdrop to allow outside-click close)
    $(".session-stats-backdrop").remove();
    const shell = $(`
        <div class="session-stats-backdrop" style="position:fixed; inset:0; z-index:999998; background:transparent;"></div>
    `);
        const viewer = $(`
            <div class="session-stats-viewer" style="position:fixed; top:5%; left:5%; width:90%; height:90%; z-index:999999; background:var(--tv-color-platform-background,#0c0e12); border:1px solid var(--tv-color-line-divider,#2a2e39); box-shadow:0 10px 30px rgba(0,0,0,0.5); border-radius:8px; display:flex; flex-direction:column;">
            <div style="display:flex; align-items:center; padding:8px 12px; border-bottom:1px solid var(--tv-color-line-divider,#2a2e39);">
                <div style="font-weight:600; font-size:14px;">Session Statistics — ${L.session.name || ''}</div>
                <div style="flex:1"></div>
                <button class="lightButton secondary xsmall typography-regular14px stats-export" title="Export to Excel" style="cursor:pointer;">
                    Export
                </button>
            </div>
                                    <style>
                            /* Responsive grid for stats viewer */
                                          .session-stats-viewer .stats-grid { display:grid; gap:16px; grid-template-columns: repeat(12, 1fr); grid-auto-rows: minmax(60px, auto); align-content: start; align-items: start; }
                                                      .session-stats-viewer .chart-tile { overflow:hidden; position:relative; isolation:isolate; contain:paint; display:grid; grid-template-rows: 24px 1fr; background: var(--tv-color-platform-background,#0c0e12); }
                                                      .session-stats-viewer { display:flex; flex-direction:column; }
                                                      .session-stats-viewer > .stats-grid { flex:1 1 auto; }
                                                    .session-stats-viewer .chart-header { display:grid; grid-template-columns: 1fr; align-items:center; }
                                                    .session-stats-viewer .chart-title { opacity:.8; font-size:12px; padding-left:8px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
                                                    .session-stats-viewer .chart-title .expand-icon { width:12px; height:12px; opacity:.7; }
                                                    .session-stats-viewer .chart-title:hover .expand-icon { opacity:1; }
                                                      .session-stats-viewer .chart-container { width:100%; height:100%; position:relative; overflow:hidden; min-height: 160px; box-sizing: border-box; padding-bottom: 1.25em; }
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
                            /* Tile heights scale with content area height (grid) for better fill after resizing */
                            .session-stats-viewer .tile-equity { height: clamp(320px, calc(var(--content-h, var(--viewer-h, 0px)) * 0.56), 2000px); }
                            .session-stats-viewer .tile-small  { height: clamp(160px, calc(var(--content-h, var(--viewer-h, 0px)) * 0.24), 1200px); }
                            @media (max-width: 1400px) {
                                .session-stats-viewer .stats-grid { grid-template-columns: repeat(6, 1fr); }
                                .session-stats-viewer .span-12 { grid-column: span 6 !important; }
                                .session-stats-viewer .span-6 { grid-column: span 6 !important; }
                                .session-stats-viewer .span-3 { grid-column: span 3 !important; }
                            }
                            @media (max-width: 900px) {
                                .session-stats-viewer .stats-grid { grid-template-columns: repeat(1, 1fr); }
                                .session-stats-viewer .span-12,
                                .session-stats-viewer .span-6,
                                .session-stats-viewer .span-3 { grid-column: span 1 !important; }
                                /* Slightly taller tiles on single-column layouts (still based on content height) */
                                .session-stats-viewer .tile-equity { height: clamp(220px, calc(var(--content-h, var(--viewer-h, 0px)) * 0.32), 2000px); }
                                .session-stats-viewer .tile-small  { height: clamp(180px, calc(var(--content-h, var(--viewer-h, 0px)) * 0.28), 1200px); }
                            }
                        </style>
                        <div class="stats-grid" style="padding:8px 12px; overflow:auto; gap:12px; display:grid; grid-template-columns: repeat(12, 1fr); grid-auto-rows: minmax(60px, auto);">
        <div style="grid-column: span 3;">
                    <div style="opacity:0.7; font-size:12px;">Winrate</div>
                    <div style="font-size:16px;">${detailed.winratePercent}</div>
                </div>
                <div style="grid-column: span 3;">
                    <div style="opacity:0.7; font-size:12px;">Profit factor</div>
                    <div style="font-size:16px;">${detailed.profitFactor}</div>
                </div>
                <div style="grid-column: span 3;">
                    <div style="opacity:0.7; font-size:12px;">Average R:R</div>
                    <div style="font-size:16px;">${detailed.avgRiskToReward}</div>
                </div>
                <div style="grid-column: span 3;">
                    <div style="opacity:0.7; font-size:12px;">Sharpe ratio</div>
                    <div style="font-size:16px;">${detailed.sharpeRatio}</div>
                </div>

                <div style="grid-column: span 3;">
                    <div style="opacity:0.7; font-size:12px;">Winning trades</div>
                    <div style="font-size:16px;">${detailed.winningTrades}</div>
                </div>
                <div style="grid-column: span 3;">
                    <div style="opacity:0.7; font-size:12px;">Losing trades</div>
                    <div style="font-size:16px;">${detailed.losingTrades}</div>
                </div>
                <div style="grid-column: span 3;">
                    <div style="opacity:0.7; font-size:12px;">BE trades</div>
                    <div style="font-size:16px;">${detailed.breakevenTrades}</div>
                </div>
                <div style="grid-column: span 3;">
                    <div style="opacity:0.7; font-size:12px;">Avg trade duration</div>
                    <div style="font-size:16px;">${avgDuration}</div>
                </div>

                ${detailed.maxConsecutiveWins > 1 ? `<div style="grid-column: span 3;"><div style="opacity:0.7; font-size:12px;">Win streak</div><div style="font-size:16px;">${detailed.maxConsecutiveWins}</div></div>` : ''}
                ${detailed.maxConsecutiveLosses > 1 ? `<div style="grid-column: span 3;"><div style="opacity:0.7; font-size:12px;">Loss streak</div><div style="font-size:16px;">${detailed.maxConsecutiveLosses}</div></div>` : ''}
                    ${detailed.maxConsecutiveBes > 1 ? `<div style="grid-column: span 3;"><div style="opacity:0.7; font-size:12px;">BE streak</div><div style="font-size:16px;">${detailed.maxConsecutiveBes}</div></div>` : ''}
                <div style="grid-column: span 3;">
                    <div style="opacity:0.7; font-size:12px;">Max drawdown</div>
                    <div style="font-size:16px;">${detailed.maxDrawdownPercent}</div>
                </div>
                <div style="grid-column: span 3;">
                    <div style="opacity:0.7; font-size:12px;">Max run-up</div>
                    <div style="font-size:16px;">${maxRunup.toFixed(2)}</div>
                </div>

                <div class="chart-tile span-12 tile-equity" style="grid-column: span 12; border:1px solid var(--tv-color-line-divider,#2a2e39); border-radius:6px; padding:8px; overflow:hidden;" id="ebt-chart-montecarlo-main">
                    <div class="chart-header">
                        <div class="chart-title">Monte Carlo <span class="expand-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h7v2H7v10h10v-5h2v7H5V5Z"/></svg></span></div>
                    </div>
                    <div class="chart-container"></div>
                </div>

                <div class="chart-tile span-6 tile-small" style="grid-column: span 6; border:1px solid var(--tv-color-line-divider,#2a2e39); border-radius:6px; padding:8px; overflow:hidden;" id="ebt-chart-weekday">
                    <div class="chart-header">
                        <div class="chart-title">Performance by weekday (entry) <span class="expand-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h7v2H7v10h10v-5h2v7H5V5Z"/></svg></span></div>
                    </div>
                    <div class="chart-container"></div>
                </div>
                <div class="chart-tile span-6 tile-small" style="grid-column: span 6; border:1px solid var(--tv-color-line-divider,#2a2e39); border-radius:6px; padding:8px; overflow:hidden;" id="ebt-chart-hour">
                    <div class="chart-header">
                        <div class="chart-title">Performance by hour (entry) <span class="expand-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h7v2H7v10h10v-5h2v7H5V5Z"/></svg></span></div>
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
        </div>
    `);
    shell.append(viewer);
    $('body').append(shell);
    // Initialize CSS variable for overlay height to drive tile heights
    const setViewerHeightVar = () => {
        const r = viewer[0].getBoundingClientRect();
        viewer.css('--viewer-h', r.height + 'px');
    };
    setViewerHeightVar();
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
    viewer.find('.stats-export').on('click', (e)=>{ e.preventDefault(); L.exportStats(); });
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
    // Add resize handle if missing (in case of cached DOM)
    if (viewer.find('.resize-handle').length === 0) {
        viewer.append('<div class="resize-handle" title="Resize" style="position:absolute; width:14px; height:14px; right:4px; bottom:4px; cursor:se-resize; opacity:.7;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M20 20h-2v-2h2v2Zm-4 0h-2v-4h2v4Zm-4 0H10v-6h2v6Zm-4 0H6v-8h2v8Z"/></svg></div>');
    }
    // Enable resizing main overlay
    (function enableMainResize(){
        const handle = viewer.find('.resize-handle');
        let isResizing=false, startX=0, startY=0, startW=0, startH=0;
        handle.on('mousedown', (e)=>{
            e.preventDefault(); e.stopPropagation();
            isResizing = true;
            const r0 = viewer[0].getBoundingClientRect();
            startX = e.clientX; startY = e.clientY; startW = r0.width; startH = r0.height;
            $(document).on('mousemove.statsResize', (ev)=>{
                if (!isResizing) return;
                const dw = ev.clientX - startX; const dh = ev.clientY - startY;
                const newW = Math.max(600, startW + dw);
                const newH = Math.max(400, startH + dh);
                viewer.css({ width: newW + 'px', height: newH + 'px' });
                setViewerHeightVar();
            });
            $(document).on('mouseup.statsResize', ()=>{
                isResizing = false;
                $(document).off('mousemove.statsResize mouseup.statsResize');
            });
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
                layout:{ background:{ type:'solid', color:'transparent' }, textColor: getComputedStyle(document.documentElement).getPropertyValue('--tv-color-text').trim() || '#d1d4dc' },
                grid: { vertLines: { visible: false }, horzLines: { visible: false } },
                leftPriceScale: { visible: false },
                rightPriceScale:{ borderVisible:false },
                timeScale:{ borderVisible:false }
            });
        for (const s of defSeries) {
            let base = Object.assign({}, s.options || {}, { lastValueVisible: false, priceLineVisible: false });
            let series;
            if (s.type === 'area') series = chart.addAreaSeries(base);
            else if (s.type === 'histogram') series = chart.addHistogramSeries(base);
            else series = chart.addLineSeries(base);
            series.setData(s.data||[]);
        }
        chart.timeScale().fitContent();
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
    const weekdayData = byWeekday.map((d,i)=>({
        time: { year: 1970, month: 1, day: 5 + i },
        value: Number(d.profit.toFixed(2))
    }));
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
    const hourData = byHour.map((d)=>({ time: hourBase + d.hour*3600, value: Number(d.profit.toFixed(2)) }));
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
    const dailyPoints = L._aggregateByDay(closed);
    const weeklyPoints = L._aggregateByWeek(closed);
    const monthlyPoints = (L.generateMonthlyData(closed) || []).map(m=>{
        const [yy,mm] = m.month.split('-').map(Number);
        return { time: Date.UTC(yy, (mm||1)-1, 1)/1000, value: Number((m.profit||0).toFixed(2)) };
    });
    const weeklyTradesPoints = L._tradesPerWeek(positions);
    const dailySeries = [{ type:'histogram', data: dailyPoints, options:{ color:'#6fbf73', priceFormat:{ type:'price', precision:2, minMove:0.01 } } }];
    const weeklySeries = [{ type:'histogram', data: weeklyPoints, options:{ color:'#7e57c2', priceFormat:{ type:'price', precision:2, minMove:0.01 } } }];
    const monthlySeries = [{ type:'histogram', data: monthlyPoints, options:{ color:'#26c6da', priceFormat:{ type:'price', precision:2, minMove:0.01 } } }];
    const weeklyTradesSeries = [{ type:'histogram', data: weeklyTradesPoints, options:{ color:'#ffca28', priceFormat:{ type:'volume' } } }];
    makeChart($('#ebt-chart-daily')[0], dailySeries);
    makeChart($('#ebt-chart-weekly')[0], weeklySeries);
    makeChart($('#ebt-chart-monthly')[0], monthlySeries);
    makeChart($('#ebt-chart-trades-week')[0], weeklyTradesSeries);

    // Monte Carlo: generate quantile bands for 100 trials of next 100 trades using bootstrapped returns
    const returns = closed.map(p=>p.getProfit(true));
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
        { type:'area', data: equityPoints, options:{ lineColor:'#21c77d', topColor:'rgba(33,199,125,0.1)', bottomColor:'rgba(33,199,125,0.0)'}},
        { type:'line', data: q05, options:{ color:'#ff5c7c', lineWidth:1 } },
        { type:'line', data: q50, options:{ color:'#cccccc', lineWidth:2 } },
        { type:'line', data: q95, options:{ color:'#4cc9f0', lineWidth:1 } },
    ];
    // Render Monte Carlo as main chart
    makeChart($('#ebt-chart-montecarlo-main')[0], mcSeries);

    // Embedded enlarged view overlay inside the stats viewer
    const openLarge = (title, defSeries) => {
                const large = $(`
                        <div class="stats-large-overlay" style="position:absolute; inset:0; background: rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:100000;">
                            <div style="position:relative; width: min(1200px, 95%); height: min(80%, 700px); background: var(--tv-color-platform-background,#0c0e12); border:1px solid var(--tv-color-line-divider,#2a2e39); border-radius:8px;">
                                <div style="position:absolute; top:8px; left:12px; font-weight:600;">${title}</div>
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
        for (const s of defSeries) {
            let base = Object.assign({}, s.options || {}, { lastValueVisible: false, priceLineVisible: false });
            let series;
            if (s.type === 'area') series = chart.addAreaSeries(base);
            else if (s.type === 'histogram') series = chart.addHistogramSeries(base);
            else series = chart.addLineSeries(base);
            series.setData(s.data||[]);
        }
        chart.timeScale().fitContent();
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
        // Add resize handle if missing
        const wnd = large.find('div').first();
        if (large.find('.resize-handle').length === 0) {
            wnd.append('<div class="resize-handle" title="Resize" style="position:absolute; width:14px; height:14px; right:4px; bottom:4px; cursor:se-resize; opacity:.7;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M20 20h-2v-2h2v2Zm-4 0h-2v-4h2v4Zm-4 0H10v-6h2v6Zm-4 0H6v-8h2v8Z"/></svg></div>');
        }
        // Resizing logic
        const handle = large.find('.resize-handle');
        let isResizing=false, startX=0, startY=0, startW=0, startH=0;
        handle.on('mousedown', (e)=>{
            e.preventDefault(); e.stopPropagation();
            isResizing = true;
            const r0 = wnd[0].getBoundingClientRect();
            startX = e.clientX; startY = e.clientY; startW = r0.width; startH = r0.height;
            $(document).on('mousemove.statsWndResize', (ev)=>{
                if (!isResizing) return;
                const dw = ev.clientX - startX; const dh = ev.clientY - startY;
                const newW = Math.max(300, startW + dw);
                const newH = Math.max(200, startH + dh);
                wnd.css({ width: newW + 'px', height: newH + 'px' });
                const r = container.getBoundingClientRect();
                chart.applyOptions({ width: r.width, height: r.height });
            });
            $(document).on('mouseup.statsWndResize', ()=>{
                isResizing = false;
                $(document).off('mousemove.statsWndResize mouseup.statsWndResize');
            });
        });
    };

    // Open buttons
    // Clickable titles open enlarged views
    viewer.find('#ebt-chart-weekday .chart-title').on('click', ()=> openLarge('Performance by Weekday', weekdaySeries));
    viewer.find('#ebt-chart-hour .chart-title').on('click', ()=> openLarge('Performance by Hour', hourSeries));
    viewer.find('#ebt-chart-daily .chart-title').on('click', ()=> openLarge('Daily Profit', dailySeries));
    viewer.find('#ebt-chart-weekly .chart-title').on('click', ()=> openLarge('Weekly Profit', weeklySeries));
    viewer.find('#ebt-chart-monthly .chart-title').on('click', ()=> openLarge('Monthly Profit', monthlySeries));
    viewer.find('#ebt-chart-montecarlo-main .chart-title').on('click', ()=> openLarge('Monte Carlo', mcSeries));
    viewer.find('#ebt-chart-trades-week .chart-title').on('click', ()=> openLarge('Trades per Week', weeklyTradesSeries));
};

// Keyboard shortcut: Ctrl + Shift + S to open stats overlay
$(document).on('keydown.statsui', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 's') {
        if (L.isTyping && L.isTyping()) return;
        event.preventDefault();
        L.showSessionStatistics();
    }
});
