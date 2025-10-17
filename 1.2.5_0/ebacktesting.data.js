import { L } from "./ebacktesting.core.js";

L.dataOps.getUserById = function (userId) {
    return L.dataOps.get(`admin/user/${userId}`);
};

L.dataOps.getOrSaveUserId = function (tradingViewUser) {
    return L.dataOps.put(`admin/user`, {...tradingViewUser, settings: null, available_offers: null, session_hash: null, auth_token: null, notification_count: null});
};

L.dataOps.getPermissions = function (planId) {
    return L.dataOps.get(`admin/plans/${planId}/permissions`);
};

L.dataOps.getSessionColumns = function (sessionId) {
    return L.dataOps.get(`journaling/session-columns/${sessionId}`);
}

L.dataOps.saveSessionColumns = function (sessionId, columns) {
    return L.dataOps.post(`journaling/session-columns/${sessionId}`, columns);
}

L.dataOps.getPositionColumns = function (positionId) {
    return L.dataOps.get(`journaling/positions/columns/${positionId}`);
}

L.dataOps.setPositionColumn = function (positionId, column) {
    return L.dataOps.put(`journaling/positions/columns/${positionId}`, column);
}

L.dataOps.getSessions = async function (userId) {
    var sessions = await L.dataOps.get("backtesting/sessions", { userId }).then(s => s || []);
    return sessions.map(session => {
        session.currentDate = new Date(session.currentDate).getTime() / 1000;
        session.lastUpdate = new Date(session.lastUpdate);
        return session;
    });
}

L.dataOps.getSession = async function (sessionId) {
    const session = await L.dataOps.get(`backtesting/sessions/${sessionId}`);
    session.currentDate = new Date(session.currentDate).getTime() / 1000;
    session.lastUpdate = new Date(session.lastUpdate);
    return session;
}

L.dataOps.createSession = function (session) {
    return L.dataOps.post("backtesting/sessions", { ...session, currentDate: new Date(session.currentDate * 1000) });
}

L.dataOps.updateSession = function (session, skipCurrentDateUpdate) {
    L.cache.delete(`getSessionPositions-${session.sessionId}`);
    return L.dataOps.put(`backtesting/sessions`, { ...session, currentDate: skipCurrentDateUpdate ? undefined : new Date(session.currentDate * 1000) });
}

L.dataOps.deleteSession = function (sessionId) {
    return L.dataOps.delete(`backtesting/sessions/${sessionId}`);
}

L.dataOps.getSessionParameters = function (sessionId) {
    return L.dataOps.get(`backtesting/sessions/${sessionId}/parameters`);
};

L.dataOps.setSessionParameterValue = function (sessionId, parameterId, parameterValue) {
    return L.dataOps.put(`backtesting/sessions/${sessionId}/parameters/${parameterId}`, parameterValue);
};

L.dataOps.getOrAddSymbol = async function (symbolName, getSymbolInfo) {
    const cacheKey = `getOrAddSymbol-${symbolName}`;
    const cacheEntry = L.cache.getIfExists(cacheKey);
    if(cacheEntry[0]) {
        return cacheEntry[1];
    } else {
        var symbolData = await L.dataOps.get(`backtesting/symbols/${symbolName}`);

        if (!symbolData) {
            const chartSymbolInfo = getSymbolInfo();
            symbolData = { symbolName: chartSymbolInfo.full_name, symbolType: chartSymbolInfo.type, pricePrecision: chartSymbolInfo.pricescale.toString().length - 1, quantityPrecision: 2, currencyId: chartSymbolInfo.currency_id };
            symbolData = await L.dataOps.post("backtesting/symbols", symbolData);
        }

        L.cache.set(cacheKey, symbolData, 3600);
        return symbolData;
    }
}

L.dataOps.getSymbolRuleContractSizes = async function (symbolType) {
    const cacheKey = `getSymbolRuleContractSizes-${symbolType}`;
    const cacheEntry = L.cache.getIfExists(cacheKey);
    if(cacheEntry[0]) {
        return cacheEntry[1];
    } else {
        const contractSizes = await L.dataOps.get(`backtesting/symbol-rule-contract-sizes/${symbolType}`);
        L.cache.set(cacheKey, contractSizes, 3600);
        return contractSizes;
    }
}

