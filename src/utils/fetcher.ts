export async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, {
		headers: {
			Accept: 'application/json',
			'User-Agent': 'discord-api-fetcher/raw-bot',
		},
	});

	if (!response.ok) {
		throw new Error(`Request failed for ${url} with status ${response.status}`);
	}

	return response.json() as Promise<T>;
}
