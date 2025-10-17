import { L } from "./ebacktesting.core.js";

L.isPredefinedColumn = (columnName, exceptColumns) => {
    return (!exceptColumns || !exceptColumns.includes(columnName)) && [
        "Trade", "Date/Time", "Price", "Symbol", "Lots", "RR", "Risk", "Profit", "Cumulative profit", "Run-up", "Drawdown", "Snapshots", "BE Run-up", "Notes", "Analysis Time"
    ].includes(columnName);
};

L.updatePositionsList = function (reset) {
    if (L.isEbacktestingPanelOpen()) {
		L.session.meta.updatePositionListRequestCount = L.session.meta.updatePositionListRequestCount || 0;
		const updatePositionListRequestCount = ++L.session.meta.updatePositionListRequestCount;
        L.session.meta.sortByColumn = L.session.meta.sortByColumn || "Date/Time";

        if(reset) {
            $("div.replay_trading:not(.js-hidden) div.backtesting.deep-history .ka-icon.ka-icon-sort").remove();
            $("div.replay_trading:not(.js-hidden) div.backtesting.deep-history .V_POSITION").remove();
            $(`div.replay_trading:not(.js-hidden) div.backtesting.deep-history th.ka-thead-cell[column-name='${L.session.meta.sortByColumn}'] .ka-thead-cell-content-wrapper`).append(`<span class='ka-icon ka-icon-sort ka-icon-sort-arrow-${!L.session.meta.sortByDesc ? "up" : "down"}'></span>`);
        }
        
        const replayTradingButton = $("button[data-name='replay_trading']");
        clearTimeout(L.session.meta.showLoaderTimeout);
        L.session.meta.showLoaderTimeout = setTimeout(() => {
            replayTradingButton.text("eBacktesting *");
        }, 1500);

        var positionIndex = 0;
        L.asyncInterval(async() => {
            if (positionIndex >= L.session.positions.length || updatePositionListRequestCount < L.session.meta.updatePositionListRequestCount) {
                clearTimeout(L.session.meta.showLoaderTimeout);
                replayTradingButton.text("eBacktesting");
                return -1;
            }

            const position = L.session.positions[positionIndex];
            L.addToPositionList(position, !position.exitTime);
    
            if(reset) {
                delete position.meta.hash;
            }
            L.updatePositionUI(position);

            positionIndex++;
            await L.delay(30);
        }, 1);
    }
}

L.getColumnClass = function (column) {
    switch (column.columnType) {
        case "date":
        case "time":
        case "datetime":
        case "number": {
            return "rightAlign";
        }
        case "actions":
        case "bool": {
            return "centerAlign";
        }
        default: {
            return "leftAlign";
        }
    }
}

L.toJournalDisplayFormat = function (position, column) {
    var displayEdit = true;

    var value = position.columnValue(column.columnName);
    if (column.columnEnumValues) {
        const columnEnumValues = column.columnEnumValues.split(",").map(v => v.trim());
        if (value != null && value != undefined && !columnEnumValues.includes(value)) {
            columnEnumValues.push(value);
        }
        displayEdit = false;
        return `<select class="input size-small">${columnEnumValues.map(v => `<option ${v == value ? "selected" : ""}>${v}</option>`).join("")}</select>`;
    } else {
        if (column.columnType == "bool") {
            displayEdit = false;
            value = "<input type='checkbox' " + (value ? "checked" : "") + ">";
        } else if (column.columnType == "date" || column.columnType == "time" || column.columnType == "datetime") {
            value = (value || "").replace("T", " ");
        } else if (column.columnType == "number") {
            if (value) {
                if (L.isNumber(value)) {
                    value = Number(value);
                }
            }
        } else {
            value = (value || "").toString();
        }
    }
    if (displayEdit && (value || "").toString().trim().length == 0) {
        value = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'><path fill='currentColor' d='m21.45 7.55-1.8 1.8a.47.47 0 0 1-.67 0L14.65 5a.47.47 0 0 1 0-.66l1.8-1.8a1.88 1.88 0 0 1 2.65 0l2.35 2.35c.73.73.73 1.91 0 2.65ZM13.1 5.9 2.84 16.15l-.83 4.75a.94.94 0 0 0 1.1 1.09l4.74-.84L18.1 10.9a.47.47 0 0 0 0-.67L13.77 5.9a.47.47 0 0 0-.67 0Zm-6.25 9.37a.54.54 0 0 1 0-.77l6.01-6.01a.54.54 0 0 1 .78 0c.21.21.21.55 0 .77l-6.02 6.01a.54.54 0 0 1-.77 0Zm-1.41 3.29H7.3v1.42l-2.52.44-1.21-1.22.44-2.51h1.42v1.87Z'></path></svg>";
    }
    return value;
}

L.createHeaderCell = function (column) {
    var header = `<th class="ka-thead-cell ka-thead-background ka-pointer headCell ${L.getColumnClass(column)} ${column.visible ? '' : 'hidden'}" scope="col" column-name="${column.columnName}">`;
    if (column.columnName != "Trade") {
        header += `
            <div class="ka-thead-cell-wrapper">
                <div class="ka-thead-cell-content-wrapper">${column.columnName}</div>
            </div>
            `;
    }
    header += "</th>";
    return header;
}

