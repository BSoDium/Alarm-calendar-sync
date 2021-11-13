/**
 * Setup triggers and install the app on the current google account.
 */
function install() {
  deleteAllTriggers();

  const resetDate = new Date();
  resetDate.setHours(24, 0, 0, 0);

  ScriptApp.newTrigger("main").forUserCalendar(Session.getEffectiveUser().getEmail()).onEventUpdated().create();
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
function main() {
  const scriptProperties = PropertiesService.getScriptProperties();
  
  const targetCalendar = CalendarApp.getCalendarsByName(jsonSettings.calendarName)[0];
  Logger.log(`Working on calendar : ${targetCalendar.getName()} (${targetCalendar.getId()})`);

  // check for trigger chain reactions
  let lastRunDate = initProperty(jsonConst.properties.lastRun, new Date().toUTCString());
  let timeoutToken = initProperty(jsonConst.properties.timeoutToken, jsonConst.timeOutThreshold.toString());

  function updateLastRun() {
    lastRunDate = new Date().toUTCString();
    scriptProperties.setProperty(jsonConst.properties.lastRun, lastRunDate);
  }

  // avoid DDoSing google calendar
  if (new Date() - new Date(lastRunDate) < (jsonConst.timeOutDelay * 1000)) { // last run was less than timeOutDelay seconds ago
    if (parseInt(timeoutToken) <= 0) {
      // out of tokens
      Logger.log(`Run canceled, you're triggering to many reloads. Please try again in ${jsonConst.timeOutDelay} seconds`);
      // update last run date
      updateLastRun();
      return;
    }
    // consume one timeout token
    timeoutToken = (parseInt(timeoutToken) - 1).toString();
    scriptProperties.setProperty(jsonConst.properties.timeoutToken, timeoutToken);
    Logger.log(`timeout token : ${timeoutToken}`); // remove this in production
  } else {
    // reset the timeout token count
    scriptProperties.setProperty(jsonConst.properties.timeoutToken, jsonConst.timeOutThreshold.toString());
  }
  updateLastRun();

  // load stored eventIds
  let rawEventIds = initProperty(jsonConst.properties.history, '');
  let eventIds = rawEventIds.split(jsonConst.dbSeparator).filter(i => i);
  Logger.log(`Event Ids : [${eventIds.map((id) => (`"${id}"`))}]`)
  
  let currentDate = new Date();

  // update / create events for the next jsonSettings.daysInAdvance days
  try {
    for (let i = 0; i < jsonSettings.daysInAdvance; i++) {
      const event = compute(targetCalendar, currentDate, eventIds[i] || null);
      if (!eventIds[i]) {
        eventIds.push(event.getId());
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } catch (e) {
    Logger.log("An exception was encountered, terminating run.")
    Logger.log("Clearing events.");
    deleteByIds(targetCalendar, eventIds);
    Logger.log("Destroying event database.");
    resetEventIds();
    Logger.log("Restarting.")
    main();
    return;
  }

  rawEventIds = eventIds.join(jsonConst.dbSeparator);
  scriptProperties.setProperty(jsonConst.properties.history, rawEventIds);
}


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
 */
function midnightReset() {
  const targetCalendar = CalendarApp.getCalendarsByName(jsonSettings.calendarName)[0];
  let rawEventIds = initProperty(jsonConst.properties.history, '');
  let eventIds = rawEventIds.split(jsonConst.dbSeparator).filter(i => i);
  deleteByIds(targetCalendar, eventIds);
  resetEventIds();
  main();
}

/**
 * Reset history
 */
function resetEventIds() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty(jsonConst.properties.history, '');
}