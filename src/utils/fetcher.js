export async function fetchJson(url) {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'discord-api-fetcher/raw-bot',
        },
    });
    if (!response.ok) {
        throw new Error(`Request failed for ${url} with status ${response.status}`);
    }
    return response.json();
}
