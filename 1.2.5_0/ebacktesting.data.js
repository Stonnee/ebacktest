import { L } from "./ebacktesting.core.js";

L.dataOps.getUserById = function (userId) {
    return L.dataOps.get(L.s(1, 5, userId) /* admin/user/{0} */);
};

L.dataOps.getOrSaveUserId = function (tradingViewUser) {
    return L.dataOps.put(L.s(1, 6) /* admin/user */, {...tradingViewUser, settings: null, available_offers: null, session_hash: null, auth_token: null, notification_count: null});
};

L.dataOps.getPermissions = function (planId) {
    return L.dataOps.get(L.s(1, 7, planId) /* admin/plans/{0}/permissions */);
};

L.dataOps.getSessionColumns = function (sessionId) {
    return L.dataOps.get(L.s(1, 8, sessionId) /* journaling/session-columns/{0} */);
}

L.dataOps.saveSessionColumns = function (sessionId, columns) {
    return L.dataOps.post(L.s(1, 8, sessionId) /* journaling/session-columns/{0} */, columns);
}

L.dataOps.getPositionColumns = function (positionId) {
    return L.dataOps.get(L.s(1, 9, positionId) /* journaling/positions/columns/{0} */);
}

L.dataOps.setPositionColumn = function (positionId, column) {
    return L.dataOps.put(L.s(2, 0, positionId) /* journaling/positions/columns/{0} */, column);
}

L.dataOps.getSessions = async function (userId) {
    var sessions = await L.dataOps.get(L.s(2, 1) /* backtesting/sessions */, { userId }).then(s => s || []);
    return sessions.map(session => {
        session.currentDate = new Date(session.currentDate).getTime() / 1000;
        session.lastUpdate = new Date(session.lastUpdate);
        return session;
    });
}

L.dataOps.getSession = async function (sessionId) {
    const session = await L.dataOps.get(L.s(2, 2, sessionId) /* backtesting/sessions/{0} */);
    session.currentDate = new Date(session.currentDate).getTime() / 1000;
    session.lastUpdate = new Date(session.lastUpdate);
    return session;
}

L.dataOps.createSession = function (session) {
    return L.dataOps.post(L.s(2, 1) /* backtesting/sessions */, { ...session, currentDate: new Date(session.currentDate * 1000) });
}

L.dataOps.updateSession = function (session, skipCurrentDateUpdate, allowPastDate) {
    L.cache.delete(L.s(2, 3, session.sessionId) /* getSessionPositions-{0} */);
    return L.dataOps.put(L.s(2, 4, !!allowPastDate) /* backtesting/sessions?allowPastDate={0} */, { ...session, currentDate: skipCurrentDateUpdate ? undefined : new Date(session.currentDate * 1000) });
}

L.dataOps.deleteSession = function (sessionId) {
    return L.dataOps.delete(L.s(2, 2, sessionId) /* backtesting/sessions/{0} */);
}

L.dataOps.cloneSession = function (sessionId, newName) {
    return L.dataOps.post(L.s(2, 5, sessionId, newName) /* backtesting/sessions/{0}/clone?newName={1} */);
}

L.dataOps.getSessionParameters = function (sessionId) {
    return L.dataOps.get(L.s(2, 6, sessionId) /* backtesting/sessions/{0}/parameters */);
};

L.dataOps.setSessionParameterValue = function (sessionId, parameterId, parameterValue) {
    return L.dataOps.put(L.s(2, 7, sessionId, parameterId) /* backtesting/sessions/{0}/parameters/{1} */, parameterValue);
};

L.dataOps.getOrAddSymbol = async function (symbolName, getSymbolInfo) {
    const cacheKey = L.s(2, 8, symbolName) /* getOrAddSymbol-{0} */;
    const cacheEntry = L.cache.getIfExists(cacheKey);
    if(cacheEntry[0]) {
        return cacheEntry[1];
    } else {
        var symbolData = await L.dataOps.get(L.s(2, 9, symbolName) /* backtesting/symbols/{0} */);

        if (!symbolData) {
            const chartSymbolInfo = getSymbolInfo();
            symbolData = { symbolName: chartSymbolInfo.full_name, symbolType: chartSymbolInfo.type, pricePrecision: chartSymbolInfo.pricescale.toString().length - 1, quantityPrecision: 2, currencyId: chartSymbolInfo.currency_id };
            symbolData = await L.dataOps.post(L.s(3, 0) /* backtesting/symbols */, symbolData);
        }

        L.cache.set(cacheKey, symbolData, 3600);
        return symbolData;
    }
}

L.dataOps.getSymbolRuleContractSizes = async function (symbolType) {
    const cacheKey = L.s(3, 1, symbolType) /* getSymbolRuleContractSizes-{0} */;
    const cacheEntry = L.cache.getIfExists(cacheKey);
    if(cacheEntry[0]) {
        return cacheEntry[1];
    } else {
        const contractSizes = await L.dataOps.get(L.s(3, 2, symbolType) /* backtesting/symbol-rule-contract-sizes/{0} */);
        L.cache.set(cacheKey, contractSizes, 3600);
        return contractSizes;
    }
}

