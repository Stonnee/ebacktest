import { L } from "./ebacktesting.core.js";

L.createToolbarButton = function () {
    const eBacktestingButton = $(`
        <button aria-label="eBacktesting" id="header-toolbar-ebacktesting" aria-pressed="false" tabindex="-1" type="button" class="button withText apply-common-tooltip isInteractive accessible ebacktesting-button">
            <span role="img" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 120 120" width="24" height="24">
                <polygon points="10,10 10,90 100,50" stroke="white" stroke-width="2" fill="black"></polygon>
                <rect x="22" y="25" width="8" height="50" rx="2" ry="2" fill="white"></rect>
                <rect x="40" y="35" width="8" height="33" rx="2" ry="2" fill="white"></rect>
                <rect x="57" y="20" width="9" height="40" rx="2" ry="2" fill="white" stroke="black" stroke-width="1"></rect>
              </svg>
            </span>
            <div class="js-button-text text eBacktesting-button">eBacktesting</div>
        </button>
    `);

    if (!$("#header-toolbar-ebacktesting").length) {
        $("button#header-toolbar-replay").parents("div[class*='group']").append(eBacktestingButton);
        L.eBacktestingButton = eBacktestingButton;

        eBacktestingButton.on("click", () => {
            if (eBacktestingButton.attr("aria-pressed") === "true") {
                L.exit(false, true);
            } else {
                if(L.r.isReplayStarted().value()) {
                    L.messageBox("eBacktesting", "Please exit Bar Replay mode before starting eBacktesting.");
                } else {
                    L.showSessions();
                }
            }
        });
    }
}

