let eventCalendar;
let alarmCalendar;

/**
 * Compute and create the wake up event associated with the provided date.
 */
function compute(currentDate, previousId = null) {
  let previousDate = new Date(currentDate);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateEvents = eventCalendar.getEventsForDay(previousDate);
  const currentDateEvents = eventCalendar.getEventsForDay(currentDate);

  // lastPreviousEvent : event of the previous day with the highest end date
  let lastPreviousEvent = null;
  previousDateEvents.forEach((event) => {
    if (
      isEventShortEnough(event) &&
      !(event.getTitle() == jsonSettings.event.summary || event.isAllDayEvent())
    ) {
      if (
        (lastPreviousEvent &&
          event.getEndTime() > lastPreviousEvent.getEndTime()) ||
        !lastPreviousEvent
      )
        lastPreviousEvent = event;
    }
  });

  // firstEventOfDay : event of the current day with the lowest start date in the current day
  let firstEventOfDay = null;
  currentDateEvents.forEach((event) => {
    if (
      isEventShortEnough(event) &&
      event.getStartTime().getDate() == currentDate.getDate() &&
      !(event.getTitle() == jsonSettings.event.summary || event.isAllDayEvent())
    ) {
      if (
        (firstEventOfDay &&
          event.getStartTime() < firstEventOfDay?.getStartTime()) ||
        !firstEventOfDay
      )
        firstEventOfDay = event;
    }
  });

  // defaults
  const maxWakeUpDate = new Date(currentDate);
  maxWakeUpDate.setHours(jsonSettings.maxWakeUpTime.hours);
  maxWakeUpDate.setMinutes(jsonSettings.maxWakeUpTime.minutes);
  maxWakeUpDate.setSeconds(0);
  maxWakeUpDate.setMilliseconds(0);

  let timestamps;
  let event;
  if (previousId) {
    // event is already present
    const gevent = Calendar.Events.get(alarmCalendar.getId(), previousId);

    // calculate optimal wake up time if necessary
    const recorded = {
      endOfPrevious: gevent.extendedProperties.private.endOfPrevious,
      startOfDay: gevent.extendedProperties.private.startOfDay,
    };
    if (
      recorded.endOfPrevious !=
        (lastPreviousEvent?.getStartTime().toISOString() || "undefined") ||
      recorded.startOfDay !=
        (firstEventOfDay?.getStartTime().toISOString() || "undefined") ||
      jsonSettings.forceUpdate
    ) {
      timestamps = getOptimal(
        firstEventOfDay,
        lastPreviousEvent,
        maxWakeUpDate
      );
      event = updateEvent(
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
          overrides: [],
        }
      );
    } else {
      Logger.log("Parameters unchanged, update skipped.");
    }
  } else {
    // calculate optimal wake up time
    timestamps = getOptimal(firstEventOfDay, lastPreviousEvent, maxWakeUpDate);
    event = createEvent(
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
        overrides: [],
      }
    );
  }
  return event;
}

/**
 * Get the optimal timestamps for a day's wake up event.
 */
function getOptimal(firstEventOfDay, lastPreviousEvent, maxWakeUpDate) {
  // get absoluteMaxWakeUpDate as a variable
  const absoluteMaxWakeUpDate = new Date(maxWakeUpDate);
  absoluteMaxWakeUpDate.setHours(jsonSettings.absoluteMaxWakeUpTime.hours);
  absoluteMaxWakeUpDate.setMinutes(jsonSettings.absoluteMaxWakeUpTime.minutes);
  absoluteMaxWakeUpDate.setSeconds(0);
  absoluteMaxWakeUpDate.setMilliseconds(0);

  // Logger.log(lastPreviousEvent.getTitle())
  // Logger.log(firstEventOfDay.getTitle());

  const dayStart = firstEventOfDay?.getStartTime();

  // apply timeBeforeEvent to first event start time
  dayStart?.setHours(
    dayStart?.getHours() -
      Math.trunc(
        jsonSettings.timeBeforeEvent(firstEventOfDay?.getTitle() || "")
      )
  );
  dayStart?.setMinutes(
    dayStart?.getMinutes() -
      (jsonSettings.timeBeforeEvent(firstEventOfDay?.getTitle() || "") % 1) * 60
  );

  let timestamps = {
    start: dayStart ? new Date(Math.min(dayStart, maxWakeUpDate)) : maxWakeUpDate,
    end: null,
  };

  const timeSlept = lastPreviousEvent?.getEndTime()
    ? (timestamps.start - lastPreviousEvent?.getEndTime()) / 1000 / 60 / 60
    : jsonSettings.targetSleepTime;

  const idealWakeUpDate = new Date(lastPreviousEvent.getEndTime());
  idealWakeUpDate.setHours(
    lastPreviousEvent.getEndTime().getHours() +
      Math.trunc(jsonSettings.targetSleepTime)
  );
  idealWakeUpDate.setMinutes(
    lastPreviousEvent.getEndTime().getMinutes() +
      (jsonSettings.targetSleepTime % 1) * 60
  );

  if (timeSlept > jsonSettings.targetSleepTime) {
    // if the time slept is more than enough
    timestamps.start = new Date(
      Math.min(
        dayStart,
        absoluteMaxWakeUpDate,
        Math.max(idealWakeUpDate, maxWakeUpDate)
      )
    )
  } else {
    // if the time slept is insufficient
    timestamps.start = new Date(
      Math.min(
        dayStart, 
        idealWakeUpDate,
        absoluteMaxWakeUpDate
      )
    );
  } 

  // apply delay
  timestamps.start.setMinutes(
    timestamps.start.getMinutes() + jsonSettings.delayAlarm
  );
  // copy to end date, with a 25 minutes duration (minimum for macrodroid to detect the event)
  timestamps.end = new Date(timestamps.start);
  timestamps.end.setMinutes(timestamps.start.getMinutes() + 25);
  return timestamps;
}

