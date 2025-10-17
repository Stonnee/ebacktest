import { L } from "./ebacktesting.core.js";

L.getDateInTimezone = function (timestamp, timezone) {
    const date = new Date(timestamp * 1000);

    // Get UTC offset in minutes
    const tzOffsetMinutes = L.getUTCOffsetInMinutes(timezone, date);

    // Apply offset to create a new adjusted Date object
    return new Date(date.getTime() + tzOffsetMinutes * 60 * 1000);
}

L.getUtcDate = function (timestamp, timezone) {
    const date = new Date(timestamp * 1000);

    // Get UTC offset in minutes
    const tzOffsetMinutes = L.getUTCOffsetInMinutes(timezone, date);

    // Apply offset to create a new adjusted Date object
    return new Date(date.getTime() - tzOffsetMinutes * 60 * 1000);
}

L.getUTCOffsetInMinutes = function (timezone, date) {
    const cacheKey = L.s(4, 9, timezone, date) /* getUTCOffsetInMinutes-{0}-{1} */;
    const cacheEntry = L.cache.getIfExists(cacheKey);
    if(cacheEntry[0]) {
        return cacheEntry[1];
    }

    const options = { timeZone: timezone, timeZoneName: "longOffset" };
    const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(date);

    const offsetPart = parts.find(part => part.type === "timeZoneName");
    if (offsetPart) {
        const match = offsetPart.value.match(/([+-]\d{2}):(\d{2})/);
        if (match) {
            const offsetMinutes = parseInt(match[1]) * 60 + parseInt(match[2]); // Convert to minutes
            L.cache.set(cacheKey, offsetMinutes, 3600); // Cache for 1 hour
            return offsetMinutes;
        }
    }
    L.cache.set(cacheKey, 0, 3600); // Cache default UTC offset for 1 hour
    return 0; // Default to UTC if parsing fails
}

L.toTradingViewDateTimeFormat = function (timestamp, timezone, chart) {
    if (!chart) {
        chart = L.getCharts()[0];
    }

    if (!timezone) {
        timezone = chart.getTimezone();
    }

    const cacheKey = L.s(5, 0, timestamp, timezone) /* toTradingViewDateTimeFormat-{0}-{1} */;
    const cacheEntry = L.cache.getIfExists(cacheKey);
    if(cacheEntry[0]) {
        return cacheEntry[1];
    }

    if (L.isDate(timestamp)) {
        timestamp = timestamp.getTime() / 1000;
    } else if (!L.isNumber(timestamp)) {
        timestamp = new Date(timestamp) / 1000;
    }

    const date = L.getDateInTimezone(timestamp, timezone);
    let formatterChart = chart;
    if (!formatterChart.chartModel().dateTimeFormatter()._timeFormatter) {
        const charts = L.getCharts();
        for (const c of charts) {
            if (c.chartModel().dateTimeFormatter()._timeFormatter) {
                formatterChart = c;
                break;
            }
        }
    }
    const timeFormatter = formatterChart.chartModel().dateTimeFormatter()._timeFormatter;
    if(timeFormatter) {
        timeFormatter._valuesAndDelimeters = ["%h",":","%m", ":", "%s"];
    }

    const formattedDate = formatterChart.chartModel().dateTimeFormatter().format(date);

    L.cache.set(cacheKey, formattedDate, 3600); // Cache for 1 hour
    return formattedDate;
}

