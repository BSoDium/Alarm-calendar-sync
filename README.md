# Alarm-calendar-sync
A Google Apps script to synchronize your morning alarm with google calendar events.

## Installation
### GAS set-up
- Open the [Google Apps Script](https://script.google.com/d/11-gCfERHjbam21k4B-F7VoZXc2VGVAfKADewRTEYQiae2ooDZ6M-cWP-/edit?usp=sharing) project
- Go to the `overview` tab
- Fork the project (click the `Make a copy` button, in the top right corner)
- Tweak the settings in the file `Settings.gs` (cf Settings explanation below)
- Open `Code.gs`, select the function `install` in the top bar, and click on `▶️ Run`
- Click on `Review permissions` in the `Authorization required` popup
- Select your google account in the list that appears
- You should get a "Google hasn't verified this app" warning, just ignore it by clicking on `Advanced`
- Click on `Go to {Your copy's name} (unsafe)`
- Click on Allow
- The script should now be set up

### Phone set-up
- Download [macroDroid](https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid&hl=en&gl=US) or equivalent from the play store
- Create a new macro
- Add a new `Event starts` trigger
- Select the correct calendar (the one containing the alarms)
- Provide the event's title (optional if you're using a separate calendar)
- Add a new `Set Alarm` action
- Set the Alarm type to One off and the Alarm time to Relative
- Set the Time until alarm to 1 minute (minimum, as zero will schedule the alarm for the following day)

Congrats, your alarms are now successfully synced 👏

## Settings

Setting|Type|Description
:----|:-------------|:----
eventCalendarName|string|name of the calendar containing your events (used to schedule your alarms)
alarmCalendarName|string|name of the calendar which will contain the alarms (can be the same as the previous one)
timeZone|string|your timezone (you can check your timezone at https://en.wikipedia.org/wiki/List_of_tz_database_time_zones, `TZ database name` column)
daysInAdvance|unsigned Integer|number of days for which the alarms will be constantly synced, starting with the current day
targetSleepTime|unsigned Integer|optimal sleep time, if no event prevents you from achieving it, and if the maxWakeUpTime is too early for it to be reached, the maxWakeUpTime will be ignored, and the absoluteMaxWakeUpTime will be used instead
delayAlarm|signed Integer|time in minutes (signed int) by which each alarm will be delayed
forceUpdate|boolean|disable update skip, usefull if you have updated these settings, but haven't actually changed your calendar (by default, if the calendar hasn't been modified, the event isn't updated for performance reasons)
maxWakeUpTime|{hours : unsigned Integer, minutes: unsigned Integer }|max wake up time when going to bed early (no late night events scheduled) - military time format
absoluteMaxWakeUpTime|{hours : unsigned Integer, minutes: unsigned Integer }|max wake up time when going to bed late (late night events scheduled) - military time format
timeBeforeEvent|(eventTitle: string) => Float|duration in hours (positive float) between the first event of the day and the time of waking up. Can depend on the event's title, which is why it is a function
event|{summary: string, description: string}|event details