L.createPositionsListHeader = function (reset) {
    var positionsContainer = $("div.replay_trading:not(.js-hidden) div.backtesting.deep-history");

    if (positionsContainer.length > 0) {
        if (!L.session.meta.positionsContainerCheckDate || (Date.now() - L.session.meta.positionsContainerCheckDate) > 2000) {
            L.session.meta.positionsContainerCheckDate = Date.now();
            if ($("button[data-name='replay_trading'][data-active='true']").length == 0) {
                $("div.ebacktesting-positions-table").remove();
                return null;
            }
            positionsContainer.find("[class*='container']:has(div[class*='strategyGroup'])").hide();
            positionsContainer.find("div[class*='tabsContainer']").hide();
            positionsContainer.find("div[class*='container']:has(div[class*='title']):has(div[class*='text'])").hide();
        }

        if (!reset && positionsContainer.find(`table.ka-table[ebacktesting-session=${L.session.sessionId}]`).length) {
            return positionsContainer;
        }

        $("div.ebacktesting-positions-table").remove();
        positionsContainer.children().hide();

        const listStructure = $(`
          <div class="wrapper ebacktesting-positions-table">
            <div class="ka root table">
              <div class="ka-table-wrapper tableWrapper">
                                <table class="ka-table" data-selector="table" style="table-layout: auto;">
                  <thead class="ka-thead">
                    <tr class="ka-tr ka-thead-row">
                                            <th class="ka-thead-cell ka-thead-background ka-pointer headCell fitContent centerAlign" scope="col" column-name="Trade">
                        <div class="ka-thead-cell-wrapper">
                            <div class="ka-thead-cell-content-wrapper">Trade</div>
                        </div>
                      </th>
                      ${L.session.sessionColumns.map(L.createHeaderCell).join("")}
                    </tr>
                  </thead>
                  <tbody class="ka-tbody">
                    <tr style="height: 0px;" class="positions-ui-first-row">
                      <td style="height: 0px;"></td>
                    </tr>
                    
                    <tr style="height: 0px;" class="positions-ui-last-row">
                      <td style="height: 0px;"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `);

        $(".ka-thead-cell-wrapper", listStructure).on("click", (e) => {
            L.sortPositions($(e.currentTarget).parents("th").attr("column-name"));
        });

        positionsContainer.append(listStructure);
        // Enable column resizing by dragging near the right edge of any header/body cell.
        (function enableColumnResize(){
            const tableEl = $(".ebacktesting-positions-table table.ka-table");
            if (!tableEl.length) return;

            // Removed legacy splitter overlay; we'll highlight the entire column border instead.
            const wrapper = $(".ebacktesting-positions-table .ka-table-wrapper.tableWrapper");
            if (!wrapper.length) return;
            if (wrapper.css('position') === 'static') wrapper.css('position','relative');
            // Inject highlight CSS once
            if (!document.getElementById('ebacktesting-col-highlight-style')) {
                const hlCss = `
                    <style id="ebacktesting-col-highlight-style">
                        .ebacktesting-col-highlight th[column-name],
                        .ebacktesting-col-highlight td[column-name]{ position:relative; }
                        /* Fallback border (some themes may ignore box-shadow) */
                        th.ebt-col-hl, td.ebt-col-hl { border-right:2px solid #707070 !important; }
                        th.ebt-col-hl-last, td.ebt-col-hl-last { border-left:2px solid #707070 !important; }
                    </style>`;
                $('head').append(hlCss);
            }
            const clearHighlight = () => { tableEl.find('th.ebt-col-hl, td.ebt-col-hl, th.ebt-col-hl-last, td.ebt-col-hl-last').removeClass('ebt-col-hl ebt-col-hl-last'); };

            // Apply previously saved widths, if any
            const applyInitialWidths = () => {
                const rules = [];
                const tradeW = L.session?.meta?.columnWidths?.Trade;
                if (tradeW) {
                    rules.push(`th[column-name='Trade'], td[column-name='Trade']{width:${tradeW}px;min-width:${tradeW}px;max-width:${tradeW}px;}`);
                }
                for (const c of (L.session.sessionColumns || [])) {
                    if (c.width && Number.isFinite(c.width)) {
                        const w = Math.max(40, Math.floor(c.width));
                        const safe = CSS.escape(c.columnName);
                        rules.push(`th[column-name='${safe}'], td[column-name='${safe}']{width:${w}px;min-width:${w}px;max-width:${w}px;}`);
                    }
                }
                $("#ebacktesting-colwidths").remove();
                if (rules.length) {
                    $("head").append(`<style id="ebacktesting-colwidths">${rules.join("\n")}</style>`);
                }
            };

            applyInitialWidths();

            const EDGE = 12; // px from right edge to activate resizing
            const MINW = 60; // minimum width in px
            const state = { active:false, column:null, startX:0, startW:0 };

            const isNearRightEdge = (el, e) => {
                const r = el.getBoundingClientRect();
                return e.clientX >= r.right - EDGE && e.clientX <= r.right + EDGE;
            };

            const applyWidth = (colName, widthPx) => {
                const w = Math.max(MINW, Math.floor(widthPx));
                const esc = CSS.escape(colName);
                tableEl.find(`th[column-name='${esc}'], td[column-name='${esc}']`).css({ width: w+"px", minWidth: w+"px", maxWidth: w+"px" });
            };

            // Cursor feedback and column highlight on hover near right edge
            tableEl.on('mousemove', "th[column-name], td[column-name]", function(e){
                const near = isNearRightEdge(this, e);
                this.style.cursor = near ? 'col-resize' : '';
                if (!state.active) clearHighlight();
                if (near || state.active) {
                    const colName = this.getAttribute('column-name');
                    const esc = CSS.escape(colName);
                    // Highlight all cells of the column by adding a right-edge indicator
                    tableEl.find(`th[column-name='${esc}'], td[column-name='${esc}']`).addClass('ebt-col-hl');
                }
            });
            tableEl.on('mouseleave', function(){ if (!state.active) clearHighlight(); });

            // Start resizing (activate highlight)
            tableEl.on('mousedown', "th[column-name], td[column-name]", function(e){
                if (!isNearRightEdge(this, e)) return;
                e.preventDefault(); e.stopPropagation();
                const colName = this.getAttribute('column-name');
                const header = tableEl.find(`th[column-name='${CSS.escape(colName)}']`).first();
                state.active = true; state.column = colName; state.startX = e.clientX; state.startW = header.outerWidth();
                document.body.classList.add('ebacktesting-resizing-col');
                clearHighlight();
                const esc = CSS.escape(colName);
                tableEl.find(`th[column-name='${esc}'], td[column-name='${esc}']`).addClass('ebt-col-hl');
            });

            // Global move/end handlers
            $(document)
                .on('mousemove.journalResize', function(e){
                    if (!state.active) return;
                    const newW = state.startW + (e.clientX - state.startX);
                    applyWidth(state.column, newW);
                })
                .on('mouseup.journalResize', function(){
                    if (!state.active) return;
                    const colName = state.column;
                    const header = tableEl.find(`th[column-name='${CSS.escape(colName)}']`).first();
                    const w = Math.max(MINW, Math.floor(header.outerWidth()));
                    if (colName === 'Trade') {
                        L.session.meta = L.session.meta || {}; L.session.meta.columnWidths = L.session.meta.columnWidths || {};
                        L.session.meta.columnWidths.Trade = w;
                    } else {
                        const col = (L.session.sessionColumns || []).find(c => c.columnName === colName);
                        if (col) col.width = w;
                        //L.tryExec(() => { L.saveSessionColumns(L.session.sessionId, L.session.sessionColumns); }, true);
                    }
                    state.active = false; state.column = null;
                    document.body.classList.remove('ebacktesting-resizing-col');
                    clearHighlight();
                });

            // Inject helper CSS to indicate resizing and prevent text selection while dragging
            if (!document.getElementById('ebacktesting-resize-style')) {
                $("head").append(`<style id="ebacktesting-resize-style">body.ebacktesting-resizing-col{cursor:col-resize!important;user-select:none!important}</style>`);
            }
        })();

        $(".ebacktesting-positions-table table.ka-table").attr("ebacktesting-session", L.session.sessionId);
        L.updatePositionsList(true);

        // --- Highlight all right borders of th/td on Ctrl/Shift/Alt ---
        (function enableKeyBorderHighlight(){
            const highlightClass = 'ebt-key-border-hl';
            const styleId = 'ebacktesting-keyborder-style';
            if (!document.getElementById(styleId)) {
                const css = `
                    th.${highlightClass}, td.${highlightClass} {
                        border-right: 1px solid #70707082;
                        transition: border-color 0.15s;
                    }
                `;
                document.head.insertAdjacentHTML('beforeend', `<style id="${styleId}">${css}</style>`);
            }
            let isActive = false;
            function setHighlight(on) {
                const tables = document.querySelectorAll('.ebacktesting-positions-table table.ka-table');
                tables.forEach(table => {
                    table.querySelectorAll('th[column-name], td[column-name]').forEach(cell => {
                        if (on) cell.classList.add(highlightClass);
                        else cell.classList.remove(highlightClass);
                    });
                });
            }
            function keyHandler(e) {
                if (e.shiftKey) {
                    if (!isActive) { setHighlight(true); isActive = true; }
                } else {
                    if (isActive) { setHighlight(false); isActive = false; }
                }
            }
            function upHandler(e) {
                // On any keyup, check if any modifier is still held
                if (!(e.shiftKey)) {
                    setHighlight(false); isActive = false;
                }
            }
            document.addEventListener('keydown', keyHandler, true);
            document.addEventListener('keyup', upHandler, true);
        })();
    }

    return positionsContainer;
}