L.getNextDateTime = function(time) {
    var [hours, minutes] = time.split(":").map(Number);
    var timeNow = new Date();
    var timeNowInTimezone = L.getDateInTimezone(timeNow /1000, TradingViewApi.activeChart().getTimezone());

    hours = hours - (timeNowInTimezone.getUTCHours() - timeNow.getHours());
    minutes = minutes - (timeNowInTimezone.getUTCMinutes() - timeNow.getMinutes());

    const symbolInfo = TradingViewApi.activeChart().chartModel().mainSeries().symbolInfo();
    const sessionStr = symbolInfo.session;
    let sessions = [];
    
    sessionStr.split('|').forEach(s => {
        const [time, days] = s.split(':');
        const [start, end] = time.split('-');
        
        if (days) {
            for(const day of days) {
                sessions.push({
                    day: parseInt(day) - 1,
                    startHour: parseInt(start.substring(0, 2)),
                    startMinute: parseInt(start.substring(2)),
                    endHour: parseInt(end.substring(0, 2)),
                    endMinute: parseInt(end.substring(2))
                });
            }
        } else {
            const existingDays = sessions.map(s => s.day);
            for (let d = 1; d <= 5; d++) {
                if (!existingDays.includes(d)) {
                    sessions.push({
                        day: d,
                        startHour: parseInt(start.substring(0, 2)),
                        startMinute: parseInt(start.substring(2)),
                        endHour: parseInt(end.substring(0, 2)),
                        endMinute: parseInt(end.substring(2))
                    });
                }
            }
        }
    });

    let nextDate = L.getDateInTimezone(L.session.currentDate, TradingViewApi.activeChart().getTimezone());
    let found = false;
    let maxAttempts = 30; 

    while (!found && maxAttempts > 0) {
        
        nextDate.setHours(hours, minutes, 0, 0);
        
        if (nextDate.getTime() / 1000 <= L.session.currentDate) {
            // Move to next day if time is in the past
            nextDate.setDate(nextDate.getDate() + 1);
            continue;
        }

        // Check if this day & time is within market hours
        const dayOfWeek = nextDate.getDay() || 7; // Convert Sunday from 0 to 7
        const session = sessions.find(s => s.day === dayOfWeek);

        if (session) {
            found = true;
        }

        if (!found) {
            nextDate.setDate(nextDate.getDate() + 1);
        }
        maxAttempts--;
    }

    if(found) {
        return nextDate;
    }
}

L.resolutionToSeconds = function (resolution) {
    if (resolution.endsWith(L.s(5, 1) /* T */)) return parseInt(resolution);   // Convert ticks to seconds
    else if (resolution.endsWith(L.s(5, 2) /* S */)) return parseInt(resolution);   // Get the seconds
    else if (resolution.toLocaleLowerCase().endsWith(L.s(5, 3) /* h */)) return parseInt(resolution) * 60 * 60;   // Convert hours to seconds
    else if (resolution.endsWith(L.s(5, 4) /* D */)) return parseInt(resolution) * 1440 * 60; // Convert days to seconds
    else if (resolution.endsWith(L.s(5, 5) /* W */)) return parseInt(resolution) * 10080 * 60; // Convert weeks to seconds
    else if (resolution.endsWith(L.s(5, 6) /* M */) && resolution.length > 1) return parseInt(resolution) * 43200 * 60; // Convert months to seconds
    else if (!isNaN(resolution)) return parseInt(resolution) * 60;              // Convert minutes to seconds
    else return 0; // unknown
};

L.resolutionToFriendlyText = function (resolution) {
    if (resolution.endsWith(L.s(5, 1) /* T */)) return resolution.replace("T", "t");
    else if (resolution.endsWith(L.s(5, 2) /* S */)) return resolution.replace("S", "s");
    else if (!isNaN(resolution)) return resolution + "m";
    else return resolution;
}

L.formatLocalTime = function(seconds) {
    const chart = TradingViewApi.activeChart();
    return chart.chartModel().timeFormatter().format(L.getDateInTimezone(seconds, chart.getTimezone()));
}

L.formatTimestamp = function (seconds) {
    const m = ~~((seconds % 3600) / 60);
    const s = seconds % 60;

    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

L.convertTimeToUnixTimestamp = function (timeStr) {
    // Extract the first word (should be HHMM format)
    const match = timeStr.match(/^\d{4}/); // Matches 4-digit numbers at the start

    if (!match) {
        return null;
    }

    const time = match[0]; // Extracted 4-digit time
    const hours = parseInt(time.substring(0, 2), 10);
    const minutes = parseInt(time.substring(2, 4), 10);

    // Validate if the extracted value is a valid time (00:00 - 23:59)
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
    }

    // Get today's date
    const now = new Date(0);
    now.setUTCHours(hours, minutes, 0, 0); // Set the extracted time (HH:MM:00)

    // Convert to Unix timestamp (seconds)
    const unixTimestamp = Math.floor(now.getTime() / 1000);

    return unixTimestamp;
}

L.isDate = function (value) {
    return value instanceof Date && !isNaN(value.getTime());
}

L.gotoTime = function (utcTime) {
    L.applyOnCharts(chart => chart.chartModel().gotoTime(L.getDateInTimezone(utcTime, chart.getTimezone())));
}
