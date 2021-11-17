/**
 * Setup triggers and install the app on the current google account.
 */
function install() {
  deleteAllTriggers();

  const resetDate = new Date();
  resetDate.setHours(24, 0, 0, 0);

  eventCalendar = initCalendar(jsonSettings.eventCalendarName);
  alarmCalendar = initCalendar(jsonSettings.alarmCalendarName);

  ScriptApp.newTrigger("main").forUserCalendar(eventCalendar.getId()).onEventUpdated().create();
  ScriptApp.newTrigger("main").forUserCalendar(alarmCalendar.getId()).onEventUpdated().create();
  ScriptApp.newTrigger("main").timeBased().after(1000).create();
  ScriptApp.newTrigger("midnightReset").timeBased().everyDays(1).create();
  ScriptApp.newTrigger("midnightReset").timeBased().at(resetDate).create();
  Logger.log("Installation complete.");
}

/**
 * Fully uninstall the app.
 */
function uninstall() {
  deleteAllTriggers();
  Logger.log("Uninstallation complete.");
}

/**
 * Create the wake up events for the following jsonSettings.daysInAdvance days.
 */
async function main(priority=0) {
  const scriptProperties = PropertiesService.getScriptProperties();

  // check for concurrent runs
  let concurrentRunFlag = initProperty(jsonConst.properties.concurrentRunFlag, '1'); // init flag as available
  if (concurrentRunFlag == '0' && priority == 0) { // if the flag is already held by another instance of the script
    Logger.log('Concurrent run disabled for consistency reasons. Run aborted.')
    return;
  } else if (priority == 1) { // if the run is marked as high priority, wait
    await awaitPropertyValue(jsonConst.properties.concurrentRunFlag, '1');
  }
  scriptProperties.setProperty(jsonConst.properties.concurrentRunFlag, '0'); // take flag before execution
  
  // load up calendars
  eventCalendar = initCalendar(jsonSettings.eventCalendarName);
  alarmCalendar = initCalendar(jsonSettings.alarmCalendarName);
  Logger.log(`Working on calendars : ${eventCalendar.getName()} (${eventCalendar.getId()}) and ${alarmCalendar.getName()} (${eventCalendar.getId()})`);

  // avoid DDoSing google calendar
  if (priority == 0) {
    let lastRunDate = initProperty(jsonConst.properties.lastRun, new Date().toUTCString());
    let timeoutToken = initProperty(jsonConst.properties.timeoutToken, jsonConst.timeOutThreshold.toString());
    function updateLastRun() {
      lastRunDate = new Date().toUTCString();
      scriptProperties.setProperty(jsonConst.properties.lastRun, lastRunDate);
    }
    if (new Date() - new Date(lastRunDate) < (jsonConst.timeOutDelay * 1000)) { // last run was less than timeOutDelay seconds ago
      if (parseInt(timeoutToken) <= 0) {
        // out of tokens
        Logger.log(`Run canceled, you're triggering to many reloads. Please try again in ${jsonConst.timeOutDelay} seconds`);
        // update last run date
        updateLastRun();
        scriptProperties.setProperty(jsonConst.properties.concurrentRunFlag, '1'); // hand back flag after execution
        return;
      }
      // consume one timeout token
      timeoutToken = (parseInt(timeoutToken) - 1).toString();
      scriptProperties.setProperty(jsonConst.properties.timeoutToken, timeoutToken);
      Logger.log(`timeout tokens remaining : ${timeoutToken}`); // remove this in production
    } else {
      // reset the timeout token count
      scriptProperties.setProperty(jsonConst.properties.timeoutToken, jsonConst.timeOutThreshold.toString());
    }
    updateLastRun();
  }

  // load stored eventIds
  let rawEventIds = initProperty(jsonConst.properties.history, '');
  let eventIds = rawEventIds.split(jsonConst.dbSeparator).filter(i => i);
  // Logger.log(`Event Ids : [${eventIds.map((id) => (`"${id}"`))}]`);
  
  // if the daysInAdvance setting was changed since the last run, perform a full reset
  if (eventIds.length && eventIds.length != jsonSettings.daysInAdvance) {
    scriptProperties.setProperty(jsonConst.properties.concurrentRunFlag, '1'); // hand back flag after execution
    midnightReset(false); 
    return;
  }

  let currentDate = new Date();

  // update / create events for the next jsonSettings.daysInAdvance days
  try {
    for (let i = 0; i < jsonSettings.daysInAdvance; i++) {
      const event = compute(currentDate, eventIds[i] || null);
      if (!eventIds[i]) {
        eventIds.push(event.getId());
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } catch (e) {
    Logger.log("An exception was encountered, terminating run.")
    Logger.log(e.msg);
    scriptProperties.setProperty(jsonConst.properties.concurrentRunFlag, '1'); // hand back flag after execution
    return;
  }

  rawEventIds = eventIds.join(jsonConst.dbSeparator);
  scriptProperties.setProperty(jsonConst.properties.history, rawEventIds);

  scriptProperties.setProperty(jsonConst.properties.concurrentRunFlag, '1'); // hand back flag after execution
}


/**
 * Delete the events whose ids are provided in idArray from the target calendar.
 */
function deleteByIds(targetCalendar, idArray) {
  idArray.forEach((id) => {
    try {
      targetCalendar.getEventById(id)?.deleteEvent();
    } catch {} // mute exceptions
  })
}

/**
 * Reset history, thus stopping the update daemon for the previous day,
 * then run the main function to reload the events. 
 * By default, the first event in the history db is kept
 * untouched, to destroy it too, set keepOldEvents to false.
 * 
 * Warning ! If you're calling this function from the main process, remember to hand back the concurrentRunFlag
 * beforehand.
 * 
 */
function midnightReset(keepOldEvents=true) {
  // load up alarm calendar
  alarmCalendar = initCalendar(jsonSettings.alarmCalendarName);
  let rawEventIds = initProperty(jsonConst.properties.history, '');
  let eventIds = rawEventIds.split(jsonConst.dbSeparator).filter(i => i);
  Logger.log("Deleting synchonized events.");
  deleteByIds(alarmCalendar, eventIds.slice(keepOldEvents ? 1 : 0));
  Logger.log("Destroying event database.");
  resetEventIds();
  Logger.log("Restarting.")
  main(1); // run with priority of 1 (high)
}

/**
 * Reset history
 */
function resetEventIds() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty(jsonConst.properties.history, '');
}

/**
 * Reset the concurrent run flag, use if the previous script 
 * was terminated without handing back its token.
 */
function resetConcurrentRunFlag() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty(jsonConst.properties.concurrentRunFlag, '1');
}