L.createPositionListCell = function (column) {
    switch (column.columnName) {
        case "Trade": {
            return `
                <td class="ka-cell cell noPadding justifyStart ${column.visible ? '' : 'hidden'}" column-name="Trade">
                    <div class="doubleCell">
                        <div class="cell V_STATUS" data-part="0"></div>
                        <div class="cell" data-part="1">Entry #DIRECTION#</div>
                    </div>
                </td>`;
        }
        case "Date/Time": {
            return `
                <td class="ka-cell cell noPadding justifyEnd ${column.visible ? '' : 'hidden'} rightAlign" column-name="Date/Time">
                    <div class="doubleCell">
                        <div class="cell date-cell V_EXITDATE" data-part="0"></div>
                        <div class="cell date-cell V_ENTRYDATE" data-part="1"></div>
                    </div>
                </td>`;
        }
        case "Price": {
            return `
                <td class="ka-cell cell noPadding justifyEnd ${column.visible ? '' : 'hidden'}" column-name="Price">
                    <div class="doubleCell">
                        <div class="cell" data-part="0">
                            <div class="tableCell twoRows">
                                <div class="currencyWrapper">
                                    <div class="value V_LATESTPRICE"></div>
                                    <div class="currency V_LATESTPRICECURRENCY">#SYMBOLCURRENCY#</div>
                                </div>
                                <div class="percentValue small"></div>
                            </div>
                        </div>
                        <div class="cell" data-part="1">
                            <div class="tableCell twoRows">
                                <div class="currencyWrapper">
                                    <div class="value">#ENTRYPRICE#</div>
                                    <div class="currency">#SYMBOLCURRENCY#</div>
                                </div>
                                <div class="percentValue small"></div>
                            </div>
                        </div>
                    </div>
                </td>`;
        }
        case "Risk": {
            return `
                <td class="ka-cell cell justifyStart ${column.visible ? '' : 'hidden'}" column-name="Risk">
                    <div class="tableCell twoRows ">
                        <div class="currencyWrapper">
                            <div class="value V_RISK"></div>
                            <div class="currency">#ACCOUNTCURRENCY#</div>
                        </div>
                        <div class="percentValue small"><span class="V_RISKPERCENTAGE"></span>%</div>
                    </div>
                </td>`;
        }
        case "Profit": {
            return `
                <td class="ka-cell cell justifyStart ${column.visible ? '' : 'hidden'}" column-name="Profit">
                    <div class="tableCell twoRows">
                        <div class="currencyWrapper">
                            <div class="value V_PROFIT"></div>
                            <div class="currency">#ACCOUNTCURRENCY#</div>
                        </div>
                        <div class="percentValue small"><span class="V_PROFITPERCENTAGE"></span>%</div>
                    </div>
                </td>`;
        }
        case "Cumulative profit": {
            return `
                <td class="ka-cell cell justifyStart ${column.visible ? '' : 'hidden'}" column-name="Cumulative profit">
                    <div class="tableCell twoRows">
                        <div class="currencyWrapper">
                            <div class="value V_CUMULATIVEPROFIT"></div>
                            <div class="currency">#ACCOUNTCURRENCY#</div>
                        </div>
                        <div class="percentValue small"><span class="V_CUMULATIVEPROFITPERCENTAGE"></span>%</div>
                    </div>
                </td>`;
        }
        case "Run-up": {
            return `
                <td class="ka-cell cell justifyStart ${column.visible ? '' : 'hidden'}" column-name="Run-up">
                    <div class="tableCell twoRows">
                        <div class="currencyWrapper">
                            <div class="value V_RUNUP"></div>
                            <div class="currency">#ACCOUNTCURRENCY#</div>
                        </div>
                        <div class="percentValue small"><div class="V_RUNUPPERCENTAGE"></div>%</div>
                    </div>
                </td>`;
        }
        case "Drawdown": {
            return `
                <td class="ka-cell cell justifyStart ${column.visible ? '' : 'hidden'}" column-name="Drawdown">
                    <div class="tableCell twoRows">
                        <div class="currencyWrapper">
                            <div class="value V_DRAWDOWN"></div>
                            <div class="currency">#ACCOUNTCURRENCY#</div>
                        </div>
                        <div class="percentValue small"><div class="V_DRAWDOWNPERCENTAGE"></div>%</div>
                    </div>
                </td>`;
        }
        case "BE Run-up": {
            return `
                <td class="ka-cell cell justifyStart ${column.visible ? '' : 'hidden'}" column-name="BE Run-up">
                    <div class="tableCell twoRows">
                        <div class="currencyWrapper">
                            <div class="value V_BERUNUP"></div>
                            <div class="currency">#ACCOUNTCURRENCY#</div>
                        </div>
                        <div class="percentValue small"><div class="V_BERUNUPPERCENTAGE"></div>%</div>
                    </div>
                </td>`;
        }
        case "Snapshots": {
            return `
                <td class="ka-cell cell justifyStart centerAlign ${column.visible ? '' : 'hidden'}" column-name="Snapshots">
                    <div class="snapshot-action-buttons">
                        <div data-role="button" class="view-snapshots-button apply-common-tooltip controls-button button isInteractive" title="View 0 snapshots" data-snapshots="0">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" fill-rule="evenodd" d="M3.5 14S7.06 6 14 6c6.94 0 10.5 8 10.5 8S21 22 14 22 3.5 14 3.5 14Zm1.95.5-.27-.5A15.92 15.92 0 0 1 7.28 11C8.9 9.14 11.15 7.5 14 7.5c2.85 0 5.1 1.64 6.72 3.49a16.8 16.8 0 0 1 2.1 3.01 15.9 15.9 0 0 1-2.07 3.01c-1.62 1.85-3.87 3.49-6.75 3.49s-5.13-1.64-6.75-3.49a16.5 16.5 0 0 1-1.8-2.52Zm-.58.11ZM16.5 14a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm1.5 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"></path></svg>
                        </div>
                        <div data-role="button" class="take-snapshot-button apply-common-tooltip controls-button button isInteractive" title="Take a snapshot">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.118 6a.5.5 0 0 0-.447.276L9.809 8H5.5A1.5 1.5 0 0 0 4 9.5v10A1.5 1.5 0 0 0 5.5 21h16a1.5 1.5 0 0 0 1.5-1.5v-10A1.5 1.5 0 0 0 21.5 8h-4.309l-.862-1.724A.5.5 0 0 0 15.882 6h-4.764zm-1.342-.17A1.5 1.5 0 0 1 11.118 5h4.764a1.5 1.5 0 0 1 1.342.83L17.809 7H21.5A2.5 2.5 0 0 1 24 9.5v10a2.5 2.5 0 0 1-2.5 2.5h-16A2.5 2.5 0 0 1 3 19.5v-10A2.5 2.5 0 0 1 5.5 7h3.691l.585-1.17z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M13.5 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm0 1a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z"></path></svg>
                        </div>
                        <div data-role="button" class="take-snapshot-loader apply-common-tooltip controls-button button isInteractive" style="display: none" title="Taking the snapshot...">
                            <svg class="ebacktesting-loader" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M13.88 3.88a1.88 1.88 0 1 1-3.76 0 1.88 1.88 0 0 1 3.76 0ZM12 18.24A1.88 1.88 0 1 0 12 22a1.88 1.88 0 0 0 0-3.75Zm8.13-8.13a1.88 1.88 0 1 0 0 3.76 1.88 1.88 0 0 0 0-3.76ZM5.74 12A1.88 1.88 0 1 0 2 12a1.88 1.88 0 0 0 3.75 0Zm.5 3.87a1.88 1.88 0 1 0 0 3.75 1.88 1.88 0 0 0 0-3.75Zm11.5 0a1.88 1.88 0 1 0 0 3.75 1.88 1.88 0 0 0 0-3.75ZM6.25 4.38a1.87 1.87 0 1 0 0 3.75 1.87 1.87 0 0 0 0-3.75Z"></path></svg>
                        </div>
                    </div>
                </td>`;
        }
        default: {
            return `
                <td class="ka-cell cell justifyStart ${L.getColumnClass(column)} ${column.visible ? '' : 'hidden'}" column-name="${column.columnName}">
                    <div class="V_VALUE"></div>
                </td>`;
        }
    }
}

