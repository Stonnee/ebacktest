import { L } from "./ebacktesting.core.js";

L.createSessionsUI = function (dialogContainer) {
    dialogContainer.find("div[class*='tabs']").remove();
    dialogContainer.find("span[class*='editIcon']").remove();
    const container = dialogContainer.find("div[class*='scrollable'] div[class*='content']");
    container.children().remove();

    const footer = dialogContainer.find("div[class*='footer']");
    footer.find("span[role='button'][data-role='listbox']").remove();
    footer.find("button[name='submit']").remove();
    footer.find("button[name='cancel'] span[class*='content']").text("Close");

    const discordInfo = `<div class="discord-cta">Need help? Join the <a href="https://discord.gg/kJSmwSxBpW">eBacktesting Discord</a> community!</div>`;
    footer.prepend(discordInfo);

    const section = $(`
        <div class="ebacktesting-dialog-section-sessions">
            <span class="intro">
                Please ensure your <a href="https://eBacktesting.com" target="_blank">eBacktesting.com</a> subscription plan is active for your TradingView username: <span contenteditable readonly spellcheck="false">${user.username}</span>
            </span>
        </div>`);

    section.append($(`<svg class="ebacktesting-loader" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M13.88 3.88a1.88 1.88 0 1 1-3.76 0 1.88 1.88 0 0 1 3.76 0ZM12 18.24A1.88 1.88 0 1 0 12 22a1.88 1.88 0 0 0 0-3.75Zm8.13-8.13a1.88 1.88 0 1 0 0 3.76 1.88 1.88 0 0 0 0-3.76ZM5.74 12A1.88 1.88 0 1 0 2 12a1.88 1.88 0 0 0 3.75 0Zm.5 3.87a1.88 1.88 0 1 0 0 3.75 1.88 1.88 0 0 0 0-3.75Zm11.5 0a1.88 1.88 0 1 0 0 3.75 1.88 1.88 0 0 0 0-3.75ZM6.25 4.38a1.87 1.87 0 1 0 0 3.75 1.87 1.87 0 0 0 0-3.75Z"></path></svg>`))
    container.append(section);

    var sessionsTable = $(`<table class="ebacktesting-dialog-table ebacktesting-sessions-table">`);

    const createSessionRow = (session) => {
        L.dataOps.getSessionPositions(session.sessionId).then(positions => {
            sessionsTable.find(`tr[data-session-id='${session.sessionId}'] .positions-counter`).text(positions.length);

            L.getBalanceAfterPositions(session.capital, positions, session).then(balance => {
                sessionsTable.find(`tr[data-session-id='${session.sessionId}'] .session-balance`).text(balance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }));
            });
        });

        const displayDate = L.getDateInTimezone(session.currentDate, window.TradingViewApi.activeChart().getTimezone()).toISOString().slice(0, 16);
        return $(`
            <tr data-session-id="${session.sessionId}" class="${session.sessionId == L.session?.sessionId ? "selected-session" : ""}">
            <td>
                <table>
                <tr>
                    <td class="session-section">Session:</td>
                    <td class="session-name">
                    <input class="input size-small" value="${session.name}"></td>
                    </td>
                </tr>
                <tr>
                    <td class="session-section">Chart date:</td>
                    <td class="session-bar-date">
                    <input type="datetime-local" class="input size-small" tooltip="Set another backtesting date" initial-value="${displayDate}" value="${displayDate}">
                    </td>
                </tr>
                <tr>
                    <td class="session-section">Balance:</td>
                    <td class="session-capital">
                    <span class="session-balance">${session.capital.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}</span> <span class="currency">${session.currencyId}</span>
                    </td>
                </tr>
                <tr>
                    <td class="session-stats-info" colspan="2">
                    Positions: <span class="positions-counter">0</span>
                    <br/>
                    Last update: ${L.toTradingViewDateTimeFormat(session.lastUpdate, window.TradingViewApi.activeChart().getTimezone())}
                    </td>
                </tr>
                </table>
            </td>
            <td class="ebacktesting-actions">
                <button class="resume-session lightButton secondary xsmall typography-regular14px ${session.sessionId == L.session?.sessionId ? "hidden" : ""}" style="--ui-lib-light-button-content-max-lines: 1;" title="Resume session">
                    Go &nbsp; <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1.17 5.79 3.05 2.92H6.52a.97.97 0 0 0-.97.97v.64c0 .54.43.97.97.97h7.36l-3.05 2.92c-.39.37-.4 1-.01 1.38l.44.44c.38.38 1 .38 1.37 0l5.35-5.34c.38-.38.38-1 0-1.37l-5.35-5.36a.96.96 0 0 0-1.37 0l-.44.44a.97.97 0 0 0 .01 1.39Z"></path></svg>
                </button>
                <br/>
                <button class="delete-session lightButton secondary xsmall typography-regular14px" style="--ui-lib-light-button-content-max-lines: 1;" title="Delete session">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" d="M12 4h3v1h-1.04l-.88 9.64a1.5 1.5 0 0 1-1.5 1.36H6.42a1.5 1.5 0 0 1-1.5-1.36L4.05 5H3V4h3v-.5C6 2.67 6.67 2 7.5 2h3c.83 0 1.5.67 1.5 1.5V4ZM7.5 3a.5.5 0 0 0-.5.5V4h4v-.5a.5.5 0 0 0-.5-.5h-3ZM5.05 5l.87 9.55a.5.5 0 0 0 .5.45h5.17a.5.5 0 0 0 .5-.45L12.94 5h-7.9Z"></path></svg>
                </button>
            </td>
            </tr>
        `);
    };

    const isPendingNewSession = () => {
        return sessionsTable.find("tr[data-session-id='new']").length > 0;
    };

    L.dataOps.getOrSaveUserId(user).then(userId => {
        L.dataOps.getUserById(userId).then(user => {
            L.user = user;

            section.append($(`<div class="ebacktesting-dialog-section-plan">Active plan: ${L.user.plan.name}</div>`));
            L.dataOps.getPermissions(L.user.plan.planId).then(permissions => {
                L.permissions = permissions;
                L.dataOps.getSessions(L.user.userId).then(sessions => {
                    $(".ebacktesting-loader").remove();

                    const addNewSession = $(`
                        <div class="ebacktesting-session-settings-add-new-session-container">
                            <button class="lightButton secondary xsmall typography-regular14px" style="--ui-lib-light-button-content-max-lines: 1;">
                                <span class="content nowrap">
                                    <span class="ellipsisContainer">New session</span>
                                </span>
                            </button>
                        </div>
                    `);

                    addNewSession.on("click", () => {
                        if (isPendingNewSession()) return;
                        if(sessionsTable.find("tr[data-session-id]").length <= 1 || L.permissions.includes("MultipleBacktestingSessions")) {
                            var oneYearAgo = new Date();
                            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                            // Format as yyyy-MM-ddTHH:mm (what datetime-local input expects)
                            oneYearAgo = oneYearAgo.toISOString().slice(0, 16);

                            const editableSessionRow = $(`
                                <tr data-session-id="new">
                                    <td>
                                        <table>
                                            <tr>
                                                <td class="session-section">Session:</td>
                                                <td class="session-name">
                                                    <input class="input size-small" value="My eBacktesting session">
                                                </td>
                                            </tr>
                                            <tr>
                                                <td class="session-section">Chart date:</td>
                                                <td class="session-bar-date">
                                                    <input type="datetime-local" tooltip="Select a backtesting date" class="input size-small" value="${oneYearAgo}">
                                                </td>
                                            </tr>
                                            <tr>
                                                <td class="session-section">Balance:</td>
                                                <td class="session-capital">
                                                    <table border="0" cellspacing="0" cellpadding="0">
                                                        <tr>
                                                            <td class="session-capital-value">
                                                                <input type="number" step="1000" placeholder="Capital" value="100000" class="input size-small">
                                                            </td>
                                                            <td class="session-capital-currency">
                                                                <select class="input size-small">
                                                                    <option value="USD">USD</option>
                                                                    <option value="EUR">EUR</option>
                                                                    <option value="AUD">AUD</option>
                                                                    <option value="GBP">GBP</option>
                                                                    <option value="NZD">NZD</option>
                                                                    <option value="CAD">CAD</option>
                                                                    <option value="CHF">CHF</option>
                                                                    <option value="HKD">HKD</option>
                                                                    <option value="JPY">JPY</option>
                                                                    <option value="NOK">NOK</option>
                                                                    <option value="RUB">RUB</option>
                                                                    <option value="SEK">SEK</option>
                                                                    <option value="SGD">SGD</option>
                                                                    <option value="TRY">TRY</option>
                                                                    <option value="ZAR">ZAR</option>
                                                                    <option value="BTC">BTC</option>
                                                                    <option value="ETH">ETH</option>
                                                                    <option value="MYR">MYR</option>
                                                                    <option value="KRW">KRW</option>
                                                                    <option value="USDT">USDT</option>
                                                                    <option value="INR">INR</option>
                                                                </select>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td class="ebacktesting-actions">
                                        <button class="save-session lightButton secondary xsmall typography-regular14px" style="--ui-lib-light-button-content-max-lines: 1;" title="Start backtesting">
                                            Start &nbsp; <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1.17 5.79 3.05 2.92H6.52a.97.97 0 0 0-.97.97v.64c0 .54.43.97.97.97h7.36l-3.05 2.92c-.39.37-.4 1-.01 1.38l.44.44c.38.38 1 .38 1.37 0l5.35-5.34c.38-.38.38-1 0-1.37l-5.35-5.36a.96.96 0 0 0-1.37 0l-.44.44a.97.97 0 0 0 .01 1.39Z"></path></svg>
                                        </button>
                                        <br/>
                                        <button class="cancel-session lightButton secondary xsmall typography-regular14px ${sessions.length ? "" : "hidden"}" style="--ui-lib-light-button-content-max-lines: 1;" title="Cancel session">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" d="M12 4h3v1h-1.04l-.88 9.64a1.5 1.5 0 0 1-1.5 1.36H6.42a1.5 1.5 0 0 1-1.5-1.36L4.05 5H3V4h3v-.5C6 2.67 6.67 2 7.5 2h3c.83 0 1.5.67 1.5 1.5V4ZM7.5 3a.5.5 0 0 0-.5.5V4h4v-.5a.5.5 0 0 0-.5-.5h-3ZM5.05 5l.87 9.55a.5.5 0 0 0 .5.45h5.17a.5.5 0 0 0 .5-.45L12.94 5h-7.9Z"></path></svg>
                                        </button>
                                    </td>
                                </tr>
                            `);
                            editableSessionRow.find("button.save-session").on("click", () => {
                                const session = {}
                                session.userId = L.user.userId;
                                session.name = editableSessionRow.find("input").val();
                                if (!session.name) {
                                    alert("Please enter a session name.");
                                    return;
                                }
                                if (sessions.find(s => s.name.toLowerCase() == session.name.toLowerCase())) {
                                    alert("There is already a session with this name.");
                                    return;
                                }
                                session.capital = Number(editableSessionRow.find("input[type='number']").val());
                                if (!(session.capital > 0)) {
                                    alert("Please enter a valid capital amount.");
                                    return;
                                }

                                session.currencyId = editableSessionRow.find("select").val();
                                session.currentDate = new Date(editableSessionRow.find("input[type='datetime-local']").val()).getTime() / 1000;

                                //display loader
                                editableSessionRow.find(".save-session").html(`<svg class="ebacktesting-loader" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M13.88 3.88a1.88 1.88 0 1 1-3.76 0 1.88 1.88 0 0 1 3.76 0ZM12 18.24A1.88 1.88 0 1 0 12 22a1.88 1.88 0 0 0 0-3.75Zm8.13-8.13a1.88 1.88 0 1 0 0 3.76 1.88 1.88 0 0 0 0-3.76ZM5.74 12A1.88 1.88 0 1 0 2 12a1.88 1.88 0 0 0 3.75 0Zm.5 3.87a1.88 1.88 0 1 0 0 3.75 1.88 1.88 0 0 0 0-3.75Zm11.5 0a1.88 1.88 0 1 0 0 3.75 1.88 1.88 0 0 0 0-3.75ZM6.25 4.38a1.87 1.87 0 1 0 0 3.75 1.87 1.87 0 0 0 0-3.75Z"></path></svg>`);

                                const latestSession = [...sessions].sort((a, b) => b.lastUpdate - a.lastUpdate)[0];
                                L.dataOps.createSession(session).then((sessionId) => {
                                    var saveColumns;
                                    if (latestSession) {
                                        saveColumns = L.dataOps.getSessionColumns(latestSession.sessionId).then((latestColumns) => L.saveSessionColumns(sessionId, latestColumns));
                                    } else {
                                        saveColumns = L.saveSessionColumns(sessionId);
                                    }

                                    saveColumns.then(() => {
                                        L.startSession(sessionId);
                                        L.removeDummyShape();
                                    });
                                });
                            });

                            editableSessionRow.find("button.cancel-session").on("click", () => {
                                if (sessionsTable.find("tr[data-session-id]").length > 1) {
                                    editableSessionRow.remove();
                                }
                            });
                            sessionsTable.append(editableSessionRow);
                            window.dispatchEvent(new Event('resize'));
                        }
                        else {
                            alert("Cannot create multiple sessions: please subscribe to a free plan or start a free trial on eBacktesting.com");
                        }
                    });

                    for (const session of sessions) {
                        const sessionRow = createSessionRow(session);
                        sessionRow.find(".session-name input").on("change", () => {
                            const sessionName = sessionRow.find(".session-name input").val().trim();
                            if (!sessionName) {
                                alert("Please enter a session name.");
                                return;
                            }
                            if (sessions.find(s => s.name == sessionName && s.sessionId != session.sessionId)) {
                                alert("There is already a session with this name.");
                                return;
                            }
                            session.name = sessionName;
                            L.dataOps.updateSession({ sessionId: session.sessionId, name: session.name });
                        });
                        sessionRow.find("button.resume-session").on("click", () => {
                            if(L.permissions.includes("CanContinueSession")) {
                                const initialDate = new Date(sessionRow.find(".session-bar-date input").attr("initial-value")).getTime() / 1000;
                                const currentDate = new Date(sessionRow.find(".session-bar-date input").val()).getTime() / 1000;
                                const secondsDifference = currentDate - initialDate;
                                if(!secondsDifference) {
                                    L.removeDummyShape();
                                    L.startSession(session.sessionId);
                                } else {
                                    L.dataOps.getSessionPositions(session.sessionId).then(positions => {
                                        if (positions.every(p => p.exitTime)) {
                                            session.currentDate += secondsDifference;
                                            if (positions.every(p => p.exitTime <= session.currentDate)) {
                                                L.removeDummyShape();
                                                L.dataOps.updateSession({ sessionId: session.sessionId, currentDate: session.currentDate }).then(() => {
                                                    L.startSession(session.sessionId);
                                                });
                                            } else {
                                                alert("Unable to change the replay date: there are positions that would be still open at this date.");
                                            }
                                        } else {
                                            alert("Unable to change the replay date: there is an open position in this session.");
                                        }
                                    });
                                }
                            } else {
                                alert("Cannot resume an existing session: please subscribe to a plan or start a free trial on eBacktesting.com");
                            }
                        });
                        sessionRow.find("button.delete-session").on("click", () => {
                            if (!confirm("Are you sure you want to delete this session?")) return;

                            L.dataOps.deleteSession(session.sessionId);
                            sessions.splice(sessions.indexOf(session), 1);
                            sessionRow.remove();

                            if (session.sessionId == L.session?.sessionId) {
                                L.removeDummyShape();
                                L.exit();
                            } else if (!sessions.length) {
                                addNewSession.click();
                            }
                        });
                        sessionsTable.append(sessionRow);
                    }
                    section.append(sessionsTable);

                    if (sessions.length) {
                        section.append(addNewSession);
                    } else {
                        addNewSession.click();
                    }

                    setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                    }, 1000);
                });
            });
        });
    });



    dialogContainer.find("button[name='cancel']").on("click", () => {
        L.removeDummyShape();
    });
}
