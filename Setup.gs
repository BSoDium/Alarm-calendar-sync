/**
 * Setup the triggers and install the app on the current google account.
 */
function install() {
  deleteAllTriggers();

  const resetDate = new Date();
  resetDate.setHours(24, 0, 0, 0);

  eventCalendar = initCalendar(jsonSettings.eventCalendarName);
  alarmCalendar = initCalendar(jsonSettings.alarmCalendarName);

  ScriptApp.newTrigger("main")
    .forUserCalendar(eventCalendar.getId())
    .onEventUpdated()
    .create();
  ScriptApp.newTrigger("main")
    .forUserCalendar(alarmCalendar.getId())
    .onEventUpdated()
    .create();
  ScriptApp.newTrigger("main").timeBased().after(1).create();
  ScriptApp.newTrigger("reset")
    .timeBased()
    .atHour(0)
    .nearMinute(0)
    .everyDays(1)
    .create();
  Logger.log("Installation complete.");
}

/**
 * Fully uninstall the app.
 */
function uninstall() {
  deleteAllTriggers();
  Logger.log("Uninstallation complete.");
}