L.addToPositionList = function (position, insertFirst) {
    if (L.isEbacktestingPanelOpen()) {
        if(!$(`tr#ID_${position.positionId}`).length) {
            var positionStructure = `
            <tr class="ka-tr ka-row row V_POSITION" data="#INDEX#" id="ID_#ID#">
                <td class="ka-cell cell" column-name="Trade">
                <div class="V_INDEX">#INDEX#</div>
                <div class="action-buttons">
                    <div data-role="button" class="close-trade-button apply-common-tooltip controls-button button isInteractive" title="Close trade">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.9 12.63c.2.18.2.5 0 .68l-1.6 1.6a.48.48 0 0 1-.68 0L12 14.25 9.37 16.9a.48.48 0 0 1-.68 0l-1.6-1.6a.48.48 0 0 1 0-.68L9.75 12 7.1 9.37a.48.48 0 0 1 0-.68l1.6-1.6c.18-.19.49-.19.68 0L12 9.74l2.63-2.64c.18-.2.5-.2.68 0l1.6 1.6c.19.18.19.49 0 .68L14.26 12l2.64 2.63Z"></path>
                        </svg>
                    </div>
                    <div data-role="button" class="show-be-button apply-common-tooltip controls-button button isInteractive" title="Set BE level">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M12 3.94a8.06 8.06 0 1 1 0 16.12 8.06 8.06 0 0 1 0-16.12ZM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 6.77a3.23 3.23 0 1 0 0 6.46 3.23 3.23 0 0 0 0-6.46Z"></path>
                        </svg>
                    </div>
                    <div data-role="button" class="hide-be-button apply-common-tooltip controls-button button isInteractive" title="Remove BE level">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM6.68 13.61a.49.49 0 0 1-.49-.48v-2.26c0-.27.22-.48.49-.48h10.64c.27 0 .49.21.49.48v2.26c0 .27-.22.48-.49.48H6.68Z"></path>
                        </svg>
                    </div>
                </div>
                </td>
                ${L.session.sessionColumns.map(column => L.createPositionListCell(column)).join("")}
            </tr>
            `
                .replaceAll("#ID#", position.positionId)
                .replaceAll("#INDEX#", position.getIndex())
                .replaceAll("#DIRECTION#", position.getDirection())
                .replaceAll("#ORDERTYPE#", position.getOrderType())
                .replaceAll("#ENTRYPRICE#", position.getEntryPrice())
                .replaceAll("#SYMBOLCURRENCY#", position.getSymbolCurrency())
                .replaceAll("#ACCOUNTCURRENCY#", L.session.currencyId)
                ;

            L.optimizePositionsList();

            if(insertFirst) {
                $(".positions-ui-first-row").after($(positionStructure));
            } else {
                $(".positions-ui-last-row").before($(positionStructure));
            }

            $(`tr#ID_${position.positionId}`).on("click", () => { L.onSelectPositionRow(position) });
            $(`tr#ID_${position.positionId}`).on("dblclick", (e) => { L.onDblClickPositionRow(e, position) });
            $(`tr#ID_${position.positionId} .action-buttons .close-trade-button`).on("click", () => { L.onCloseTradeButtonClick(position) });
            $(`tr#ID_${position.positionId} .action-buttons .show-be-button`).on("click", () => { L.onShowBEButtonClick(position) });
            $(`tr#ID_${position.positionId} .action-buttons .hide-be-button`).on("click", () => { L.onHideBEButtonClick(position) });
            $(`tr#ID_${position.positionId} .date-cell`).on("click", (e) => { L.onDateCellClick(e, position) });
            $(`tr#ID_${position.positionId} .date-cell`).on("mouseenter", (e) => { L.onDateCellMouseEnter(e, position) });
            $(`tr#ID_${position.positionId} .date-cell`).on("mouseleave", (e) => { L.onDateCellMouseLeave(e, position) });
            $(`tr#ID_${position.positionId} .view-snapshots-button`).on("click", (e) => { L.viewSnapshots(e, position) });
            $(`tr#ID_${position.positionId} .take-snapshot-button`).on("click", async (e) => { await L.onTakeSnapshot(e, position) });
            $(`tr#ID_${position.positionId} td[column-name] div`).on("click", (e) => { L.onEditField(e, position) });

            if (position.bePrice()) {
                $(`tr#ID_${position.positionId}.V_POSITION .action-buttons .show-be-button`).hide();
                $(`tr#ID_${position.positionId}.V_POSITION .action-buttons .hide-be-button`).show();
            } else {
                $(`tr#ID_${position.positionId}.V_POSITION .action-buttons .show-be-button`).show();
                $(`tr#ID_${position.positionId}.V_POSITION .action-buttons .hide-be-button`).hide();
            }
        }
    }
}

