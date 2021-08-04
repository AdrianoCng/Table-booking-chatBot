const functions = require("firebase-functions");
const { WebhookClient } = require("dialogflow-fulfillment");
const { google } = require("googleapis");

const calendarId = "j5p5eleapqasuhn3mmcpri47j8@group.calendar.google.com";
const serviceAccount = require("./serviceAccountKey.json");

const serviceAccountAuth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: "https://www.googleapis.com/auth/calendar"
});

// Google calendar API
const calendar = google.calendar("v3");

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    const agent = new WebhookClient({ request, response });

    // Parameters
    const { date, time } = agent.parameters;

    const makeAppointment = (agent) => {
        // Format date and time strings to extract the day and exact hour of the booking
        const day = date.split("T")[0];
        const hour = time.split("T")[1];

        const dateTimeStart = new Date(Date.parse(`${day}T${hour}`));
        // Add 1 hour from the event start
        const dateTimeEnd = new Date(new Date(dateTimeStart).setHours(dateTimeStart.getHours() + 1));

        // Check the availability of the time, and make an appointment if there is time on the calendar
        return createCalendarEvent(dateTimeStart, dateTimeEnd)
            .then((event) => {
                agent.add(`OK, I have booked a table on ${day} at ${hour.slice(0, 5)} and added to the calendar. See you then!`);
            })
            .catch((err) => {
                err.message === "No table" ? agent.add("Sorry, there is not slots available.") : agent.add("Sorry, I can not book a table for you");
            })
    }

    const intentsMap = new Map();

    intentsMap.set("reservation", makeAppointment);

    agent.handleRequest(intentsMap);
});

function createCalendarEvent(dateTimeStart, dateTimeEnd) {
    return new Promise((resolve, reject) => {
        calendar.events.list({
            auth: serviceAccountAuth,
            calendarId,
            timeMin: dateTimeStart.toISOString(),
            timeMax: dateTimeEnd.toISOString()
        }, (err, calendarResponse) => {
            if (err || calendarResponse.data.items.length > 0) {
                reject(err || new Error("No table"));
            } else {
                calendar.events.insert({
                    auth: serviceAccountAuth,
                    calendarId,
                    resource: {
                        summary: "table booked",
                        start: { dateTime: dateTimeStart },
                        end: { dateTime: dateTimeEnd }
                    }
                }, (err, event) => {
                    err ? reject(err) : resolve(event);
                })
            }
        })
    })
}