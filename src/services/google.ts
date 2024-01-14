import {endOfToday} from "date-fns";

const CLIENT_ID = import.meta.env.MY_GOOGLE_CALENDAR_CLIENT_ID || "";
const API_KEY = import.meta.env.MY_GOOGLE_CALENDAR_API_KEY || "";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
const CALENDAR_IDS = (import.meta.env.MY_GOOGLE_CALENDAR_IDS || "").split(",");


export async function loadEvents() {
    await auth();
    const result = [];
    for (const calendarId of CALENDAR_IDS) {
        const events = await listTodayEvents(calendarId);
        result.push(...events);
    }
    result.sort((a, b) => {
        const aStart = a.start?.dateTime || "";
        const bStart = b.start?.dateTime || "";
        return aStart < bStart ? -1 : 0;
    });
    return result;
}

function getToken(): google.accounts.oauth2.TokenResponse | null {
    let data: any = window.localStorage.getItem("google_auth");
    if (data) {
        try {
            data = JSON.parse(data);
        } catch (e) {
        }
        if (!data.expires || data.expires <= Date.now()) {
            return null;
        }
        return data;
    }
    return null;
}

function saveToken(token: google.accounts.oauth2.TokenResponse) {
    // @ts-ignore
    token.expires = Date.now() + parseInt(token.expires_in) * 1000;
    window.localStorage.setItem("google_auth", JSON.stringify(token));
}

function loadScript(url: string) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.setAttribute("async", "false");
        script.setAttribute("src", url);
        script.onload = () => resolve(script);
        script.onerror = () => reject(new Error(`Script load error for ${url}`));
        document.head.appendChild(script);
    });
}

let inited = false;

function auth() {
    return new Promise<void>(async function (resolve, reject) {
        if (!CLIENT_ID || !API_KEY) {
            alert("Google Calendar API is not configured");
            reject();
            return;
        }
        if (inited) {
            createTokenClient(resolve, reject);
            return;
        }
        await loadScript("https://apis.google.com/js/api.js");
        await loadScript("https://accounts.google.com/gsi/client");

        gapi.load("client", async function () {
            await gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: [DISCOVERY_DOC],
            });
            inited = true;
            createTokenClient(resolve, reject);
        });
    });
}

function createTokenClient(resolve: () => void, reject: (err: any) => void) {
    const token = getToken();
    if (token) {
        gapi.client.setToken({access_token: token.access_token});
        resolve();
        return;
    }
    const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        error_callback: (error: google.accounts.oauth2.ClientConfigError) => {
            alert("Failed!");
            reject(error);
        },
        callback: (res: google.accounts.oauth2.TokenResponse) => {
            if (res.error !== undefined) {
                alert("Error!");
                throw res;
            }
            saveToken(res);
            resolve();
        },
    });
    tokenClient.requestAccessToken();
}

async function listTodayEvents(calendarId: string) {
    // Possible to use Batch:
    // https://github.com/google/google-api-javascript-client/blob/master/docs/reference.md#batch-api-requests
    let response;
    try {
        response = await gapi.client.calendar.events.list({
            calendarId: calendarId,
            timeMin: (new Date()).toISOString(),
            timeMax: endOfToday().toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            showDeleted: false,
            singleEvents: true,
            maxAttendees: 1,
        });
        console.debug(response);
    } catch (err) {
        console.error(err);
        return [];
    }

    return response.result.items as gapi.client.calendar.Event[];
}
