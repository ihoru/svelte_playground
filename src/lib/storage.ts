async function _fetch(path: string, body: any = null, params: object | null = null) {
    // @ts-ignore
    let searchParams = params && Object.keys(params).length ? new URLSearchParams(params).toString() : "";
    if (searchParams) {
        searchParams = "?" + searchParams;
    }
    const url = import.meta.env.MY_STORAGE_URL + path + searchParams;
    if (body && typeof body !== "string") {
        body = JSON.stringify(body);
    }
    const response = await fetch(url, {
        body: body,
        cache: "no-cache",
        // credentials: "include",
        method: body ? "POST" : "GET",
        mode: "cors",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "Planist",
        },
    });
    if (response.status === 304) {
        return;
    }
    if (!response.ok) {
        throw new Error(`Storage request failed (${response.status}): ${response.statusText}`);
    }
    const json = await response.json();
    if (!json.ok) {
        console.info("Storage response is not ok", json);
        return json;
    }
    return json;
}

export function get(key: string, timestamp: number | null = null) {
    return _fetch(key, null, {timestamp});
}

export function set(key: string, timestamp: number, oldTimestamp: number, value: any) {
    return _fetch(`${key}/${timestamp}`, value, {oldTimestamp});
}
