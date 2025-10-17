import { L } from "./ebacktesting.core.js";

L.initSessionChannel = async function() {
    L.sessionChannel = new BroadcastChannel(`ebacktesting-session-${L.session.sessionId}`);
    L.sessionChannel.onmessage = async function(event) {
        const data = event.data;
        if (data.type === 'DATE-SYNC' && 
            data.sessionId === L.session?.sessionId && 
            data.currentDate > L.session.currentDate) {
            
            await L.selectDateWithWarmup(data.currentDate);
            setTimeout(() => {
                L.tryExec(() => {L.ext.testStrats();}, true);
            }, 2000);
        }

        if (data.type === 'FAST-FORWARD' && 
            data.sessionId === L.session?.sessionId) {

            const selectedIntervalValue = Number($(".skip-intervals").val());
            await L.skipTime(selectedIntervalValue, false, 0);
        }

        L.tryExec(() => {L.ext.onSessionChannelMessage();}, true);
    };
}

$(document).on("keydown.sessionchannel", async (event) => {
    if (event.key === " ") {
        if(L.isTyping()) {
            return;
        }
        
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        
        if (L.session?.sessionId && L.session?.currentDate) {
            L.sessionChannel.postMessage({
                type: 'DATE-SYNC',
                sessionId: L.session.sessionId,
                currentDate: L.session.currentDate
            });
        }
    }

});