L.dataOps.getSessionPositions = async function (sessionId) {
    const cacheKey = `getSessionPositions-${sessionId}`;
    const cacheEntry = L.cache.getIfExists(cacheKey);
    if(cacheEntry[0]) {
        return cacheEntry[1];
    }

    const rawPositions = await L.dataOps.get(`backtesting/positions/${sessionId}`);
    const processedPositions = rawPositions.map((position, i) => ({
        ...position,
        index: rawPositions.length - i,
        entryTime: Math.floor(new Date(position.entryTime).getTime() / 1000),
        exitTime: position.exitTime ? new Date(position.exitTime).getTime() / 1000 : null,
        positionShapes: position.positionShapes?.map(shape => ({
            ...shape,
            endTime: Math.floor(new Date(shape.endTime).getTime() / 1000)
        })),
        positionBEs: position.positionBEs?.map(be => ({
            ...be,
            barTime: Math.floor(new Date(be.barTime).getTime() / 1000)
        })),
        positionSLs: position.positionSLs?.map(sl => ({
            ...sl,
            barTime: Math.floor(new Date(sl.barTime).getTime() / 1000)
        })),
        positionTPs: position.positionTPs?.map(tp => ({
            ...tp,
            barTime: Math.floor(new Date(tp.barTime).getTime() / 1000)
        })),
        positionRisks: position.positionRisks?.map(risk => ({
            ...risk,
            barTime: Math.floor(new Date(risk.barTime).getTime() / 1000)
        }))
    }));

    L.cache.set(cacheKey, processedPositions, 300); // Cache for 5 minutes
    return processedPositions;
}

L.dataOps.createPosition = function (position) {
    return L.dataOps.post(`backtesting/positions`,
        {
            ...position,
            sessionId: L.session.sessionId,
            symbolId: position.symbol?.symbolId,
            symbol: null,
            ...{
                entryTime: new Date(position.entryTime * 1000),
                positionShapes: position.positionShapes?.map(shape => ({
                    ...shape,
                    endTime: new Date(shape.endTime * 1000)
                })),
                positionBEs: position.positionBEs?.map(be => ({
                    ...be,
                    barTime: new Date(be.barTime * 1000)
                })),
                positionSLs: position.positionSLs?.map(sl => ({
                    ...sl,
                    barTime: new Date(sl.barTime * 1000)
                })),
                positionTPs: position.positionTPs?.map(tp => ({
                    ...tp,
                    barTime: new Date(tp.barTime * 1000)
                })),
                positionRisks: position.positionRisks?.map(risk => ({
                    ...risk,
                    barTime: new Date(risk.barTime * 1000)
                }))
            }
        });
}

L.dataOps.closePosition = function (position) {
    return L.dataOps.put(`backtesting/positions/close`, { ...position, 
        exitTime: new Date(position.exitTime * 1000), 
        entryTime: undefined, 
        positionShapes: undefined, 
        positionSLs: undefined, 
        positionTPs: undefined, 
        positionBEs: undefined, 
        positionRisks: undefined, 
        positionColumns: undefined, 
        positionSnapshots: undefined,
        symbol: undefined
    });
}

L.dataOps.addPositionBE = function (positionId, be) {
    return L.dataOps.put(`backtesting/positions/be/${positionId}`, { ...be, barTime: new Date(be.barTime * 1000) });
}

L.dataOps.addPositionRisk = function (positionId, risk) {
    return L.dataOps.put(`backtesting/positions/risk/${positionId}`, { ...risk, barTime: new Date(risk.barTime * 1000) });
}

L.dataOps.addPositionSL = function (positionId, sl) {
    return L.dataOps.put(`backtesting/positions/sl/${positionId}`, { ...sl, barTime: new Date(sl.barTime * 1000) });
}

