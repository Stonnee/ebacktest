import { L } from "./ebacktesting.core.js";


L.createAnalysisTimesUI = function (dialogContainer) {
    dialogContainer.find(L.s(5, 7) /* div[class*='tabs'] */).remove();
    dialogContainer.find(L.s(5, 8) /* span[class*='editIcon'] */).remove();

    const container = dialogContainer.find(L.s(5, 9) /* div[class*='scrollable'] div[class*='content'] */);
    container.children().remove();

    const footer = dialogContainer.find(L.s(6, 0) /* div[class*='footer'] */);
    footer.find(L.s(6, 1) /* span[role='button'][data-role='listbox'] */).remove();

    const analysisTimesTable = $(`
        <table class="${L.s(6, 4) /* ebacktesting-dialog-table */}">
        </table>
    `);
    container.append(analysisTimesTable);

    for (const analysisTime of L.session.meta.analysisTimes.filter(a => a.analysisDuration > 5 && a.analysisStartTime < L.session.currentDate).slice(0, 10)) {
        const row = $(`
            <tr>
                <td>${L.toTradingViewDateTimeFormat(analysisTime.analysisStartTime, window.TradingViewApi.activeChart().getTimezone())}</td>
                <td class="${L.s(6, 5) /* analysis-timespan */}" contenteditable readonly>${analysisTime.analysisTimespan}</td>
                <td class="${L.s(6, 6) /* ebacktesting-actions */}">
                    <button class="lightButton secondary xsmall typography-regular14px ${L.s(6, 7) /* select-analysis-time-button */}" title="${L.s(6, 8) /* Add to journal */}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M18.75 7.38h-3.37c.06-.3.09-.59.09-.88 0-1.87-1.37-3.25-3.6-3.25-1.77 0-2.22 1.9-2.95 3.08-.3.48-.67.9-1.01 1.3H7.9c-.6.7-.9.93-1.18.93h-.1c-.23-.2-.53-.31-.87-.31h-2.5c-.69 0-1.25.5-1.25 1.13v9c0 .62.56 1.12 1.25 1.12h2.5c.34 0 .64-.12.86-.31h.1c1.13 0 2.63 1.56 4.98 1.56h.83c2.44 0 3.86-1.51 3.9-3.56.5-.7.73-1.6.63-2.45.14-.28.24-.57.3-.87h1.4A3.27 3.27 0 0 0 22 10.63a3.3 3.3 0 0 0-3.25-3.26Zm0 4.62h-3.56c.5.57.57 1.67-.19 2.38.44.77.07 1.79-.5 2.1.25 1.53-.4 2.4-1.98 2.4h-.83c-1.78 0-3.02-1.4-4.69-1.55v-6.9c.99-.13 1.68-.84 2.3-1.56.45-.49.86-.98 1.21-1.55.57-.92 1.02-2.2 1.37-2.2.9 0 1.71.35 1.71 1.38 0 1.38-1.03 2.07-1.03 2.75h6.19c.72 0 1.38.64 1.38 1.38A1.4 1.4 0 0 1 18.75 12ZM5.44 17a.94.94 0 1 1-1.88 0 .94.94 0 0 1 1.88 0Z"></path></svg>
                    </button>
                </td>
            </tr>
        `);

        row.find(L.s(6, 2) /* .select-analysis-time-button */).on("click", async function() {
            const timeValue = row.find(`.${L.s(6, 5) /* analysis-timespan */}`).text();
            if (timeValue) {
                L.removeDummyShape();
                const position = L.session.getActivePositions()[0];
                if (position) {
                    position.columnValue("Analysis Time", timeValue);
                    L.updatePositionUI(position);
                }

            }
        });

        analysisTimesTable.append(row);
    }

    if(L.session.getActivePositions().length == 0) {
        analysisTimesTable.find(`.${L.s(6, 7) /* select-analysis-time-button */}`).hide();
    }

    footer.find(L.s(6, 3) /* button[name='cancel'] */).hide();
}
