import { L } from "./ebacktesting.core.js";

L.createSettingsUI = function (dialogContainer) {
    dialogContainer.find("div[class*='tabs']").remove();
    const container = dialogContainer.find("div[class*='scrollable'] div[class*='content']");
    container.children().remove();

    const footer = dialogContainer.find("div[class*='footer']");
    footer.find("span[role='button'][data-role='listbox']").remove();

    container.append($("<h3 class='ebacktesting-dialog-section-title'>Options</h3>"));
    var section = $("<div>").addClass("ebacktesting-dialog-options-section");
    container.append(section);
    var optionsSection = $(`
            <input type='checkbox' id='ebacktesting-option-MinReplayResolutionDummy' checked>
            <label for="ebacktesting-option-MinReplayResolution">Minimum step forward</label>
            <select id="ebacktesting-option-MinReplayResolution">
            </select>
            <span title="The minimum replay interval when clicking the step forward button (Shift + ⇨). When skipping candles, all increments are based on this interval. By default, it's the minimum supported by your TradingView subscription plan." class="icon-wrapper with-tooltip apply-common-tooltip iconWrapper default small" tabindex="-1"><span role="img" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Zm1-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM8.5 9.5H7V8h3v6H8.5V9.5Z"></path></svg></span></span>
            <br/>
            <input type='checkbox' id='ebacktesting-option-PreventHTFCandlePreviews' ${L.session.getParameter(L.sessionParameterIds.PreventHTFCandlePreviews) == 'true' ? "checked" : ""}>
            <label for='ebacktesting-option-PreventHTFCandlePreviews'>Prevent candle previews when changing timeframes</label>
            <span title="Workaround for overcoming HTF candle previews: when switching timeframes, it will shortly go back to the previous HTF candle and will automatically play step by step from there, to depict the accurate current HTF candle state in the end" class="icon-wrapper with-tooltip apply-common-tooltip iconWrapper default small" tabindex="-1"><span role="img" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Zm1-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM8.5 9.5H7V8h3v6H8.5V9.5Z"></path></svg></span></span>
            <br/>
            <input type='checkbox' id='ebacktesting-option-EnablePredefinedTimes' ${L.session.getParameter(L.sessionParameterIds.EnablePredefinedTimes) == 'true' ? "checked" : ""}>
            <label for='ebacktesting-option-EnablePredefinedTimes'>Stop at hours (HH:mm)</label>
            <input type='text' id='ebacktesting-option-PredefinedTimes' class="input size-small normal" value='${L.session.getParameter(L.sessionParameterIds.PredefinedTimes)}' placeholder='e.g., 09:30, 12:30, 15:30'>
            <span title="Automatically stops candle playback at specified times during the day. Useful for regular events like session opens, news releases or your own schedule." class="icon-wrapper with-tooltip apply-common-tooltip iconWrapper default small" tabindex="-1"><span role="img" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Zm1-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM8.5 9.5H7V8h3v6H8.5V9.5Z"></path></svg></span></span>
            <br/>
            <input type='checkbox' id='ebacktesting-option-EnableWarmupStart' ${L.session.getParameter(L.sessionParameterIds.EnableWarmupStart) == 'true' ? "checked" : ""}>
            <label for='ebacktesting-option-EnableWarmupStart'>Warmup jump-to-date</label>
            <select id="ebacktesting-option-WarmupStartOffset">
                <option value="300" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == '300' ? "selected" : ""}>5m</option>
                <option value="900" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == '900' ? "selected" : ""}>15m</option>
                <option value="1800" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == '1800' ? "selected" : ""}>30m</option>
                <option value="3600" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == '3600' ? "selected" : ""}>1h</option>
                <option value="7200" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == '7200' ? "selected" : ""}>2h</option>
                <option value="14400" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == '14400' ? "selected" : ""}>4h</option>
                <option value="86400" ${L.session.getParameter(L.sessionParameterIds.WarmupStartOffset) == '86400' ? "selected" : ""}>1D</option>
            </select>
            <span title="When jumping to a specific time, a brief playback will take place just before that time to load indicators and prevent seeing future price action (by default, TradingView displays the full candle when navigating to a time that is mid-candle)." class="icon-wrapper with-tooltip apply-common-tooltip iconWrapper default small" tabindex="-1"><span role="img" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Zm1-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM8.5 9.5H7V8h3v6H8.5V9.5Z"></path></svg></span></span>
            <br/>
            <input type='checkbox' id='ebacktesting-option-AnalysisTimer' ${L.session.getParameter(L.sessionParameterIds.AnalysisTimer) == 'true' ? "checked" : ""}>
            <label for='ebacktesting-option-AnalysisTimer'>Show analysis timer</label>
            <span title="Track how long you spend analyzing each trading opportunity. The timer starts when you pause at any candle." class="icon-wrapper with-tooltip apply-common-tooltip iconWrapper default small" tabindex="-1"><span role="img" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Zm1-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM8.5 9.5H7V8h3v6H8.5V9.5Z"></path></svg></span></span>
        `);

    section.append(optionsSection);
    $("#ebacktesting-option-MinReplayResolutionDummy")
    .on('click change keydown keyup mousedown mouseup touchstart touchend', function(e) {
        e.preventDefault();
        $(this).prop('checked', true);
        return false;
    });

    L.getReplayResolutions().then(resolutions => {
        const select = optionsSection.closest('#ebacktesting-option-MinReplayResolution');
        resolutions.forEach(resolution => {
            select.append($('<option>', {
                value: resolution,
                text: L.resolutionToFriendlyText(resolution),
                selected: L.session.getParameter(L.sessionParameterIds.MinReplayResolution) == resolution
            }));
        });
    });

    L.session.retrieveParameters().then(() => {
        $("#ebacktesting-option-MinReplayResolution").val(L.session.getParameter(L.sessionParameterIds.MinReplayResolution));
        $("#ebacktesting-option-PreventHTFCandlePreviews").prop("checked", L.session.getParameter(L.sessionParameterIds.PreventHTFCandlePreviews) == 'true');
        $("#ebacktesting-option-EnablePredefinedTimes").prop("checked", L.session.getParameter(L.sessionParameterIds.EnablePredefinedTimes) == 'true');
        $("#ebacktesting-option-PredefinedTimes").val(L.session.getParameter(L.sessionParameterIds.PredefinedTimes));
        $("#ebacktesting-option-EnableWarmupStart").prop("checked", L.session.getParameter(L.sessionParameterIds.EnableWarmupStart) == 'true');
        $("#ebacktesting-option-WarmupStartOffset").val(L.session.getParameter(L.sessionParameterIds.WarmupStartOffset));
        $("#ebacktesting-option-AnalysisTimer").prop("checked", L.session.getParameter(L.sessionParameterIds.AnalysisTimer) == 'true');
        $("#ebacktesting-option-AutoSnapshot").prop("checked", L.session.getParameter(L.sessionParameterIds.AutoSnapshot) == 'true');
        $("#ebacktesting-option-CanModifyQty").prop("checked", L.session.getParameter(L.sessionParameterIds.CanModifyQty) == 'true');
    });

    container.append($("<h3 class='ebacktesting-dialog-section-title'>Journal Columns</h3>"));
    section = $("<div>")
        .addClass("ebacktesting-dialog-options-section")
        .addClass("ebacktesting-journal-options-section");

    container.append(section);

    var columnsTable = $(`
        <table class="ebacktesting-dialog-table ebacktesting-column-settings-table">
        </table>
    `);

    const createColumnRow = (column) => {
        const columnRow = $(`
            <tr data-column-id="${column.columnId}">
                <td class="column-drag">
                    <div class="drag-handle">
                        <svg width="20" height="100%" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="5" r="1.5"></circle><circle cx="6" cy="12" r="1.5"></circle><circle cx="6" cy="19" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle><circle cx="18" cy="5" r="1.5"></circle><circle cx="18" cy="12" r="1.5"></circle><circle cx="18" cy="19" r="1.5"></circle></svg>
                    </div>
                </td>
                <td class="column-enable">
                    <input type="checkbox" data-column-name="${column.columnName}" ${column.visible ? "checked" : ""}>
                </td>
                <td class="column-name"><input class="input size-small" value="${column.columnName}" ${L.isPredefinedColumn(column.columnName) ? "readonly" : ""}></td>
                <td class="column-type">
                    <select ${L.isPredefinedColumn(column.columnName) ? "disabled" : ""}>
                        <option value="text" ${column.columnType == "text" ? "selected" : ""}>Text</option>
                        <option value="richtext" ${column.columnType == "richtext" ? "selected" : ""}>Rich text</option>
                        <option value="number" ${column.columnType == "number" ? "selected" : ""}>Number</option>
                        <option value="bool" ${column.columnType == "bool" ? "selected" : ""}>Yes/No</option>
                        <option value="date" ${column.columnType == "date" ? "selected" : ""}>Date</option>
                        <option value="time" ${column.columnType == "time" ? "selected" : ""}>Time</option>
                        <option value="datetime" ${column.columnType == "datetime" ? "selected" : ""}>Date & time</option>
                        <option disabled value="actions" ${column.columnType == "actions" ? "selected" : ""}>Actions</option>
                    </select>
                </td>
                <td class="ebacktesting-actions">
                    <button class="edit-select-values lightButton secondary xsmall typography-regular14px" style="--ui-lib-light-button-content-max-lines: 1;" title="${column.columnEnumValues || "Edit possible values"}" data-values="${column.columnEnumValues || ""}" ${L.isPredefinedColumn(column.columnName) || ["richtext", "bool", "actions"].includes(column.columnType) ? "disabled" : ""}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18"><path fill="currentColor" d="M5 6.4a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 6h16V5H8v1Zm-3 8.46a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 14h16v-1H8v1Zm-2 7.43a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM24 22H8v-1h16v1Z"></path></svg>
                    </button>
                    <button class="delete-column lightButton secondary xsmall typography-regular14px" style="--ui-lib-light-button-content-max-lines: 1;" title="Delete column" ${L.isPredefinedColumn(column.columnName) ? "disabled" : ""}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18">
                            <path fill="currentColor" d="M12 4h3v1h-1.04l-.88 9.64a1.5 1.5 0 0 1-1.5 1.36H6.42a1.5 1.5 0 0 1-1.5-1.36L4.05 5H3V4h3v-.5C6 2.67 6.67 2 7.5 2h3c.83 0 1.5.67 1.5 1.5V4ZM7.5 3a.5.5 0 0 0-.5.5V4h4v-.5a.5.5 0 0 0-.5-.5h-3ZM5.05 5l.87 9.55a.5.5 0 0 0 .5.45h5.17a.5.5 0 0 0 .5-.45L12.94 5h-7.9Z"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `);

        columnRow.find("select").on("change", function () {
            const columnType = $(this).val();
            if (["richtext", "bool", "actions"].includes(columnType)) {
                columnRow.find("button.edit-select-values").attr("disabled", true);
            } else {
                columnRow.find("button.edit-select-values").removeAttr("disabled");
            }

            if (L.isPredefinedColumn(column.columnName)) {
                columnRow.find("button.edit-select-values").attr("disabled", true);
                columnRow.find("button.delete-column").attr("disabled", true);
            }
        });

        columnRow.find("button.edit-select-values").on("click", () => {
            L.showInputPrompt(`Specify possible options for '${$(`tr[data-column-id=${column.columnId}] td.column-name input`).val().trim()}', separated by commas:`, column.columnEnumValues, "Option 1, Option 2, Option 3", dialogContainer).then(value => {
                if (value !== null) {
                    const button = columnRow.find("button.edit-select-values");
                    button.attr("data-values", value);
                    button.attr("title", value);
                }
            });
        });

        columnRow.find("button.delete-column").on("click", () => {
            columnRow.remove();
        });

        return columnRow;
    };

    for (const column of L.session.sessionColumns) {
        columnsTable.append(createColumnRow(column));
    }
    section.append(columnsTable);

    const addNewColumn = $(`
        <div class="ebacktesting-column-settings-add-new-column-container">
            <button class="lightButton secondary xsmall typography-regular14px" style="--ui-lib-light-button-content-max-lines: 1;">
                <span class="content nowrap">
                    <span class="ellipsisContainer">Add new column</span>
                </span>
            </button>
        </div>
    `);

    section.append(addNewColumn);

    let draggedRow = null;

    const dragOnMouseDown = function () {
        draggedRow = $(this).parents("tr");
        draggedRow.addClass("dragging");
    };

    const dragOnMouseMove = function (e) {
        if (draggedRow) {
            let targetRow = $(this);
            if (targetRow[0] !== draggedRow[0]) {
                let draggedY = draggedRow.offset().top;
                let targetY = targetRow.offset().top;
                if (draggedY > targetY) {
                    targetRow.before(draggedRow);
                } else {
                    targetRow.after(draggedRow);
                }
            }
        }
    };

    columnsTable.find("tr .drag-handle").on("mousedown", dragOnMouseDown);
    columnsTable.find("tr").on("mousemove", dragOnMouseMove);

    $(document).on("mouseup", function () {
        draggedRow?.removeClass("dragging");
        draggedRow = null;
    });

    $("button", addNewColumn).on("click", () => {
        if(L.permissions.includes("JournalCustomization")) {
            const newColumn = {
                columnName: "New Column",
                columnType: "text",
                visible: true,
                sortable: true
            };

            const newRow = createColumnRow(newColumn);

            if (columnsTable.find("tbody").length) {
                columnsTable.find("tbody").append(newRow);
            } else {
                columnsTable.find("tr").append(newRow);
            }

            columnsTable.find("tr .drag-handle").on("mousedown", dragOnMouseDown);
            columnsTable.find("tr").on("mousemove", dragOnMouseMove);
                    
            setTimeout(() => {
                window.dispatchEvent(new Event('resize')); 
            }, 1000);
        } else {
            L.messageBox("Feature disabled", "Cannot customize journal columns: please subscribe to a free plan or start a free trial on eBacktesting.com");
        }
    });

    $(`
        <input type='checkbox' id='ebacktesting-option-AutoSnapshot' ${L.session.getParameter(L.sessionParameterIds.AutoSnapshot) == 'true' ? "checked" : ""}>
        <label for='ebacktesting-option-AutoSnapshot'>Auto capture trade snapshots</label>
        <span title="Save into the eBacktesting journal panel automatic snapshots of the chart during and after a trade: when the position opens, when either TP or SL gets hit, when BE gets hit, or when the trade is manually closed." class="icon-wrapper with-tooltip apply-common-tooltip iconWrapper default small" tabindex="-1"><span role="img" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Zm1-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM8.5 9.5H7V8h3v6H8.5V9.5Z"></path></svg></span></span>
        <br/>
        <input type='checkbox' id='ebacktesting-option-CanModifyQty' ${L.session.getParameter(L.sessionParameterIds.CanModifyQty) == 'true' ? "checked" : ""}>
        <label for='ebacktesting-option-CanModifyQty'>Allow modifying quantity</label>
        <span title="Enable the ability to modify the quantity (lots) of each trade in the eBacktesting panel." class="icon-wrapper with-tooltip apply-common-tooltip iconWrapper default small" tabindex="-1"><span role="img" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Zm1-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM8.5 9.5H7V8h3v6H8.5V9.5Z"></path></svg></span></span>
    `).appendTo(section);

    dialogContainer.find("button[name='submit']").on("click", () => {
        L.session.setParameter(L.sessionParameterIds.MinReplayResolution, $("#ebacktesting-option-MinReplayResolution").val());
        L.session.setParameter(L.sessionParameterIds.PreventHTFCandlePreviews, $("#ebacktesting-option-PreventHTFCandlePreviews").prop("checked").toString());
        L.session.setParameter(L.sessionParameterIds.EnablePredefinedTimes, $("#ebacktesting-option-EnablePredefinedTimes").prop("checked").toString());
        L.session.setParameter(L.sessionParameterIds.PredefinedTimes, $("#ebacktesting-option-PredefinedTimes").val());
        L.session.setParameter(L.sessionParameterIds.EnableWarmupStart, $("#ebacktesting-option-EnableWarmupStart").prop("checked").toString());
        L.session.setParameter(L.sessionParameterIds.WarmupStartOffset, $("#ebacktesting-option-WarmupStartOffset").val());
        L.session.setParameter(L.sessionParameterIds.AnalysisTimer, $("#ebacktesting-option-AnalysisTimer").prop("checked").toString());
        L.session.setParameter(L.sessionParameterIds.AutoSnapshot, $("#ebacktesting-option-AutoSnapshot").prop("checked").toString());
        L.session.setParameter(L.sessionParameterIds.CanModifyQty, $("#ebacktesting-option-CanModifyQty").prop("checked").toString());
        L.selectResolution(0, 0);
        L.reflectReplayResolutions();

        if (!$("#ebacktesting-option-PreventHTFCandlePreviews").prop("checked")) {
            L.stopSkipping();
        }

        if ($("#ebacktesting-option-AnalysisTimer").prop("checked")) {
            $(".analysis-timer-separator").show();
            $(".ebacktesting-session-analysis-timer").show();
        } else {
            $(".analysis-timer-separator").hide();
            $(".ebacktesting-session-analysis-timer").hide();
        }

        const columns = [];
        columnsTable.find("tr").each((i, row) => {
            const columnId = $(row).attr("data-column-id");
            var columnName = $(row).find("td.column-name input").val().trim();
            const columnType = $(row).find("td.column-type select").val();
            const visible = $(row).find("td.column-enable input").is(":checked");
            var columnEnumValues = $(row).find("button.edit-select-values").attr("data-values");
            if (["richtext", "bool", "actions"].includes(columnType)) {
                columnEnumValues = null;
            }

            if (columnName.trim()) {
                const existingColumn = L.session.sessionColumns.find(c => c.columnId == columnId);
                if (existingColumn) {
                    existingColumn.columnName = columnName;
                    existingColumn.columnType = columnType;
                    existingColumn.columnEnumValues = columnEnumValues;
                    existingColumn.visible = visible;
                    columns.push(existingColumn);
                } else {
                    if (!columns.some(c => c.columnName == columnName)) {
                        columns.push({
                            columnName: columnName,
                            columnType: columnType,
                            columnEnumValues: columnEnumValues,
                            visible: visible,
                            sortable: true
                        });
                    }
                }
            }
        });

        //detect columnName duplicates in columns array and add suffixes to duplicates
        const columnNames = columns.map(c => c.columnName);
        const duplicates = columnNames.filter((item, index) => columnNames.indexOf(item) != index);
        for (const duplicate of duplicates) {
            const duplicateCount = columnNames.filter(c => c == duplicate).length;
            for (let i = 0; i < duplicateCount; i++) {
                const column = columns.find(c => c.columnName == duplicate);
                if (column) {
                    column.columnName = `${duplicate} ${i + 1}`;
                }
            }
        }

        L.saveSessionColumns(L.session.sessionId, columns).then(c => {
            L.session.sessionColumns = c;
            L.createPositionsListHeader(true);
        });

        const newSessionName = dialogContainer.attr("data-dialog-name").trim();
        if (newSessionName && L.session.name != newSessionName) {
            L.session.name = newSessionName;
            L.dataOps.updateSession({ sessionId: L.session.sessionId, name: newSessionName }, L.session.meta.isReviewMode);
        }
        L.removeDummyShape();
    });

    dialogContainer.find("button[name='cancel']").on("click", () => {
        L.removeDummyShape();
    });

    setTimeout(() => {
        window.dispatchEvent(new Event('resize')); 
    }, 1000);
}