L.optimizePositionsList = function() {
    $(".positions-ui-first-row").parents(".ka-table-wrapper.tableWrapper").scrollTop(0);

    const wrapper = $('.ka-table-wrapper.tableWrapper');
    const allRows = wrapper.find('tr.V_POSITION');
    const maxVisibleRows = 20;

    if (allRows.length <= maxVisibleRows) {
        return;
    }

    allRows.each((index, row) => {
        row = $(row);
        if(index > 20) {
            row.addClass('hidden');
        }
    });

    wrapper.off('scroll.optimize').on('scroll.optimize', function() {
        clearTimeout(L.positionsListScrollTimeout);
        L.positionsListScrollTimeout = setTimeout(() => {
            const scrollTop = wrapper.scrollTop();
            const viewportHeight = wrapper.height();
            const scrollHeight = wrapper[0].scrollHeight;

            allRows.each((index, row) => {
                row = $(row);
                const isHidden = row.hasClass('hidden');
                
                if (scrollHeight - scrollTop - viewportHeight < 500 && isHidden) {
                    row.removeClass('hidden');
                    // return false;
                }
            });
        }, 50);
    });

    // Initial optimization
    wrapper.trigger('scroll.optimize');
}


L.updatePositionUI = function (position) {
    if (L.isEbacktestingPanelOpen()) {
        const currentHash = JSON.stringify({...position, ...position.meta, hash: undefined, index: undefined });

        if (position.meta.hash === currentHash) {
            return;
        }

        position.meta.hash = currentHash;

        const positionElement = $(`#ID_${position.positionId}.V_POSITION`);
        if (positionElement.length) {
            positionElement.find(".action-buttons").addClass(position.exitTime ? "" : "openTrade").removeClass(position.exitTime ? "openTrade" : "");
            positionElement.find(".V_INDEX").addClass(position.exitTime ? "" : "openTrade").removeClass(position.exitTime ? "openTrade" : "");

            const activeChart = window.TradingViewApi.activeChart();

            for (const column of L.session.sessionColumns) {
                switch (column.columnName) {
                    case "Trade": {
                        positionElement.find(".V_STATUS").addClass(position.exitTime ? "" : "openTrade").removeClass(position.exitTime ? "openTrade" : "").text(position.getStatus());
                        break;
                    }
                    case "Date/Time": {
                        positionElement.find(".V_EXITDATE").addClass(position.exitTime ? "" : "openTrade").removeClass(position.exitTime ? "openTrade" : "").text(position.getExitDate(activeChart));
                        positionElement.find(".V_ENTRYDATE").text(position.getEntryDate(activeChart));
                        break;
                    }
                    case "Price": {
                        positionElement.find(".V_LATESTPRICE").addClass(position.exitTime ? "" : "openTrade").removeClass(position.exitTime ? "openTrade" : "").text(position.getLatestPrice());
                        positionElement.find(".V_LATESTPRICECURRENCY").addClass(position.exitTime ? "" : "openTrade").removeClass(position.exitTime ? "openTrade" : "");
                        break;
                    }
                    case "Lots": {
                        positionElement.find("td[column-name='Lots'] .V_VALUE")
                            .text(position.getQuantity())
                            .attr('title', `Leverage: ${position.getLeverage()}x`);
                        break;
                    }
                    case "Risk": {
                        positionElement.find(".V_RISK").text(position.getRisk());
                        positionElement.find(".V_RISKPERCENTAGE").text(position.getRiskPercentage());
                        break;
                    }
                    case "Profit": {
                        positionElement.find(".V_PROFIT").text(position.getProfit());
                        positionElement.find(".V_PROFITPERCENTAGE").text(position.getProfitPercentage());
                        break;
                    }
                    case "Cumulative profit": {
                        positionElement.find(".V_CUMULATIVEPROFIT").text(position.getCumulativeProfit());
                        positionElement.find(".V_CUMULATIVEPROFITPERCENTAGE").text(position.getCumulativeProfitPercentage());
                        break;
                    }
                    case "Run-up": {
                        positionElement.find(".V_RUNUP").text(position.getRunUp());
                        positionElement.find(".V_RUNUPPERCENTAGE").text(position.getRunUpPercentage());
                        break;
                    }
                    case "Drawdown": {
                        positionElement.find(".V_DRAWDOWN").text(position.getDrawDown());
                        positionElement.find(".V_DRAWDOWNPERCENTAGE").text(position.getDrawDownPercentage());
                        break;
                    }
                    case "BE Run-up": {
                        positionElement.find(".V_BERUNUP").text(position.getBERunUp());
                        positionElement.find(".V_BERUNUPPERCENTAGE").text(position.getBERunUpPercentage());
                        break;
                    }
                    case "Snapshots": {
                        positionElement.find(".view-snapshots-button").attr("data-snapshots", position.positionSnapshots.length);
                        positionElement.find(".view-snapshots-button").attr("title", `View ${position.positionSnapshots.length > 1 ? position.positionSnapshots.length + " " : ""}snapshot${position.positionSnapshots.length > 1 ? "s" : ""}`);
                        break;
                    }
                    default: {
                        positionElement.find(`td[column-name='${column.columnName}'] .V_VALUE`).html(L.toJournalDisplayFormat(position, column));
                        break;
                    }
                }
            }
        }
    }
}

