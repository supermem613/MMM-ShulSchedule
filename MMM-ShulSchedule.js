Module.register("MMM-ShulSchedule",{

	// Define module defaults
	defaults: {
		maximumNumberOfDays: 3,
		maxTitleLength: 25,
		fetchInterval: 14400000,
		animationSpeed: 2000,
		fade: false,
		timeFormat: "absolute",
		fadePoint: 0.25, // Start on 1/4th of the list.
		calendars: [
			{
				symbol: "calendar",
				url: "http://www.calendarlabs.com/templates/ical/US-Holidays.ics",
			},
		],
		excludedEvents: [
			{
				filterBy: "foo",
				regex: true,
			},
		],
	},

	// Define required scripts.
	getStyles: function() {
		return ["MMM-ShulSchedule.css", "font-awesome.css"];
	},

	// Define required scripts.
	getScripts: function() {
		return ["moment.js"];
	},

	// Define required translations.
	getTranslations: function() {
		// The translations for the defaut modules are defined in the core translation files.
		// Therefor we can just return false. Otherwise we should have returned a dictionairy.
		// If you're trying to build your own module including translations, check out the documentation.
		return false;
	},

	// Override start method.
	start: function() {
		Log.log("Starting module: " + this.name);

		// Set locale.
		moment.locale(config.language);

		for (var c in this.config.calendars) {
			var calendar = this.config.calendars[c];
			calendar.url = calendar.url.replace("webcal://", "http://");
			this.addCalendar(calendar.url);
		}

		this.calendarData = {};
		this.loaded = false;
	},

	// Override socket notification handler.
	socketNotificationReceived: function(notification, payload) {
		if (notification === "CALENDAR_EVENTS") {
			if (this.hasCalendarURL(payload.url)) {
				this.calendarData[payload.url] = payload.events;
				this.loaded = true;
			}
		} else if (notification === "FETCH_ERROR") {
			Log.error("Calendar Error. Could not fetch calendar: " + payload.url);
		} else if (notification === "INCORRECT_URL") {
			Log.error("Calendar Error. Incorrect url: " + payload.url);
		} else {
			Log.log("Calendar received an unknown socket notification: " + notification);
		}

		this.updateDom(this.config.animationSpeed);
	},

	// Override dom generator.
	getDom: function() {

		var events = this.createEventList();
		var wrapper = document.createElement("table");
		wrapper.className = "small";

		if (events.length === 0) {
			wrapper.innerHTML = (this.loaded) ? this.translate("EMPTY") : this.translate("LOADING");
			wrapper.className = "small dimmed";
			return wrapper;
		}

		var previousDay = "";

		for (var e in events) {
		    var event = events[e];

		    var eventWrapper = document.createElement("tr");
		    eventWrapper.className = "normal";

			var when = document.createElement("td");

			var day = moment(event.startDate, "x").format("dddd");

		    if (day != previousDay) {
		        when.innerHTML = day;
			    previousDay = day;
			}

    		eventWrapper.appendChild(when);

    		var blank1 = document.createElement("td");
    		blank1.innerHTML = "     ";

    		eventWrapper.appendChild(blank1);

			var titleWrapper = document.createElement("td");
			titleWrapper.innerHTML = event.title;
			titleWrapper.className = "title bright";
	
			eventWrapper.appendChild(titleWrapper);

			var blank2 = document.createElement("td");
			blank2.innerHTML = "     ";

			eventWrapper.appendChild(blank2);

			var timeWrapper = document.createElement("td");
			var hourMin = moment(event.startDate, "x").format("h:mm a");

			if (hourMin != "12:00 am") {
			    timeWrapper.innerHTML = hourMin;
			}

			timeWrapper.className = "time light";

			eventWrapper.appendChild(timeWrapper);

			wrapper.appendChild(eventWrapper);

			// Create fade effect.
			if (this.config.fade && this.config.fadePoint < 1) {
				if (this.config.fadePoint < 0) {
					this.config.fadePoint = 0;
				}
				var startingPoint = events.length * this.config.fadePoint;
				var steps = events.length - startingPoint;
				if (e >= startingPoint) {
					var currentStep = e - startingPoint;
					eventWrapper.style.opacity = 1 - (1 / steps * currentStep);
				}
			}
		}

		return wrapper;
	},

	/* hasCalendarURL(url)
	 * Check if this config contains the calendar url.
	 *
	 * argument url sting - Url to look for.
	 *
	 * return bool - Has calendar url
	 */
	hasCalendarURL: function(url) {
		for (var c in this.config.calendars) {
			var calendar = this.config.calendars[c];
			if (calendar.url === url) {
				return true;
			}
		}

		return false;
	},

	/* createEventList()
	 * Creates the sorted list of all events.
	 *
	 * return array - Array with events.
	 */
	createEventList: function() {
		var events = [];

		var one_second = 1000; // 1,000 milliseconds
		var one_minute = one_second * 60;
		var one_hour = one_minute * 60;
		var one_day = one_hour * 24;

		var today = moment().startOf("day");
		var rightNow = moment();
		for (var c in this.calendarData) {
			var calendar = this.calendarData[c];
			for (var e in calendar) {
			    var event = calendar[e];

				var excluded = false;
				
				for (var f in this.config.excludedEvents) {
					var filter = this.config.excludedEvents[f];
					var regexFlags = "g";

					if (!filter.caseSensitive) {
						regexFlags += "i";
					}

					if (filter.useRegex) {
						var regex = new RegExp(filter.filterBy, regexFlags);

						if (regex.test(event.title)) {
							excluded = true;
						}
					} else {
						if (event.title.includes(filter.filterBy)) {
							excluded = true;
						}
					}
				}
				
				if (!excluded) {
					if ((event.fullDayEvent &&
						event.startDate == today) ||
						((event.startDate >= rightNow) &&
						(event.startDate - today <= 2*one_day * this.config.maximumNumberOfDays))) {
						event.url = c;
						event.today = event.startDate >= today && event.startDate < (today + 24 * 60 * 60 * 1000);
						
						if (event.title.length > 30) {
							event.title = event.title.substring(0, 30) + "...";
						}

						events.push(event);
					}
				}
			}
		}

		events.sort(function(a, b) {
			return a.startDate - b.startDate;
		});

		return events;
	},

	/* createEventList(url)
	 * Requests node helper to add calendar url.
	 *
	 * argument url sting - Url to add.
	 */
	addCalendar: function(url) {
		this.sendSocketNotification("ADD_CALENDAR", {
			url: url,
			maximumNumberOfDays: this.config.maximumNumberOfDays,
			fetchInterval: this.config.fetchInterval
		});
	},

	/* symbolForUrl(url)
	 * Retrieves the symbol for a specific url.
	 *
	 * argument url sting - Url to look for.
	 *
	 * return string - The Symbol
	 */
	symbolForUrl: function(url) {
		for (var c in this.config.calendars) {
			var calendar = this.config.calendars[c];
			if (calendar.url === url && typeof calendar.symbol === "string")  {
				return calendar.symbol;
			}
		}

		return this.config.defaultSymbol;
	},
	/* countTitleForUrl(url)
	 * Retrieves the name for a specific url.
	 *
	 * argument url sting - Url to look for.
	 *
	 * return string - The Symbol
	 */
	countTitleForUrl: function(url) {
		for (var c in this.config.calendars) {
			var calendar = this.config.calendars[c];
			if (calendar.url === url && typeof calendar.repeatingCountTitle === "string")  {
				return calendar.repeatingCountTitle;
			}
		}

		return this.config.defaultRepeatingCountTitle;
	},

	/* shorten(string, maxLength)
	 * Shortens a sting if it's longer than maxLenthg.
	 * Adds an ellipsis to the end.
	 *
	 * argument string string - The string to shorten.
	 * argument maxLength number - The max lenth of the string.
	 *
	 * return string - The shortened string.
	 */
	shorten: function(string, maxLength) {
		if (string.length > maxLength) {
			return string.slice(0,maxLength) + "&hellip;";
		}

		return string;
	},
});

