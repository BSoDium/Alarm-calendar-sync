
/**
 * Compute and create the wake up event associated with the provided date.
 */
function compute(targetCalendar, currentDate, previousId=null) {
  let previousDate = new Date(currentDate); 
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateEvents = targetCalendar.getEventsForDay(previousDate);
  const currentDateEvents = targetCalendar.getEventsForDay(currentDate);
  let lastEvent = previousDateEvents[previousDateEvents.length - 1];
  let firstEvent = currentDateEvents[0];
  if (lastEvent?.getId() == firstEvent?.getId()) { // detect multi-day events
    lastEvent = currentDateEvents[0];
    firstEvent = currentDateEvents[1];
  } else if (firstEvent?.getTag('Origin') == 'AlarmSync') {
    firstEvent = currentDateEvents[1];
  }

  const maxWakeUpDate = new Date(currentDate);
  maxWakeUpDate.setHours(jsonSettings.maxWakeUpTime.hours);
  maxWakeUpDate.setMinutes(jsonSettings.maxWakeUpTime.minutes);

  let timestamps = {
    start: firstEvent?.getStartTime() || new Date(`${currentDate.getFullYear()}-${currentDate.getMonth}-${currentDate.getDate()}T${jsonSettings.maxWakeUpTime.hours}:${jsonSettings.maxWakeUpTime.minutes}:00`),
    end: null,
  };

  // calculate optimal wake up time
  timestamps = getOptimal(timestamps, firstEvent, lastEvent, maxWakeUpDate);

  let event;
  if (previousId) { // event already present
    event = updateEvent(targetCalendar, previousId, jsonSettings.event.summary, timestamps.start, timestamps.end, jsonSettings.event.description, "Home");
  } else {
    event = createEvent(targetCalendar, jsonSettings.event.summary, timestamps.start, timestamps.end, jsonSettings.event.description, "Home", false);
    event.addPopupReminder(0);
    event.setColor("1");
  }
  return event;
}

/**
 * Get the optimal timestamps for a day's wake up event.
 */
function getOptimal(timestamps, firstEvent, lastEvent, maxWakeUpDate) {
  const absoluteMaxWakeUpTime = new Date(firstEvent.getStartTime());
  absoluteMaxWakeUpTime.setHours(jsonSettings.absoluteMaxWakeUpTime.hours);
  absoluteMaxWakeUpTime.setMinutes(jsonSettings.absoluteMaxWakeUpTime.minutes);
  
  if (timestamps.start > maxWakeUpDate) { // wake up time is over maximum
    const timeSlept = (maxWakeUpDate - lastEvent?.getEndTime()) / 1000 / 60 / 60;

    if (timeSlept && timeSlept < jsonSettings.targetSleepTime) { // if the time slept is insufficient, override maximum wake up time constraint to match minimum between optimal sleep time 
                                                                 // and first event of the day
      timestamps.start.setHours(lastEvent.getEndTime().getHours() + Math.trunc(jsonSettings.targetSleepTime));
      timestamps.start.setMinutes(lastEvent.getEndTime().getMinutes() + jsonSettings.targetSleepTime % 1 * 60);
      timestamps.start = new Date(Math.min(Math.min(timestamps.start, firstEvent.getStartTime()), absoluteMaxWakeUpTime));
    } else { // else set the wake up time to the max allowed
      timestamps.start.setHours(jsonSettings.maxWakeUpTime.hours);
      timestamps.start.setMinutes(jsonSettings.maxWakeUpTime.minutes);
    }
  } else {
    timestamps.start.setHours(timestamps.start.getHours() - Math.trunc(jsonSettings.timeBeforeEvent(firstEvent.getTitle())));
    timestamps.start.setMinutes(timestamps.start.getMinutes() - jsonSettings.timeBeforeEvent(firstEvent.getTitle()) % 1 * 60);
  }
  // apply delay
  timestamps.start.setMinutes(timestamps.start.getMinutes() + jsonSettings.delayAlarm);
  // copy to end date, with a 25 minutes duration (minimum for macrodroid to work)
  timestamps.end = new Date(timestamps.start);
  timestamps.end.setMinutes(timestamps.start.getMinutes() + 25);
  return timestamps;
}


/**
 * Create an event on the calendar.
 */
function createEvent(targetCalendar, summary, startDate, endDate, description=null, location=null, sendInvites=true) {
  const event = targetCalendar.createEvent(summary,
    startDate,
    endDate,
    {location,
    description,
    sendInvites});
  event.setTag('Origin', 'AlarmSync');
  return event;
}

/**
 * Update an event on the calendar, using its Id.
 */
function updateEvent(targetCalendar, eventId, summary, startDate, endDate, description=null, location=null) {
    const event = targetCalendar.getEventById(eventId);
    if (!targetCalendar.getEventsForDay(event.getStartTime()).map(event => event.getId()).includes(eventId)) { // event deleted
      {
        Logger.error(`Failed to update event ${eventId}.`);
        throw Error("UpdateEvent failed to run.");
      }
    }
    if (event.getTitle() !== summary)
      event.setTitle(summary);
    if (event.getStartTime() !== startDate || event.getEndTime() != endDate)
      event.setTime(startDate, endDate);
    if (event.getDescription() !== description)
      event.setDescription(description);
    if (event.getLocation() !== location)
      event.setLocation(location);
}

/**
 * Remove all triggers for the script's 'main' function.
 */
function deleteAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() == "main" | triggers[i].getHandlerFunction() == "midnightReset") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * Initialize a property, if needed.
 */
function initProperty(key, init) {
  const scriptProperties = PropertiesService.getScriptProperties();
  if (!scriptProperties.getProperty(key)) {
    scriptProperties.setProperty(key, init);
  }
  return scriptProperties.getProperty(key);
}