L.isEbacktestingPanelOpen = function() {
    const cacheKey = "isEbacktestingPanelOpen";
    
    const cacheEntry = L.cache.getIfExists(cacheKey);
    if(cacheEntry[0]) {
        return cacheEntry[1];
    }

    const isOpen = $("div.replay_trading:not(.js-hidden) div.backtesting.deep-history").length == 1;
    L.cache.set(cacheKey, isOpen, 2);
    return isOpen;
}

L.onDateCellClick = async function (event, position) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    if (!L.isEditingPositionsList()) {
        const element = $(event.currentTarget);
        L.getPositionChart(position, true)?.setActive();
        
        setTimeout(() => {
            L.onSelectPositionRow(position, true);
        }, 1000);

        if (element.hasClass("V_ENTRYDATE")) {
            if(L.session.meta.isReviewMode) {
                await L.selectDateWithWarmup(position.entryTime);
            } else {
                L.gotoTime(position.entryTime);
            }
        } else if (element.hasClass("V_EXITDATE")) {
            if(L.session.meta.isReviewMode && position.exitTime) {
                await L.selectDateWithWarmup(position.exitTime);
            } else {
                L.gotoTime(position.exitTime || L.session.currentDate);
            }
        }
    }
}

L.onDateCellMouseEnter = function (event, position) {
    const element = $(event.currentTarget);
    if (!element.hasClass("openTrade")) {
        if (element.find("svg").length == 0) {
            element.prepend(`<svg class="cell" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" fill-rule="evenodd" d="M3.58 9.5a5.45 5.45 0 0 0 4.92 4.92V16h1v-1.58a5.45 5.45 0 0 0 4.92-4.92H16v-1h-1.58A5.45 5.45 0 0 0 9.5 3.58V2h-1v1.58A5.45 5.45 0 0 0 3.58 8.5H2v1h1.58ZM8.5 6V4.58A4.45 4.45 0 0 0 4.58 8.5H6v1H4.58a4.45 4.45 0 0 0 3.92 3.92V12h1v1.42a4.45 4.45 0 0 0 3.92-3.92H12v-1h1.42A4.45 4.45 0 0 0 9.5 4.58V6h-1Z"></path></svg>`);          
        }
    }
}

L.onDateCellMouseLeave = function (event, position) {
    const element = $(event.currentTarget);
    element.find("svg").remove();    
}

L.onSelectPositionRow = async function (position, forceSelect) {
    if (!L.isEditingPositionsList()) {
        $(`tr#ID_${position.positionId}`).toggleClass("selected").siblings().removeClass("selected");
        if(forceSelect) {
            $(`tr#ID_${position.positionId}`).addClass("selected");
        }

        if ($(`tr#ID_${position.positionId}`).hasClass("selected")) {
            for (const p of L.session.positions) {
                if (p.meta.hasShapeRedraw) {
                    L.removeShapeForPosition(p, true);
                }
            }
            const shapes = await L.drawShapeForPosition(position);
            if(shapes.some(s => s)) {
                const isShapeOnScreen = function(shape) {
                    if(shape) {
                        const shapePoints = shape.getPoints();
                        return L.getCharts().filter(c => c.symbol() == position.symbol.symbolName || c.chartModel().mainSeries().symbolInfo().pro_name == position.symbol.symbolName).some(c => {
                            const visibleRange = c.getVisibleRange();
                            if(visibleRange.from <= shapePoints[0]?.time && shapePoints[1]?.time <= visibleRange.to) {
                                return true;
                            }

                            return false;
                        });
                    }
                };

                if(!shapes.some(s => isShapeOnScreen(s))) {
                    L.toast("Click entry/exit dates in the eBacktesting panel to jump to the trade.", 2000);
                }
            } else {
                if (!L.isSameSymbol(TradingViewApi.activeChart(), position)) {
                    L.toast("Double click to open the position's chart", 2000);
                }
            }
        } else {
            L.removeShapeForPosition(position, true);
        }
    }
}

