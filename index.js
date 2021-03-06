import {AppState, NativeEventEmitter, NativeModules, Platform} from 'react-native';

const {RNEstimote} = NativeModules;

let isAppInForeground = true;
let currentAppState = "";

/* only iOS issue, when start 2 estimote proximity observer (foreground & backend),
*  even foreground observer called stop() , the listener call back still be invoked.
*  so we check the app state here, only app is foreground allow invoke the beacon received event.
*/
let handleAppStateChange = (nextAppState) => {
    if (currentAppState.match(/inactive|background/) && nextAppState === 'active')
        isAppInForeground = true;
    else
        isAppInForeground = false;

    currentAppState = nextAppState;
}

const Estimote = {
    addOnEnterEventListener: function (callback) {
        new NativeEventEmitter(RNEstimote).addListener('RNEstimoteEventOnEnter', (data) => {
            if(!isAppInForeground)
                return;

            for(let payload of data) {
                let beaconCode = payload.uid;
                if (onEnterEventQueue.shouldCodeInvokeCallback(beaconCode)) {
                    callback(payload);
                }
                onEnterEventQueue.heardCode(beaconCode);
            }
        });

    },

    addOnLeaveEventListener: function (callback) {
        new NativeEventEmitter(RNEstimote).addListener('RNEstimoteEventOnLeave', (data) => {
            if(!isAppInForeground)
                return;

            let beaconCode = data.uid;
            if (onLeaveEventQueue.shouldCodeInvokeCallback(beaconCode)) {
                callback(data);
            }
            onLeaveEventQueue.heardCode(beaconCode);
        });
    },

    isUseLegacySDK: function () {
        if (Platform.OS === "android") {
            return RNEstimote.isUseLegacySDK();
        } else {
            return false;
        }
    },

    init: function (appId, appToken, detectDistances) {
        RNEstimote.init(appId, appToken, detectDistances);
        currentAppState = AppState.currentState;
        AppState.addEventListener('change', handleAppStateChange);
    },

    start: function () {
        RNEstimote.start();
    },

    stop: function () {
        RNEstimote.stop();
    },

    isSupportIOSProximityEstimoteSDK: function () {
        if (Platform.OS === "ios") {
            return RNEstimote.isSupportIOSProximityEstimoteSDK();
        }
    },
};

/*
  FIFO queue with <key: signal code of a beacon, value: time it is heard>
  with the following rule of message removal:
  - The oldest entry would be removed as new value enters.
  - Stale element older than x {timeToLive, default=60000ms} seconds would be removed
  This is to prevent event emitter from being called too many times in succession
 */
class CodeHeardQueue {
    /**
     * @param {int} timeToLive
     */
    constructor({timeToLive = 60000} = {}) {
        this._timeToLive = timeToLive;
        this._queue = new Map();
    }

    _cleanQueue() {
        //- clean old element if it has lived pass its TTL
        let now = new Date();
        for (let [code, timeUpdated] of this._queue) {
            if ((now - timeUpdated) > this._timeToLive) {
                this._queue.delete(code);
            }
        }
    }

    /**
     * @param {string} beaconCode
     * @param {Date} timeHeard
     */
    _put({beaconCode, timeHeard}) {
        this._queue.set(beaconCode, timeHeard);
        this._cleanQueue();
    }

    /**
     * Determine if code heard should be invoked to callback, by checking:
     * - if entries in queue (which is not stale/old) don't contain that code
     */
    shouldCodeInvokeCallback(beaconCode) {
        this._cleanQueue();
        return !this._queue.has(beaconCode);
    }

    heardCode(beaconCode) {
        this._put({
            beaconCode: beaconCode,
            timeHeard: new Date(),
        });
    }

    /**
     * @param ttl - time to live in ms
     */
    setTimeToLive = (ttl) => {
        this._timeToLive = ttl;
    }
}


//Global codeHeardQueue
export const onEnterEventQueue = new CodeHeardQueue();
export const onLeaveEventQueue = new CodeHeardQueue();

export default Estimote;