L.dataOps.getSessionPositions = async function (sessionId) {
    const cacheKey = L.s(3, 3, sessionId) /* getSessionPositions-{0} */;
    const cacheEntry = L.cache.getIfExists(cacheKey);
    if(cacheEntry[0]) {
        return cacheEntry[1];
    }

    const rawPositions = await L.dataOps.get(L.s(3, 4, sessionId) /* backtesting/positions/{0} */);
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
    return L.dataOps.post(L.s(3, 5) /* backtesting/positions */,
        {
            ...position,
            sessionId: L.session.sessionId,
            symbolId: position.symbol?.symbolId,
            symbol: null,
            ...{
                entryTime: new Date(position.entryTime * 1000),
                positionShapes: position.positionShapes?.map(shape => {
                    const { stopPrice, targetPrice, endTime, ...shapeWithoutStops } = shape;
                    return {
                        ...shapeWithoutStops,
                        endTime: new Date(endTime * 1000)
                    };
                }),
                positionBEs: position.positionBEs?.map(be => ({
                    ...be,
                    barTime: new Date(be.barTime * 1000)
                })),
                positionSLs: undefined,
                positionTPs: undefined,
                positionRisks: position.positionRisks?.map(risk => ({
                    ...risk,
                    barTime: new Date(risk.barTime * 1000)
                }))
            }
        });
}

L.dataOps.closePosition = function (position) {
    return L.dataOps.put(L.s(3, 6) /* backtesting/positions/close */, { ...position, 
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
    return L.dataOps.put(L.s(3, 7, positionId) /* backtesting/positions/be/{0} */, { ...be, barTime: new Date(be.barTime * 1000) });
}

L.dataOps.addPositionRisk = function (positionId, risk) {
    return L.dataOps.put(L.s(3, 8, positionId) /* backtesting/positions/risk/{0} */, { ...risk, barTime: new Date(risk.barTime * 1000) });
}

L.dataOps.addPositionSL = function (_positionId, _sl) {
    return Promise.resolve();
}

L.dataOps.addPositionTP = function (_positionId, _tp) {
    return Promise.resolve();
}

L.dataOps.getPositionShapes = function (positionId) {
    return L.dataOps.get(L.s(4, 1, positionId) /* backtesting/positions/shapes/{0} */);
}

L.dataOps.setPositionShape = function (positionId, positionShape) {
    return L.dataOps.put(L.s(4, 2, positionId) /* backtesting/positions/shapes/{0} */, positionShape);
}

L.dataOps.getPositionSnapshots = async function (positionId) {
    var rawSnapshots = await L.dataOps.get(L.s(4, 3, positionId) /* journaling/positions/snapshots/{0} */);
    return rawSnapshots.map((snapshot) => ({
        ...snapshot, 
        sessionTime: Math.floor(new Date(snapshot.sessionTime).getTime() / 1000) 
    }));
}

L.dataOps.setPositionSnapshots = function (positionId, snapshots) {
    return L.dataOps.put(L.s(4, 3, positionId) /* journaling/positions/snapshots/{0} */, snapshots.map(snapshot => ({ ...snapshot, sessionTime: new Date(snapshot.sessionTime * 1000) })));
};

L.dataOps.deletePosition = function (positionId) {
    return L.dataOps.delete(L.s(3, 4, positionId) /* backtesting/positions/{0} */);
};

L.dataOps.updateLastPrice = function (sessionId, symbolId, lastPrice) {
    return L.dataOps.put(L.s(4, 4, sessionId, symbolId) /* backtesting/sessions/{0}/symbols/{1}/last-price */, lastPrice);
};

L.dataOps.updatePositionQuantity = function (positionId, quantity) {
    return L.dataOps.put(L.s(4, 5, positionId) /* backtesting/positions/{0}/quantity */, quantity);
};

L.dataOps.exportSessionStatistics = function (sessionName, positionEntries) {
    return L.dataOps.post(L.s(4, 6, sessionName) /* journaling/export/excel/{0} */, positionEntries, "blob");
};

L.dataOps.getAddons = function () {
    return L.dataOps.get(L.s(4, 7) /* ui/addons */, { username: user.username });
}

L.dataOps.get = async function (url, params, responseFormat) {
    if (params) {
        url += "?" + new URLSearchParams(params);
    }
    return await fetch(L.s(4, 8, url) /* https://api.ebacktesting.com/{0} */).then(response => {
        if (response.status === 200) {
            return L.dataOps.parseResponse(response, responseFormat);
        }
    });
}

L.dataOps.post = async function (url, data, responseFormat) {
    return await fetch(L.s(4, 8, url) /* https://api.ebacktesting.com/{0} */, {
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
    return await fetch(L.s(4, 8, url) /* https://api.ebacktesting.com/{0} */, {
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
    return await fetch(L.s(4, 8, url) /* https://api.ebacktesting.com/{0} */, {
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
