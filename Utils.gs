
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
  if (lastEvent?.getId() == firstEvent?.getId()) { // detect multi-day events TODO : refactor this to look nicer
    lastEvent = currentDateEvents[0];
    firstEvent = currentDateEvents[1];
    if (firstEvent?.getTitle() == jsonSettings.event.summary) {
      firstEvent = currentDateEvents[2];
    }
  } else if (firstEvent?.getTitle() == jsonSettings.event.summary) {
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
    event = updateEvent(
      targetCalendar, 
      previousId, 
      jsonSettings.event.summary, 
      timestamps.start, 
      timestamps.end, 
      jsonSettings.event.description, 
      "Home", 
      "transparent",
      {
        useDefault: false, 
        overrides: [
          {'method': 'popup', 'minutes': 0}
          ]
      }
    );
  } else {
    event = createEvent(
      targetCalendar, 
      jsonSettings.event.summary, 
      timestamps.start, 
      timestamps.end, 
      jsonSettings.event.description, 
      "Home",
      "transparent",
      {
        useDefault: false, 
        overrides: [
          {'method': 'popup', 'minutes': 0}
          ]
      }
    );
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
function createEvent(targetCalendar, summary, startDate, endDate, description=null, location=null, transparency="opaque", reminders = reminders={useDefault: true, overrides: []}, colorId='1') {
  let event = {
    start: {
      dateTime: startDate.toISOString(),
      timeZone: jsonSettings.timeZone
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: jsonSettings.timeZone
    },
    status: 'confirmed',
    colorId: '1',
    summary,
    description,
    location,
    reminders,
    colorId,
    transparency,
    extendedProperties: {
      private: {
        MD5: '', // not implemented yet
        generated: true
      }
    }
  };
  event = Calendar.Events.insert(event, targetCalendar.getId());
  // retrieve the CalendarEvent object to modify its Origin tag // TODO improve this
  Logger.log(`Successfully created event ${event.getId()}.`);
  return event;
}

/**
 * Update an event on the calendar, using its Id.
 */
function updateEvent(targetCalendar, eventId, summary, startDate, endDate, description=null, location=null, transparency="opaque", reminders = reminders={useDefault: true, overrides: []}, colorId='1') {
  const gevent = Calendar.Events.get(targetCalendar.getId(), eventId);
  let event = {
    start: {
      dateTime: startDate.toISOString(),
      timeZone: jsonSettings.timeZone
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: jsonSettings.timeZone
    },
    status: 'confirmed',
    colorId: '1',
    summary,
    description,
    colorId,
    location,
    reminders,
    transparency,
    extendedProperties: {
      private: {
        MD5: '', // not implemented yet
        generated: true
      }
    }
  };

  event = Calendar.Events.update(event, targetCalendar.getId(), gevent.getId());
  Logger.log(`Successfully updated event ${eventId}.`);
  return event;
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

