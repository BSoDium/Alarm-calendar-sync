// documentation : https://github.com/BSoDium/Alarm-calendar-sync#settings
const jsonSettings = {
  // eventCalendarName: "TestInput",
  eventCalendarName: "Main",
  // alarmCalendarName: "TestOutput",
  alarmCalendarName: "Alarms",
  timeZone: "Europe/Paris",
  daysInAdvance: 7,
  targetSleepTime: 7,
  delayAlarm: -1,
  forceUpdate: true,
  maxWakeUpTime: {
    hours: 8,
    minutes: 30,
  },
  absoluteMaxWakeUpTime: {
    hours: 12,
    minutes: 0,
  },
  timeBeforeEvent: (eventTitle) => {
    return eventTitle.match(/.*Sport.*/) ? 1.3 : 1;
  },
  event: {
    summary: "🔔 Wake up",
    description: "Come on get your ass up. You've slept enough.",
  },
};
