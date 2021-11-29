// documentation : https://github.com/l3alr0g/Alarm-calendar-sync#settings
const jsonSettings = {
  eventCalendarName: "Personal",
  alarmCalendarName: "Alarms",
  timeZone: 'Europe/Paris',
  daysInAdvance: 7,
  targetSleepTime: 7,
  delayAlarm: -1,
  forceUpdate : true,
  maxWakeUpTime: {
    hours: 8,
    minutes: 30
  },
  absoluteMaxWakeUpTime: {
    hours: 12,
    minutes: 0
  },
  timeBeforeEvent: (eventTitle) => {
    return eventTitle.match(/.*Sport.*/) ? 1.3 : 1
  },
  event: {
    summary: "🔔 Wake up",
    description: "⏰ Rise and shine, it's time to get out of bed !"
  },
}
