import { L } from "./ebacktesting.core.js";


L.createGotoDateUI = function (dialogContainer) {
    dialogContainer.find(L.s(5, 7) /* div[class*='tabs'] */).remove();
    dialogContainer.find(L.s(5, 8) /* span[class*='editIcon'] */).remove();

    const container = dialogContainer.find(L.s(5, 9) /* div[class*='scrollable'] div[class*='content'] */);
    container.children().remove();

    const footer = dialogContainer.find(L.s(6, 0) /* div[class*='footer'] */);
    footer.find(L.s(6, 1) /* span[role='button'][data-role='listbox'] */).remove();

    const predefinedTimesTable = $(`
        <table class="${L.s(6, 4) /* ebacktesting-dialog-table */}">
        </table>
    `);
    const predefinedTimesSection = $(`
        <div class="${L.s(6, 9) /* predefined-times */} ${L.s(7, 0) /* ebacktesting-dialog-section */}">
            <label>${L.s(7, 1) /* Predefined times */}:</label>
        </div>`);
    predefinedTimesSection.append(predefinedTimesTable);
    container.append(predefinedTimesSection);

    // Load existing predefined times
    const predefinedTimes = (L.session.getParameter(L.sessionParameterIds.PredefinedTimes) || "")
        .split(L.s(0, 7) /* , */)
        .map((time) => time.trim())
        .filter((time) => time.length > 0);

    function saveParameters() {
        const enablePredefinedTimes = optionsSection.find("#" + L.s(7, 2) /* ebacktesting-option-EnablePredefinedTimes */).prop(L.s(7, 3) /* checked */).toString();
        const times = predefinedTimesTable.find(L.s(7, 4) /* tbody tr input[type='time'] */)
            .map((_, el) => $(el).val())
            .get()
            .filter(t => t)
            .sort()
            .join(L.s(0, 7) /* , */ + " ");

        L.session.setParameter(L.sessionParameterIds.EnablePredefinedTimes, enablePredefinedTimes);
        L.session.setParameter(L.sessionParameterIds.PredefinedTimes, times);
        L.session.setParameter(L.sessionParameterIds.EnableWarmupStart, $("#" + L.s(7, 5) /* ebacktesting-option-EnableWarmupStart */).prop(L.s(7, 3) /* checked */).toString());
        L.session.setParameter(L.sessionParameterIds.WarmupStartOffset, $("#" + L.s(7, 6) /* ebacktesting-option-WarmupStartOffset */).val());
    }

    function addTimeRow(time) {
        var nextDate = L.getNextDateTime(time);
        
        const row = $(`
            <tr>
                <td><input type="time" class="input size-small" value="${time}" /></td>
                <td class="${L.s(6, 6) /* ebacktesting-actions */} rightAlign" width="40%">
                    <button class="${L.s(7, 7) /* goto-time */} lightButton secondary xsmall typography-regular14px" title="${L.s(7, 8) /* Next occurrence */}: ${L.toTradingViewDateTimeFormat(nextDate)}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                            <path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1.17 5.79 3.05 2.92H6.52a.97.97 0 0 0-.97.97v.64c0 .54.43.97.97.97h7.36l-3.05 2.92c-.39.37-.4 1-.01 1.38l.44.44c.38.38 1 .38 1.37 0l5.35-5.34c.38-.38.38-1 0-1.37l-5.35-5.36a.96.96 0 0 0-1.37 0l-.44.44a.97.97 0 0 0 .01 1.39Z"></path>
                        </svg>
                    </button>
                    <button class="${L.s(7, 9) /* delete-time */} lightButton secondary xsmall typography-regular14px" title="${L.s(8, 0) /* Delete */}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18">
                            <path fill="currentColor" d="M12 4h3v1h-1.04l-.88 9.64a1.5 1.5 0 0 1-1.5 1.36H6.42a1.5 1.5 0 0 1-1.5-1.36L4.05 5H3V4h3v-.5C6 2.67 6.67 2 7.5 2h3c.83 0 1.5.67 1.5 1.5V4ZM7.5 3a.5.5 0 0 0-.5.5V4h4v-.5a.5.5 0 0 0-.5-.5h-3ZM5.05 5l.87 9.55a.5.5 0 0 0 .5.45h5.17a.5.5 0 0 0 .5-.45L12.94 5h-7.9Z"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `);

        row.find(`.${L.s(7, 7) /* goto-time */}`).on("click", async function() {
            const t = row.find("input[type='time']").val();
            const nextDateTime = L.getNextDateTime(t);
            saveParameters();
            L.removeDummyShape();
            if (L.session.getActivePositions().length == 0) {
                if (nextDateTime) {
                    L.session.stopAssessTracking();
                    if (L.session.getParameter(L.sessionParameterIds.EnableWarmupStart) == L.s(0, 6) /* true */) {
                        L.toast(L.s(8, 1) /* Playing warmup candles near the specified time to prevent candle previews */, 5000);
                    }
                    await L.selectDateWithWarmup(nextDateTime.getTime() / 1000);
                    setTimeout(async () => {
                        var minReplayResolution = L.session.getParameter(L.sessionParameterIds.MinReplayResolution);
                        L.session.meta.latestPredefinedTime = L.session.currentDate + L.resolutionToSeconds(minReplayResolution) * 4
                    }, 1000);
                    setTimeout(() => {
                        if (L.session?.sessionId && L.session?.currentDate) {
                            L.sessionChannel.postMessage({
                                type: 'DATE-SYNC',
                                sessionId: L.session.sessionId,
                                currentDate: L.session.currentDate
                            });
                        }
                    }, 2000);
                } else {
                    L.toast(L.s(8, 2) /* Could not find next valid market session for the specified time */, 2000, "warn");
                }
            } else {
                L.toast(L.s(8, 3) /* Cannot go to the specified time while there are open positions */, 2000, "warn");
            }
        });

        row.find(`.${L.s(7, 9) /* delete-time */}`).on("click", function() {
            row.remove();
        });

        predefinedTimesTable.append(row);
    }

    // Add existing times
    predefinedTimes.forEach(time => addTimeRow(time));

    // Add new time button
    const addNewTime = $(`
        <div>
            <button class="lightButton secondary xsmall typography-regular14px">
                ${L.s(8, 4) /* Add new time */}
            </button>
        </div>
    `);
    addNewTime.find("button").on("click", () => addTimeRow(L.s(8, 5) /* 00:00 */));
    container.append(addNewTime);

    const customDateTimeSection = $(`
        <div class="${L.s(8, 6) /* ebacktesting-dialog-options-section-custom-date */}">
            <hr>
            <div class="${L.s(7, 0) /* ebacktesting-dialog-section */}">
                <label for="${L.s(8, 7) /* custom-date-time */}">${L.s(8, 8) /* Or, go to a custom date/time */}:</label>
                <table class="${L.s(6, 4) /* ebacktesting-dialog-table */}">
                    <tr>
                        <td>
                            <input 
                                id="${L.s(8, 7) /* custom-date-time */}" 
                                type="datetime-local" 
                                class="input size-small" 
                                value="${(() => {
                                    const utcDate = new Date(L.session.currentDate * 1000);
                                    if(predefinedTimes[0]) {
                                        const [hours, minutes] = predefinedTimes[0].split(":").map(Number);
                                        utcDate.setHours(hours, minutes, 0, 0);
                                    }
                                    const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
                                    const defaultVal = localDate.toISOString().slice(0, 16);
                                    return defaultVal;
                                })()}"
                                min="${L.getDateInTimezone(L.session.currentDate, window.TradingViewApi.activeChart().getTimezone()).toISOString().slice(0, 16)}">
                        </td>
                        <td class="${L.s(6, 6) /* ebacktesting-actions */} rightAlign" width="40%">
                            <button class="${L.s(7, 7) /* goto-time */} lightButton secondary xsmall typography-regular14px">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                                    <path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1.17 5.79 3.05 2.92H6.52a.97.97 0 0 0-.97.97v.64c0 .54.43.97.97.97h7.36l-3.05 2.92c-.39.37-.4 1-.01 1.38l.44.44c.38.38 1 .38 1.37 0l5.35-5.34c.38-.38.38-1 0-1.37l-5.35-5.36a.96.96 0 0 0-1.37 0l-.44.44a.97.97 0 0 0 .01 1.39Z"></path>
                                </svg>
                            </button>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
    `);
    container.append(customDateTimeSection);

    container.find(`.${L.s(8, 6) /* ebacktesting-dialog-options-section-custom-date */} .${L.s(7, 7) /* goto-time */}`).on("click", async function() {
        saveParameters();
        L.removeDummyShape();

        const customDateTime = customDateTimeSection.find(`#${L.s(8, 7) /* custom-date-time */}`).val();
        if (customDateTime) {
            var timeNow = new Date();
            var timeNowInTimezone = L.getDateInTimezone(timeNow / 1000, TradingViewApi.activeChart().getTimezone());

            const offsetHours = timeNowInTimezone.getUTCHours() - timeNow.getHours();
            const offsetMinutes = timeNowInTimezone.getUTCMinutes() - timeNow.getMinutes();

            const adjustedDateTime = new Date(customDateTime);
            adjustedDateTime.setHours(adjustedDateTime.getHours() - offsetHours);
            adjustedDateTime.setMinutes(adjustedDateTime.getMinutes() - offsetMinutes);
            
            if (new Date(adjustedDateTime).getTime() / 1000 > L.session.currentDate) {
                if (L.session.getActivePositions().length == 0) {
                    L.session.stopAssessTracking();

                    const timestamp = new Date(adjustedDateTime).getTime() / 1000;
                    if (L.session.getParameter(L.sessionParameterIds.EnableWarmupStart) == "true") {
                        L.toast(L.s(8, 9) /* Warming up candles to the specified date/time to prevent candle preview... */, 5000);
                    }
                    await L.selectDateWithWarmup(timestamp);
                } else {
                    L.messageBox(L.s(9, 0) /* Usage info */, L.s(9, 1) /* Cannot go to the specified date/time while there are open positions. Please close all positions before jumping to another date. */);
                }
            } else {
                L.messageBox(L.s(9, 0) /* Usage info */, L.s(9, 2) /* The selected date/time must be in the future. */);
            }
        } 
    });

    const optionsSection = $(`
        <div class="${L.s(9, 3) /* ebacktesting-dialog-options-section */}">
            <hr>
            <input type='checkbox' id='${L.s(7, 2) /* ebacktesting-option-EnablePredefinedTimes */}' ${L.session.getParameter(L.sessionParameterIds.EnablePredefinedTimes) == L.s(0, 6) /* true */ ? L.s(7, 3) /* checked */ : ""}>
            <label for='${L.s(7, 2) /* ebacktesting-option-EnablePredefinedTimes */}'>${L.s(9, 4) /* Stop playback/skipping at predefined times */}</label>
            <span title="${L.s(9, 5) /* Automatically stops candle playback at specified times during the day. Useful for regular events like session opens, news releases or your own schedule. */}" class="icon-wrapper with-tooltip apply-common-tooltip iconWrapper default small" tabindex="-1"><span role="img" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Zm1-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM8.5 9.5H7V8h3v6H8.5V9.5Z"></path></svg></span></span>
            <br/>
            <input type='checkbox' id='${L.s(7, 5) /* ebacktesting-option-EnableWarmupStart */}' ${L.session.getParameter(L.sessionParameterIds.EnableWarmupStart) == L.s(0, 6) /* true */ ? L.s(7, 3) /* checked */ : ""}>
            <label for='${L.s(7, 5) /* ebacktesting-option-EnableWarmupStart */}'>${L.s(9, 6) /* Warmup jump-to-date */}</label>
            <select id="${L.s(7, 6) /* ebacktesting-option-WarmupStartOffset */}">
                <option value="${L.s(9, 7) /* 300 */}" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == L.s(9, 7) /* 300 */ ? "selected" : ""}>${L.s(-1, 4) /* 5m */}</option>
                <option value="${L.s(9, 8) /* 900 */}" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == L.s(9, 8) /* 900 */ ? "selected" : ""}>${L.s(-1, 5) /* 15m */}</option>
                <option value="${L.s(9, 9) /* 1800 */}" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == L.s(9, 9) /* 1800 */ ? "selected" : ""}>${L.s(-1, 6) /* 30m */}</option>
                <option value="${L.s(-1, 0) /* 3600 */}" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == L.s(-1, 0) /* 3600 */ ? "selected" : ""}>${L.s(-1, 7) /* 1h */}</option>
                <option value="${L.s(-1, 1) /* 7200 */}" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == L.s(-1, 1) /* 7200 */ ? "selected" : ""}>${L.s(-1, 8) /* 2h */}</option>
                <option value="${L.s(-1, 2) /* 14400 */}" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == L.s(-1, 2) /* 14400 */ ? "selected" : ""}>${L.s(-1, 9) /* 4h */}</option>
                <option value="${L.s(-1, 3) /* 86400 */}" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == L.s(-1, 3) /* 86400 */ ? "selected" : ""}>${L.s(-2, 0) /* 1D */}</option>
            </select>
            <span title="${L.s(-2, 1) /* When jumping to a specific time, a brief playback will take place just before that time to load indicators and prevent seeing future price action (by default, TradingView displays the full candle when navigating to a time that is mid-candle). */}" class="icon-wrapper with-tooltip apply-common-tooltip iconWrapper default small" tabindex="-1"><span role="img" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Zm1-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM8.5 9.5H7V8h3v6H8.5V9.5Z"></path></svg></span></span>
        </div>
    `);
    container.append(optionsSection);
    L.session.retrieveParameters().then(() => {
        $(`#${L.s(7, 2) /* ebacktesting-option-EnablePredefinedTimes */}`).prop(L.s(7, 3) /* checked */, L.session.getParameter(L.sessionParameterIds.EnablePredefinedTimes) == L.s(0, 6) /* true */);
        $(`#${L.s(7, 5) /* ebacktesting-option-EnableWarmupStart */}`).prop(L.s(7, 3) /* checked */, L.session.getParameter(L.sessionParameterIds.EnableWarmupStart) == L.s(0, 6) /* true */);
        $(`#${L.s(7, 6) /* ebacktesting-option-WarmupStartOffset */}`).val(L.session.getParameter(L.sessionParameterIds.WarmupStartOffset));
    });

    footer.find(L.s(-2, 2) /* button[name='submit'] */).on("click", async function () {
        saveParameters();
        L.removeDummyShape();
    });

    footer.find(L.s(6, 3) /* button[name='cancel'] */).on("click", () => {
        L.removeDummyShape();
    });
}
