const jsonSettings = {
  calendarName: "Personal",
  timeZone: 'Europe/Paris',
  maxWakeUpTime: { // max wake up time when going to bed early (kinda)
    hours: 8,
    minutes: 30
  }, // military time format
  absoluteMaxWakeUpTime: { // max wake up time on special occasions (parties and stuff)
    hours: 12,
    minutes: 0
  },
  daysInAdvance: 7,
  targetSleepTime: 7, // hours
  timeBeforeEvent: (eventTitle) => {
    return eventTitle.match(/.*Sport.*/) ? 1.3 : 1
  }, // returns time in hours
  delayAlarm: -1, // minutes
  event: {
    summary: "⏰ Wake up",
    description: "🌞 Rise and shine, it's time to get out of bed 🚀"
  },
  forceUpdate : false
}