L.createReplayControls = function () {
    if (!L.lastReplayControlsCheck || (Date.now() - L.session.meta.lastReplayControlsCheck) > 1000) {
        L.lastReplayControlsCheck = Date.now();

        const replayToolbar = $("div[class*='replayToolbar-']");
        if (replayToolbar.length === 0) {
            console.warn("Replay Toolbar not found!");
            return null;
        }

        const controlsPanels = replayToolbar.find("div[class*='controlsPanel-']");
        if (controlsPanels.length === 0) {
            console.warn("Controls Panel not found!");
            return null;
        }

        const controlsContainers = controlsPanels.find("div[class*='controls-']");
        if (controlsContainers.length === 0) {
            console.warn("Controls container not found!");
            return null;
        }

        replayToolbar.parent().parent().hide();
    }

    const toolbarContainer = $("div.chart-toolbar.chart-controls-bar div[class*='dateRangeExpanded']");
    if (toolbarContainer.length === 0) {
        console.warn("Toolbar container not found!");
        return null;
    }

    if ($(".backtesting-replay-controls").length == 0) {
        toolbarContainer.parent().parent().removeAttr("data-mouse-click-auto-blur");
        toolbarContainer.children().hide();
        const replayControls = $(`
            <div class="backtesting-replay-controls controls">
                <div class="drag-handle">
                    <svg width="20" height="100%" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="5" r="1.5"></circle><circle cx="6" cy="12" r="1.5"></circle><circle cx="6" cy="19" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle><circle cx="18" cy="5" r="1.5"></circle><circle cx="18" cy="12" r="1.5"></circle><circle cx="18" cy="19" r="1.5"></circle></svg>
                </div>
                <div class="controls-control">
                    <div class="controls-button button apply-common-tooltip isInteractive play-pause-button play" title="Play&#013;Shift + ⇩" data-role="button">
                        <span role="img" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
                            <path fill="currentColor" fill-rule="evenodd" d="m10.997 6.93 7.834 6.628a.58.58 0 0 1 0 .88l-7.834 6.627c-.359.303-.897.04-.897-.44V7.37c0-.48.538-.743.897-.44Zm8.53 5.749a1.741 1.741 0 0 1 0 2.637l-7.834 6.628c-1.076.91-2.692.119-2.692-1.319V7.37c0-1.438 1.616-2.23 2.692-1.319l7.834 6.628Z"></path>
                            </svg>
                        </span>
                    </div>
                    <div class="controls-button button apply-common-tooltip isInteractive play-pause-button pause" title="Pause&#013;Shift + ⇩" data-role="button" style="display:none">
                        <span role="img" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
                            <path fill="currentColor" fill-rule="evenodd" d="M10 6h2v16h-2V6ZM9 6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V6Zm7 0h2v16h-2V6Zm-1 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V6Z"></path>
                            </svg>
                        </span>
                    </div>
                </div>
                <div class="controls-separator"><span class="separator"></span></div>
                <div class="controls-control controls-control-type-forward">
                    <div data-role="button" class="controls-button button apply-common-tooltip isInteractive forward-button">
                        <span role="img" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
                            <path fill="currentColor" fill-rule="evenodd" d="M20 6v16h1V6h-1Zm-3.908 7.628L9.834 7.996A.5.5 0 0 0 9 8.368v11.264a.5.5 0 0 0 .834.372l6.258-5.632a.5.5 0 0 0 0-.744Zm.67 1.487a1.5 1.5 0 0 0 0-2.23l-6.259-5.632C9.538 6.384 8 7.07 8 8.368v11.264c0 1.299 1.538 1.984 2.503 1.115l6.258-5.632Z"></path>
                            </svg>
                        </span>
                    </div>
                </div>
                <div class="controls-control controls-control-type-forward">
                    <div title="Fast forward&#013;Ctrl + Shift + ⇨" data-role="button" class="controls-button button apply-common-tooltip isInteractive fast-forward-button">
                        <span role="img" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 28" width="36" height="28">
                                <path fill="currentColor" fill-rule="evenodd" d="M8 6.93l7.834 6.628a.58.58 0 0 1 0 .88L8 21.065c-.359.303-.897.04-.897-.44V7.37c0-.48.538-.743.897-.44Zm8.53 5.749a1.741 1.741 0 0 1 0 2.637L8.696 21.944c-1.076.91-2.692.119-2.692-1.319V7.37c0-1.438 1.616-2.23 2.692-1.319l7.834 6.628Z"></path>
                                <path fill="currentColor" fill-rule="evenodd" d="M18 6.93l7.834 6.628a.58.58 0 0 1 0 .88L18 21.065c-.359.303-.897.04-.897-.44V7.37c0-.48.538-.743.897-.44Zm8.53 5.749a1.741 1.741 0 0 1 0 2.637L18.696 21.944c-1.076.91-2.692.119-2.692-1.319V7.37c0-1.438 1.616-2.23 2.692-1.319l7.834 6.628Z"></path>
                            </svg>
                        </span>
                    </div>
                </div>
                <select class="skip-intervals input normal" title="Fast forward interval">
                </select>
                <div class="controls-control controls-control-type-goto-date">
                    <div title="Go to date/time" data-role="button" class="controls-button button apply-common-tooltip isInteractive goto-date-button">
                        <span role="img" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18.06a8.06 8.06 0 1 1 0-16.12 8.06 8.06 0 0 1 0 16.12Zm2.5-4.2-3.43-2.5a.49.49 0 0 1-.2-.38V6.35c0-.26.22-.48.48-.48h1.3c.26 0 .48.22.48.48v5.72l2.7 1.96c.21.16.25.46.1.68l-.76 1.04a.49.49 0 0 1-.68.1Z"></path></svg>
                        </span>
                    </div>
                </div>
                <div class="controls-separator"><span class="separator"></span></div>
                <div class="ebacktesting-session-balance">
                    <div class="ebacktesting-session-balance-balance">
                        <span class="ebacktesting-session-balance-balance-label">Balance:</span>
                        <span class="ebacktesting-session-balance-balance-value">${(L?.session?.meta?.balance || L?.session?.capital).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })}</span>
                        <span class="ebacktesting-session-balance-balance-currency currency">${L.session.currencyId}</span>
                    </div>
                    <div class="ebacktesting-session-balance-equity">
                        <span class="ebacktesting-session-balance-equity-label">Equity:</span>
                        <span class="ebacktesting-session-balance-equity-value">${L?.session?.meta?.equity?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })}</span>
                        <span class="ebacktesting-session-balance-equity-currency currency">${L.session.currencyId}</span>
                    </div>
                </div>
                <div class="controls-separator"><span class="separator"></span></div>
                <div class="controls-control controls-control-type-settings">
                    <div data-role="button" class="controls-button button apply-common-tooltip isInteractive ebacktesting-review-button ${L.session.meta.isReviewMode ? "isActive" : ""}" data-tooltip="Review mode">
                        <span role="img" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="24"><path fill="currentColor" d="M18.93 12.68v3.84c0 .96-.34 1.78-1.01 2.46A3.33 3.33 0 0 1 15.47 20h-10c-.96 0-1.78-.34-2.45-1.02A3.36 3.36 0 0 1 2 16.52V6.48c0-.96.34-1.78 1.02-2.46A3.33 3.33 0 0 1 5.46 3h10.01c.5 0 .97.1 1.4.3.13.06.2.15.22.28a.38.38 0 0 1-.1.35l-.6.6a.38.38 0 0 1-.27.11c-.03 0-.06 0-.1-.02a2.13 2.13 0 0 0-.55-.07h-10c-.54 0-.99.18-1.37.56-.37.38-.56.84-.56 1.37v10.04c0 .53.19.99.56 1.37.38.38.83.56 1.36.56h10.01c.53 0 .98-.18 1.36-.56.38-.38.56-.84.56-1.37v-3.06c0-.1.04-.2.11-.27l.77-.77a.38.38 0 0 1 .28-.12c.05 0 .1 0 .14.03.16.07.24.18.24.35Zm2.78-5.9-9.79 9.83c-.2.19-.42.29-.68.29-.27 0-.5-.1-.69-.3l-5.17-5.18a.94.94 0 0 1-.29-.7c0-.26.1-.49.29-.68L6.7 8.7c.2-.2.42-.29.69-.29.26 0 .5.1.68.3l3.17 3.17 7.78-7.82c.19-.19.42-.29.68-.29.27 0 .5.1.69.3L21.7 5.4c.2.2.29.43.29.7 0 .26-.1.49-.29.68Z"></path></svg>
                        </span>
                    </div>
                </div>
                <div class="controls-control controls-control-type-settings">
                    <div data-role="button" class="controls-button button apply-common-tooltip isInteractive ebacktesting-stats-button" data-tooltip="${L.getStatsSummary()}">
                        <span role="img" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="24"><path fill="currentColor" d="M15 14.5h1.5c.25 0 .5-.25.5-.5V8.75c0-.25-.25-.5-.5-.5H15c-.25 0-.5.25-.5.5V14c0 .25.25.5.5.5Zm3.75 0h1.5c.25 0 .5-.25.5-.5V5c0-.25-.25-.5-.5-.5h-1.5c-.25 0-.5.25-.5.5v9c0 .25.25.5.5.5Zm-11.25 0H9c.25 0 .5-.25.5-.5v-2.75c0-.25-.25-.5-.5-.5H7.5c-.25 0-.5.25-.5.5V14c0 .25.25.5.5.5Zm3.75 0h1.5c.25 0 .5-.25.5-.5V6.25c0-.25-.25-.5-.5-.5h-1.5c-.25 0-.5.25-.5.5V14c0 .25.25.5.5.5ZM21.38 17H4.5V5.12a.62.62 0 0 0-.63-.62H2.63a.62.62 0 0 0-.62.63v13.12c0 .69.56 1.25 1.25 1.25h18.13c.34 0 .62-.28.62-.63v-1.25a.62.62 0 0 0-.63-.62Z"></path></svg>
                        </span>
                    </div>
                </div>
                <div class="controls-control controls-control-type-settings">
                    <div title="eBacktesting Settings" data-role="button" class="controls-button button apply-common-tooltip isInteractive ebacktesting-settings-button">
                        <span role="img" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="24" fill="currentColor"><path fill="currentColor" d="m21.3 10.67-2.33-1.58.53-2.78a1.59 1.59 0 0 0-1.85-1.85l-2.77.53-1.57-2.34c-.6-.87-2.03-.87-2.62 0L9.11 5l-2.76-.53A1.58 1.58 0 0 0 4.5 6.32l.53 2.77-2.33 1.58a1.58 1.58 0 0 0 0 2.62l2.33 1.58-.53 2.77a1.58 1.58 0 0 0 1.85 1.86l2.76-.54 1.58 2.34a1.58 1.58 0 0 0 2.62 0l1.57-2.34 2.77.54c.53.1 1.05-.06 1.42-.43.37-.38.53-.9.43-1.42l-.53-2.78 2.33-1.58a1.58 1.58 0 0 0 0-2.62ZM16.9 14l.68 3.56-3.55-.68-2.03 3-2.03-3-3.55.68.69-3.56-3-2.03 3-2.03-.69-3.57 3.56.7 2.02-3 2.03 3 3.55-.7-.69 3.57 3 2.03-3 2.03ZM12 7.94a4.07 4.07 0 1 0 .01 8.14A4.07 4.07 0 0 0 12 7.94Zm0 6.25a2.19 2.19 0 1 1 0-4.38 2.19 2.19 0 0 1 0 4.38Z"></path></svg>
                        </span>
                    </div>
                </div>
                <div class="controls-separator analysis-timer-separator"><span class="separator"></span></div>
                <div class="ebacktesting-session-analysis-timer">Analysis time: ${((L?.session?.meta?.analysisTimes || []).slice(-1)[0]?.analysisTimespan || "00:00")}</div>
            </div>
        `);

        $(".skip-intervals", replayControls).on("change", function () {
            if (L.session?.meta) {
                L.session.meta.forceStopPlayback = false;
                L.session.meta.selectedResolution = $(this).val();
            }
        });

        $(".play-pause-button.play", replayControls).on("click", () => {
            L.session.meta.forceStopPlayback = false;
            L.session.meta.disableCurrentDateTracking = false;
            L.startSkipping();
        });

        $(".play-pause-button.pause", replayControls).on("click", () => {
            L.stopSkipping();
            L.session.meta.forceStopPlayback = true;
        });

        $(".forward-button", replayControls).on("click", async () => {
            L.session.meta.forceStopPlayback = false;
            L.session.meta.disableCurrentDateTracking = false;
            await L.skipTime(0, false, 0);
        });

        $(".forward-button", replayControls).on("contextmenu", async (e) => {
            L.session.meta.forceStopPlayback = false;
            L.session.meta.disableCurrentDateTracking = false;
            const selectedIntervalValue = Number($(".skip-intervals", replayControls).find("option:first").val());
            await L.skipTime(selectedIntervalValue, false, 0);
        });

        $(".fast-forward-button", replayControls).on("click", async () => {
            L.session.meta.forceStopPlayback = false;
            L.session.meta.disableCurrentDateTracking = false;
            const selectedIntervalValue = Number($(".skip-intervals", replayControls).val());
            await L.skipTime(selectedIntervalValue, false, 0);
            L.sessionChannel.postMessage({type: "FAST-FORWARD", sessionId: L.session.sessionId, interval: selectedIntervalValue});
        });

        $(".goto-date-button", replayControls).on("click", () => {
            L.session.meta.forceStopPlayback = false;
            L.showGotoDateDialog();
        });

        if (L.session.getParameter(L.sessionParameterIds.AnalysisTimer) != 'true') {
            $(".analysis-timer-separator", replayControls).hide();
            $(".ebacktesting-session-analysis-timer", replayControls).hide();
        }

        $(".ebacktesting-session-analysis-timer", replayControls).on("click", () => {
            if (L.session.meta.analysisTimes && L.session.meta.analysisTimes.filter(at => at.analysisDuration > 5 && at.analysisStartTime < L.session.currentDate).length > 1) {
                L.showAnalysisTimesDialog();
            }
        });

        $(".drag-handle", replayControls).on("mousedown", (e) => {
            const controls = $(".backtesting-replay-controls");
            controls.attr("isDragging", 1);
            controls.attr("startX", e.clientX);
            controls.attr("startLeft", $(".backtesting-replay-controls").offset().left);
            $(".drag-handle").css("cursor", "grabbing");
            e.preventDefault();
        });

        $(".ebacktesting-settings-button", replayControls).on("click", () => {
            L.session.meta.forceStopPlayback = false;
            L.showSettings();
        });

        $(".ebacktesting-stats-button", replayControls).on("click", () => {
            L.showSessionStatistics();
        });

        if (L.session.positions.length < 3) {
            $(".ebacktesting-review-button", replayControls).parent().hide();
        } else {
        $(".ebacktesting-review-button", replayControls).on("click", async () => {
            if(!L.session.meta.isReviewMode) {
                L.session.meta.realSessionDate = L.session.currentDate;
                if (L.session.getActivePositions().length == 0) {
                    L.session.meta.isReviewMode = true;
                    $(".ebacktesting-review-button", replayControls).addClass("isActive");
                        L.toast("Review mode: click on a position's date (eBacktesting panel) to replay the trade.", 3000);
                } else {
                    L.messageBox("Open position", "You cannot enter review mode while having active positions.");
                }
            } else {
                $(".ebacktesting-review-button", replayControls).removeClass("isActive");

                if(L.session.currentDate != L.session.meta.realSessionDate) {
                    await L.selectDateWithWarmup(L.session.meta.realSessionDate);
                }

                L.session.meta.isReviewMode = false;
            }
        });
        }

        toolbarContainer.append(replayControls);
        L.reflectReplayResolutions();
        
        const parentWidth = $(".chart-controls-bar").outerWidth();
        const childWidth = replayControls.outerWidth();
        const leftOffset = (parentWidth - childWidth) / 2;
        
        replayControls.css("left", leftOffset + "px");

        L.updateSessionCapitalInfo();
    }
}