L.dataOps.addPositionTP = function (positionId, tp) {
    return L.dataOps.put(`backtesting/positions/tp/${positionId}`, { ...tp, barTime: new Date(tp.barTime * 1000) });
}

L.dataOps.getPositionShapes = function (positionId) {
    return L.dataOps.get(`backtesting/positions/shapes/${positionId}`);
}

L.dataOps.setPositionShape = function (positionId, positionShape) {
    return L.dataOps.put(`backtesting/positions/shapes/${positionId}`, positionShape);
}

L.dataOps.getPositionSnapshots = async function (positionId) {
    var rawSnapshots = await L.dataOps.get(`journaling/positions/snapshots/${positionId}`);
    return rawSnapshots.map((snapshot) => ({
        ...snapshot, 
        sessionTime: Math.floor(new Date(snapshot.sessionTime).getTime() / 1000) 
    }));
}

L.dataOps.setPositionSnapshots = function (positionId, snapshots) {
    return L.dataOps.put(`journaling/positions/snapshots/${positionId}`, snapshots.map(snapshot => ({ ...snapshot, sessionTime: new Date(snapshot.sessionTime * 1000) })));
};

L.dataOps.deletePosition = function (positionId) {
    return L.dataOps.delete(`backtesting/positions/${positionId}`);
};

L.dataOps.updateLastPrice = function (sessionId, symbolId, lastPrice) {
    return L.dataOps.put(`backtesting/sessions/${sessionId}/symbols/${symbolId}/last-price`, lastPrice);
};

L.dataOps.updatePositionQuantity = function (positionId, quantity) {
    return L.dataOps.put(`backtesting/positions/${positionId}/quantity`, quantity);
};

L.dataOps.exportSessionStatistics = function (sessionName, positionEntries) {
    return L.dataOps.post(`journaling/export/excel/${sessionName}`, positionEntries, "blob");
};

L.dataOps.getAddons = function () {
    return L.dataOps.get(`ui/addons`, { username: user.username });
}

L.dataOps.get = async function (url, params, responseFormat) {
    if (params) {
        url += "?" + new URLSearchParams(params);
    }
    return await fetch(`https://api.ebacktesting.com/${url}`).then(response => {
        if (response.status === 200) {
            return L.dataOps.parseResponse(response, responseFormat);
        }
    });
}

L.dataOps.post = async function (url, data, responseFormat) {
    return await fetch(`https://api.ebacktesting.com/${url}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    }).then(response => {
        if (response.status === 200) {
            return L.dataOps.parseResponse(response, responseFormat);
        }
    });
}

L.dataOps.put = async function (url, data, responseFormat) {
    return await fetch(`https://api.ebacktesting.com/${url}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    }).then(response => {
        if (response.status === 200) {
            return L.dataOps.parseResponse(response, responseFormat);
        }
    });
}

L.dataOps.delete = async function (url) {
    return await fetch(`https://api.ebacktesting.com/${url}`, {
        method: "DELETE"
    }).then(response => {
        if (response.status === 200) {
            return response.json();
        }
    });
}

L.dataOps.parseResponse = async function (response, responseFormat) {
    responseFormat = responseFormat || "json";

    if (responseFormat == "blob") {
        const blob = await response.blob();

        // Extract filename from Content-Disposition header
        const disposition = response.headers.get("Content-Disposition");
        let filename = "download.dat";

        if (disposition) {
            const utf8Match = disposition.match(/filename\*\s*=\s*UTF-8''([^;\n]*)/);
            const normalMatch = disposition.match(/filename\s*=\s*"?([^"]+)"?/);

            if (utf8Match) {
                filename = decodeURIComponent(utf8Match[1]);
            } else if (normalMatch) {
                filename = decodeURIComponent(normalMatch[1]);
            }
        }

        // Create and trigger download
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return; // Nothing to return after download
    }

    // Other formats
    switch (responseFormat) {
        case "text": return response.text();
        case "json": return response.json();
        case "number": return response.text().then(text => parseFloat(text));
        default: throw new Error("Unsupported response format: " + responseFormat);
    }
};