/**
 * Create an event on the calendar.
 */
function createEvent(
  lastPreviousEvent,
  firstEventOfDay,
  summary,
  startDate,
  endDate,
  description = null,
  location = null,
  transparency = "opaque",
  reminders = { useDefault: true, overrides: [] },
  colorId = "0"
) {
  let event = {
    start: {
      dateTime: startDate.toISOString(),
      timeZone: jsonSettings.timeZone,
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: jsonSettings.timeZone,
    },
    status: "confirmed",
    colorId,
    summary,
    description,
    location,
    reminders,
    colorId,
    transparency,
  };
  // generate digest
  event.extendedProperties = {
    private: {
      MD5: Utilities.computeDigest(
        Utilities.DigestAlgorithm.MD5,
        recursiveToString(event)
      ).toString(),
      generated: true,
      endOfPrevious:
        lastPreviousEvent?.getStartTime().toISOString() || "undefined",
      startOfDay: firstEventOfDay?.getStartTime().toISOString() || "undefined",
    },
  };
  event = Calendar.Events.insert(event, alarmCalendar.getId());
  Logger.log(`Created event ${event.getId()}.`);
  return event;
}

/**
 * Update an event on the calendar, using its Id.
 */
function updateEvent(
  lastPreviousEvent,
  firstEventOfDay,
  eventId,
  gevent,
  summary,
  startDate,
  endDate,
  description = null,
  location = null,
  transparency = "opaque",
  reminders = { useDefault: true, overrides: [] },
  colorId = "0"
) {
  let event = {
    start: {
      dateTime: startDate.toISOString(),
      timeZone: jsonSettings.timeZone,
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: jsonSettings.timeZone,
    },
    status: "confirmed",
    colorId,
    summary,
    description,
    colorId,
    location,
    reminders,
    transparency,
  };

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    recursiveToString(event)
  ).toString();
  if (
    digest != gevent.extendedProperties.private.MD5 ||
    gevent.status != "confirmed"
  ) {
    event.extendedProperties = {
      private: {
        MD5: digest,
        generated: true,
        endOfPrevious:
          lastPreviousEvent?.getStartTime().toISOString() || "undefined",
        startOfDay:
          firstEventOfDay?.getStartTime().toISOString() || "undefined",
      },
    };
    event = Calendar.Events.update(
      event,
      alarmCalendar.getId(),
      gevent.getId()
    );
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
    if (
      (triggers[i].getHandlerFunction() == "main") |
      (triggers[i].getHandlerFunction() == "midnightReset")
    ) {
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
 * Create a calendar if needed, if not just return the existing one.
 */
function initCalendar(name, options = null) {
  let cal = CalendarApp.getCalendarsByName(name)[0];
  if (!cal) {
    Logger.log(`Creating calendar "${name}"`);
    return CalendarApp.createCalendar(name, options);
  }
  return cal;
}

/**
 * Recursively convert an object to a string.
 */
function recursiveToString(object, recurseCount = 0) {
  if (recurseCount > 100) {
    throw Error(
      "RecursiveToString has detected an infinite recursion, this is definitely not normal."
    );
  }
  return object.toString == Object.prototype.toString
    ? `{${Object.keys(object).map(
        (key) => `${key} : ${recursiveToString(object[key], recurseCount + 1)}`
      )}}`
    : object.toString();
}

/**
 * Wait for a property's value to equal the provided value.
 */
async function awaitPropertyValue(key, value, timeout = 100) {
  const scriptProperties = PropertiesService.getScriptProperties();
  Logger.log(`Waiting for property ${key} to equal ${value}.`);
  Logger.log(`"${scriptProperties.getProperty(key)}"   "${value}"`);
  while (scriptProperties.getProperty(key) != value) {
    await sleep(1000); // that does not seem to work
    timeout--;
    if (timeout <= 0) {
      throw Error(
        `Reached timeout when waiting for property ${key} to equal ${value}`
      );
    }
  }
  Logger.log("Condition verified.");
}

/**
 * Do I seriously need to comment on this one ?
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Is the event shorter than a day ?
 */
function isEventShortEnough(event) {
  return event
    ? (event.getEndTime() - event.getStartTime()) / 1000 / 60 / 60 < 24
    : true;
}
