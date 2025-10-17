export let L = {
    user: { userId: null },
    isSkippingCandles: false,
    permissions: [],
    dataOps: { 
        plans: {
            none: {
                planId: "00000000-0000-0000-0000-000000000000"
            },
            full: {
                planId: "1BD92829-0577-4177-9B7A-0A9B0E8DD4ED"
            }
        }
    },
    sessionParameterIds: {
        MinReplayResolution: 1,
        PreventHTFCandlePreviews: 2,
        EnablePredefinedTimes: 3,
        PredefinedTimes: 4,
        EnableWarmupStart: 5,
        WarmupStartOffset: 6,
        AnalysisTimer: 7,
        ShowOpenPositionTip: 8,
        AutoSnapshot: 9,
        CanModifyQty: 10,
        RiskWarning: 11,
        AutoOpenPanel: 12
    },
    snapshotUrlPrefix: "https://tradingview.com/x/",
    cache: {
        _storage: {},

        set: function (key, value, timeoutSeconds) {
            const expiresAt = Date.now() + timeoutSeconds * 1000;
            this._storage[key] = { value, expiresAt };
            setTimeout(() => this.delete(key), timeoutSeconds * 1000 + 1000);
        },

        get: function (key) {
            const cachedItem = this._storage[key];

            if (cachedItem && Date.now() < cachedItem.expiresAt) {
                return cachedItem.value;
            } else {
                delete this._storage[key];
                return undefined;
            }
        },

        getIfExists: function (key) {
            const value = this.get(key);
            return [value !== undefined, value];
        },

        delete: function (key) {
            delete this._storage[key];
        },

        clear: function () {
            this._storage = {};
        }
    },
    r: await TradingViewApi.replayApi(),
};