L.createUI = function () {
    const replayTradingButton = $("button[data-name='replay_trading']");
    replayTradingButton.text("eBacktesting");

    L.createReplayControls();
    L.createPositionsListHeader();
    
    if(!L.session.meta.analysisTimes){
        L.session.meta.analysisTimes = [];
    }

    setInterval(() => {
        if(L.session.getParameter(L.sessionParameterIds.AnalysisTimer) == 'true' && L.session.meta.isActive && !L.session.meta.isReviewMode && !L.r.isAutoplayStarted().value() && !L.isSkippingCandles) {
            var analysisTime = L.session.meta.analysisTimes.find(at => at.analysisStartTime == L.session.currentDate);
            if(!analysisTime) {
                analysisTime = {
                    analysisDuration: 0,
                    analysisTimespan: "00:00",
                    analysisStartTime: L.session.currentDate
                };

                L.session.meta.analysisTimes.unshift(analysisTime);
            } else {
                L.session.meta.totalAnalysisTime = (L.session.meta.totalAnalysisTime || 0) + 0.11;
                if(L.session.meta.totalAnalysisTime > 3600) {
                    L.session.meta.totalAnalysisTime = 0;
                    L.messageBox("Overtrading", "You have been analyzing for over 1 hour. Please consider a break to avoid overtrading.");
                }
                if(analysisTime.analysisDuration < 3600) {
                    analysisTime.analysisDuration += 0.11;
                }
                analysisTime.analysisTimespan = L.formatTimestamp(parseInt(analysisTime.analysisDuration));
            }

            $(".ebacktesting-session-analysis-timer").text("Analysis time: " + (analysisTime.analysisTimespan || "00:00"));
        }
    }, 100);

    TradingViewApi.onActiveChartChanged().subscribe(null, () => {
        setTimeout(() => {
            L.createReplayTimestampUI();
            $("#eBacktestingCurrentDate").text(L.toTradingViewDateTimeFormat(L.r.currentDate().value(), window.TradingViewApi.activeChart().getTimezone()));
        }, 200);
    });
    
    TradingViewApi.onActiveChartChanged().fire();

    $(document).on("mousemove.initui", (e) => {
        const controls = $(".backtesting-replay-controls");

        if (!controls.attr("isDragging")) return;

        let deltaX = e.clientX - Number(controls.attr("startX"));
        let newLeft = Number(controls.attr("startLeft")) + deltaX;

        const maxLeft = $("div[class*='seriesControlWrapper']").position().left - controls.width();

        controls.css("left", newLeft + "px");
        if (controls.position().left > maxLeft) {
            controls.css("left", maxLeft + "px");
        }

        if (controls.position().left < 0) {
            controls.css("left", "0px");
        }
    });

    $(document).on("mouseup.initui", () => {
        const controls = $(".backtesting-replay-controls");
        if (controls.attr("isDragging")) {
            controls.removeAttr("isDragging");
            $(".drag-handle").css("cursor", "grab");
        }
    });

    $(document).on("keyup.initui", async (event) => {
        if (!(event.shiftKey && event.ctrlKey)) return;
        if(L.isTyping()) {
            return;
        }

        if (event.key === "ArrowRight") {
            $(".fast-forward-button").click();
        }
    });

    $(document).on("keydown.initui", async (event) => {
        if (event.key === " ") {
            if(L.isTyping()) {
                return;
            }
            
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    });

    L.r.isAutoplayStarted().subscribe((isAutoplayStarted) => {
        if(L.session.meta.forceStopPlayback) {
            $(".play-pause-button.play").show();
            $(".play-pause-button.pause").hide();
        }
        
        if (isAutoplayStarted || L.isSkippingCandles || L.session.meta.autoplayStarted) {
            $(".play-pause-button.play").hide();
            $(".play-pause-button.pause").show();
        } else {
            $(".play-pause-button.play").show();
            $(".play-pause-button.pause").hide();
        }
    })
}

L.createReplayTimestampUI = function () {
    if ($("#eBacktestingCurrentDate").length == 0) {
        const timeContainerDiv = $("div[.chart-toolbar] button.apply-common-tooltip[data-name='time-zone-menu'] div.js-button-text");

        if (timeContainerDiv.length) {
            $("<div>")
                .attr("id", "eBacktestingCurrentDate")
                .insertAfter(timeContainerDiv);
        } else {
            console.error("Current Time div not found!");
        }
    }
}