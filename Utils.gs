/**
 * Compute and create the wake up event associated with the provided date.
 */
function compute(targetCalendar, currentDate, previousId=null) {
  let previousDate = new Date(currentDate); 
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateEvents = targetCalendar.getEventsForDay(previousDate);
  const currentDateEvents = targetCalendar.getEventsForDay(currentDate);
  let lastPreviousEvent = previousDateEvents[previousDateEvents.length - 1];
  let firstEventOfDayIndex = 0;
  let firstEventOfDay = currentDateEvents[firstEventOfDayIndex];

  if (lastPreviousEvent?.getId() == firstEventOfDay?.getId()) { // detect multi-day events
    lastPreviousEvent = currentDateEvents[0];
    firstEventOfDayIndex = 1;
    firstEventOfDay = currentDateEvents[firstEventOfDayIndex];
  }
  while (firstEventOfDay?.getTitle() == jsonSettings.event.summary || firstEventOfDay.isAllDayEvent()) { // don't take alarms into account
    firstEventOfDayIndex++;
    firstEventOfDay = currentDateEvents[firstEventOfDayIndex];
  }

  const maxWakeUpDate = new Date(currentDate);
  maxWakeUpDate.setHours(jsonSettings.maxWakeUpTime.hours);
  maxWakeUpDate.setMinutes(jsonSettings.maxWakeUpTime.minutes);

  let timestamps = {
    start: firstEventOfDay?.getStartTime() || new Date(`${currentDate.getFullYear()}-${currentDate.getMonth}-${currentDate.getDate()}T${jsonSettings.maxWakeUpTime.hours}:${jsonSettings.maxWakeUpTime.minutes}:00`),
    end: null,
  };

  

  let event;
  if (previousId) { // event already present
    const gevent = Calendar.Events.get(targetCalendar.getId(), previousId);

    // calculate optimal wake up time if necessary
    const recorded = {
      endOfPrevious : gevent.extendedProperties.private.endOfPrevious,
      startOfDay : gevent.extendedProperties.private.startOfDay
    }
    if (recorded.endOfPrevious != lastPreviousEvent.getStartTime().toISOString() || recorded.startOfDay != firstEventOfDay.getStartTime().toISOString() || jsonSettings.forceUpdate) {
      timestamps = getOptimal(timestamps, firstEventOfDay, lastPreviousEvent, maxWakeUpDate);
      event = updateEvent(
        targetCalendar,
        lastPreviousEvent,
        firstEventOfDay,
        previousId,
        gevent,
        jsonSettings.event.summary, 
        timestamps.start, 
        timestamps.end, 
        jsonSettings.event.description, 
        "Home", 
        "transparent",
        {
          useDefault: false, 
          overrides: [
            ]
        }
      );
    } else {
      Logger.log("Parameters unchanged, update skipped.");
    }
    
  } else {
    // calculate optimal wake up time
    timestamps = getOptimal(timestamps, firstEventOfDay, lastPreviousEvent, maxWakeUpDate);
    event = createEvent(
      targetCalendar,
      lastPreviousEvent,
      firstEventOfDay,
      jsonSettings.event.summary, 
      timestamps.start, 
      timestamps.end, 
      jsonSettings.event.description, 
      "Home",
      "transparent",
      {
        useDefault: false, 
        overrides: [
          ]
      }
    );
  }
  return event;
}

/**
 * Get the optimal timestamps for a day's wake up event.
 */
function getOptimal(timestamps, firstEventOfDay, lastPreviousEvent, maxWakeUpDate) {
  const absoluteMaxWakeUpTime = new Date(firstEventOfDay.getStartTime());
  absoluteMaxWakeUpTime.setHours(jsonSettings.absoluteMaxWakeUpTime.hours);
  absoluteMaxWakeUpTime.setMinutes(jsonSettings.absoluteMaxWakeUpTime.minutes);
  
  if (timestamps.start > maxWakeUpDate) { // wake up time is over maximum
    const timeSlept = (maxWakeUpDate - lastPreviousEvent?.getEndTime()) / 1000 / 60 / 60;

    if (timeSlept && timeSlept < jsonSettings.targetSleepTime) { // if the time slept is insufficient, override maximum wake up time constraint to match minimum between optimal sleep time 
                                                                 // and first event of the day
      timestamps.start.setHours(lastPreviousEvent.getEndTime().getHours() + Math.trunc(jsonSettings.targetSleepTime));
      timestamps.start.setMinutes(lastPreviousEvent.getEndTime().getMinutes() + jsonSettings.targetSleepTime % 1 * 60);
      timestamps.start = new Date(Math.min(Math.min(timestamps.start, firstEventOfDay.getStartTime()), absoluteMaxWakeUpTime));
    } else { // else set the wake up time to the max allowed
      timestamps.start.setHours(jsonSettings.maxWakeUpTime.hours);
      timestamps.start.setMinutes(jsonSettings.maxWakeUpTime.minutes);
    }
  } else {
    timestamps.start.setHours(timestamps.start.getHours() - Math.trunc(jsonSettings.timeBeforeEvent(firstEventOfDay.getTitle())));
    timestamps.start.setMinutes(timestamps.start.getMinutes() - jsonSettings.timeBeforeEvent(firstEventOfDay.getTitle()) % 1 * 60);
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
function createEvent(targetCalendar, lastPreviousEvent, firstEventOfDay, summary, startDate, endDate, description=null, location=null, transparency="opaque", reminders={useDefault: true, overrides: []}, colorId='1') {
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
    transparency
  };
  // generate digest
  event.extendedProperties = {
    private: {
      MD5: Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, recursiveToString(event)).toString(),
      generated: true,
      endOfPrevious: lastPreviousEvent.getStartTime().toISOString(),
      startOfDay: firstEventOfDay.getStartTime().toISOString()
    }
  }
  event = Calendar.Events.insert(event, targetCalendar.getId());
  Logger.log(`Created event ${event.getId()}.`);
  return event;
}

/**
 * Update an event on the calendar, using its Id.
 */
function updateEvent(targetCalendar, lastPreviousEvent, firstEventOfDay, eventId, gevent, summary, startDate, endDate, description=null, location=null, transparency="opaque", reminders={useDefault: true, overrides: []}, colorId='1') {
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
  };
  
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, recursiveToString(event)).toString();
  if (digest != gevent.extendedProperties.private.MD5 || gevent.status != 'confirmed') {
    event.extendedProperties = {
      private: {
        MD5: digest,
        generated: true,
        endOfPrevious: lastPreviousEvent.getStartTime().toISOString(),
        startOfDay: firstEventOfDay.getStartTime().toISOString()
      }
    };
    event = Calendar.Events.update(event, targetCalendar.getId(), gevent.getId());
    Logger.log(`Updated event ${eventId}.`);
    return event;
  }
  Logger.log(`Skipped event ${eventId}, no informations changed.`);
  return gevent;
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

/**
 * Recursively convert an object to a string.
 */
function recursiveToString(object, recurseCount=0) {
  if (recurseCount > 100) {
    throw Error('RecursiveToString has detected an infinite recursion, this is definitely not normal. Are you running this on a quantum computer ?');
  }
  return object.toString == Object.prototype.toString ? `{${Object.keys(object).map(key => `${key} : ${recursiveToString(object[key], recurseCount + 1)}`)}}` : object.toString();
}

