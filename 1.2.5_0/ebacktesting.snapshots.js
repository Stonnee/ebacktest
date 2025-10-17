import { L } from "./ebacktesting.core.js";

L.viewSnapshots = function (event, position) {
    if ($(`tr#ID_${position.positionId}`).hasClass("selected")) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }

    if (!position.positionSnapshots || position.positionSnapshots.length === 0) {
        return;
    }

    var preloadedImages = [];
    
    position.positionSnapshots.forEach((snapshot) => { 
        var img = new Image();
        img.src = `${L.snapshotUrlPrefix}${snapshot.snapshotUrl}`;
        preloadedImages.push(img);
    });

    let currentIndex = 0;
    let currentUrl = `${L.snapshotUrlPrefix}${position.positionSnapshots[currentIndex].snapshotUrl}`;

    function updateSnapshot() {
        currentUrl = `${L.snapshotUrlPrefix}${position.positionSnapshots[currentIndex].snapshotUrl}`;
        if (position.positionSnapshots.length === 0) {
            $(`.${L.s(4, -5) /* snapshot-viewer */}`).remove();
        } else {
            $(`.${L.s(4, -6) /* snapshot-viewer-image-container */} img`).attr("src", `${currentUrl}`);
        }
        $(`.${L.s(4, -7) /* snapshot-viewer-counter */}`).text(`${currentIndex + 1} / ${position.positionSnapshots.length}`);
        $(`.${L.s(4, -8) /* snapshot-viewer-info */} .${L.s(4, -9) /* snapshot-viewer-url */}`).text(currentUrl);
        $(`.${L.s(4, -8) /* snapshot-viewer-info */} .${L.s(5, -1) /* snapshot-viewer-time */}`).text(
            L.toTradingViewDateTimeFormat(
                position.positionSnapshots[currentIndex].sessionTime,
                window.TradingViewApi.activeChart().getTimezone()
            )
        );
        $(`#ID_${position.positionId}.V_POSITION`).find(`.${L.s(5, -2) /* view-snapshots-button */}`).attr(L.s(5, -3) /* data-snapshots */, position.positionSnapshots.length);
        $(`#ID_${position.positionId}.V_POSITION`).find(`.${L.s(5, -2) /* view-snapshots-button */}`).attr("title", L.s(5, -4, position.positionSnapshots.length > 1 ? position.positionSnapshots.length + " " : "", position.positionSnapshots.length > 1 ? "s" : "") /* View {0}snapshot{1} */);
    }

    const viewer = $(`
        <div class="${L.s(4, -5) /* snapshot-viewer */}">
            <button class="${L.s(5, -5) /* snapshot-viewer-button */} ${L.s(5, -6) /* snapshot-viewer-close-button */} lightButton secondary xsmall typography-regular14px" title="${L.s(-3, 1) /* Close */}">
                ${L.s(5, -7) /* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path stroke="currentColor" stroke-width="1.2" d="m1.5 1.5 15 15m0-15-15 15"></path></svg> */}
            </button>
            <div class="${L.s(4, -7) /* snapshot-viewer-counter */}">${currentIndex + 1} / ${position.positionSnapshots.length}</div>
            <button class="${L.s(5, -5) /* snapshot-viewer-button */} ${L.s(5, -8) /* snapshot-viewer-delete-button */} lightButton secondary xsmall typography-regular14px" title="${L.s(8, 0) /* Delete */}">
                ${L.s(5, -9) /* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" d="M12 4h3v1h-1.04l-.88 9.64a1.5 1.5 0 0 1-1.5 1.36H6.42a1.5 1.5 0 0 1-1.5-1.36L4.05 5H3V4h3v-.5C6 2.67 6.67 2 7.5 2h3c.83 0 1.5.67 1.5 1.5V4ZM7.5 3a.5.5 0 0 0-.5.5V4h4v-.5a.5.5 0 0 0-.5-.5h-3ZM5.05 5l.87 9.55a.5.5 0 0 0 .5.45h5.17a.5.5 0 0 0 .5-.45L12.94 5h-7.9Z"></path></svg> */}
            </button>
            <div class="${L.s(6, -1) /* snapshot-viewer-image-container */}">
                <img src="${currentUrl}" alt="${L.s(6, -2) /* Snapshot */}" />
            </div>
            <button class="${L.s(5, -5) /* snapshot-viewer-button */} ${L.s(6, -3) /* snapshot-viewer-nav-button */} ${L.s(6, -4) /* snapshot-viewer-prev */} lightButton secondary xsmall typography-regular14px" title="${L.s(6, -7) /* Previous */}">
                ${L.s(6, -5) /* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-width="1.2" d="M17 22.5 6.85 12.35a.5.5 0 0 1 0-.7L17 1.5"></path></svg> */}
            </button>
            <div class="${L.s(4, -8) /* snapshot-viewer-info */}">
                <span class="${L.s(4, -9) /* snapshot-viewer-url */}" contenteditable>${currentUrl}</span>
                <button class="${L.s(5, -5) /* snapshot-viewer-button */} ${L.s(6, -6) /* snapshot-viewer-copy-url */} lightButton secondary xsmall typography-regular14px" title="${L.s(6, -8) /* Copy chart link */}">
                    ${L.s(6, -9) /* <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><g fill="none" fill-rule="evenodd" stroke="currentColor"><path d="M13.111 18.5H10.5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-8.389z"></path><path d="M18.5 20v1.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H8"></path></g></svg> */}
                </button>
                <br />
                <span class="${L.s(7, -1) /* snapshot-viewer-time */}">${L.toTradingViewDateTimeFormat(position.positionSnapshots[currentIndex].sessionTime, window.TradingViewApi.activeChart().getTimezone())}</span>
            </div>
            <button class="${L.s(5, -5) /* snapshot-viewer-button */} ${L.s(6, -3) /* snapshot-viewer-nav-button */} ${L.s(7, -2) /* snapshot-viewer-next */} lightButton secondary xsmall typography-regular14px" title="Next">
                ${L.s(7, -3) /* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none"><g transform="scale(-1,1) translate(-24,0)"><path stroke="currentColor" stroke-linecap="round" stroke-width="1.2" d="M17 22.5 6.85 12.35a.5.5 0 0 1 0-.7L17 1.5"></path></g></svg> */}
            </button>
        </div>
    `);

    viewer.on("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        viewer.find(`.${L.s(5, -6) /* snapshot-viewer-close-button */}`).click();
    });

    viewer.find(`.${L.s(5, -6) /* snapshot-viewer-close-button */}`).on("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        viewer.remove();
        $(document).off(`keydown.${L.s(4, -5) /* snapshot-viewer */}`); // Remove keydown listener when viewer is closed
    });

    viewer.find(`.${L.s(5, -8) /* snapshot-viewer-delete-button */}`).on("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        position.positionSnapshots.splice(currentIndex, 1);
        L.dataOps.setPositionSnapshots(position.positionId, position.positionSnapshots);

        if (position.positionSnapshots.length === 0) {
            viewer.remove();
            $(document).off(`keydown.${L.s(4, -5) /* snapshot-viewer */}`); // Remove keydown listener when viewer is closed
        } else {
            currentIndex = Math.min(currentIndex, position.positionSnapshots.length - 1);
        }

        updateSnapshot();
    });

    viewer.find(`.${L.s(6, -4) /* snapshot-viewer-prev */}`).on("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        if (currentIndex > 0) {
            currentIndex--;
        } else {
            currentIndex = position.positionSnapshots.length - 1; // Cycle to the last snapshot
        }
        updateSnapshot();
    });

    viewer.find(`.${L.s(7, -2) /* snapshot-viewer-next */}`).on("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        if (currentIndex < position.positionSnapshots.length - 1) {
            currentIndex++;
        } else {
            currentIndex = 0; // Cycle to the first snapshot
        }
        updateSnapshot();
    });

    viewer.find(`.${L.s(4, -9) /* snapshot-viewer-url */}`).on("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    });

    // Copy URL button logic
    viewer.find(`.${L.s(6, -6) /* snapshot-viewer-copy-url */}`).on('click', async function(event){
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        try {
            const text = viewer.find(`.${L.s(4, -9) /* snapshot-viewer-url */}`).text().trim();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback using temporary textarea
                const ta = document.createElement('textarea');
                ta.value = text; document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); document.body.removeChild(ta);
            }
            const btn = $(this);
            const originalTitle = btn.attr('title');
            btn.attr('title', L.s(7, -4) /* Copied! */);
            btn.addClass('copied');
            // Optional quick visual feedback
            btn.css({ outline:'2px solid #26c6da'});
            setTimeout(()=>{ btn.attr('title', originalTitle); btn.removeClass('copied'); btn.css({ outline:'none'}); }, 1200);
        } catch(_e) {
            L.messageBox(L.s(7, -5) /* Copy failed */, L.s(7, -6) /* Could not copy snapshot URL to clipboard. */);
        }
    });

    // Add keydown listener for left/right arrow keys
    $(document).on(`keydown.${L.s(4, -5) /* snapshot-viewer */}`, function (e) {
        if (e.key === L.s(7, -7) /* ArrowLeft */) {
            viewer.find(`.${L.s(6, -4) /* snapshot-viewer-prev */}`).click();
        } else if (e.key === L.s(7, -8) /* ArrowRight */) {
            viewer.find(`.${L.s(7, -2) /* snapshot-viewer-next */}`).click();
        } else if (e.key === L.s(7, -9) /* Escape */) {
            viewer.find(`.${L.s(5, -6) /* snapshot-viewer-close-button */}`).click();
        } else if (e.key === L.s(8, -1) /* Delete */) {
            viewer.find(`.${L.s(5, -8) /* snapshot-viewer-delete-button */}`).click();
        }
    });

    $("body").append(viewer);
}