L.onDblClickPositionRow = async function (event, position) {
    if (!L.isEditingPositionsList()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        if (!L.getPositionChart(position, true)) {
            await L.changeSymbol(TradingViewApi.activeChart(), position.symbol.symbolName);
        }

        if (await L.drawShapeForPosition(position)) {
            $(`tr#ID_${position.positionId}`).addClass("selected").siblings().removeClass("selected");
            for (const p of L.session.positions) {
                if (p.meta.hasShapeRedraw) {
                    L.removeShapeForPosition(p, true);
                }
            }
        }
    }
}

L.onCloseTradeButtonClick = function (position) {
    const chart = L.getPositionChart(position);
    if (chart) {
        position.exitPrice = position.meta.currentPrice;
        L.closePosition(position, 0 /* Manual */, chart);
    }
}

L.onShowBEButtonClick = function (position) {
    L.showBeLine(position, L.getPositionChart(position, true));
}

L.onHideBEButtonClick = function (position) {
    L.removeBeLine(position, L.getPositionChart(position, true));
}

L.onEditField = function (event, position) {
    const element = $(event.currentTarget);
    if (!L.isEditingPositionsList()) {
        if (element.hasClass("V_DRAWDOWNPERCENTAGE") && position.exitTime) {
            L.createInput("number", event, position);
        } else if (element.hasClass("V_RUNUPPERCENTAGE") && position.exitTime) {
            L.createInput("number", event, position);
        } else if (element.hasClass("V_BERUNUPPERCENTAGE") && position.exitTime) {
            L.createInput("number", event, position);
        } else if (element.hasClass("V_DRAWDOWN") && position.exitTime) {
            L.createInput("number", event, position);
        } else if (element.hasClass("V_RUNUP") && position.exitTime) {
            L.createInput("number", event, position);
        } else if (element.hasClass("V_BERUNUP") && position.exitTime) {
            L.createInput("number", event, position);
        } else if (element.hasClass("V_VALUE")) {
            const columnName = $(event.currentTarget).parent().attr("column-name");
            if (!L.isPredefinedColumn(columnName, ["Notes", "Analysis Time", "Lots", "RR"])) {
                const column = L.session.sessionColumns.find(c => c.columnName == columnName);
                if (column.columnEnumValues) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    position.columnValue(element.parent().attr("column-name"), event.target.value);
                } else {
                    switch (column.columnType) {
                        case "text":
                        case "date":
                        case "time":
                        case "datetime":
                        case "number": {
                            if(columnName == "Lots" && L.session.getParameter(L.sessionParameterIds.CanModifyQty) != 'true') {
                                return;
                            }
                            if(L.permissions.includes("CanModifyPositionQty")) {
                                L.createInput(column.columnType, event, position);
                            } else {
                                L.messageBox("Feature disabled", "Modifying position quantity is disabled in your current eBacktesting plan. Please upgrade to enable this feature.");
                            }
                            break;
                        }
                        case "richtext": {
                            L.createTextAreaInput(event, position);
                            break;
                        }
                        case "bool": {
                            position.columnValue(element.parent().attr("column-name"), event.target.checked);
                            event.stopPropagation();
                            event.stopImmediatePropagation();
                            break;
                        }
                    }
                }
            }
        }
    }
}

L.createInput = function (columnType, event, position) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const element = $(event.currentTarget);
    if (!element.children("input").length) {
        var value = element.html();
        const width = element.width();
        const height = element.height();
        if (value.includes("<svg")) {
            value = "";
        }

        const inputType = columnType == "datetime" ? "datetime-local" : columnType;

        element.html(`<input type="${inputType}" value="${value}" />`);
        const control = element.children("input");
        control.width(width * 1.5);
        control.height(height);
        control.on("focus", function () { this.select(); }).focus();
        control.focus();
        control.on("blur", (e) => {
            var userValue = e.target.value;

            if (element.hasClass("V_RUNUP")) {
                userValue = Math.abs(userValue);
                position.columnValue("Run-up", userValue);
                element.parents("td").find(".V_RUNUPPERCENTAGE").text(position.getRunUpPercentage());
                position.meta.trackRunUp = false;
            } else if (element.hasClass("V_DRAWDOWN")) {
                userValue = -Math.abs(userValue);
                position.columnValue("Drawdown", userValue);
                element.parents("td").find(".V_DRAWDOWNPERCENTAGE").text(position.getDrawDownPercentage());
                position.meta.trackDrawDown = false;
            } else if (element.hasClass("V_RUNUPPERCENTAGE")) {
                userValue = Math.abs(userValue);
                position.columnValue("Run-up", userValue * position.meta.initialBalance / 100);
                element.parents("td").find(".V_RUNUP").text(position.getRunUp());
                position.meta.trackRunUp = false;
            } else if (element.hasClass("V_DRAWDOWNPERCENTAGE")) {
                userValue = -Math.abs(userValue);
                position.columnValue("Drawdown", userValue * position.meta.initialBalance / 100);
                element.parents("td").find(".V_DRAWDOWN").text(position.getDrawDown());
                position.meta.trackDrawDown = false;
            } else if (element.hasClass("V_BERUNUP")) {
                userValue = Math.abs(userValue);
                position.columnValue("BE Run-up", userValue);
                element.parents("td").find(".V_BERUNUPPERCENTAGE").text(position.getBERunUpPercentage());
                if(position.columnValue("Run-up") < position.getBERunUp()) {
                    position.columnValue("Run-up", position.getBERunUp());
                    element.parents("td").parent().find(".V_RUNUP").text(position.getRunUp());
                    element.parents("td").parent().find(".V_RUNUPPERCENTAGE").text(position.getRunUpPercentage());
                }
                position.meta.trackBeRunUp = false;
            } else if (element.hasClass("V_BERUNUPPERCENTAGE")) {
                userValue = Math.abs(userValue);
                position.columnValue("BE Run-up", userValue * position.meta.initialBalance / 100);
                element.parents("td").find(".V_BERUNUP").text(position.getBERunUp());
                if(position.columnValue("Run-up") < position.getBERunUp()) {
                    position.columnValue("Run-up", position.getBERunUp());
                    element.parents("td").parent().find(".V_RUNUP").text(position.getRunUp());
                    element.parents("td").parent().find(".V_RUNUPPERCENTAGE").text(position.getRunUpPercentage());
                }
                position.meta.trackBeRunUp = false;
            } else if(element.parents("td").attr("column-name") == "Lots") {
                const qtyDiff = position.quantity / Number(userValue);

                position.quantity = Number(userValue);
                L.dataOps.updatePositionQuantity(position.positionId, position.quantity);

                if(qtyDiff != 0) {
                    position.risk(position.getRisk(true) / qtyDiff);
                    position.columnValue("BE Run-up", position.getBERunUp(true) / qtyDiff);
                    position.columnValue("Run-up", position.getRunUp(true) / qtyDiff);
                    position.columnValue("Drawdown", position.getDrawDown(true) / qtyDiff);
                    
                    if(position.exitTime) {
                        position.meta.profit = position.getProfitAtPrice(position.exitPrice, true);
                    }
                }

                L.getBalanceAfterPositions(L.session.capital, L.session.positions).then((balance) => { L.session.meta.balance = balance; });
                L.updatePositionUI(position);
            } else {
                position.columnValue(element.parent().attr("column-name"), userValue);
            }

            if (columnType == "date" || columnType == "time" || columnType == "datetime") {
                userValue = userValue.replace("T", " ");
            } else if (columnType == "number") {
                userValue = Number(userValue);
            }

            if (userValue.toString().trim().length == 0) {
                userValue = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'><path fill='currentColor' d='m21.45 7.55-1.8 1.8a.47.47 0 0 1-.67 0L14.65 5a.47.47 0 0 1 0-.66l1.8-1.8a1.88 1.88 0 0 1 2.65 0l2.35 2.35c.73.73.73 1.91 0 2.65ZM13.1 5.9 2.84 16.15l-.83 4.75a.94.94 0 0 0 1.1 1.09l4.74-.84L18.1 10.9a.47.47 0 0 0 0-.67L13.77 5.9a.47.47 0 0 0-.67 0Zm-6.25 9.37a.54.54 0 0 1 0-.77l6.01-6.01a.54.54 0 0 1 .78 0c.21.21.21.55 0 .77l-6.02 6.01a.54.54 0 0 1-.77 0Zm-1.41 3.29H7.3v1.42l-2.52.44-1.21-1.22.44-2.51h1.42v1.87Z'></path></svg>";
            }
            element.html(userValue);
        });
    }
}