L.takeSnapshot = async function (position, withDate) {
    var takeSnapshotButton = $(`#ID_${position.positionId}.V_POSITION`).find(`.take-snapshot-button`);
    var takeSnapshotLoader = $(`#ID_${position.positionId}.V_POSITION`).find(".take-snapshot-loader");
    takeSnapshotButton.hide();
    takeSnapshotLoader.show();

    setTimeout(async () => {
        const formattedSessionDate = $("#eBacktestingCurrentDate").text();
        var infoTextShapeId = null;
        if (withDate) {
            infoTextShapeId = await TradingViewApi.activeChart().createAnchoredShape({ x: 0.005, y: 0.93 }, { shape: "anchored_text", text: `eBacktesting date: ${formattedSessionDate}`, overrides: { color: "white", backgroundColor: "rgb(0,0,0)", backgroundTransparency: 1, fillBackground: true, fontsize: 14 } })
        }
        const snapshotUrl = await window.TradingViewApi.takeScreenshot();
        if(infoTextShapeId) {
            L.removeShapeById(infoTextShapeId);
        }
        position.positionSnapshots.push({ snapshotUrl, sessionTime: L.session.currentDate });
        L.dataOps.setPositionSnapshots(position.positionId, position.positionSnapshots);

        var viewSnapshostButton = $(`#ID_${position.positionId}.V_POSITION`).find(".view-snapshots-button");
        viewSnapshostButton.attr("data-snapshots", position.positionSnapshots.length);
        viewSnapshostButton.attr("title", `View ${position.positionSnapshots.length > 1 ? position.positionSnapshots.length + " " : ""}snapshot${position.positionSnapshots.length > 1 ? "s" : ""}`);

        setTimeout(() => {
            takeSnapshotButton.show();
            takeSnapshotLoader.hide();
        }, 300);

        L.tryExec(() => navigator.clipboard.writeText(`${L.snapshotUrlPrefix}${snapshotUrl}`), true);
    }, 10);
}

L.onTakeSnapshot = async function (event, position) {
    if ($(`tr#ID_${position.positionId}`).hasClass("selected")) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }

    await L.takeSnapshot(position, event.ctrlKey);
}