L.createTextAreaInput = function (event, position) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const element = $(event.currentTarget);
    if (!element.children("input").length) {
        var value = element.text();
        const width = element.width();
        const height = element.height();
        if (value.includes("<svg")) {
            value = "";
        }

        element.html(`<textarea rows="3">${value}</textarea>`);
        const control = element.children("textarea");
        control.width(Math.max(width, 200));
        control.height(Math.max(height, 80));
        control.on("focus", function () { this.select(); }).focus();
        control.focus();
        control.on("blur", (e) => {
            var userValue = e.target.value.trim();
            position.columnValue(element.parent().attr("column-name"), userValue);
            if (userValue.trim().length == 0) {
                userValue = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'><path fill='currentColor' d='m21.45 7.55-1.8 1.8a.47.47 0 0 1-.67 0L14.65 5a.47.47 0 0 1 0-.66l1.8-1.8a1.88 1.88 0 0 1 2.65 0l2.35 2.35c.73.73.73 1.91 0 2.65ZM13.1 5.9 2.84 16.15l-.83 4.75a.94.94 0 0 0 1.1 1.09l4.74-.84L18.1 10.9a.47.47 0 0 0 0-.67L13.77 5.9a.47.47 0 0 0-.67 0Zm-6.25 9.37a.54.54 0 0 1 0-.77l6.01-6.01a.54.54 0 0 1 .78 0c.21.21.21.55 0 .77l-6.02 6.01a.54.54 0 0 1-.77 0Zm-1.41 3.29H7.3v1.42l-2.52.44-1.21-1.22.44-2.51h1.42v1.87Z'></path></svg>";
            }

            element.html(userValue);
        });
    }
}

L.isEditingPositionsList = function () {
    return $(".ebacktesting-positions-table input:not([type='checkbox'])").length > 0
        || $(".ebacktesting-positions-table textarea").length > 0;
}

L.saveSessionColumns = function (sessionId, columns) {
    const defaultColumns = [
        { columnName: "Trade", columnType: "actions", sortable: false, visible: true },
        { columnName: "Date/Time", columnType: "datetime", sortable: true, visible: true },
        { columnName: "Price", columnType: "number", sortable: true, visible: true },
        { columnName: "Symbol", columnType: "text", sortable: true, visible: false },
        { columnName: "Lots", columnType: "number", sortable: true, visible: true },
        { columnName: "RR", columnType: "number", sortable: true, visible: false },
        { columnName: "Risk", columnType: "number", sortable: true, visible: true },
        { columnName: "Profit", columnType: "number", sortable: true, visible: true },
        { columnName: "Cumulative profit", columnType: "number", sortable: true, visible: false },
        { columnName: "Run-up", columnType: "number", sortable: true, visible: true },
        { columnName: "Drawdown", columnType: "number", sortable: true, visible: true },
        { columnName: "BE Run-up", columnType: "number", sortable: true, visible: false },
        { columnName: "Snapshots", columnType: "actions", sortable: false, visible: true },
        { columnName: "Notes", columnType: "richtext", sortable: false, visible: true },
        { columnName: "Analysis Time", columnType: "time", sortable: true, visible: true }
    ];

    if(!columns) {
        columns = [];
    }

    for (const defaultColumn of defaultColumns) {
        const column = columns.find(c => c.columnName == defaultColumn.columnName);
        if (!column) {
            columns.push(defaultColumn);
        } else {
            column.sortable = column.sortable ?? defaultColumn.sortable;
            column.columnType = column.columnType ?? defaultColumn.columnType;
        }
    }

    return L.dataOps.saveSessionColumns(sessionId, columns);
}
